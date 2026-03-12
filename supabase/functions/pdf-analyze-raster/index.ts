// Supabase Edge Function: Analyze PDF drawing with Claude Vision (Anthropic)
// Supports two modes:
// 1. Image-only (raster PDFs) — sends rendered image to Claude
// 2. Structured data + low-res image (vector PDFs) — sends extracted geometry data as primary source

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType, pageNumber, ocrContext, structuredData } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!CLAUDE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'CLAUDE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const detectedMime = mimeType || 'image/jpeg';
    const isVectorMode = !!structuredData;

    // Build system prompt based on mode
    const systemPrompt = isVectorMode
      ? buildVectorSystemPrompt()
      : buildRasterSystemPrompt();

    // Build user message content
    const userContent: any[] = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: detectedMime,
          data: imageBase64,
        },
      },
    ];

    const userPrompt = isVectorMode
      ? buildVectorUserPrompt(pageNumber, structuredData)
      : buildRasterUserPrompt(pageNumber, ocrContext);

    userContent.push({ type: 'text', text: userPrompt });

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 16384,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze drawing with AI', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeData = await claudeResponse.json();
    const textContent = claudeData.content?.find((c: any) => c.type === 'text')?.text || '{}';

    // Parse JSON from <json> tags, ```json blocks, or raw
    let jsonStr = '';
    const jsonTagMatch = textContent.match(/<json>\s*([\s\S]*?)\s*<\/json>/);
    if (jsonTagMatch) {
      jsonStr = jsonTagMatch[1].trim();
    } else {
      const codeBlockMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        const rawMatch = textContent.match(/\{[\s\S]*\}/);
        jsonStr = rawMatch ? rawMatch[0] : '{}';
      }
    }

    const parsedData = JSON.parse(jsonStr);

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in pdf-analyze-raster function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ==================== VECTOR MODE ====================
// Primary data source: structured text (texts, symbols, style groups)
// Image: low-res reference only for visual context

function buildVectorSystemPrompt(): string {
  return `You are an expert electrical/MEP installation drawing analyzer. You receive STRUCTURED DATA extracted programmatically from a vector PDF — this data is 100% accurate (not OCR).

Your task: produce an accurate bill of materials (przedmiar) from the structured data.

DATA YOU RECEIVE:
1. **TEXTS** — every text fragment from the PDF with exact (x,y) position in page pixels. This includes legend labels, room names, cable annotations, element descriptions.
2. **DETECTED SYMBOLS** — clusters of small graphic shapes (circles, crosses, squares etc.) with their positions. These are the installation elements on the plan.
3. **STYLE GROUPS** — paths grouped by visual style (color, line width, dash pattern) with total length in meters.
4. **IMAGE** — low-resolution reference image for visual context. Do NOT rely on it for text or counting — use the structured data.

STRICT RULES:

1. **BUILD LEGEND FROM TEXTS.** Find the legend region (usually labeled "LEGENDA" or "OZNACZENIA"). Legend entries are text pairs: a symbol code/name + description, arranged in a table. Extract ALL entries.

2. **MATCH SYMBOLS TO LEGEND.** The detected symbols have shape, color, and position. Match them to legend entries by:
   - Nearby text labels (text fragments close to symbol positions)
   - Style (color, shape) matching legend descriptions
   - Count each matched type precisely

3. **USE EXACT TEXT.** All element names and descriptions must come from the extracted text verbatim. Do NOT paraphrase or generalize.

4. **CABLE ROUTES FROM STYLE GROUPS.** If the legend mentions cable types, match them to style groups by color/line style. Use the precise geometric length (totalLengthM) from the style group data.

5. **POSITIONS AS PERCENTAGES.** Convert symbol positions from page pixels to percentages (0-100) of page dimensions. The page dimensions are provided.

6. **DO NOT INVENT.** Only report elements that exist in the structured data. If a legend entry has no matching symbols on the plan, report it with count=0.`;
}

function buildVectorUserPrompt(
  pageNumber: number,
  data: {
    texts: { text: string; x: number; y: number; fontSize: number }[];
    symbols: { shape: string; centerX: number; centerY: number; radius: number; color: string; clusterId: string; count: number }[];
    styleGroups: { name: string; color: string; lineWidth: number; dashPattern: string; pathCount: number; totalLengthM: number }[];
    pageWidth: number;
    pageHeight: number;
    scale: string;
  },
): string {
  // Format texts with positions
  const textsSection = data.texts
    .map(t => `  "${t.text}" @ (${Math.round(t.x)}, ${Math.round(t.y)}) font=${t.fontSize.toFixed(1)}`)
    .join('\n');

  // Format detected symbols
  const symbolsSection = data.symbols
    .map(s => `  ${s.shape} color=${s.color} @ (${Math.round(s.centerX)}, ${Math.round(s.centerY)}) r=${s.radius.toFixed(1)} cluster=${s.clusterId} count=${s.count}`)
    .join('\n');

  // Format style groups
  const groupsSection = data.styleGroups
    .map(sg => `  ${sg.name}: color=${sg.color}, lw=${sg.lineWidth}, dash=${sg.dashPattern}, paths=${sg.pathCount}, length=${sg.totalLengthM.toFixed(1)}m`)
    .join('\n');

  return `Analyze this vector PDF technical drawing (page ${pageNumber || 1}).

Page dimensions: ${data.pageWidth.toFixed(0)} x ${data.pageHeight.toFixed(0)} px
Scale: ${data.scale}

=== EXTRACTED TEXTS (${data.texts.length} fragments) ===
${textsSection}
=== END TEXTS ===

=== DETECTED SYMBOLS (${data.symbols.length} instances in clusters) ===
${symbolsSection}
=== END SYMBOLS ===

=== STYLE GROUPS (${data.styleGroups.length} groups) ===
${groupsSection}
=== END STYLE GROUPS ===

The attached image is a LOW-RESOLUTION reference. Use the structured data above as your PRIMARY source.
For positions, convert from page pixels to percentages: x_pct = x / ${data.pageWidth.toFixed(0)} * 100, y_pct = y / ${data.pageHeight.toFixed(0)} * 100.

Output valid JSON inside <json> tags with this EXACT structure:

{
  "drawingType": "type of drawing",
  "scaleText": "1:100" or null,
  "symbols": [
    {
      "type": "EXACT name from legend text",
      "legendRef": "legend symbol code (e.g. 'AW1', 'AE-1')",
      "category": "Oprawy oświetleniowe | Osprzęt elektryczny | Wyłączniki | Tablice rozdzielcze | Instalacja alarmowa | Instalacja teletechniczna | Inne",
      "count": number,
      "description": "full description from legend",
      "positions": [{"x": 0-100, "y": 0-100}, ...]
    }
  ],
  "routes": [
    {
      "type": "cable spec from legend",
      "category": "Kable i przewody",
      "estimatedLengthM": number_from_style_group,
      "description": "route description"
    }
  ],
  "legendEntries": [
    {
      "symbol": "symbol code from legend",
      "description": "full text from legend",
      "category": "category"
    }
  ]
}

CRITICAL:
- Report ALL legend entries, even those with count=0 on the plan
- Use EXACT text from the extracted data, not paraphrased
- Positions must be percentage coordinates (0-100)
- For cable routes, use totalLengthM from matching style groups`;
}

// ==================== RASTER MODE ====================
// Image is the only data source (raster/scanned PDFs)

function buildRasterSystemPrompt(): string {
  return `You are an expert electrical/MEP installation drawing analyzer. Your task is to analyze a technical drawing image and produce an accurate bill of materials (przedmiar).

STRICT RULES — FOLLOW EXACTLY:

1. **LEGEND IS YOUR GROUND TRUTH.** Read the legend (LEGENDA) on the drawing FIRST. Every element you report MUST correspond to an entry in the legend. Use the EXACT names and descriptions from the legend — do not paraphrase, do not generalize.

2. **DO NOT INVENT ELEMENTS.** Only report elements you can actually SEE on the drawing. If you cannot clearly identify a cable route line on the drawing, do NOT add cables/routes.

3. **COUNT PRECISELY.** Go room by room, section by section. Count each symbol type separately. If the legend shows "AW1" for emergency lighting — count every "AW1" symbol on the plan.

4. **REPORT POSITIONS.** For each symbol occurrence, estimate its approximate position as percentage coordinates (0-100% of image width/height, where 0,0 is top-left).

5. **CABLE ROUTES — ONLY IF VISIBLE.** Only report cable routes if you see actual drawn cable lines (usually colored/thick lines running between elements with cable type annotations like "YDYp 3x2.5"). Electrical connection lines between symbols on a floor plan are NOT cable routes.

6. **USE POLISH TERMINOLOGY** from the legend exactly as written.

Process:
1. Read the legend completely — list every entry
2. For each legend entry, scan the drawing and count occurrences
3. Record approximate positions of each occurrence
4. Only add cable routes if explicitly drawn and annotated
5. Output JSON`;
}

function buildRasterUserPrompt(pageNumber: number, ocrContext?: string): string {
  return `Analyze this technical drawing (page ${pageNumber || 1}).

${ocrContext ? `Additional context:\n${ocrContext}` : ''}

Output valid JSON inside <json> tags with this EXACT structure:

{
  "drawingType": "type of drawing",
  "scaleText": "1:100" or null,
  "symbols": [
    {
      "type": "EXACT name from legend (e.g. 'Oprawa oświetleniowa LUXCLASSIC SLIM LED 60x600')",
      "legendRef": "legend symbol code if present (e.g. 'AW1', 'AE-1')",
      "category": "Oprawy oświetleniowe | Osprzęt elektryczny | Wyłączniki | Tablice rozdzielcze | Instalacja alarmowa | Instalacja teletechniczna | Inne",
      "count": number,
      "description": "full description from legend",
      "positions": [{"x": 0-100, "y": 0-100}, ...]
    }
  ],
  "routes": [
    {
      "type": "cable spec ONLY if visible on drawing",
      "category": "Kable i przewody",
      "estimatedLengthM": number,
      "description": "route description"
    }
  ],
  "legendEntries": [
    {
      "symbol": "symbol code/graphic description",
      "description": "full text from legend",
      "category": "category"
    }
  ]
}

REMEMBER:
- "positions" is an array of {x, y} percentage coordinates (0-100) for EACH occurrence of that symbol on the drawing
- Every symbol "type" must match a legend entry EXACTLY
- Do NOT add routes/cables unless you see actual cable route lines drawn on the plan
- Count each symbol occurrence individually and precisely`;
}

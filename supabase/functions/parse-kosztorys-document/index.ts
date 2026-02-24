// Supabase Edge Function for Kosztorys/Przedmiar Document Parsing with Claude AI
// Extracts cost estimate sections, positions, and resources via document analysis

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT = `Przeanalizuj ten dokument kosztorysu budowlanego (przedmiar, kosztorys ślepy, kosztorys inwestorski itp.) i wyodrębnij następujące dane.

Zwróć TYLKO czysty JSON (bez markdown, bez komentarzy) z polami:
- title: tytuł/nazwa kosztorysu
- sections: tablica działów (sekcji) kosztorysu

Każdy dział (section) powinien zawierać:
- name: nazwa działu (np. "INSTALACJA ELEKTRYCZNA", "ROBOTY BUDOWLANE")
- ordinal: numer porządkowy (np. "1", "2")
- subsections: opcjonalna tablica poddziałów (ta sama struktura co dział)
- positions: tablica pozycji kosztorysowych

Każda pozycja (position) powinna zawierać:
- base: podstawa wyceny / numer KNR/KNNR (np. "KNR 4-03 0313-10", "KNNR 5 0407-01")
- name: opis pozycji (np. "Wymiana płyty maskującej w tablicy TA")
- unit: jednostka miary (np. "szt.", "m", "m2", "m3", "kpl.", "r-g")
- quantity: ilość/obmiar jako liczba
- resources: tablica nakładów/zasobów

Każdy zasób (resource) powinien zawierać:
- type: typ zasobu - "labor" (robocizna/R), "material" (materiał/M), lub "equipment" (sprzęt/S)
- name: nazwa zasobu
- norm: norma zużycia jako liczba
- unit: jednostka normy (np. "r-g", "szt.", "m", "kg")

Wyodrębnij WSZYSTKIE pozycje z dokumentu. Zachowaj strukturę działów. Jeśli pole nie jest znalezione, użyj pustego stringa dla tekstu lub 0 dla liczb.

Odpowiedz WYŁĄCZNIE poprawnym JSON-em, bez żadnych dodatkowych komentarzy.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fileBase64, mimeType } = await req.json();

    if (!fileBase64) {
      return new Response(
        JSON.stringify({ error: 'fileBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!CLAUDE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'CLAUDE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const detectedMime = mimeType || 'application/pdf';

    // Build content blocks based on mime type
    const isImage = detectedMime.startsWith('image/');
    const isPdf = detectedMime === 'application/pdf';

    let fileContentBlock: Record<string, unknown>;

    if (isPdf) {
      fileContentBlock = {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: fileBase64,
        },
      };
    } else if (isImage) {
      fileContentBlock = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: detectedMime,
          data: fileBase64,
        },
      };
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported mime type: ${detectedMime}. Use PDF or image formats.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16384,
        messages: [
          {
            role: 'user',
            content: [
              fileContentBlock,
              {
                type: 'text',
                text: PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to parse document with AI', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeData = await claudeResponse.json();
    const textBlock = claudeData.content?.find((b: { type: string }) => b.type === 'text');
    const rawText = textBlock?.text || '{}';

    // Extract JSON from response (handle possible markdown code blocks)
    let jsonText = rawText.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const parsedData = JSON.parse(jsonText);

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in parse-kosztorys-document function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

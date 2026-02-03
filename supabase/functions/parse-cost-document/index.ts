// Supabase Edge Function for Cost Document Parsing with Google Gemini AI
// Extracts invoice data: issuer, NIP, address, amounts, dates, VAT

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mime = mimeType || 'application/pdf';

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mime,
                    data: fileBase64,
                  },
                },
                {
                  text: `Extract invoice/cost document data from this file. Return a JSON object with these fields:
- issuer: company name of the document issuer (string)
- issuer_nip: NIP (tax ID) of the issuer (string, digits only)
- issuer_address: full address of the issuer (string)
- document_number: invoice/document number (string)
- issue_date: date of issue in YYYY-MM-DD format (string)
- payment_due_date: payment due date in YYYY-MM-DD format (string)
- value_netto: net value in PLN (number)
- vat_rate: VAT rate as percentage, e.g. 23 for 23% (number)
- value_brutto: gross value in PLN (number)
- category: short category description of what was purchased (string)
If a field is not found, use empty string for strings or 0 for numbers.`,
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: {
              type: 'OBJECT',
              properties: {
                issuer: { type: 'STRING' },
                issuer_nip: { type: 'STRING' },
                issuer_address: { type: 'STRING' },
                document_number: { type: 'STRING' },
                issue_date: { type: 'STRING' },
                payment_due_date: { type: 'STRING' },
                value_netto: { type: 'NUMBER' },
                vat_rate: { type: 'NUMBER' },
                value_brutto: { type: 'NUMBER' },
                category: { type: 'STRING' },
              },
              required: ['issuer', 'issuer_nip', 'issuer_address', 'document_number', 'issue_date', 'payment_due_date', 'value_netto', 'vat_rate', 'value_brutto', 'category'],
            },
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to parse document with AI', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsedData = JSON.parse(text);

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in parse-cost-document function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

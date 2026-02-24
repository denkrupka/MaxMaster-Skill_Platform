// Supabase Edge Function for Kosztorys/Przedmiar Document Parsing with Google Gemini AI
// Extracts cost estimate sections, positions, and resources via OCR

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

    const detectedMime = mimeType || 'application/pdf';

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: detectedMime,
                    data: fileBase64,
                  },
                },
                {
                  text: `Przeanalizuj ten dokument kosztorysu budowlanego (przedmiar, kosztorys ślepy, kosztorys inwestorski itp.) i wyodrębnij następujące dane.

Zwróć JSON z polami:
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

Wyodrębnij WSZYSTKIE pozycje z dokumentu. Zachowaj strukturę działów. Jeśli pole nie jest znalezione, użyj pustego stringa dla tekstu lub 0 dla liczb.`,
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                sections: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      name: { type: 'STRING' },
                      ordinal: { type: 'STRING' },
                      positions: {
                        type: 'ARRAY',
                        items: {
                          type: 'OBJECT',
                          properties: {
                            base: { type: 'STRING' },
                            name: { type: 'STRING' },
                            unit: { type: 'STRING' },
                            quantity: { type: 'NUMBER' },
                            resources: {
                              type: 'ARRAY',
                              items: {
                                type: 'OBJECT',
                                properties: {
                                  type: { type: 'STRING' },
                                  name: { type: 'STRING' },
                                  norm: { type: 'NUMBER' },
                                  unit: { type: 'STRING' },
                                },
                                required: ['type', 'name'],
                              },
                            },
                          },
                          required: ['name'],
                        },
                      },
                      subsections: {
                        type: 'ARRAY',
                        items: {
                          type: 'OBJECT',
                          properties: {
                            name: { type: 'STRING' },
                            ordinal: { type: 'STRING' },
                            positions: {
                              type: 'ARRAY',
                              items: {
                                type: 'OBJECT',
                                properties: {
                                  base: { type: 'STRING' },
                                  name: { type: 'STRING' },
                                  unit: { type: 'STRING' },
                                  quantity: { type: 'NUMBER' },
                                  resources: {
                                    type: 'ARRAY',
                                    items: {
                                      type: 'OBJECT',
                                      properties: {
                                        type: { type: 'STRING' },
                                        name: { type: 'STRING' },
                                        norm: { type: 'NUMBER' },
                                        unit: { type: 'STRING' },
                                      },
                                      required: ['type', 'name'],
                                    },
                                  },
                                },
                                required: ['name'],
                              },
                            },
                          },
                          required: ['name'],
                        },
                      },
                    },
                    required: ['name'],
                  },
                },
              },
              required: ['title', 'sections'],
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
    console.error('Error in parse-kosztorys-document function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

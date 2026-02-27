import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { offer_summary, client_name } = await req.json()

    if (!offer_summary) {
      return new Response(
        JSON.stringify({ error: 'offer_summary is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!ANTHROPIC_API_KEY) {
      // Fallback if API key not configured
      const fallbackLetter = `Szanowni Państwo,

Z przyjemnością przesyłam ofertę przygotowaną specjalnie dla ${client_name || 'Państwa firmy'}.

${offer_summary}

Oferta została przygotowana z uwzględnieniem najwyższych standardów jakości i konkurencyjnych warunków cenowych. Jesteśmy przekonani, że nasze rozwiązania spełnią Państwa oczekiwania.

Zachęcam do zapoznania się z załączonym dokumentem. W razie pytań lub potrzeby omówienia szczegółów, jestem do dyspozycji.

Z poważaniem`

      return new Response(
        JSON.stringify({ letter: fallbackLetter }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Jesteś asystentem firmy budowlano-instalacyjnej. Napisz profesjonalny, krótki list przewodni (po polsku) do oferty handlowej.

Informacje o ofercie: ${offer_summary}
Nazwa klienta: ${client_name || 'Szanowni Państwo'}

Wymagania:
- Pisz po polsku, formalnie ale przyjaźnie
- Krótkie podsumowanie oferty (BEZ podawania konkretnych cen)
- Podkreśl jakość i profesjonalizm
- Zachęcaj do kontaktu w razie pytań
- Tekst sprzedażowy, ale nie nachalny
- Maksymalnie 5-6 zdań
- Zacznij od "Szanowni Państwo,"
- Zakończ "Z poważaniem"
- NIE dodawaj podpisu ani danych kontaktowych na końcu`
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    const letter = data.content?.[0]?.text || ''

    return new Response(
      JSON.stringify({ letter }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error generating cover letter:', error)

    // Return fallback on any error
    const fallbackLetter = `Szanowni Państwo,

W załączeniu przesyłam ofertę przygotowaną dla Państwa firmy. Została ona opracowana z uwzględnieniem najwyższych standardów jakości i konkurencyjnych warunków.

Zachęcam do zapoznania się z dokumentem. W razie pytań jestem do dyspozycji.

Z poważaniem`

    return new Response(
      JSON.stringify({ letter: fallbackLetter }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

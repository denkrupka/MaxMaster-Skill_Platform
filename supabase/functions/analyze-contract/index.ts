import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RiskItem {
  type: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

interface AnalysisResult {
  score: number;
  summary: string;
  risks: RiskItem[];
  recommendations: string[];
  analyzed_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { content, name } = await req.json()
    if (!content) throw new Error('Missing document content')

    const apiKey = Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GEMINI_API_KEY')
    
    if (apiKey) {
      const prompt = `Jesteś ekspertem prawnym specjalizującym się w polskim prawie umów. 
Przeanalizuj poniższy dokument prawny pod kątem ryzyk i problemów.

DOKUMENT: "${name}"
TREŚĆ:
${content.substring(0, 6000)}

Odpowiedz TYLKO w formacie JSON (bez markdown):
{
  "score": <liczba 1-10, 10=bardzo bezpieczny>,
  "summary": "<podsumowanie po polsku>",
  "risks": [{"type":"high|medium|low","title":"<tytuł>","description":"<opis>"}],
  "recommendations": ["<rec1>","<rec2>"]
}`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          return new Response(
            JSON.stringify({ ...parsed, analyzed_at: new Date().toISOString() }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Fallback: pattern-based
    const textLower = content.toLowerCase()
    const risks: RiskItem[] = []

    if (!textLower.includes('termin') && !textLower.includes('data realizacji'))
      risks.push({ type: 'high', title: 'Brak terminu realizacji', description: 'Brak jasno określonego terminu.' })
    if (!textLower.includes('wynagrodzenie') && !textLower.includes('kwota'))
      risks.push({ type: 'high', title: 'Niejasne wynagrodzenie', description: 'Brak precyzyjnej kwoty.' })
    if (!textLower.includes('kara umowna'))
      risks.push({ type: 'medium', title: 'Brak kar umownych', description: 'Brak klauzul o karach.' })
    if (!textLower.includes('rodo') && textLower.includes('pesel'))
      risks.push({ type: 'medium', title: 'Brak klauzuli RODO', description: 'PESEL bez zgody RODO.' })

    const score = Math.max(3, 10 - risks.filter(r=>r.type==='high').length*2 - risks.filter(r=>r.type==='medium').length)
    
    return new Response(
      JSON.stringify({
        score,
        summary: risks.length === 0 ? 'Dokument wygląda poprawnie.' : `Wykryto ${risks.length} problemów.`,
        risks,
        recommendations: ['Skonsultuj z prawnikiem', 'Sprawdź wszystkie kwoty', 'Dodaj klauzulę sporów'],
        analyzed_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

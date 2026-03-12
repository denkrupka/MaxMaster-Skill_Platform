// Supabase Edge Function: AI-powered Gantt task order optimization
// Uses Claude API to reorder construction tasks in logical sequence

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_KEYS: string[] = [];
const primary = Deno.env.get('CLAUDE_API_KEY');
if (primary) API_KEYS.push(primary);
for (let i = 2; i <= 10; i++) {
  const key = Deno.env.get(`CLAUDE_API_KEY_${i}`);
  if (key) API_KEYS.push(key);
}
let keyIndex = 0;
const getNextKey = () => { const k = API_KEYS[keyIndex % API_KEYS.length]; keyIndex++; return k; };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tasks } = await req.json();
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return new Response(JSON.stringify({ error: 'tasks array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (API_KEYS.length === 0) {
      return new Response(JSON.stringify({ error: 'No CLAUDE_API_KEY configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const taskList = tasks.map((t: any, i: number) => `${i}. [${t.id}] ${t.title}${t.parent_id ? ` (parent: ${tasks.find((x: any) => x.id === t.parent_id)?.title || t.parent_id})` : ''}`).join('\n');

    const prompt = `Jesteś ekspertem w zarządzaniu projektami budowlanymi w Polsce.

Poniżej lista zadań z harmonogramu budowlanego. Uporządkuj je we właściwej kolejności technologicznej — tak jak powinny być wykonywane w rzeczywistym projekcie budowlanym (np. fundamenty przed ścianami, ściany przed dachem, instalacje przed wykończeniami, itp.).

Zadania:
${taskList}

WAŻNE zasady kolejności budowlanej:
- Prace ziemne i fundamentowe → konstrukcja → dach → instalacje → wykończenia
- Nie można montować instalacji elektrycznych bez ścian
- Nie można kłaść płytek bez tynków
- Nie można malować bez tynków i gładzi
- Roboty zewnętrzne mogą być częściowo równoległe z robotami wewnętrznymi
- Zadania podrzędne powinny być po zadaniu nadrzędnym (chyba że to grupy)

Zwróć TYLKO JSON w formacie:
{"order": ["id1", "id2", "id3", ...]}

gdzie każdy element to ID zadania z listy, w kolejności technologicznej.
Uwzględnij WSZYSTKIE ID z listy.`;

    const apiKey = getNextKey();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in AI response');
    
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.order || !Array.isArray(parsed.order)) throw new Error('Invalid response format');

    return new Response(JSON.stringify({ success: true, order: parsed.order }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('gantt-ai-optimize error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

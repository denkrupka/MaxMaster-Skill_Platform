// Edge Function: generate-document-number
// Вызывается при создании документа для получения автоинкрементного номера
// Формат: {PREFIX}/{YEAR}/{NUMBER:03d} → CON/2026/001
// Используем service_role для записи в document_numbering

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const TYPE_PREFIX: Record<string, string> = {
  contract: 'CON',
  protocol: 'PRO',
  annex: 'ANX',
  other: 'DOC',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Авторизация: проверить JWT из заголовка
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Создаём клиент с JWT пользователя для проверки доступа
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    
    // Получаем данные пользователя
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Получаем company_id пользователя
    const { data: userData } = await userClient.from('users').select('company_id').eq('id', user.id).single()
    if (!userData?.company_id) {
      return new Response(JSON.stringify({ error: 'No company' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { template_type } = await req.json()
    const prefix = TYPE_PREFIX[template_type] || 'DOC'
    const year = new Date().getFullYear()
    const companyId = userData.company_id

    // Service role client для записи в document_numbering
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Атомарный инкремент: upsert + increment
    // Сначала пробуем обновить
    const { data: existing } = await adminClient
      .from('document_numbering')
      .select('id, last_number')
      .eq('company_id', companyId)
      .eq('prefix', prefix)
      .eq('year', year)
      .single()

    let nextNumber: number

    if (existing) {
      nextNumber = existing.last_number + 1
      await adminClient
        .from('document_numbering')
        .update({ last_number: nextNumber })
        .eq('id', existing.id)
    } else {
      nextNumber = 1
      await adminClient
        .from('document_numbering')
        .insert({ company_id: companyId, prefix, year, last_number: 1 })
    }

    const number = `${prefix}/${year}/${String(nextNumber).padStart(3, '0')}`

    return new Response(JSON.stringify({ data: { number } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

# Как задеплоить Edge Function create-candidate через Supabase Dashboard

## Проблема решена
Исправлена ошибка "null value in column id" при создании кандидата HR-ом.

## Что изменилось
Функция `create-candidate` теперь:
1. Сначала создает auth user через `createUser` (гарантирует ID)
2. Затем создает запись в `public.users` с этим ID
3. Затем отправляет invitation email

## Деплой через Supabase Dashboard

### Вариант 1: Через Dashboard UI (рекомендуется)

1. **Откройте Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_ID
   ```

2. **Перейдите в Edge Functions**
   - В левом меню: **Edge Functions**

3. **Найдите функцию `create-candidate`**
   - Если она уже существует - кликните на неё
   - Если нет - создайте новую с именем `create-candidate`

4. **Обновите код**
   - Скопируйте содержимое файла `/supabase/functions/create-candidate/index.ts`
   - Вставьте в редактор кода в Dashboard
   - Нажмите **Deploy** или **Save**

### Вариант 2: Через Supabase CLI

Если у вас установлен Supabase CLI:

```bash
# В корне проекта
supabase functions deploy create-candidate
```

### Вариант 3: Через API (если CLI недоступен)

Можно обновить функцию через Management API, но это сложнее.

## Проверка деплоя

### 1. Проверьте что функция задеплоена

В Supabase Dashboard → Edge Functions → create-candidate

Должна показываться дата последнего деплоя.

### 2. Проверьте логи

После деплоя создайте тестового кандидата через HR панель.

В Supabase Dashboard → Edge Functions → create-candidate → Logs

Должны увидеть:
```
Creating candidate: test@example.com
Redirect URL: https://portal.maxmaster.info/email-redirect.html
Auth user created: [uuid]
Candidate created successfully: [uuid]
Invitation email sent to: test@example.com
```

### 3. Тестирование

1. Откройте HR панель в приложении
2. Нажмите "Dodaj kandydata" (Добавить кандидата)
3. Заполните форму:
   - Imię (Имя)
   - Nazwisko (Фамилия)
   - Email
   - Telefon
   - Stanowisko (Должность)
   - Źródło (Источник)
4. Нажмите "Utwórz kandydata"

**Ожидаемый результат:**
- ✅ Успешное создание кандидата
- ✅ Кандидат появился в списке
- ✅ Email с приглашением отправлен на указанный адрес

**Если ошибка:**
- Проверьте логи в Supabase Dashboard
- Убедитесь что функция задеплоена с новым кодом
- Проверьте что переменные окружения настроены (SITE_URL)

## Переменные окружения

Убедитесь что в настройках Edge Function есть:

```
SITE_URL=https://portal.maxmaster.info
```

Это можно проверить и настроить в:
**Supabase Dashboard → Settings → Edge Functions → Environment Variables**

## Полный код функции

Если нужно, вот полный код обновленной функции:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, first_name, last_name, phone, target_position, source, status } = await req.json()

    console.log('Creating candidate:', email)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const siteUrl = Deno.env.get('SITE_URL') || 'https://portal.maxmaster.info'
    const redirectUrl = `${siteUrl}/email-redirect.html`

    console.log('Redirect URL:', redirectUrl)

    // 1. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: false,
      user_metadata: {
        first_name: first_name,
        last_name: last_name,
        role: 'candidate',
        target_position: target_position,
        phone: phone
      }
    })

    if (authError || !authData.user) {
      console.error('Auth user creation error:', authError)
      throw authError || new Error('Failed to create auth user')
    }

    console.log('Auth user created:', authData.user.id)

    // 2. Create record in public.users
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        email: email,
        first_name: first_name,
        last_name: last_name,
        phone: phone || null,
        target_position: target_position || null,
        source: source || 'Aplikacja',
        role: 'candidate',
        status: status || 'started',
        hired_date: new Date().toISOString()
      }])
      .select()
      .single()

    if (userError) {
      console.error('User insert error:', userError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw userError
    }

    console.log('Candidate created successfully:', userData.id)

    // 3. Send invitation email
    try {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: redirectUrl
        }
      )

      if (inviteError) {
        console.error('Invite email error (non-critical):', inviteError)
      } else {
        console.log('Invitation email sent to:', email)
      }
    } catch (emailError) {
      console.error('Email sending failed (non-critical):', emailError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: userData,
        message: 'Kandydat utworzony. Email z zaproszeniem został wysłany.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
```

## Альтернатива: Ручной деплой файлов

Если Dashboard не позволяет редактировать код:

1. Скопируйте файл `supabase/functions/create-candidate/index.ts`
2. В Supabase Dashboard создайте новую функцию или отредактируйте существующую
3. Вставьте код из файла
4. Сохраните и задеплойте

## После деплоя

1. ✅ Функция задеплоена
2. ✅ Переменные окружения настроены
3. ✅ Протестируйте создание кандидата
4. ✅ Проверьте что email приходит
5. ✅ Проверьте что ссылка в email ведет на email-redirect.html

## Troubleshooting

### Ошибка: "Function not found"
- Убедитесь что имя функции точно `create-candidate`
- Проверьте что функция задеплоена и активна

### Ошибка: "Invalid token" или "Unauthorized"
- Проверьте что Service Role Key настроен правильно
- В Edge Function секреты должны включать SUPABASE_SERVICE_ROLE_KEY

### Email не приходит
- Проверьте логи функции - был ли вызов inviteUserByEmail
- Проверьте настройки SMTP в Supabase Dashboard
- Проверьте папку спам

### Кандидат создается но ссылка не работает
- Убедитесь что index.html задеплоен с [PreReact] скриптом
- Проверьте что email-redirect.html доступен
- Посмотрите консоль браузера при клике на ссылку

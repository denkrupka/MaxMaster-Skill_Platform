# Supabase Email Confirmation Setup

## Проблема "requested path is invalid"

Если при переходе по ссылке подтверждения email вы видите ошибку:
```json
{"error":"requested path is invalid"}
```

Это означает, что URL не настроен в Supabase Dashboard.

## Решение

### 1. Настройка Redirect URLs в Supabase

1. Откройте Supabase Dashboard
2. Перейдите в **Authentication** → **URL Configuration**
3. В поле **Redirect URLs** добавьте:

   **Для production:**
   ```
   https://portal.maxmaster.pl/#/setup-password
   https://portal.maxmaster.pl/#/reset-password
   ```

   **Для development:**
   ```
   http://localhost:5173/#/setup-password
   http://localhost:5173/#/reset-password
   ```

4. Нажмите **Save**

### 2. Настройка Site URL

В разделе **Site URL** укажите:
- Production: `https://portal.maxmaster.pl`
- Development: `http://localhost:5173`

### 3. Email Templates

Убедитесь, что в Email Templates используются правильные переменные:

**Confirm Signup Template:**
```html
<h2>Potwierdź swój email</h2>
<p>Kliknij w link poniżej, aby potwierdzić email i ustawić hasło:</p>
<p><a href="{{ .ConfirmationURL }}">Potwierdź email</a></p>
```

**Invite User Template:**
```html
<h2>Zaproszenie do MaxMaster</h2>
<p>Zostałeś zaproszony do platformy MaxMaster.</p>
<p>Kliknij w link poniżej, aby ustawić hasło:</p>
<p><a href="{{ .ConfirmationURL }}">Ustaw hasło</a></p>
```

### 4. Edge Function Environment Variables

Dla edge function `create-candidate` ustaw w **Edge Functions** → **Secrets**:

```
SITE_URL=https://portal.maxmaster.pl
```

**WAŻNE:** URL musi zawierać `https://` ale NIE zawierać `/#/setup-password` - to jest dodawane automatycznie.

## Jak to działa

1. **Supabase wysyła email** z tokenem w URL:
   ```
   https://portal.maxmaster.pl/#/setup-password#access_token=...&type=signup
   ```

2. **App.tsx EmailConfirmationHandler** przechwytuje ten URL i przekierowuje do:
   ```
   /#/setup-password#access_token=...
   ```

3. **SetupPassword.tsx** odczytuje token z URL i umożliwia ustawienie hasła

## Testowanie

1. Utwórz nowego użytkownika przez Admin → Users lub przez `create-candidate` edge function
2. Sprawdź email
3. Kliknij w link - powinieneś zostać przekierowany do strony setup-password
4. Ustaw hasło

## Troubleshooting

### Email nie przychodzi
- Sprawdź spam
- Sprawdź Supabase Dashboard → Authentication → Logs
- Sprawdź czy email jest poprawny

### Nadal "requested path is invalid"
- Sprawdź czy URL jest DOKŁADNIE taki sam w Redirect URLs (ze znakiem `#`)
- Poczekaj 1-2 minuty po zapisaniu zmian w Dashboard
- Wyczyść cache przeglądarki

### "Invalid token"
- Link wygasł (ważny 24h)
- Wygeneruj nowy link poprzez Forgot Password

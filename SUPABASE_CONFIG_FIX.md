# Naprawa błędu "requested path is invalid" w emailach rejestracyjnych

## Problem
Gdy kandydat klika link z emaila rejestracyjnego, dostaje błąd `{"error":"requested path is invalid"}` lub jest przekierowywany do strony logowania zamiast do setup-password.

## Przyczyna
**Site URL** w Supabase Dashboard jest ustawiony bez protokołu `https://`, co powoduje że Supabase generuje nieprawidłowe URLe w emailach.

## Rozwiązanie

### Krok 1: Napraw Site URL w Supabase Dashboard

1. Otwórz **Supabase Dashboard**: https://supabase.com/dashboard
2. Wybierz swój projekt (MaxMaster)
3. Idź do **Authentication** → **URL Configuration**
4. Znajdź pole **"Site URL"**
5. Zmień wartość z:
   ```
   portal.maxmaster.info
   ```
   na:
   ```
   https://portal.maxmaster.info
   ```
   ⚠️ **Ważne:** Musi być `https://` na początku!

6. Kliknij **"Save"**

### Krok 2: Dodaj Redirect URLs do allowed list

W tym samym miejscu (**Authentication** → **URL Configuration**), dodaj następujące URLe do sekcji **"Redirect URLs"**:

```
https://portal.maxmaster.info/#/setup-password
https://portal.maxmaster.info/#/reset-password
http://localhost:5173/#/setup-password
http://localhost:5173/#/reset-password
```

Kliknij **"Save"**

### Krok 3: Zredeploy Edge Function

Edge function `create-candidate` ma zaktualizowany kod (teraz używa `portal.maxmaster.info` zamiast `.pl`).

Musisz go zredeploy:

```bash
cd /home/user/MaxMaster-Skill_Platform
supabase functions deploy create-candidate
```

### Krok 4: (Opcjonalne) Ustaw zmienną środowiskową SITE_URL

Jeśli chcesz mieć pewność, że edge function używa właściwego URL:

1. Idź do **Edge Functions** → **Secrets** w Supabase Dashboard
2. Dodaj nowy sekret:
   - Nazwa: `SITE_URL`
   - Wartość: `https://portal.maxmaster.info`
3. Kliknij **"Save"**
4. Zredeploy funkcję ponownie

### Krok 5: Test

1. Utwórz nowego kandydata przez aplikację
2. Sprawdź email - link powinien wyglądać tak:
   ```
   https://portal.maxmaster.info/#/setup-password?access_token=...&type=invite
   ```
3. Kliknij w link
4. Powinieneś zobaczyć stronę "Utwórz hasło", NIE stronę logowania
5. Ustaw hasło i zaloguj się

## Jak sprawdzić czy jest poprawnie skonfigurowane

Po kliknięciu linku z emaila powinieneś zobaczyć:

✅ **Prawidłowo:** Strona z formularzem "Utwórz hasło" z powitaniem kandydata
❌ **Nieprawidłowo:** Strona logowania lub błąd "requested path is invalid"

## Dodatkowe informacje

- Kod aplikacji został zaktualizowany w PR
- Email template jest prawidłowy - używa zmiennej `{{ .ConfirmationURL }}` generowanej przez Supabase
- Problem był wyłącznie w konfiguracji Supabase Dashboard

## Kontakt

Jeśli problem nadal występuje po wykonaniu tych kroków, sprawdź:
1. Czy zapisałeś zmiany w Supabase Dashboard
2. Czy czysty cache przeglądarki
3. Czy zredeployowałeś edge function

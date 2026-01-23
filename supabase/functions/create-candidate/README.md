# Create Candidate Edge Function

This Supabase Edge Function creates a new candidate user and sends them an invitation email to set up their password.

## Environment Variables

The following environment variables must be set in Supabase Dashboard:

- `SUPABASE_URL` - Your Supabase project URL (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (auto-provided)
- `SITE_URL` - Your application URL (e.g., `https://portal.maxmaster.info`)

### Setting SITE_URL

1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Add secret: `SITE_URL` = `https://portal.maxmaster.info` (or your actual domain)
3. Redeploy the function

**Important:** The `SITE_URL` must include `https://` but NOT the `/#/setup-password` path - that's added automatically.

## Redirect URL Configuration

This function uses **HashRouter**, so the email confirmation link will be:
```
https://portal.maxmaster.info/#/setup-password
```

### Add to Supabase Allowed Redirect URLs

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add to "Redirect URLs":
   ```
   https://portal.maxmaster.info/#/setup-password
   ```
3. Also add for local development:
   ```
   http://localhost:5173/#/setup-password
   ```

## Deploy

```bash
supabase functions deploy create-candidate
```

## Usage

Call from your application:

```typescript
const { data, error } = await supabase.functions.invoke('create-candidate', {
  body: {
    email: 'candidate@example.com',
    first_name: 'Jan',
    last_name: 'Kowalski',
    phone: '+48 123 456 789',
    target_position: 'Elektryk',
    source: 'Aplikacja',
    status: 'started'
  }
})
```

## Response

Success:
```json
{
  "success": true,
  "data": { ... user object ... },
  "message": "Kandydat utworzony. Email z zaproszeniem został wysłany."
}
```

Error:
```json
{
  "success": false,
  "error": "Error message"
}
```

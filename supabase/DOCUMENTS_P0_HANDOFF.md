# Documents P0 handoff (Preview/dev only)

## Apply order
### Recommended now
1. `supabase/migrations/20260316204000_documents_preview_compat_fix.sql`

This late migration is self-healing for Preview/dev and intentionally does **not** depend on the old broken ordering between:
- `20260316083500_documents_p0_foundation.sql`
- `20260316084500_documents_core_minimal.sql`

It creates missing base tables when absent, patches existing objects when present, restores PostgREST-visible compatibility objects, and aligns the signing contract with the already shipped UI.

### Legacy note
`20260315_documents_stage2.sql` is **not** required for P0 build wiring.
It contains overlapping Stage 2 objects; do not apply it for this minimal Preview/dev path unless you intentionally want Stage 2 extras.

## What these migrations now guarantee
- `documents`, `document_templates`, `document_numbering`, `document_audit_log`, `document_versions`, `document_public_links`
- `signature_requests` foundation for signing route (`signing_token`, status lifecycle, metadata, expiry/open/signed/declined timestamps)
- `document_emails`
- `document_ai_analyses`
- compatibility view: `contractor_clients` -> `contractors_clients`
- RPC: `generate_next_document_number(...)`
- RPC: `log_document_event(...)`
- append-only protection for `document_audit_log`

## Edge function contracts ready

### `generate-document-number`
Request:
```json
{ "template_type": "contract", "project_id": "uuid-optional" }
```
Response:
```json
{
  "success": true,
  "number": "CON/2026/001",
  "document_number": "CON/2026/001",
  "prefix": "CON",
  "year": 2026,
  "last_number": 1,
  "template_type": "contract",
  "project_id": "uuid-optional"
}
```
Depends on RPC `generate_next_document_number`.

### `generate-document-pdf`
Request:
```json
{ "document_id": "uuid" }
```
Response (Preview/dev contract):
```json
{
  "success": true,
  "mode": "preview-html-data-url",
  "url": "data:text/html;base64,...",
  "pdf_url": "data:text/html;base64,...",
  "path": "company/year/document.pdf",
  "pdf_path": "company/year/document.pdf",
  "document_id": "uuid"
}
```
Notes:
- returns HTML data URL, not a binary PDF yet
- still persists `documents.pdf_path` placeholder for next integration step

### `log-document-event`
Request:
```json
{ "document_id": "uuid", "action": "pdf_generated", "metadata": {} }
```
Response:
```json
{ "success": true, "log_id": "uuid", "document_id": "uuid", "action": "pdf_generated" }
```
Depends on RPC `log_document_event`.

### `analyze-document`
Request:
```json
{ "document_id": "uuid", "analysis_type": "summary" }
```
Response:
```json
{
  "result": { "text": "..." },
  "id": "uuid",
  "analysis_id": "uuid",
  "document_id": "uuid",
  "analysis_type": "summary"
}
```
Notes:
- if `GEMINI_API_KEY` absent/fails, fallback text is saved to `document_ai_analyses`

### `send-document-email`
Request:
```json
{
  "document_id": "uuid",
  "recipients": [{ "email": "a@b.com", "name": "Jan" }],
  "subject": "Umowa",
  "body": "Treść",
  "attach_pdf": true,
  "include_public_link": true
}
```
Response:
```json
{
  "success": true,
  "queued": [{ "id": "uuid", "recipient_email": "a@b.com", "status": "queued|sent|failed" }],
  "public_link_token": "uuid-or-null"
}
```
Notes:
- queues rows in `document_emails`
- creates/reuses `document_public_links` when `include_public_link=true`
- sends via Postmark only if `POSTMARK_API_KEY` exists
- `attach_pdf=true` is persisted in queue/metadata, but binary attachment is not wired in Preview foundation yet
- public email link body uses `DOCUMENT_PUBLIC_BASE_URL/<token>` if env exists

## Required env for full edge behavior
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- optional: `GEMINI_API_KEY`
- optional: `POSTMARK_API_KEY`
- optional: `EMAIL_FROM`
- optional: `DOCUMENT_PUBLIC_BASE_URL`

## Known intentional Preview limitations
- PDF generation is HTML preview, not real PDF binary
- email attachment wiring is queued/foundation only
- public link route consumer must exist separately in app/router

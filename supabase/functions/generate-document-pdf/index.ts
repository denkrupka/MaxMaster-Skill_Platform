// Edge Function: generate-document-pdf
// Generates a PDF from a document + template, saves to Storage, returns signed URL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import jsPDF from 'https://esm.sh/jspdf@2.5.2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Replace Polish diacritics with closest Latin equivalents.
 * jsPDF's built-in helvetica font doesn't support Latin2 glyphs.
 */
function stripPolishDiacritics(text: string): string {
  const map: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
    'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
    'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
  }
  return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => map[ch] ?? ch)
}

/**
 * Strip HTML tags from a string (template bodies may contain HTML).
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/**
 * Wrap long text to fit within a given width (approximate character-based).
 */
function wrapText(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = []
  const paragraphs = text.split('\n')

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('')
      continue
    }
    const splitLines = doc.splitTextToSize(paragraph, maxWidth)
    lines.push(...splitLines)
  }

  return lines
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth ────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: userData } = await userClient
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return new Response(JSON.stringify({ error: 'No company' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const companyId = userData.company_id

    // ── Parse body ──────────────────────────────────────────
    const { document_id } = await req.json()
    if (!document_id) {
      return new Response(JSON.stringify({ error: 'document_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Load document + template via service_role ───────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: doc, error: docError } = await adminClient
      .from('documents')
      .select('*, document_templates(name, type, content, variables)')
      .eq('id', document_id)
      .single()

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify the document belongs to the user's company
    if (doc.company_id !== companyId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const template = doc.document_templates
    const sections: Array<{ title?: string; body?: string }> = template?.content ?? []
    const docData: Record<string, string> = doc.data ?? {}

    // ── Generate PDF ────────────────────────────────────────
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()   // 210
    const pageHeight = pdf.internal.pageSize.getHeight()  // 297
    const marginLeft = 20
    const marginRight = 20
    const marginTop = 25
    const marginBottom = 25
    const contentWidth = pageWidth - marginLeft - marginRight
    let y = marginTop

    const addPageIfNeeded = (requiredSpace: number) => {
      if (y + requiredSpace > pageHeight - marginBottom) {
        // Footer on current page
        addFooter(pdf, pageWidth, pageHeight)
        pdf.addPage()
        y = marginTop
      }
    }

    // ── Document header ─────────────────────────────────────
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    const title = stripPolishDiacritics(template?.name ?? doc.name ?? 'Dokument')
    pdf.text(title, pageWidth / 2, y, { align: 'center' })
    y += 8

    // Document number & date
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    if (doc.number) {
      const numberText = stripPolishDiacritics(`Nr: ${doc.number}`)
      pdf.text(numberText, pageWidth / 2, y, { align: 'center' })
      y += 5
    }
    const dateStr = doc.created_at
      ? new Date(doc.created_at).toLocaleDateString('pl-PL')
      : new Date().toLocaleDateString('pl-PL')
    pdf.text(stripPolishDiacritics(`Data: ${dateStr}`), pageWidth / 2, y, { align: 'center' })
    y += 10

    // Separator line
    pdf.setDrawColor(180)
    pdf.setLineWidth(0.3)
    pdf.line(marginLeft, y, pageWidth - marginRight, y)
    y += 8

    // ── Render sections ─────────────────────────────────────
    for (const section of sections) {
      // Section title
      if (section.title) {
        addPageIfNeeded(12)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(12)
        const sTitle = stripPolishDiacritics(section.title)
        pdf.text(sTitle, marginLeft, y)
        y += 7
      }

      // Section body with placeholder substitution
      if (section.body) {
        let body = section.body
        for (const [key, value] of Object.entries(docData)) {
          body = body.replaceAll(`{{${key}}}`, value)
        }

        // Strip HTML tags and convert to plain text
        const plainText = stripPolishDiacritics(stripHtml(body))
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)

        const lines = wrapText(pdf, plainText, contentWidth, 10)
        const lineHeight = 5

        for (const line of lines) {
          addPageIfNeeded(lineHeight + 2)
          pdf.text(line, marginLeft, y)
          y += lineHeight
        }
        y += 4 // gap between sections
      }
    }

    // Final footer
    addFooter(pdf, pageWidth, pageHeight)

    // ── Save to Storage ─────────────────────────────────────
    const pdfArrayBuffer = pdf.output('arraybuffer')
    const pdfBytes = new Uint8Array(pdfArrayBuffer)
    const fileName = `${companyId}/${document_id}.pdf`

    const { error: uploadError } = await adminClient.storage
      .from('documents-private')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Upload failed: ${uploadError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update pdf_path in documents table
    await adminClient
      .from('documents')
      .update({ pdf_path: fileName })
      .eq('id', document_id)

    // Create signed URL (30 min TTL)
    const { data: signedData, error: signError } = await adminClient.storage
      .from('documents-private')
      .createSignedUrl(fileName, 30 * 60) // 1800 seconds

    if (signError || !signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: 'Failed to create signed URL' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ url: signedData.signedUrl, pdf_path: fileName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Add page number footer to the current page.
 */
function addFooter(pdf: jsPDF, pageWidth: number, pageHeight: number) {
  const pageNumber = pdf.internal.pages.length - 1
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(150)
  pdf.text(`Strona ${pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
  pdf.setTextColor(0)
}

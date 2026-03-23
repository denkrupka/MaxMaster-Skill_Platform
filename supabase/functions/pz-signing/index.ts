import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PZ_CLIENT_ID = Deno.env.get("PZ_CLIENT_ID") || "zzAxz3ZlYfP_FfBxgR0vgvQltUMa";
const PZ_CLIENT_SECRET = Deno.env.get("PZ_CLIENT_SECRET") || "xXJSvgIhUp9XpwsfBzFK7NnQrQYa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://diytvuczpciikzdhldny.supabase.co";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CPA_SOAP_URL = "https://api-cpa.gov.pl/mc-profil-zaufany/1.0/TpSigning/addDocumentToSigning";
const CALLBACK_BASE = `${SUPABASE_URL}/functions/v1/pz-callback`;

async function getCpaToken(): Promise<string> {
  const credentials = btoa(`${PZ_CLIENT_ID}:${PZ_CLIENT_SECRET}`);
  const resp = await fetch("https://api-cpa.gov.pl/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`CPA token error: ${resp.status} ${err}`);
  }
  const data = await resp.json();
  return data.access_token;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSoap(params: {
  docBase64: string;
  successUrl: string;
  failureUrl: string;
  description: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:sig="http://signing.ws.comarch.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <sig:addDocumentToSigning>
      <doc>${params.docBase64}</doc>
      <successURL>${xmlEscape(params.successUrl)}</successURL>
      <failureURL>${xmlEscape(params.failureUrl)}</failureURL>
      <additionalInfo>${xmlEscape(params.description)}</additionalInfo>
    </sig:addDocumentToSigning>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function extractXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const { action, token } = body;

    if (action === "init") {
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

      // Get token → request → document
      const { data: tokenRow } = await supabase
        .from("signature_tokens")
        .select("id, request_id")
        .eq("token", token)
        .single();

      if (!tokenRow) {
        return new Response(JSON.stringify({ error: "Token not found" }), {
          status: 404, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: sigRequest } = await supabase
        .from("signature_requests")
        .select("document_id")
        .eq("id", tokenRow.request_id)
        .single();

      const { data: doc } = await supabase
        .from("documents")
        .select("name, content")
        .eq("id", sigRequest?.document_id)
        .single();

      // Extract plain text from document content
      let docText = doc?.name || "Dokument";
      const content = doc?.content;
      if (content) {
        if (typeof content === "string") {
          try {
            const parsed = JSON.parse(content);
            if (parsed?.sections) {
              docText = parsed.sections.map((s: any) => `${s.title || ""}\n${s.content || ""}`).join("\n\n");
            } else {
              docText = content;
            }
          } catch { docText = content; }
        } else if (content.sections) {
          docText = content.sections.map((s: any) => `${s.title || ""}\n${s.content || ""}`).join("\n\n");
        }
      }

      // Generate PDF with pdf-lib
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const page = pdfDoc.addPage([595, 842]); // A4
      const { height } = page.getSize();

      // Draw title
      page.drawText(doc?.name || "Dokument", {
        x: 50, y: height - 60, size: 16, font, color: rgb(0, 0, 0),
      });

      // Draw content (word-wrap at ~90 chars, handle newlines)
      const lines: string[] = [];
      for (const paragraph of docText.split('\n')) {
        const words = paragraph.split(' ');
        let line = '';
        for (const word of words) {
          if ((line + ' ' + word).trim().length > 90) {
            if (line) lines.push(line);
            line = word;
          } else {
            line = line ? line + ' ' + word : word;
          }
        }
        if (line) lines.push(line);
        lines.push(''); // paragraph break
      }

      let y = height - 100;
      for (const line of lines.slice(0, 60)) {
        if (y < 50) break;
        if (line) {
          page.drawText(line, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
        }
        y -= 15;
      }

      const pdfBytes = await pdfDoc.save();
      const docBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
      const successUrl = `${CALLBACK_BASE}?state=${encodeURIComponent(token)}&result=success`;
      const failureUrl = `${CALLBACK_BASE}?state=${encodeURIComponent(token)}&result=failure`;

      // Get CPA token
      const cpaToken = await getCpaToken();
      console.log("[pz-signing] Got CPA token");

      // Build and send SOAP
      const soapBody = buildSoap({
        docBase64,
        successUrl,
        failureUrl,
        description: doc?.name || "Dokument MaxMaster do podpisania",
      });

      console.log("[pz-signing] Calling CPA SOAP addDocumentToSigning");
      const soapResp = await fetch(CPA_SOAP_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cpaToken}`,
          "Content-Type": "application/xml",
        },
        body: soapBody,
      });

      const soapText = await soapResp.text();
      console.log("[pz-signing] CPA response status:", soapResp.status);
      console.log("[pz-signing] CPA response:", soapText.substring(0, 800));

      if (!soapResp.ok) {
        return new Response(JSON.stringify({
          error: "CPA SOAP error",
          status: soapResp.status,
          details: soapText.substring(0, 800),
        }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Extract signing URL — field name from response may vary
      const signingUrl =
        extractXmlValue(soapText, "addDocumentToSigningReturn") ||
        extractXmlValue(soapText, "return") ||
        extractXmlValue(soapText, "signingUrl") ||
        extractXmlValue(soapText, "url");

      if (!signingUrl) {
        return new Response(JSON.stringify({
          error: "No signing URL in SOAP response",
          soapResponse: soapText.substring(0, 1000),
        }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Store in token metadata
      await supabase.from("signature_tokens").update({
        metadata: {
          pz_initiated_at: new Date().toISOString(),
          pz_signing_url: signingUrl,
          signing_method: "pz",
        },
      }).eq("id", tokenRow.id);

      return new Response(JSON.stringify({ success: true, signingUrl }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[pz-signing] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

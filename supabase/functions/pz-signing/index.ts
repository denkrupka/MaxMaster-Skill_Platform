import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PZ_CLIENT_ID = Deno.env.get("PZ_CLIENT_ID") || "zzAxz3ZlYfP_FfBxgR0vgvQltUMa";
const PZ_CLIENT_SECRET = Deno.env.get("PZ_CLIENT_SECRET") || "xXJSvgIhUp9XpwsfBzFK7NnQrQYa";
const PZ_API = "https://api-cpa.gov.pl/mc-profil-zaufany/1.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getCPAToken(): Promise<string> {
  const res = await fetch("https://cpa.gov.pl/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${PZ_CLIENT_ID}&client_secret=${PZ_CLIENT_SECRET}`,
  });
  const data = await res.json();
  return data.access_token || "";
}

function extractXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<[^>]*${tag}[^>]*>([\\s\\S]*?)<\/[^>]*${tag}[^>]*>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const { action, token, documentContent, documentName, signingId } = body;

    // action: "init" — submit document to PZ for signing
    if (action === "init") {
      const cpToken = await getCPAToken();
      if (!cpToken) {
        return new Response(JSON.stringify({ error: "Nie udało się uzyskać tokenu CPA" }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Encode document content as base64
      const docBase64 = documentContent
        ? btoa(unescape(encodeURIComponent(documentContent)))
        : btoa("<dokument><tresc>Dokument MaxMaster</tresc></dokument>");

      const successURL = `${SUPABASE_URL}/functions/v1/pz-callback?status=success&token=${token}`;
      const failureURL = `${SUPABASE_URL}/functions/v1/pz-callback?status=failure&token=${token}`;

      const soapRequest = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sig="http://signing.ws.comarch.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <sig:addDocumentToSigning>
      <doc>${docBase64}</doc>
      <successURL>${successURL}</successURL>
      <failureURL>${failureURL}</failureURL>
      <additionalInfo>${documentName || "MaxMaster — podpisanie dokumentu"}</additionalInfo>
    </sig:addDocumentToSigning>
  </soapenv:Body>
</soapenv:Envelope>`;

      const pzRes = await fetch(`${PZ_API}/TpSigning/addDocumentToSigning`, {
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
          "Authorization": `Bearer ${cpToken}`,
        },
        body: soapRequest,
      });

      const pzXml = await pzRes.text();
      const signingUrl = extractXmlValue(pzXml, "addDocumentToSigningReturn");

      if (!signingUrl) {
        return new Response(JSON.stringify({ error: "Brak URL podpisywania w odpowiedzi PZ", raw: pzXml.substring(0, 500) }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Store signingId in signature_tokens.metadata for retrieval
      await fetch(`${SUPABASE_URL}/rest/v1/signature_tokens?token=eq.${token}`, {
        method: "PATCH",
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadata: { pz_signing_url: signingUrl, pz_initiated_at: new Date().toISOString() },
        }),
      });

      return new Response(JSON.stringify({ success: true, signingUrl }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // action: "get_signed" — retrieve signed document after user signed
    if (action === "get_signed") {
      const cpToken = await getCPAToken();
      const soapRequest = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sig="http://signing.ws.comarch.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <sig:getSignedDocument>
      <id>${signingId}</id>
    </sig:getSignedDocument>
  </soapenv:Body>
</soapenv:Envelope>`;

      const pzRes = await fetch(`${PZ_API}/TpSigning/getSignedDocument`, {
        method: "POST",
        headers: { "Content-Type": "application/xml", "Authorization": `Bearer ${cpToken}` },
        body: soapRequest,
      });

      const pzXml = await pzRes.text();
      const signedDocBase64 = extractXmlValue(pzXml, "getSignedDocumentReturn");

      // Mark token as used and store signed document
      if (token && signedDocBase64) {
        await fetch(`${SUPABASE_URL}/rest/v1/signature_tokens?token=eq.${token}`, {
          method: "PATCH",
          headers: {
            "apikey": SERVICE_KEY,
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            used_at: new Date().toISOString(),
            signature_data: signedDocBase64,
            metadata: {
              method: "profil_zaufany",
              pz_signing_id: signingId,
              signed_at: new Date().toISOString(),
            },
          }),
        });
      }

      return new Response(JSON.stringify({ success: true, signedDocument: signedDocBase64 ? "ok" : "pending" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

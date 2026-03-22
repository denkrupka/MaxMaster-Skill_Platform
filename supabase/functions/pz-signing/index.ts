import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PZ_CLIENT_ID = Deno.env.get("PZ_CLIENT_ID") || "zzAxz3ZlYfP_FfBxgR0vgvQltUMa";
const PZ_CLIENT_SECRET = Deno.env.get("PZ_CLIENT_SECRET") || "xXJSvgIhUp9XpwsfBzFK7NnQrQYa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://diytvuczpciikzdhldny.supabase.co";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CPA_SOAP_URL = "https://api-cpa.gov.pl/mc-profil-zaufany/1.0/TpSigning/addDocumentToSigning";
const CPA_GET_SIGNED_URL = "https://api-cpa.gov.pl/mc-profil-zaufany/1.0/TpSigning/getSignedDocument";
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/pz-callback`;

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

function buildAddDocumentSoap(params: {
  documentTitle: string;
  documentContent: string; // base64 encoded
  callbackUrl: string;
  signingId: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:tps="http://www.obywatel.gov.pl/ws/tpsigning">
  <soapenv:Body>
    <tps:addDocumentToSigning>
      <tps:systemId>MAXMASTER</tps:systemId>
      <tps:documentTitle>${params.documentTitle}</tps:documentTitle>
      <tps:documentContent>${params.documentContent}</tps:documentContent>
      <tps:callbackUrl>${params.callbackUrl}?state=${params.signingId}</tps:callbackUrl>
    </tps:addDocumentToSigning>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function buildGetSignedDocumentSoap(signingId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:tps="http://www.obywatel.gov.pl/ws/tpsigning">
  <soapenv:Body>
    <tps:getSignedDocument>
      <tps:signingId>${signingId}</tps:signingId>
    </tps:getSignedDocument>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function extractXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([\\s\\S]*?)<\/(?:[^:]+:)?${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const { action, token, documentId, signingId } = body;

    if (action === "init") {
      // Step 1: Get document content
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      
      // Get token row to find document
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
        .select("document_id, company_id")
        .eq("id", tokenRow.request_id)
        .single();

      const { data: doc } = await supabase
        .from("documents")
        .select("name, content, type")
        .eq("id", sigRequest?.document_id)
        .single();

      // Build document content — use text content encoded as base64
      let docText = doc?.name || "Dokument";
      if (doc?.content) {
        if (typeof doc.content === "string") {
          docText = doc.content;
        } else if (doc.content?.sections) {
          // TipTap sections format
          docText = doc.content.sections
            .map((s: { title?: string; content?: string }) => `${s.title || ""}\n${s.content || ""}`)
            .join("\n\n");
        } else {
          docText = JSON.stringify(doc.content);
        }
      }

      // base64 encode the document
      const docBase64 = btoa(unescape(encodeURIComponent(docText)));
      const docTitle = doc?.name || "Dokument MaxMaster";

      // Step 2: Get CPA Bearer token
      const cpaToken = await getCpaToken();
      console.log("Got CPA token:", cpaToken.substring(0, 20) + "...");

      // Step 3: Call SOAP addDocumentToSigning
      const soapBody = buildAddDocumentSoap({
        documentTitle: docTitle,
        documentContent: docBase64,
        callbackUrl: CALLBACK_URL,
        signingId: token, // Use our signature token as state
      });

      console.log("Calling CPA SOAP:", CPA_SOAP_URL);
      const soapResp = await fetch(CPA_SOAP_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cpaToken}`,
          "Content-Type": "text/xml; charset=UTF-8",
          "SOAPAction": "addDocumentToSigning",
        },
        body: soapBody,
      });

      const soapRespText = await soapResp.text();
      console.log("SOAP response status:", soapResp.status);
      console.log("SOAP response (first 500):", soapRespText.substring(0, 500));

      if (!soapResp.ok) {
        return new Response(JSON.stringify({ 
          error: "CPA SOAP error", 
          status: soapResp.status,
          details: soapRespText.substring(0, 500) 
        }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Extract signing URL from SOAP response
      const signingUrl = extractXmlValue(soapRespText, "addDocumentToSigningReturn") ||
                         extractXmlValue(soapRespText, "return") ||
                         extractXmlValue(soapRespText, "signingUrl");

      if (!signingUrl) {
        console.error("No signing URL in response:", soapRespText);
        return new Response(JSON.stringify({ 
          error: "No signing URL in SOAP response",
          soapResponse: soapRespText.substring(0, 1000)
        }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Step 4: Store signing info in token metadata
      await supabase.from("signature_tokens").update({
        metadata: { 
          pz_initiated_at: new Date().toISOString(),
          pz_signing_url: signingUrl,
          signing_method: "pz"
        }
      }).eq("id", tokenRow.id);

      return new Response(JSON.stringify({ success: true, signingUrl }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "get_signed") {
      // Called after callback to retrieve the signed document
      const cpaToken = await getCpaToken();
      const soapBody = buildGetSignedDocumentSoap(signingId || token);
      
      const soapResp = await fetch(CPA_GET_SIGNED_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cpaToken}`,
          "Content-Type": "text/xml; charset=UTF-8",
          "SOAPAction": "getSignedDocument",
        },
        body: soapBody,
      });

      const soapRespText = await soapResp.text();
      console.log("getSignedDocument response:", soapRespText.substring(0, 500));

      return new Response(JSON.stringify({ 
        success: soapResp.ok, 
        response: soapRespText.substring(0, 2000) 
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("pz-signing error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

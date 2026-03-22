import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://diytvuczpciikzdhldny.supabase.co";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PREVIEW_BASE = "https://denkrupka.github.io/maxmaster-preview";

serve(async (req) => {
  const url = new URL(req.url);

  console.log("[pz-callback]", req.method, url.pathname + url.search);
  console.log("[pz-callback] params:", Object.fromEntries(url.searchParams));

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  // pz.gov.pl redirects here after signing with ?state=<our_token>
  // May also include ?status=signed or ?error=... depending on PZ implementation
  const signToken = url.searchParams.get("state") || "";
  const status = url.searchParams.get("status") || "";
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description") || "";

  console.log("[pz-callback] signToken:", signToken, "status:", status, "error:", error);

  // Error from pz.gov.pl
  if (error) {
    console.error("[pz-callback] Error from pz.gov.pl:", error, errorDescription);
    if (signToken) {
      return Response.redirect(
        `${PREVIEW_BASE}/#/sign/${signToken}?pz_error=${encodeURIComponent(error)}`,
        302
      );
    }
    return new Response("OK", { status: 200 });
  }

  if (!signToken) {
    console.error("[pz-callback] No state/token parameter");
    return new Response("Missing state parameter", { status: 400 });
  }

  try {
    // Step 1: Call pz-signing get_signed to retrieve the signed document from CPA
    console.log("[pz-callback] Calling pz-signing get_signed for token:", signToken);
    const signRes = await fetch(`${SUPABASE_URL}/functions/v1/pz-signing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        action: "get_signed",
        token: signToken,
        signingId: signToken,
      }),
    });

    if (!signRes.ok) {
      const errText = await signRes.text();
      console.error("[pz-callback] pz-signing get_signed failed:", signRes.status, errText.substring(0, 200));
    } else {
      const signData = await signRes.json();
      console.log("[pz-callback] pz-signing get_signed OK, success:", signData.success);
    }

    // Step 2: Mark the signature token as used
    const now = new Date().toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/signature_tokens?token=eq.${signToken}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        used_at: now,
        signature_data: "profil_zaufany:soap_signed",
        metadata: {
          method: "profil_zaufany_soap",
          signed_at: now,
          pz_callback_status: status || "completed",
        },
      }),
    });
    console.log("[pz-callback] Token marked as signed");

    // Step 3: Check if all signers for this request are done
    try {
      const tokenLookup = await fetch(
        `${SUPABASE_URL}/rest/v1/signature_tokens?token=eq.${signToken}&select=id,request_id`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        }
      );

      if (tokenLookup.ok) {
        const tokens = await tokenLookup.json();
        if (tokens.length > 0 && tokens[0].request_id) {
          const requestId = tokens[0].request_id;

          const allTokensRes = await fetch(
            `${SUPABASE_URL}/rest/v1/signature_tokens?request_id=eq.${requestId}&select=used_at`,
            {
              headers: {
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${SERVICE_KEY}`,
              },
            }
          );

          if (allTokensRes.ok) {
            const allTokens = await allTokensRes.json();
            const allSigned = allTokens.length > 0 && allTokens.every((t: { used_at: string | null }) => t.used_at != null);
            console.log("[pz-callback] All tokens signed?", allSigned, `(${allTokens.filter((t: { used_at: string | null }) => t.used_at).length}/${allTokens.length})`);

            if (allSigned) {
              await fetch(
                `${SUPABASE_URL}/rest/v1/signature_requests?id=eq.${requestId}`,
                {
                  method: "PATCH",
                  headers: {
                    apikey: SERVICE_KEY,
                    Authorization: `Bearer ${SERVICE_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ status: "signed" }),
                }
              );
              console.log("[pz-callback] signature_requests status updated to 'signed'");
            }
          }
        }
      }
    } catch (statusErr) {
      console.error("[pz-callback] Status update error (non-fatal):", statusErr);
    }

    // Step 4: Redirect user to certificate page
    console.log("[pz-callback] Redirecting to certificate page");
    return Response.redirect(`${PREVIEW_BASE}/#/sign/${signToken}/certificate`, 302);

  } catch (e) {
    console.error("[pz-callback] Fatal error:", e);
    if (signToken) {
      return Response.redirect(`${PREVIEW_BASE}/#/sign/${signToken}?pz_error=1`, 302);
    }
    return new Response("OK", { status: 200 });
  }
});

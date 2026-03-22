import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PZ_CLIENT_ID = Deno.env.get("PZ_CLIENT_ID") || "zzAxz3ZlYfP_FfBxgR0vgvQltUMa";
const PZ_CLIENT_SECRET = Deno.env.get("PZ_CLIENT_SECRET") || "xXJSvgIhUp9XpwsfBzFK7NnQrQYa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PREVIEW_BASE = "https://denkrupka.github.io/maxmaster-preview";

serve(async (req) => {
  const url = new URL(req.url);

  // Log everything for debugging
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

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description") || "";

  // state format: "{token}:{uuid}"
  const [signToken, stateUuid] = state.split(":");

  console.log("[pz-callback] code:", code ? "present" : "missing", "state:", state, "signToken:", signToken);

  // Error from login.gov.pl or no code
  if (error || !code) {
    console.error("[pz-callback] Error from login.gov.pl:", error, errorDescription);
    if (signToken) {
      return Response.redirect(
        `${PREVIEW_BASE}/#/sign/${signToken}?pz_error=${encodeURIComponent(error || "no_code")}`,
        302
      );
    }
    // No token to redirect to — return 200 so login.gov.pl doesn't retry
    return new Response("OK", { status: 200 });
  }

  try {
    // Exchange authorization code for token with login.gov.pl
    const redirectUri = `${SUPABASE_URL}/functions/v1/pz-callback`;
    console.log("[pz-callback] Exchanging code, redirect_uri:", redirectUri);

    const tokenRes = await fetch("https://login.gov.pl/idp/profile/oidc/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: PZ_CLIENT_ID,
        client_secret: PZ_CLIENT_SECRET,
      }).toString(),
    });

    let userName = "Użytkownik PZ";
    let userPesel = "";
    let userEmail = "";

    if (tokenRes.ok) {
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      console.log("[pz-callback] Token exchange OK, access_token:", accessToken ? "present" : "missing");

      if (accessToken) {
        // Get userinfo
        const userRes = await fetch("https://login.gov.pl/idp/profile/oidc/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (userRes.ok) {
          const userInfo = await userRes.json();
          console.log("[pz-callback] UserInfo keys:", Object.keys(userInfo));
          userName = [userInfo.given_name, userInfo.family_name].filter(Boolean).join(" ") || userName;
          userPesel = userInfo.sub || "";
          userEmail = userInfo.email || "";
        } else {
          const errText = await userRes.text();
          console.error("[pz-callback] UserInfo failed:", userRes.status, errText.substring(0, 200));
        }
      }
    } else {
      const errText = await tokenRes.text();
      console.error("[pz-callback] Token exchange failed:", tokenRes.status, errText.substring(0, 300));
      // Continue anyway — we can still mark the signing attempt
    }

    // Mark token as signed via pz-signing EF
    if (signToken) {
      console.log("[pz-callback] Calling pz-signing get_signed for token:", signToken, "user:", userName);
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
          userName,
          userPesel,
          userEmail,
        }),
      });

      if (!signRes.ok) {
        const errText = await signRes.text();
        console.error("[pz-callback] pz-signing call failed:", signRes.status, errText.substring(0, 200));
      } else {
        console.log("[pz-callback] pz-signing get_signed OK");
      }

      // Also check if all signers are done → update signature_requests status
      try {
        // Get request_id from this token
        const tokenLookup = await fetch(
          `${SUPABASE_URL}/rest/v1/signature_tokens?token=eq.${signToken}&select=id,request_id,used_at`,
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

            // Get all tokens for this request
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
    }

    console.log("[pz-callback] Redirecting to certificate page");
    return Response.redirect(`${PREVIEW_BASE}/#/sign/${signToken}/certificate`, 302);
  } catch (e) {
    console.error("[pz-callback] Fatal error:", e);
    if (signToken) {
      return Response.redirect(`${PREVIEW_BASE}/#/sign/${signToken}?pz_error=1`, 302);
    }
    // Always return 200 to external caller
    return new Response("OK", { status: 200 });
  }
});

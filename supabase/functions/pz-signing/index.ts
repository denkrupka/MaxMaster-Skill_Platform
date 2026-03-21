import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PZ_CLIENT_ID = Deno.env.get("PZ_CLIENT_ID") || "zzAxz3ZlYfP_FfBxgR0vgvQltUMa";
const PZ_CLIENT_SECRET = Deno.env.get("PZ_CLIENT_SECRET") || "xXJSvgIhUp9XpwsfBzFK7NnQrQYa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getCPAToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: PZ_CLIENT_ID,
    client_secret: PZ_CLIENT_SECRET,
  });
  const res = await fetch("https://cpa.gov.pl/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  return data.access_token || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, token, redirectUri, documentId } = await req.json();

    // action: "init" — initiate PZ signing session
    if (action === "init") {
      const cpToken = await getCPAToken();
      if (!cpToken) {
        return new Response(JSON.stringify({ error: "Nie udało się pobrać tokenu CPA" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      // Try to call CPA Profil Zaufany API to get signing session
      // The redirect URL for PZ authentication
      const pzAuthUrl = `https://login.gov.pl/idp/profile/oidc/authorize` +
        `?client_id=${PZ_CLIENT_ID}` +
        `&response_type=code` +
        `&scope=openid%20profile` +
        `&redirect_uri=${encodeURIComponent(redirectUri || (SUPABASE_URL + "/functions/v1/pz-callback"))}` +
        `&state=${token}` +
        `&nonce=${crypto.randomUUID()}`;

      return new Response(JSON.stringify({
        success: true,
        redirectUrl: pzAuthUrl,
        cpaToken: cpToken.substring(0, 10) + "...", // partial for debug
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // action: "callback" — process PZ callback with authorization code
    if (action === "callback") {
      const { code, state: signToken } = await req.json().catch(() => ({ code: "", state: "" }));
      
      // Exchange code for token at PZ
      const tokenRes = await fetch("https://login.gov.pl/idp/profile/oidc/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code || "",
          client_id: PZ_CLIENT_ID,
          client_secret: PZ_CLIENT_SECRET,
          redirect_uri: SUPABASE_URL + "/functions/v1/pz-callback",
        }).toString(),
      });
      const tokenData = await tokenRes.json();
      
      // Get user info
      const userRes = await fetch("https://login.gov.pl/idp/profile/oidc/userinfo", {
        headers: { "Authorization": "Bearer " + tokenData.access_token },
      });
      const user = await userRes.json();
      
      // Update signature record
      if (signToken) {
        await fetch(`${SUPABASE_URL}/rest/v1/signature_tokens?token=eq.${signToken}`, {
          method: "PATCH",
          headers: {
            "apikey": SERVICE_KEY,
            "Authorization": "Bearer " + SERVICE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            used_at: new Date().toISOString(),
            metadata: {
              method: "profil_zaufany",
              pz_sub: user.sub,
              pz_name: user.name,
              pz_pesel: user.pesel,
              signed_at: new Date().toISOString(),
            },
          }),
        });
      }

      return new Response(JSON.stringify({ success: true, user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

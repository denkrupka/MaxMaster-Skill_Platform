import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PZ_CLIENT_ID = Deno.env.get("PZ_CLIENT_ID") || "zzAxz3ZlYfP_FfBxgR0vgvQltUMa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PZ_AUTHORIZE = "https://login.gov.pl/idp/profile/oidc/authorize";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const { action, token, signingId } = body;

    if (action === "init") {
      // Generate OIDC redirect URL — NO server-side CPA call needed
      const state = crypto.randomUUID();
      const nonce = crypto.randomUUID();
      const redirectUri = `${SUPABASE_URL}/functions/v1/pz-callback`;

      const params = new URLSearchParams({
        response_type: "code",
        client_id: PZ_CLIENT_ID,
        redirect_uri: redirectUri,
        scope: "openid profile",
        state: `${token}:${state}`,
        nonce,
        // Pass our token in state so callback can link back
      });

      const signingUrl = `${PZ_AUTHORIZE}?${params.toString()}`;

      // Store state in signature_tokens metadata for verification in callback
      if (token) {
        await fetch(`${SUPABASE_URL}/rest/v1/signature_tokens?token=eq.${token}`, {
          method: "PATCH",
          headers: {
            "apikey": SERVICE_KEY,
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            metadata: { pz_state: state, pz_nonce: nonce, pz_initiated_at: new Date().toISOString() },
          }),
        });
      }

      return new Response(JSON.stringify({ success: true, signingUrl }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // action: "get_signed" — called after OIDC callback, mark as signed
    if (action === "get_signed") {
      const { userName, userPesel, userEmail } = body;

      if (token) {
        await fetch(`${SUPABASE_URL}/rest/v1/signature_tokens?token=eq.${token}`, {
          method: "PATCH",
          headers: {
            "apikey": SERVICE_KEY,
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            used_at: new Date().toISOString(),
            signature_data: `profil_zaufany:${userPesel || 'verified'}`,
            metadata: {
              method: "profil_zaufany",
              signer_name: userName,
              signer_pesel: userPesel,
              signer_email: userEmail,
              signed_at: new Date().toISOString(),
            },
          }),
        });
      }

      return new Response(JSON.stringify({ success: true }), {
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

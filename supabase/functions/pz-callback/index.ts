import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PZ_CLIENT_ID = Deno.env.get("PZ_CLIENT_ID") || "zzAxz3ZlYfP_FfBxgR0vgvQltUMa";
const PZ_CLIENT_SECRET = Deno.env.get("PZ_CLIENT_SECRET") || "xXJSvgIhUp9XpwsfBzFK7NnQrQYa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PREVIEW_BASE = "https://denkrupka.github.io/maxmaster-preview";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error");

  // state format: "{token}:{uuid}"
  const [signToken] = state.split(":");

  if (error || !code) {
    return Response.redirect(`${PREVIEW_BASE}/#/sign/${signToken}?pz_error=1`, 302);
  }

  try {
    // Exchange code for token with login.gov.pl
    const redirectUri = `${SUPABASE_URL}/functions/v1/pz-callback`;
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

      if (accessToken) {
        // Get userinfo
        const userRes = await fetch("https://login.gov.pl/idp/profile/oidc/userinfo", {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });
        if (userRes.ok) {
          const userInfo = await userRes.json();
          userName = [userInfo.given_name, userInfo.family_name].filter(Boolean).join(" ") || userName;
          userPesel = userInfo.sub || "";
          userEmail = userInfo.email || "";
        }
      }
    }

    // Mark token as signed via pz-signing EF
    if (signToken) {
      await fetch(`${SUPABASE_URL}/functions/v1/pz-signing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SERVICE_KEY },
        body: JSON.stringify({
          action: "get_signed",
          token: signToken,
          userName,
          userPesel,
          userEmail,
        }),
      });
    }

    return Response.redirect(`${PREVIEW_BASE}/#/sign/${signToken}/certificate`, 302);

  } catch (e) {
    console.error("PZ callback error:", e);
    return Response.redirect(`${PREVIEW_BASE}/#/sign/${signToken}?pz_error=1`, 302);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// PZ callback after user signs — redirect to SignPage with result
serve(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const token = url.searchParams.get("token");
  const signingId = url.searchParams.get("id") || url.searchParams.get("doc");

  const previewBase = "https://denkrupka.github.io/maxmaster-preview";

  if (status === "success") {
    // Trigger get_signed to retrieve the document
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    try {
      await fetch(`${SUPABASE_URL}/functions/v1/pz-signing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SERVICE_KEY },
        body: JSON.stringify({ action: "get_signed", token, signingId }),
      });
    } catch (e) {
      console.error("get_signed failed:", e);
    }

    // Redirect to success page
    return Response.redirect(`${previewBase}/#/sign/${token}/certificate`, 302);
  }

  // failure
  return Response.redirect(`${previewBase}/#/sign/${token}?pz_error=1`, 302);
});

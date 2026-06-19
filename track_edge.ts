// ============================================================
//  Supabase Edge Function: track  (G9 Newsletter-Klick-Tracking)
//  Oeffentlicher Redirect: loggt den Klick (Kandidat/Stelle/Ziel) und
//  leitet dann auf die echte Ziel-URL weiter.
//  verify_jwt MUSS false sein (Empfaenger klickt ohne Login).
//  Schreibt mit SERVICE_ROLE (umgeht RLS). Liest URL aus ?u=<base64>.
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FALLBACK = "https://yavuzsenol.github.io/yavis";

function b64decode(s: string): string {
  try {
    // URL-sichere base64 zulassen
    const norm = s.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(escape(atob(norm)));
  } catch { return ""; }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const p = url.searchParams;
  let target = b64decode(p.get("u") || "");
  if (!/^https?:\/\//i.test(target)) target = FALLBACK;   // kein Open-Redirect auf Nicht-HTTP
  const kandidat_id = p.get("k") || null;
  const stelle_id = p.get("s") || null;
  const kampagne = p.get("c") || null;

  // Klick protokollieren (fire-and-forget; Redirect darf nie blockieren)
  try {
    await fetch(SUPABASE_URL + "/rest/v1/newsletter_klicks", {
      method: "POST",
      headers: {
        "apikey": SERVICE,
        "Authorization": "Bearer " + SERVICE,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        kandidat_id, stelle_id, kampagne, ziel_url: target,
        user_agent: req.headers.get("user-agent") || null,
      }),
    });
  } catch (_e) { /* Klick-Log fehlgeschlagen -> trotzdem weiterleiten */ }

  return new Response(null, { status: 302, headers: { "Location": target, "Cache-Control": "no-store" } });
});

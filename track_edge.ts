// ============================================================
//  Supabase Edge Function: track  (G9 Newsletter-Tracking)
//  Zwei Modi:
//   - Klick:   ?u=<base64-Ziel>&k=&s=&c=  -> loggt typ 'klick'  + 302-Redirect aufs Ziel
//   - Öffnung: ?o=1&k=&s=&c=             -> loggt typ 'oeffnung' + liefert 1x1-Transparent-GIF
//  verify_jwt MUSS false sein (Empfaenger ohne Login). Schreibt mit SERVICE_ROLE (umgeht RLS).
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FALLBACK = "https://yavuzsenol.github.io/yavis";

// 1x1 transparentes GIF
const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);

function b64decode(s: string): string {
  try {
    const norm = s.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(escape(atob(norm)));
  } catch { return ""; }
}

async function log(row: Record<string, unknown>) {
  try {
    await fetch(SUPABASE_URL + "/rest/v1/newsletter_klicks", {
      method: "POST",
      headers: {
        "apikey": SERVICE,
        "Authorization": "Bearer " + SERVICE,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch (_e) { /* Log-Fehler darf Auslieferung nie blockieren */ }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const p = url.searchParams;
  const kandidat_id = p.get("k") || null;
  const stelle_id = p.get("s") || null;
  const kampagne = p.get("c") || null;
  const user_agent = req.headers.get("user-agent") || null;

  // ----- Öffnungs-Pixel -----
  if (p.get("o") === "1") {
    await log({ kandidat_id, stelle_id, kampagne, ziel_url: "__OPEN__", typ: "oeffnung", user_agent });
    return new Response(PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Content-Length": String(PIXEL.length),
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  }

  // ----- Klick-Redirect -----
  let target = b64decode(p.get("u") || "");
  if (!/^https?:\/\//i.test(target)) target = FALLBACK; // kein Open-Redirect auf Nicht-HTTP
  await log({ kandidat_id, stelle_id, kampagne, ziel_url: target, typ: "klick", user_agent });
  return new Response(null, { status: 302, headers: { "Location": target, "Cache-Control": "no-store" } });
});

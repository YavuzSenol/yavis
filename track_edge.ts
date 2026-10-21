// ============================================================
//  Supabase Edge Function: track  (G9 Newsletter-Tracking + Abmeldung)
//  Drei Modi:
//   - Klick:     ?u=<base64-Ziel>&k=&s=&c=  -> loggt typ 'klick'  + 302-Redirect aufs Ziel
//   - Öffnung:   ?o=1&k=&s=&c=              -> loggt typ 'oeffnung' + liefert 1x1-Transparent-GIF
//   - Abmeldung: POST ?a=<kandidat_id>      -> setzt kandidaten.kein_newsletter = true, loggt typ 'abmeldung'
//                (aufgerufen von der Seite abmelden.html nach Klick auf „Newsletter abbestellen";
//                 ein reines GET meldet NIE ab, damit Link-Scanner von Mailprogrammen niemanden abmelden)
//  verify_jwt MUSS false sein (Empfaenger ohne Login). Schreibt mit SERVICE_ROLE (umgeht RLS).
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FALLBACK = "https://yavuzsenol.github.io/yavis";
const CORS = {
  "Access-Control-Allow-Origin": "https://yavuzsenol.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

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

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const p = url.searchParams;
  const kandidat_id = p.get("k") || null;
  const stelle_id = p.get("s") || null;
  const kampagne = p.get("c") || null;
  const user_agent = req.headers.get("user-agent") || null;

  // ----- Abmeldung (nur per POST) -----
  if (p.get("a") !== null) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (req.method !== "POST") return json({ ok: false, fehler: "nur POST" }, 405);
    const id = (p.get("a") || "").trim();
    if (!/^[A-Za-z0-9_\-]{3,80}$/.test(id)) return json({ ok: false, fehler: "ungueltiger Link" }, 400);
    try {
      const r = await fetch(SUPABASE_URL + "/rest/v1/kandidaten?id=eq." + encodeURIComponent(id) + "&geloescht_am=is.null", {
        method: "PATCH",
        headers: {
          "apikey": SERVICE,
          "Authorization": "Bearer " + SERVICE,
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify({ kein_newsletter: true, geaendert_am: new Date().toISOString() }),
      });
      if (!r.ok) return json({ ok: false, fehler: "Speichern fehlgeschlagen" }, 500);
      const rows = await r.json();
      if (!Array.isArray(rows) || rows.length === 0) return json({ ok: false, fehler: "Link nicht gefunden" }, 404);
      await log({ kandidat_id: id, stelle_id: null, kampagne: p.get("c") || null, ziel_url: "__ABMELDUNG__", typ: "abmeldung", user_agent });
      return json({ ok: true });
    } catch (_e) {
      return json({ ok: false, fehler: "Serverfehler" }, 500);
    }
  }

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

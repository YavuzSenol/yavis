// ============================================================
//  Supabase Edge Function: jobs
//  ÖFFENTLICH (ohne Login) — liefert die aktiven Stellen als JSON
//  für die Webflow-Homepage (Rubrik "Jobs"). Ersetzt das Zoho-Widget.
//
//  WICHTIG beim Deploy: "Verify JWT" für diese Funktion AUSSCHALTEN,
//  damit anonyme Webseiten-Besucher sie aufrufen können.
//
//  Nutzt die projektweiten Secrets SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//  (von Supabase automatisch gesetzt), um RLS zu umgehen und NUR die
//  öffentlichen Felder zurückzugeben (keine internen IDs, kein Gehalt).
// ============================================================

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Nur diese Felder werden öffentlich ausgegeben:
const FELDER = [
  "id", "jobtitel", "beschreibung", "stellentyp", "stadt", "plz",
  "bundesland", "land", "remote", "branche", "berufserfahrung",
  "erforderliche_skills", "anzahl_positionen", "oeffnungsdatum",
].join(",");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const base = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!base || !key) {
      return new Response(JSON.stringify({ ok: false, error: "Server nicht konfiguriert" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const u = new URL(req.url);
    const id = u.searchParams.get("id");
    let rest = `${base}/rest/v1/stellen?select=${FELDER}`;
    if (id) {
      rest += `&id=eq.${encodeURIComponent(id)}`;
    } else {
      // "aktiv/online" = Status In-progress
      rest += `&status=eq.In-progress&order=oeffnungsdatum.desc.nullslast`;
    }
    const r = await fetch(rest, { headers: { apikey: key, Authorization: "Bearer " + key } });
    const data = await r.json();
    return new Response(JSON.stringify({ ok: true, jobs: Array.isArray(data) ? data : [] }), {
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

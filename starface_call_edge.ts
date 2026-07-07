// Y.A.V.I.S. — Edge Function: starface-call
// Empfängt Anruf-Ereignisse aus der STARFACE-Telefonanlage (Modul-Baustein "HTTP-Request bei Anruf-Ende")
// und legt automatisch eine Anruf-Notiz beim passenden Kandidaten/der Firma an.
// Deploy via Management-API (slug "starface-call"), verify_jwt=FALSE (STARFACE kann sich nicht per Supabase-Auth anmelden).
// Schutz: geheimer Schlüssel als Query-Parameter ?key=... — ohne den wird nichts geschrieben.
//
// STARFACE ruft z.B. auf (GET oder POST):
//   https://<proj>.supabase.co/functions/v1/starface-call?key=SECRET&nummer=<Gegenstelle>&richtung=in&dauer=<Sek>&ts=<ISO>
//   Feld-Aliasse werden großzügig akzeptiert (nummer/number/caller/from/extern, richtung/direction, dauer/duration, ts/timestamp).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SECRET = Deno.env.get("STARFACE_KEY")!;  // als Supabase-Function-Secret hinterlegt (nicht im Code/Repo)
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// Nummer auf die "nationale Kernnummer" reduzieren: nur Ziffern, Ländervorwahl 49 / führende 0 weg.
function kern(v: string): string {
  let d = (v || "").replace(/\D/g, "");
  if (d.startsWith("0049")) d = d.slice(4);
  else if (d.startsWith("49") && d.length > 9) d = d.slice(2);
  d = d.replace(/^0+/, "");
  return d;
}
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(SB_URL + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  return r;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    const p: Record<string, string> = {};
    url.searchParams.forEach((v, k) => (p[k.toLowerCase()] = v));
    if (req.method === "POST") {
      try { const b = await req.json(); for (const k in b) p[k.toLowerCase()] = String(b[k]); } catch (_) { /* egal */ }
    }
    if (p.key !== SECRET) return j({ ok: false, error: "unauthorized" }, 401);

    const nummerRaw = p.nummer || p.number || p.caller || p.from || p.extern || p.remote || p.gegenstelle || "";
    if (!nummerRaw) return j({ ok: false, error: "nummer fehlt" }, 400);
    const dirRaw = (p.richtung || p.direction || p.dir || "").toLowerCase();
    const richtung = /out|raus|abgeh|outgoing/.test(dirRaw) ? "raus" : "rein";
    const dauer = parseInt(p.dauer || p.duration || p.seconds || "0") || 0;
    const tsRaw = p.ts || p.timestamp || p.time || "";
    let ts = new Date().toISOString();
    if (tsRaw) { const d = new Date(/^\d+$/.test(tsRaw) ? Number(tsRaw) * (tsRaw.length <= 10 ? 1000 : 1) : tsRaw); if (!isNaN(d.getTime())) ts = d.toISOString(); }
    const kur = kern(nummerRaw);
    if (kur.length < 5) return j({ ok: false, error: "nummer zu kurz", kern: kur }, 200);

    // Kandidaten-Telefonfelder laden und normalisiert vergleichen (Kernnummer gleich ODER 7-stelliger Suffix gleich)
    const passt = (feld?: string) => { const k = kern(feld || ""); return k && (k === kur || (k.length >= 7 && kur.length >= 7 && k.slice(-7) === kur.slice(-7))); };
    let treffer: { typ: "kandidat" | "kunde"; id: string; name: string } | null = null;

    const kr = await rest("kandidaten?select=id,voller_name,telefon,mobil,telefon_privat,mobil_privat&geloescht_am=is.null");
    const kand = kr.ok ? await kr.json() : [];
    for (const k of kand) { if (passt(k.telefon) || passt(k.mobil) || passt(k.telefon_privat) || passt(k.mobil_privat)) { treffer = { typ: "kandidat", id: k.id, name: k.voller_name || "" }; break; } }
    if (!treffer) {
      const fr = await rest("kunden?select=id,name,telefon&geloescht_am=is.null");
      const firmen = fr.ok ? await fr.json() : [];
      for (const f of firmen) { if (passt(f.telefon)) { treffer = { typ: "kunde", id: f.id, name: f.name || "" }; break; } }
    }
    if (!treffer) return j({ ok: true, matched: false, hinweis: "keine Person/Firma zu dieser Nummer gefunden", kern: kur });

    // Doppelschutz: dieselbe Anruf-Kennung (falls STARFACE eine mitschickt) nicht zweimal
    const callId = p.callid || p.uuid || p.id || "";
    const dauerTxt = dauer ? " · " + Math.floor(dauer / 60) + ":" + String(dauer % 60).padStart(2, "0") + " min" : "";
    const inhalt = "☎ Anruf " + (richtung === "raus" ? "(ausgehend)" : "(eingehend)") + dauerTxt + " · via STARFACE" + (callId ? " [" + callId + "]" : "");

    if (callId) {
      const ex = await rest("notizen?select=id&typ=eq.Anruf&inhalt=ilike.*" + encodeURIComponent("[" + callId + "]") + "*&limit=1");
      if (ex.ok && (await ex.json()).length) return j({ ok: true, matched: true, duplicate: true, person: treffer.name });
    }

    const row: Record<string, unknown> = { id: "sf_" + crypto.randomUUID(), typ: "Anruf", richtung, inhalt, erstellt_am: ts, geaendert_am: ts, modul: treffer.typ };
    row[treffer.typ === "kandidat" ? "kandidat_id" : "kunde_id"] = treffer.id;
    const ins = await rest("notizen", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
    if (!ins.ok) return j({ ok: false, error: "insert fehlgeschlagen: " + (await ins.text()).slice(0, 200) }, 500);

    // letzte_aktivitaet der Person/Firma auffrischen (best effort)
    await rest((treffer.typ === "kandidat" ? "kandidaten" : "kunden") + "?id=eq." + treffer.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ letzte_aktivitaet: ts }) }).catch(() => {});

    return j({ ok: true, matched: true, typ: treffer.typ, person: treffer.name, richtung });
  } catch (e) {
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});

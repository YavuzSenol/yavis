// Y.A.V.I.S. — Edge Function: starface-call
// Empfängt Anruf-Ereignisse aus der STARFACE-Telefonanlage (Modul-Baustein "HTTP-Request bei Anruf-Ende")
// und legt automatisch eine Anruf-Notiz beim passenden Kandidaten/der Firma an.
// LEITPRINZIP "kein Anruf geht verloren": Was den Server erreicht, wird IMMER persistiert —
//   Treffer -> Notiz bei der Person; alles andere (keine Nummer / zu kurz / kein Treffer / Insert-Fehler / Ausnahme)
//   -> Eintrag in Tabelle `anrufe_offen` (Sammelliste, in der App zuordenbar). Gilt für eingehend UND ausgehend.
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
// Eine Seite (Range) einer Tabelle holen — Supabase kappt sonst bei 1000 Zeilen.
async function restPage(path: string, from: number, size: number): Promise<any[]> {
  const r = await fetch(SB_URL + "/rest/v1/" + path, {
    headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json", "Range-Unit": "items", Range: from + "-" + (from + size - 1) },
  });
  return r.ok ? await r.json() : [];
}
// "Kein Anruf geht verloren": Anruf ohne Personen-Treffer (oder mit Fehler) hier festhalten. Scheitert NIE hart.
async function logOffen(o: { grund: string; nummer: string; kern: string; richtung: string; dauer: number; callid: string; ts: string }): Promise<boolean> {
  try {
    if (o.callid) {  // Doppelschutz nur, wenn STARFACE eine Anruf-Kennung mitschickt
      const ex = await rest("anrufe_offen?select=id&callid=eq." + encodeURIComponent(o.callid) + "&limit=1");
      if (ex.ok && (await ex.json()).length) return true;
    }
    const row = { id: "ao_" + crypto.randomUUID(), nummer: o.nummer || null, nummer_kern: o.kern || null, richtung: o.richtung, dauer: o.dauer, callid: o.callid || null, ts: o.ts, grund: o.grund, status: "offen", erstellt_am: o.ts };
    const r = await rest("anrufe_offen", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
    return r.ok;
  } catch (_) {
    return false; // best effort — der Aufrufer soll nie an dieser Stelle abstürzen
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Felder außerhalb des try, damit auch der catch-Zweig einen vollständigen Eintrag schreiben kann.
  let richtung = "rein", dauer = 0, ts = new Date().toISOString(), callId = "", nummerRaw = "", kur = "", authed = false;
  try {
    const url = new URL(req.url);
    const p: Record<string, string> = {};
    url.searchParams.forEach((v, k) => (p[k.toLowerCase()] = v));
    if (req.method === "POST") {
      try { const b = await req.json(); for (const k in b) p[k.toLowerCase()] = String(b[k]); } catch (_) { /* egal */ }
    }
    if (p.key !== SECRET) return j({ ok: false, error: "unauthorized" }, 401);
    authed = true;

    const dirRaw = (p.richtung || p.direction || p.dir || "").toLowerCase();
    richtung = /out|raus|abgeh|outgoing/.test(dirRaw) ? "raus" : "rein";
    dauer = parseInt(p.dauer || p.duration || p.seconds || "0") || 0;
    const tsRaw = p.ts || p.timestamp || p.time || "";
    if (tsRaw) { const d = new Date(/^\d+$/.test(tsRaw) ? Number(tsRaw) * (tsRaw.length <= 10 ? 1000 : 1) : tsRaw); if (!isNaN(d.getTime())) ts = d.toISOString(); }
    callId = p.callid || p.uuid || p.id || "";
    nummerRaw = p.nummer || p.number || p.caller || p.from || p.extern || p.remote || p.gegenstelle || "";
    kur = kern(nummerRaw);

    // (1) Keine Nummer (unterdrückt/anonym) -> trotzdem festhalten
    if (!nummerRaw) {
      const ok = await logOffen({ grund: "nummer_fehlt", nummer: "", kern: "", richtung, dauer, callid: callId, ts });
      return j({ ok: true, matched: false, offen: ok, grund: "nummer_fehlt" });
    }
    // (2) Nummer zu kurz (interne Nebenstelle o.ä.) -> festhalten
    if (kur.length < 5) {
      const ok = await logOffen({ grund: "nummer_kurz", nummer: nummerRaw, kern: kur, richtung, dauer, callid: callId, ts });
      return j({ ok: true, matched: false, offen: ok, grund: "nummer_kurz", kern: kur });
    }

    // Personen/Firmen abgleichen (Kernnummer gleich ODER 7-stelliger Suffix gleich), seitenweise, Abbruch beim ersten Treffer.
    const passt = (feld?: string) => { const k = kern(feld || ""); return k && (k === kur || (k.length >= 7 && kur.length >= 7 && k.slice(-7) === kur.slice(-7))); };
    let treffer: { typ: "kandidat" | "kunde"; id: string; name: string } | null = null;
    const PAGE = 1000;
    for (let from = 0; !treffer; from += PAGE) {
      const rows = await restPage("kandidaten?select=id,voller_name,telefon,mobil,telefon_privat,mobil_privat&geloescht_am=is.null", from, PAGE);
      for (const k of rows) { if (passt(k.telefon) || passt(k.mobil) || passt(k.telefon_privat) || passt(k.mobil_privat)) { treffer = { typ: "kandidat", id: k.id, name: k.voller_name || "" }; break; } }
      if (rows.length < PAGE) break;
    }
    if (!treffer) {
      for (let from = 0; !treffer; from += PAGE) {
        const rows = await restPage("kunden?select=id,name,telefon&geloescht_am=is.null", from, PAGE);
        for (const f of rows) { if (passt(f.telefon)) { treffer = { typ: "kunde", id: f.id, name: f.name || "" }; break; } }
        if (rows.length < PAGE) break;
      }
    }

    // (3) Kein Treffer -> in die Sammelliste, NICHT verwerfen
    if (!treffer) {
      const ok = await logOffen({ grund: "kein_treffer", nummer: nummerRaw, kern: kur, richtung, dauer, callid: callId, ts });
      return j({ ok: true, matched: false, offen: ok, grund: "kein_treffer", kern: kur });
    }

    // Treffer -> Notiz bei der Person
    const dauerTxt = dauer ? " · " + Math.floor(dauer / 60) + ":" + String(dauer % 60).padStart(2, "0") + " min" : "";
    const inhalt = "☎ Anruf " + (richtung === "raus" ? "(ausgehend)" : "(eingehend)") + dauerTxt + " · via STARFACE" + (callId ? " [" + callId + "]" : "");

    if (callId) {  // Doppelschutz über mitgesendete callid
      const ex = await rest("notizen?select=id&typ=eq.Anruf&inhalt=ilike.*" + encodeURIComponent("[" + callId + "]") + "*&limit=1");
      if (ex.ok && (await ex.json()).length) return j({ ok: true, matched: true, duplicate: true, person: treffer.name });
    }

    const row: Record<string, unknown> = { id: "sf_" + crypto.randomUUID(), typ: "Anruf", richtung, inhalt, erstellt_am: ts, geaendert_am: ts, modul: treffer.typ };
    row[treffer.typ === "kandidat" ? "kandidat_id" : "kunde_id"] = treffer.id;
    const ins = await rest("notizen", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
    // (4) Notiz-Insert scheitert -> Fallback in die Sammelliste, damit der Anruf nicht verloren geht
    if (!ins.ok) {
      const fehler = (await ins.text()).slice(0, 200);
      await logOffen({ grund: "insert_fehler", nummer: nummerRaw, kern: kur, richtung, dauer, callid: callId, ts });
      return j({ ok: true, matched: true, offen: true, grund: "insert_fehler", fehler });
    }

    // letzte_aktivitaet der Person/Firma auffrischen (best effort)
    await rest((treffer.typ === "kandidat" ? "kandidaten" : "kunden") + "?id=eq." + treffer.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ letzte_aktivitaet: ts }) }).catch(() => {});

    return j({ ok: true, matched: true, typ: treffer.typ, person: treffer.name, richtung });
  } catch (e) {
    // (5) Unerwartete Ausnahme -> Best-Effort-Eintrag (nur wenn authentifiziert), damit selbst dann nichts verloren geht.
    if (authed) { try { await logOffen({ grund: "fehler", nummer: nummerRaw, kern: kur, richtung, dauer, callid: callId, ts }); } catch (_) { /* egal */ } }
    return j({ ok: true, matched: false, offen: authed, fehler: String((e as Error).message || e) });
  }
});

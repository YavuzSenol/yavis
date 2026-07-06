// ============================================================
//  Supabase Edge Function: profil-auslesen
//  Nimmt EINEN Profiltext (z. B. aus LinkedIn/XING kopiert)
//  und gibt die extrahierten Kandidaten-Felder als JSON zurueck.
//  Identische Logik wie cv-auslesen, nur Text statt PDF.
//  Anthropic-Key kommt aus dem projektweiten Secret ANTHROPIC_API_KEY.
// ============================================================

const PROMPT = `Du bist ein Recruiting-Assistent. Lies den folgenden Profil-/Lebenslauf-Text aus und gib die Daten als JSON zurueck.
Gib NUR valides JSON zurueck, keine Erklaerung, keine Markdown-Zeichen. Wenn ein Feld nicht vorkommt, lass es leer ("").

Felder:
- vorname, nachname, email, telefon, mobil
- begruessung: Anrede, GENAU einer dieser Werte: "Herr", "Frau", "Herr Dr.", "Frau Dr.".
  Leite das Geschlecht aus dem Vornamen ab. "Dr." NUR ergaenzen, wenn ein echter Doktortitel (Dr.) vorkommt.
  Bei geschlechtsneutralem/unklarem Vornamen leer lassen ("").
- strasse, plz, stadt
- geburtstag (Format TT.MM.JJJJ)
- position_original: die AKTUELLE/juengste Berufsbezeichnung WOERTLICH wie im Text (z.B. "Projektleitender Ingenieur")
- berufsbezeichnung: ordne die aktuelle Position GENAU EINER der folgenden 21 Standard-Kategorien zu.

  WICHTIGE REGELN fuer die Einordnung:
  1) Eine LEITUNGS-Kategorie (Geschaeftsfuehrung, COO, Niederlassungsleitung, Kaufmaennische Leitung,
     Technische Leitung, Bereichsleitung, Abteilungsleitung, Teamleitung, Gesamtprojektleitung, Projektleitung)
     darfst du NUR vergeben, wenn der OFFIZIELLE JOBTITEL das ausdrueckt - also Worte wie
     "Leiter", "Leitung", "Head of", "Geschaeftsfuehrer", "Niederlassungsleiter", "Teamleiter",
     "Projektleiter", "Prokurist mit Leitungsfunktion" im Titel stehen.
  2) Formulierungen wie "verantwortlich fuer", "Hauptverantwortlicher", "zustaendig fuer den Bereich",
     "Ansprechpartner" sind KEINE Leitungstitel - sie fuehren NICHT zu einer Leitungs-Kategorie.
  3) Wenn kein echter Leitungstitel vorliegt, waehle die FACHLICHE Rolle
     (Ingenieur, Vertriebsingenieur, Kalkulator, Projektingenieur, Bauleitung, Objektueberwachung,
     Fachplanung, Arbeitssicherheit, Techniker, BIM Konstrukteur, technische Systemplanung).
  4) Im Zweifel ist "Ingenieur" der Standard.
  Kategorien-Liste: Geschaeftsfuehrung, COO, Niederlassungsleitung, Kaufmaennische Leitung,
  Technische Leitung, Bereichsleitung, Abteilungsleitung, Teamleitung, Gesamtprojektleitung, Projektleitung,
  Ingenieur, Vertriebsingenieur, Kalkulator, Projektingenieur, Bauleitung, Objektueberwachung, Fachplanung,
  Arbeitssicherheit, Techniker, BIM Konstrukteur, technische Systemplanung
- position_unsicher: true NUR wenn sich GAR KEINE fachliche Rolle erkennen laesst, sonst false.
  Wenn unsicher: setze berufsbezeichnung auf "Ingenieur" und position_unsicher auf true.
- arbeitgeber: der AKTUELLE/letzte Arbeitgeber (Firmenname), oder "".
- bei_firma_seit: seit wann die Person beim aktuellen Arbeitgeber ist. Format IMMER TT.MM.JJJJ.
  Ist nur Monat/Jahr bekannt (z.B. "seit 03/2019"): "01.03.2019". Ist nur das Jahr bekannt (z.B. "seit 2019"): "01.01.2019". Sonst "".
- in_position_seit: seit wann die Person in der AKTUELLEN Position ist (kann von bei_firma_seit abweichen, z.B. bei interner Befoerderung). Gleiches Format. Sonst "".
- firma_zuvor: der Arbeitgeber VOR dem aktuellen (die vorletzte Station im Werdegang), oder "".
- position_zuvor: die Berufsbezeichnung/der Jobtitel bei diesem vorherigen Arbeitgeber, woertlich wie angegeben, oder "".
- qualifikation, studiengang
- faehigkeiten (Skills, kommagetrennt)
- erfahrung_jahre (grobe Schaetzung als Zahl)
- profil_zusammenfassung (3-4 Saetze, Deutsch)
- xing_profil: vollstaendige XING-Profil-URL, falls im Text vorhanden (enthaelt "xing.com"), sonst "".
- linkedin_profil: vollstaendige LinkedIn-Profil-URL, falls im Text vorhanden (enthaelt "linkedin.com"), sonst "".

Profil-/Lebenslauf-Text:
`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { text } = await req.json().catch(() => ({}));
    if (!text || !String(text).trim()) {
      return json({ ok: false, error: "text fehlt im Request" });
    }
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ ok: false, error: "ANTHROPIC_API_KEY nicht gesetzt" });

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: PROMPT + String(text) }],
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return json({ ok: false, error: "Anthropic: " + (data?.error?.message || resp.status) });
    }
    const out = data?.content?.[0]?.text || "";
    const m = out.match(/\{[\s\S]*\}/);
    const fields = m ? JSON.parse(m[0]) : {};
    return json({ ok: true, fields });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});

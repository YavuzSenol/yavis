// Y.A.V.I.S. — Edge Function: Neuer Auftrag aus Freitext (Slug "auftrag-auslesen")
// Deployment: via Management-API (multipart), verify_jwt = true.
// Umgebungsvariable: ANTHROPIC_API_KEY (im Projekt bereits gesetzt).
// Eingabe:  { text: "<Auftragstext, Mail, Stellenanzeige, Notizen>" }
// Ausgabe:  { ok:true, auftrag:{ jobtitel, position, gewerk, branche, stellentyp, berufserfahrung, stadt, gehalt,
//             anzahl_positionen, kunde_name, ansprechpartner_name, beschreibung, erforderliche_skills,
//             suchprofil, suchstring_linkedin, suchstring_xing } }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = { ...CORS, "Content-Type": "application/json" };

const POSITIONEN = ["Geschäftsführung","COO","Niederlassungsleitung","Kaufmännische Leitung","Technische Leitung","Bereichsleitung","Abteilungsleitung","Teamleitung","Gesamtprojektleitung","Projektleitung","Projektingenieur","Ingenieur","Vertriebsingenieur","Fachplanung","technische Systemplanung","Bauleitung","Objektüberwachung","Kalkulator","BIM Konstrukteur","Techniker","Arbeitssicherheit"];
const GEWERKE = ["HKLS","Heizung","Lüftung","Klima","Kälte","Sanitär","Elektrotechnik","MSR","Gebäudeautomation","Brandschutz","Löschtechnik","Sprinkler","Nachrichtentechnik","Sicherheitstechnik","Reinraumtechnik","Lichtplanung"];
const BRANCHEN = ["Technische Gebäudeausrüstung","Engineering","Anlagenbau","Industrie","Rechenzentrum","Krankenhaus","Chemie","Pharma","Energie","Wasser- und Abwasserwirtschaft","Immobilien","Hochbau","Wohnungsbau","Planung / Beratung","Sonstige"];
const TYPEN = ["Direktvermittlung","Festanstellung","Zeitarbeit / ANÜ","Projektbasis / Freelance","Interimsmanagement"];
const ERFAHRUNG = ["Berufseinsteiger","1–3 Jahre","3–5 Jahre","5–10 Jahre","10+ Jahre"];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return new Response(JSON.stringify({ ok: false, error: "ANTHROPIC_API_KEY nicht gesetzt." }), { status: 500, headers: J });
    const { text } = await req.json();
    const t = String(text || "").trim();
    if (t.length < 20) return new Response(JSON.stringify({ ok: false, error: "Auftragstext fehlt oder ist zu kurz." }), { status: 400, headers: J });

    const prompt = `Du unterstützt eine Personalberatung für Technische Gebäudeausrüstung (TGA) und Hochbau/Schlüsselfertigbau (Ansprache: wir suchen im Auftrag eines Partners).
Aus dem folgenden Auftragstext erstellst du die Felder eines neuen Projekts.

AUFTRAGSTEXT:
"""
${t.slice(0, 12000)}
"""

Erlaubte Werte (genau so schreiben, sonst null):
- position: ${POSITIONEN.join(" | ")}
- gewerk: ${GEWERKE.join(" | ")}
- branche: ${BRANCHEN.join(" | ")}
- stellentyp: ${TYPEN.join(" | ")}
- berufserfahrung: ${ERFAHRUNG.join(" | ")}

Regeln:
- Erfinde nichts. Was nicht im Text steht, ist null (bei Listen: leere Liste). Gehalt nur, wenn genannt.
- jobtitel im Muster "Projektleiter (d/m/w) HKLS - Ratingen" (Titel, (d/m/w), Gewerk, Bindestrich, Ort). Ort weglassen, wenn unbekannt.
- kunde_name und ansprechpartner_name: nur wenn im Text genannt. Diese Namen dürfen NIRGENDS in beschreibung, suchprofil oder Suchstrings stehen.
- beschreibung: die Stellenanzeige in genau dieser Form, Klartext, Überschriften als eigene Zeilen, Aufzählungen mit "- ":

Unser Partner

<Ein bis zwei Sätze zum Auftraggeber, anonym: Branche, Größe, Ausrichtung, Standort. Danach ein Satz im Muster "Wir suchen einen erfahrenen <Titel> (d/m/w) für den Standort <Ort>.">

Ihr Verantwortungsbereich

- <5 bis 8 Aufgaben>

Das bringen Sie mit

- <4 bis 6 Anforderungen>

Das dürfen Sie erwarten

- <4 bis 7 Angebote, nur was im Text steht oder branchenüblich sachlich ohne Zahlen>

  Wichtig für die beschreibung: "Wir suchen" ist richtig. Besitzangaben wie "unser Team", "unser Standort" sind falsch, weil der Partner das besitzt: sage "das Team", "der Standort". Keine Gedankenstriche, keine Floskeln, keine Übertreibungen, Sie-Form.
- erforderliche_skills: Stichpunkte der Anforderungen, eine pro Zeile, mit "- ".
- suchprofil: 5 bis 8 Zeilen "Label: Inhalt" mit Labels aus Position, Fachgebiet, Erfahrung, Muss, Wunsch, Region, Ausschlüsse. Die Zeile "Ausschlüsse:" beginnt immer so und nennt: Bahn, Gleis, Oberleitung, Fahrleitung, LST, Eisenbahn, Tiefbau, Breitband, Architekt, Recruiter.
- suchstring_linkedin: boolescher Suchstring (AND, OR, NOT, Anführungszeichen, Klammern), Titel-Varianten und Gewerk-Synonyme per OR, Ausschlüsse per NOT, höchstens 300 Zeichen.
- suchstring_xing: einfacher, wenige Begriffe, höchstens 150 Zeichen.
- hinweise: Liste kurzer Sätze zu allem, was fehlt oder unklar ist und der Berater klären sollte (z. B. Gehalt, Ort, Vertraulichkeit). Höchstens 5.

Antworte NUR mit diesem JSON, kein Text davor oder danach:
{"jobtitel":null,"position":null,"gewerk":null,"branche":null,"stellentyp":null,"berufserfahrung":null,"stadt":null,"gehalt":null,"anzahl_positionen":null,"kunde_name":null,"ansprechpartner_name":null,"beschreibung":"","erforderliche_skills":"","suchprofil":"","suchstring_linkedin":"","suchstring_xing":"","hinweise":[]}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      }),
    });
    if (!claudeRes.ok) throw new Error(`Claude API Fehler ${claudeRes.status}: ${await claudeRes.text()}`);
    const data = await claudeRes.json();
    const raw: string = (data.content || []).filter((b: {type: string}) => b.type === "text").map((b: {text: string}) => b.text).join("");
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Kein gültiges JSON geliefert: " + raw.slice(0, 200));
    const o = JSON.parse(m[0]);
    const inListe = (v: unknown, l: string[]) => (typeof v === "string" && l.includes(v) ? v : null);
    const s = (v: unknown, max: number) => (v == null || v === "null" ? null : String(v).slice(0, max));
    const auftrag = {
      jobtitel: s(o.jobtitel, 200),
      position: inListe(o.position, POSITIONEN),
      gewerk: inListe(o.gewerk, GEWERKE),
      branche: inListe(o.branche, BRANCHEN),
      stellentyp: inListe(o.stellentyp, TYPEN),
      berufserfahrung: inListe(o.berufserfahrung, ERFAHRUNG),
      stadt: s(o.stadt, 100),
      gehalt: s(o.gehalt, 100),
      anzahl_positionen: Number.isFinite(Number(o.anzahl_positionen)) && Number(o.anzahl_positionen) > 0 ? Number(o.anzahl_positionen) : null,
      kunde_name: s(o.kunde_name, 200),
      ansprechpartner_name: s(o.ansprechpartner_name, 200),
      beschreibung: s(o.beschreibung, 6000) || "",
      erforderliche_skills: s(o.erforderliche_skills, 2000) || "",
      suchprofil: s(o.suchprofil, 1500) || "",
      suchstring_linkedin: s(o.suchstring_linkedin, 600) || "",
      suchstring_xing: s(o.suchstring_xing, 400) || "",
      hinweise: Array.isArray(o.hinweise) ? o.hinweise.slice(0, 5).map((x: unknown) => String(x).slice(0, 200)) : [],
    };
    return new Response(JSON.stringify({ ok: true, auftrag, usage: data.usage || null }), { headers: J });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), { status: 500, headers: J });
  }
});

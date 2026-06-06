// ============================================================
//  Supabase Edge Function: recherche-nlp
//  Nimmt eine natürlichsprachliche Suchanfrage und gibt
//  strukturierte Filterparameter als JSON zurück.
//  verify_jwt: OFF (App-intern, kein öffentlicher Zugriff)
// ============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `Du bist ein Assistent fuer die Recruiting-Software YAVIS (TGA/Bau-Recruiting, Deutschland).
Interpretiere die Suchanfrage und gib strukturierte Filterparameter als JSON zurueck.
Gib NUR valides JSON zurueck, keine Erklaerung, keine Markdown-Formatierung.

Verfuegbares JSON-Schema:
{
  "suche_in": string[],  // Array mit einem oder mehreren: "kandidaten", "kunden", "kontakte"

  // Kandidaten-Filter (wenn suche_in "kandidaten" enthaelt):
  "position": string,         // EXAKT einer dieser 21 Werte:
                              // Geschaeftsfuehrung, COO, Niederlassungsleitung, Kaufmaennische Leitung,
                              // Technische Leitung, Bereichsleitung, Abteilungsleitung, Teamleitung,
                              // Gesamtprojektleitung, Projektleitung, Ingenieur, Vertriebsingenieur,
                              // Kalkulator, Projektingenieur, Bauleitung, Objektueberwachung,
                              // Fachplanung, Arbeitssicherheit, Techniker, BIM Konstrukteur, technische Systemplanung
  "posUnter": boolean,        // Position und alle hierarchisch darunter einbeziehen
  "plz": string,              // PLZ (5-stellig) fuer Umkreissuche
  "radius": number,           // Umkreis in km, Standard 50
  "tags": string[],           // Tags aus: HKLS, Elektrotechnik, Versorgungstechnik, Heizung, Lueftung,
                              // Klima, Kaelte, Sanitaer, Sprinkler, MSR/Gebaeudeautomation, Brandschutz,
                              // TGA allgemein, Tiefbau, Hochbau, Ingenieurbau, Schluesselfertiger Bau,
                              // Generalunternehmen, Rohrleitungsbau, ELT, SGA, Industrie, Pharma, Chemie,
                              // Automotive, Lebensmittel, Energie, Versorgung, Rechenzentren, Krankenhaeuser,
                              // Oeffentliche Bauten, Wohnungsbau, Buerogebaeude, Hotels, Einzelhandel,
                              // Logistik, Bildung, AutoCAD, Revit, EPLAN, DDS-CAD, Trimble, Linear, BIM, SAP
  "tagModus": string,         // "und" | "oder" | "nicht"
  "arbeitgeber": string,      // Arbeitgeber-Feld enthaelt diesen Text
  "arbeitgeberNicht": string, // Arbeitgeber-Feld enthaelt NICHT diesen Text
  "mitProfil": boolean,       // nur Kandidaten mit XING oder LinkedIn
  "luecke": string,           // "keinHandy" | "keinEmail" | "keinProfil" | "keinPosition" | "keinArbeitgeber"
  "abwerbeschutz": boolean,   // true = nur Abwerbeschutz-Kandidaten, false = nur ohne
  "name": string,             // Freitext in Name, Berufsbezeichnung, Faehigkeiten, Stadt, Arbeitgeber

  // Kunden-Filter (wenn suche_in "kunden" enthaelt):
  "kundenTyp": string[],      // "Auftraggeber" | "Auftraggeber Potenzial" | "Dienstleister" | "Lieferant" | "Sonstige"
  "kundenName": string,       // Firmenname enthaelt
  "kundenBranche": string     // Branche enthaelt
}

Wichtige Hinweise:
- "HKLS" = Heizung, Lueftung, Klima, Sanitaer (haeufigstes Gewerk TGA)
- "nicht bei X" / "ohne X" / "ausser bei X" => arbeitgeberNicht
- "bei X" / "arbeitet bei X" / "Mitarbeiter von X" => arbeitgeber
- "Auftraggeber Potenzial" = moegliche Neukunden, noch kein aktiver Auftraggeber
- PLZ-Gebiete: 50xxx/51xxx = Koeln, 40xxx = Duesseldorf, 60xxx = Frankfurt, 70xxx = Stuttgart, 80xxx = Muenchen, 10xxx = Berlin, 20xxx = Hamburg
- Wenn nur nach Kandidaten gesucht wird: suche_in = ["kandidaten"]
- Wenn nur nach Firmen/Kunden gesucht wird: suche_in = ["kunden"]
- Felder die nicht aus der Anfrage erkennbar sind: WEGLASSEN (nicht null oder "" setzen)
- "Teamleiter" => Teamleitung, "Projektleiter" => Projektleitung, "GF" => Geschaeftsfuehrung

Suchanfrage:
`;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
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
        max_tokens: 800,
        messages: [{ role: "user", content: PROMPT + String(text) }],
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return json({ ok: false, error: "Anthropic: " + (data?.error?.message || resp.status) });
    }
    const out = data?.content?.[0]?.text || "";
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return json({ ok: false, error: "Kein JSON in Antwort: " + out.slice(0, 200) });
    const filter = JSON.parse(m[0]);
    return json({ ok: true, filter });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});

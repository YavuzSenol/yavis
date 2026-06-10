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

const PROMPT = `Du bist ein Filter-Parser fuer die Recruiting-Software YAVIS (TGA/Bau, Deutschland).
Wandle die Suchanfrage in strukturierte Filter um und gib NUR valides JSON zurueck (keine Erklaerung, kein Markdown).
Felder, die in der Anfrage NICHT vorkommen: WEGLASSEN (nicht null oder "" setzen).

JSON-Schema (alle Felder optional):
{
  "suche_in": string[],            // ["kandidaten"] (Standard) oder ["kunden"]; "kunden" nur wenn klar nach Firmen gefragt wird

  // --- Person / Kandidat ---
  "position": string,              // GENAU einer (mit Umlauten!): Geschäftsführung, COO, Niederlassungsleitung,
                                   // Kaufmännische Leitung, Technische Leitung, Bereichsleitung, Abteilungsleitung,
                                   // Teamleitung, Gesamtprojektleitung, Projektleitung, Projektingenieur, Ingenieur,
                                   // Vertriebsingenieur, Fachplanung, technische Systemplanung, Bauleitung,
                                   // Objektüberwachung, Kalkulator, BIM Konstrukteur, Techniker, Arbeitssicherheit
  "posUnter": boolean,             // "und darunter" / "ab ... abwaerts"
  "rolle": string,                 // "kandidat" | "ansprechpartner" | "doppel" (Doppelrolle)
  "plz": string,                   // 5-stellige PLZ fuer Umkreissuche (bei Stadt: typische PLZ verwenden)
  "radius": number,                // km, Standard 50
  "bundesland": string[],          // exakte Namen: Baden-Württemberg, Bayern, Berlin, Brandenburg, Bremen, Hamburg,
                                   // Hessen, Mecklenburg-Vorpommern, Niedersachsen, Nordrhein-Westfalen, Rheinland-Pfalz,
                                   // Saarland, Sachsen, Sachsen-Anhalt, Schleswig-Holstein, Thüringen
  "qualifikation": string,         // Freitext, z.B. "Techniker", "Meister", "Diplom"
  "studiengang": string,           // Freitext, z.B. "Versorgungstechnik", "Elektrotechnik"
  "arbeitgeber": string,           // "bei X" / "arbeitet bei X"
  "name": string,                  // Freitext (Name/Stadt/Skills/Arbeitgeber)
  "tags": string[], "tagModus": string,   // tagModus: "und" | "oder" | "nicht"

  // Erreichbarkeit (POSITIV = hat etwas):
  "mailMode": string,              // "irgendeine" | "privat" | "beruflich"   ("mit E-Mail" => "irgendeine")
  "telMode": string,               // "irgendeine" | "mobil" | "festnetz" | "mobilpriv" | "mobilberuf"
  "luecke": string,                // NUR fuer "OHNE": "keinEmail" | "keinHandy" | "keinProfil" | "keinPosition"
  "mitProfil": boolean,            // "mit XING/LinkedIn"
  "hatDok": boolean,               // "mit Lebenslauf/CV/Dokument"

  // Bereiche (Zahlen):
  "gehaltVon": number, "gehaltBis": number,   // erwartetes Gehalt in EUR
  "erfVon": number, "erfBis": number,         // Berufserfahrung in Jahren
  "alterVon": number, "alterBis": number,     // Alter in Jahren

  "istHot": boolean,               // "heiss" / "Hot" / "Top-Kandidat"
  "abwerbeschutz": boolean,        // "mit Abwerbeschutz" = true, "kein/ohne Abwerbeschutz" = false
  "wertungAusschluss": string[],   // auszuschliessende Wertungen: z.B. "vermittelt","nicht vermittelbar","Rente","zu alt","generell kein Interesse"
  "quelle": string[],              // z.B. "XING","LinkedIn","Internal"

  // --- Firmen (nur wenn suche_in ["kunden"]) ---
  "kundenTyp": string[], "kundenName": string, "kundenBranche": string
}

NEGATION vs. POSITIV — SEHR WICHTIG, nicht verwechseln:
- "mit E-Mail" / "hat E-Mail" / "per Mail erreichbar"   => mailMode:"irgendeine"   (NICHT luecke!)
- "mit beruflicher E-Mail" => mailMode:"beruflich" ; "private E-Mail" => mailMode:"privat"
- "ohne E-Mail" / "keine E-Mail-Adresse"                => luecke:"keinEmail"
- "mit Handy/Mobil" => telMode:"mobil" ; "mit Telefon" => telMode:"irgendeine" ; "ohne Telefonnummer" => luecke:"keinHandy"
- "kein/ohne Abwerbeschutz" => abwerbeschutz:false ; "geschuetzt"/"mit Abwerbeschutz" => abwerbeschutz:true

Weitere Hinweise:
- "HKLS" = Heizung/Lueftung/Klima/Sanitaer. "TGA-Planer" => position Fachplanung + tags ["TGA allgemein"].
- "Teamleiter"=>Teamleitung, "Projektleiter"=>Projektleitung, "GF"/"Geschaeftsfuehrer"=>Geschäftsführung, "NL-Leiter"=>Niederlassungsleitung
- Bundeslandname ("in NRW","Bayern") => bundesland (NRW = Nordrhein-Westfalen). Stadt/Ort ("Koeln","um Frankfurt") => plz + radius.
- PLZ: Koeln 50667, Duesseldorf 40213, Frankfurt 60311, Stuttgart 70173, Muenchen 80331, Berlin 10115, Hamburg 20095.
- "mindestens 5 Jahre Erfahrung"=>erfVon:5 ; "Gehalt bis 80k"=>gehaltBis:80000 ; "ab 70000"=>gehaltVon:70000
- "zwischen 40 und 55 Jahre"=>alterVon:40,alterBis:55 ; "Mitte 40"=>alterVon:43,alterBis:47
- "Ansprechpartner bei Firma X" => rolle:"ansprechpartner" (+ ggf. arbeitgeber/kundenName X)

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

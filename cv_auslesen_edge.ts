// Y.A.V.I.S. — Edge Function: CV einlesen
// Deployment: Supabase Dashboard → Edge Functions → New Function → Name: "cv-auslesen" → Code einfügen
// Umgebungsvariable: ANTHROPIC_API_KEY im Supabase Dashboard setzen (Settings → Edge Functions → Secrets)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const POSITIONEN = [
  "Geschäftsführung","COO","Niederlassungsleitung","Kaufmännische Leitung",
  "Technische Leitung","Bereichsleitung","Abteilungsleitung","Teamleitung",
  "Gesamtprojektleitung","Projektleitung","Ingenieur","Vertriebsingenieur",
  "Kalkulator","Projektingenieur","Bauleitung","Objektüberwachung",
  "Fachplanung","Arbeitssicherheit","Techniker","BIM Konstrukteur",
  "technische Systemplanung",
].join(", ");

const PROMPT = `Lies diesen Lebenslauf und extrahiere die Felder als JSON.

BERUFSBEZEICHNUNG-REGEL (berufsbezeichnung):
Wähle EXAKT eine der folgenden 21 Positionen – keine anderen Werte erlaubt:
${POSITIONEN}

Leitungsregel: Eine Leitungs-Kategorie (z.B. Projektleitung, Bereichsleitung) NUR bei echtem Jobtitel mit den Wörtern "Leiter", "Leitung", "Head of" oder "GF/Geschäftsführer". Formulierungen wie "verantwortlich für", "Projektverantwortung" oder "koordiniert" zählen NICHT als Leitung → dann fachliche Rolle wählen (meist Ingenieur). Im Zweifel: "Ingenieur [PRÜFEN]".

RANGREGEL (wichtig): Nennt der Jobtitel MEHRERE Positionen (z.B. "Fachplaner und Projektleiter"), wähle IMMER die ranghöhere. Die obige 21er-Liste ist von hoch nach niedrig sortiert (Geschäftsführung am höchsten, Techniker am niedrigsten). Beispiel: "Fachplaner und Projektleiter" → "Projektleitung" (nicht "Fachplanung").

WERDEGANG-REGELN (arbeitgeber, bei_firma_seit, in_position_seit, firma_zuvor, position_zuvor):
- "arbeitgeber": der AKTUELLE/letzte Arbeitgeber (Firmenname), oder null.
- "bei_firma_seit": seit wann die Person beim aktuellen Arbeitgeber ist. Format IMMER TT.MM.JJJJ.
  Ist nur Monat/Jahr bekannt (z.B. "seit 03/2019"): "01.03.2019". Ist nur das Jahr bekannt (z.B. "seit 2019"): "01.01.2019". Sonst null.
- "in_position_seit": seit wann die Person in der AKTUELLEN Position ist (kann von bei_firma_seit abweichen, wenn es eine interne Beförderung gab). Gleiches Format wie oben. Sonst null.
- "firma_zuvor": der Arbeitgeber VOR dem aktuellen (die vorletzte Station im Werdegang), oder null.
- "position_zuvor": die Berufsbezeichnung/der Jobtitel bei diesem vorherigen Arbeitgeber, wörtlich wie angegeben, oder null.

Antworte NUR mit folgendem JSON-Objekt, kein Text davor oder danach:
{
  "berufsbezeichnung": "eine der 21 erlaubten Positionen",
  "position_original": "genaue Berufsbezeichnung aus dem CV, wörtlich",
  "vorname": "Vorname oder null",
  "nachname": "Nachname oder null",
  "geburtstag": "YYYY-MM-DD oder null",
  "mobil_privat": "private Mobilnummer aus dem CV oder null",
  "qualifikation": "höchster Abschluss z.B. Dipl.-Ing., B.Sc., M.Sc. oder null",
  "studiengang": "Studiengang oder null",
  "erfahrung_jahre": "Anzahl Berufsjahre als Zahl (ohne Einheit) oder null",
  "faehigkeiten": "kommagetrennte Skills und Fachgebiete oder null",
  "profil_zusammenfassung": "3–5 Sätze sachliche Zusammenfassung der Qualifikationen oder null",
  "arbeitgeber": "aktueller Arbeitgeber oder null",
  "bei_firma_seit": "TT.MM.JJJJ oder null",
  "in_position_seit": "TT.MM.JJJJ oder null",
  "firma_zuvor": "vorheriger Arbeitgeber oder null",
  "position_zuvor": "vorherige Position, wörtlich, oder null"
}`;

serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // Anthropic-Key aus Umgebungsvariable
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "ANTHROPIC_API_KEY nicht gesetzt. Bitte im Supabase Dashboard unter Settings → Edge Functions → Secrets eintragen." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Request-Body lesen — PDF, Bild (PNG/JPEG/WebP/GIF, z.B. Screenshot) ODER reiner Text
    const { pdf_base64, image_base64, media_type, cv_text } = await req.json();
    if (!pdf_base64 && !image_base64 && !cv_text) {
      return new Response(
        JSON.stringify({ ok: false, error: "pdf_base64, image_base64 oder cv_text fehlt im Request" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Content-Blöcke je nach Quelle zusammenstellen
    const ERLAUBTE_BILD_TYPEN = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    // Echtes Bildformat aus den ersten Bytes erkennen (Dateiname/„media_type" kann falsch sein,
    // z.B. umbenannte oder aus der Zwischenablage eingefügte Datei).
    const sniffBildTyp = (b64: string, fallback: string): string => {
      try {
        const bin = atob(b64.slice(0, 24));
        const b = (i: number) => bin.charCodeAt(i);
        if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
        if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
        if (bin.slice(0, 4) === "GIF8") return "image/gif";
        if (bin.slice(0, 4) === "RIFF" && bin.slice(8, 12) === "WEBP") return "image/webp";
      } catch (_) { /* Fallback unten */ }
      return ERLAUBTE_BILD_TYPEN.includes(fallback) ? fallback : "image/png";
    };
    let content;
    if (cv_text) {
      // Reiner Text: CV-Text + Prompt in einem Text-Block
      content = [
        { type: "text", text: PROMPT + "\n\nLEBENSLAUF-TEXT:\n" + String(cv_text) },
      ];
    } else {
      const quelleBlock = image_base64
        ? {
            type: "image",
            source: {
              type: "base64",
              media_type: sniffBildTyp(image_base64, media_type),
              data: image_base64,
            },
          }
        : {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdf_base64,
            },
          };
      content = [quelleBlock, { type: "text", text: PROMPT }];
    }

    // Claude aufrufen
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content,
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude API Fehler ${claudeRes.status}: ${errText}`);
    }

    const claudeData = await claudeRes.json();
    const rawText: string = claudeData.content?.[0]?.text ?? "";

    // JSON aus der Antwort extrahieren
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude hat kein gültiges JSON geliefert: " + rawText.slice(0, 200));

    const fields = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({ ok: true, fields }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});

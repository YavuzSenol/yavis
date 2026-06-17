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
  "profil_zusammenfassung": "3–5 Sätze sachliche Zusammenfassung der Qualifikationen oder null"
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
              media_type: ERLAUBTE_BILD_TYPEN.includes(media_type) ? media_type : "image/png",
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

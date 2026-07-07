// Y.A.V.I.S. — Edge Function: KI-Matching (Feinbewertung Kandidat ↔ Stelle)
// Deployment: via Management-API (slug "matching"), wie cv-auslesen.
// Umgebungsvariable: ANTHROPIC_API_KEY (ist im Projekt bereits gesetzt, gleiche wie CV-Auslese).
// Eingabe:  { stelle: {jobtitel, gewerk, position, stadt, gehalt, beschreibung, skills},
//             kandidaten: [{id, position, position_original, faehigkeiten, qualifikation, studiengang,
//                           erfahrung_jahre, arbeitgeber, profil, wechselmotivation, positionswunsch,
//                           umzugsbereitschaft, wunschregion, entfernung_km}, …] }  (max 20)
// Ausgabe:  { ok:true, bewertungen: [{id, score, grund, bedenken}] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "ANTHROPIC_API_KEY nicht gesetzt." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const { stelle, kandidaten } = await req.json();
    if (!stelle || !Array.isArray(kandidaten) || !kandidaten.length) {
      return new Response(
        JSON.stringify({ ok: false, error: "stelle oder kandidaten fehlt im Request" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    const kand = kandidaten.slice(0, 20); // Kostendeckel: max 20 pro Aufruf

    const stelleTxt = [
      "Jobtitel: " + (stelle.jobtitel || "?"),
      stelle.position ? "Position (normiert): " + stelle.position : "",
      stelle.gewerk ? "Gewerk: " + stelle.gewerk : "",
      stelle.stadt ? "Ort: " + stelle.stadt : "",
      stelle.gehalt ? "Gehalt: " + stelle.gehalt : "",
      stelle.beschreibung ? "Beschreibung: " + String(stelle.beschreibung).slice(0, 1500) : "",
      stelle.skills ? "Anforderungen/Skills: " + String(stelle.skills).slice(0, 1000) : "",
    ].filter(Boolean).join("\n");

    const kandTxt = kand.map((k: Record<string, unknown>, i: number) => {
      const z = (label: string, v: unknown, max = 300) =>
        v ? label + ": " + String(v).slice(0, max) : "";
      return [
        "KANDIDAT " + (i + 1) + " (id: " + k.id + ")",
        z("Berufsbezeichnung", k.position),
        z("Position laut CV", k.position_original),
        z("Fähigkeiten", k.faehigkeiten, 500),
        z("Qualifikation", k.qualifikation),
        z("Studiengang", k.studiengang),
        z("Berufsjahre", k.erfahrung_jahre),
        z("Arbeitgeber", k.arbeitgeber),
        z("Profil", k.profil, 600),
        z("Wechselmotivation", k.wechselmotivation),
        z("Positionswunsch", k.positionswunsch),
        z("Umzugsbereitschaft", k.umzugsbereitschaft),
        z("Wunschregion", k.wunschregion),
        k.entfernung_km != null ? "Entfernung zur Stelle: " + Math.round(Number(k.entfernung_km)) + " km" : "",
      ].filter(Boolean).join("\n");
    }).join("\n\n");

    const prompt = `Du bist Recruiting-Assistent einer Personalberatung für Technische Gebäudeausrüstung (TGA).
Bewerte, wie gut jeder Kandidat fachlich zur folgenden Stelle passt.

STELLE:
${stelleTxt}

KANDIDATEN:
${kandTxt}

Bewertungsregeln:
- score: 0–100 (fachliche Passung: Position/Rang, Gewerk, Skills, Erfahrung; Entfernung nur leicht gewichten — Umzugsbereitschaft beachten).
- grund: EIN kurzer sachlicher Satz, warum der Kandidat passt (das Stärkste zuerst).
- bedenken: EIN kurzer Satz zum größten Fragezeichen, oder null wenn keins.
- Keine Floskeln, keine Übertreibungen. Fehlen Infos zu einem Kandidaten, bewerte konservativ und nenne das als Bedenken.

Antworte NUR mit folgendem JSON-Array, kein Text davor oder danach — genau ein Objekt je Kandidat, in derselben Reihenfolge:
[{"id":"<id des Kandidaten>","score":0,"grund":"…","bedenken":"… oder null"}]`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude API Fehler ${claudeRes.status}: ${errText}`);
    }

    const claudeData = await claudeRes.json();
    const rawText: string = claudeData.content?.[0]?.text ?? "";
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Claude hat kein gültiges JSON geliefert: " + rawText.slice(0, 200));

    const bewertungen = JSON.parse(jsonMatch[0]).map((b: Record<string, unknown>) => ({
      id: String(b.id || ""),
      score: Math.max(0, Math.min(100, Math.round(Number(b.score) || 0))),
      grund: String(b.grund || "").slice(0, 300),
      bedenken: b.bedenken && b.bedenken !== "null" ? String(b.bedenken).slice(0, 300) : null,
    }));

    return new Response(
      JSON.stringify({ ok: true, bewertungen, usage: claudeData.usage || null }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error).message || e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});

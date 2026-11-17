// Y.A.V.I.S. — Edge Function: Suchprofil und Suchstrings aus dem Auftragstext (Slug "suchprofil")
// Deployment: via Management-API (multipart), wie matching / cv-auslesen.
// Umgebungsvariable: ANTHROPIC_API_KEY (im Projekt bereits gesetzt).
// Eingabe:  { stelle: {jobtitel, position, gewerk, stadt, gehalt, berufserfahrung, beschreibung, skills} }
// Ausgabe:  { ok:true, suchprofil, suchstring_linkedin, suchstring_xing }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = { ...CORS, "Content-Type": "application/json" };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ ok: false, error: "ANTHROPIC_API_KEY nicht gesetzt." }), { status: 500, headers: J });
    }
    const { stelle } = await req.json();
    if (!stelle || !(stelle.jobtitel || stelle.beschreibung)) {
      return new Response(JSON.stringify({ ok: false, error: "Jobtitel oder Beschreibung fehlt." }), { status: 400, headers: J });
    }
    const stelleTxt = [
      "Jobtitel: " + (stelle.jobtitel || "?"),
      stelle.position ? "Position (normiert): " + stelle.position : "",
      stelle.gewerk ? "Gewerk: " + stelle.gewerk : "",
      stelle.stadt ? "Ort: " + stelle.stadt : "",
      stelle.gehalt ? "Gehalt: " + stelle.gehalt : "",
      stelle.berufserfahrung ? "Erfahrung: " + stelle.berufserfahrung : "",
      stelle.beschreibung ? "Beschreibung: " + String(stelle.beschreibung).slice(0, 3000) : "",
      stelle.skills ? "Anforderungen/Skills: " + String(stelle.skills).slice(0, 1500) : "",
    ].filter(Boolean).join("\n");

    const prompt = `Du unterstützt einen Personalberater für Technische Gebäudeausrüstung (TGA) und Hochbau/Schlüsselfertigbau bei der Direktansprache von Kandidaten.
Aus dem folgenden Auftrag erstellst du ein Suchprofil und zwei Suchstrings.

AUFTRAG:
${stelleTxt}

Regeln:
- Erfinde nichts. Was im Auftrag fehlt, lässt du weg oder schreibst "offen".
- Der Auftraggeber bleibt anonym: keine Firmennamen des Auftraggebers in den Suchstrings.
- Immer ausschließen: Bahn, Gleis, Oberleitung, Fahrleitung, LST, Eisenbahn, Tiefbau, Breitband, Architekt, Recruiter.
- Keine Gedankenstriche, kein Fülltext.

1. suchprofil: stichwortartig, 5 bis 8 Zeilen, jede Zeile "Label: Inhalt". Labels in dieser Reihenfolge, nur wenn es etwas zu sagen gibt: Position, Fachgebiet, Erfahrung, Muss, Wunsch, Region, Ausschlüsse. Die Zeile "Ausschlüsse:" beginnt immer genau so.
2. suchstring_linkedin: boolescher Suchstring mit AND, OR, NOT, Anführungszeichen und Klammern. Titel-Varianten und Gewerk-Synonyme per OR (z. B. TGA, HKLS, Haustechnik, Gebäudetechnik, Versorgungstechnik, Lüftung, Raumlufttechnik, RLT, Reinraum), Ausschlüsse per NOT. Höchstens 300 Zeichen.
3. suchstring_xing: dieselbe Idee, aber einfacher für die XING-Suche: wenige Begriffe, Anführungszeichen und OR, keine verschachtelten Klammern. Höchstens 150 Zeichen.

Antworte NUR mit diesem JSON, kein Text davor oder danach:
{"suchprofil":"…","suchstring_linkedin":"…","suchstring_xing":"…"}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      }),
    });
    if (!claudeRes.ok) throw new Error(`Claude API Fehler ${claudeRes.status}: ${await claudeRes.text()}`);
    const data = await claudeRes.json();
    const raw: string = data.content?.[0]?.text ?? "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Kein gültiges JSON geliefert: " + raw.slice(0, 200));
    const o = JSON.parse(m[0]);
    return new Response(JSON.stringify({
      ok: true,
      suchprofil: String(o.suchprofil || "").slice(0, 1500),
      suchstring_linkedin: String(o.suchstring_linkedin || "").slice(0, 600),
      suchstring_xing: String(o.suchstring_xing || "").slice(0, 400),
      usage: data.usage || null,
    }), { headers: J });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), { status: 500, headers: J });
  }
});

// ============================================================
//  Supabase Edge Function: firma-auslesen
//  Nimmt EINEN Firmen-/Impressum-/Signatur-Text (kopiert) und gibt
//  die extrahierten Firmen-Felder als JSON zurueck. Analog zu profil-auslesen.
//  Anthropic-Key kommt aus dem projektweiten Secret ANTHROPIC_API_KEY.
// ============================================================

const PROMPT = `Du bist ein Recruiting-Assistent. Lies den folgenden Firmen-Text (z. B. Impressum, E-Mail-Signatur, Website-Ausschnitt, Visitenkarte) aus und gib die Firmendaten als JSON zurueck.
Gib NUR valides JSON zurueck, keine Erklaerung, keine Markdown-Zeichen. Wenn ein Feld nicht vorkommt, lass es leer ("").

Felder:
- name: offizieller Firmenname (ohne Rechtsform-Wiederholung im Adresszusatz)
- branche: ordne die Firma GENAU EINER dieser Kategorien zu (im Zweifel "Sonstige"):
  "Ingenieurbuero" (Planung/Beratung/Engineering-Buero),
  "Ausfuehrer / Anlagenbau" (ausfuehrender TGA-/Anlagenbau-Betrieb, Montage),
  "Bauunternehmen / GU" (Generalunternehmer, Hochbau, Bauunternehmen),
  "Immobilien / Projektentwickler" (Immobilien, Bautraeger, Projektentwicklung),
  "Hersteller / Industrie" (Produkt-Hersteller, Industrieunternehmen),
  "Sonstige".
  WICHTIG: Gib den Wert EXAKT mit den Sonderzeichen aus, wie er im echten System heisst:
  "Ingenieurbuero" -> gib "Ingenieurbuero" NICHT aus, sondern den Originalwert "Ingenieurb" + "uero" ist falsch.
  Nutze GENAU diese Strings: Ingenieurbuero, Ausfuehrer / Anlagenbau, Bauunternehmen / GU, Immobilien / Projektentwickler, Hersteller / Industrie, Sonstige.
- telefon, fax, email
- webseite: vollstaendige URL falls vorhanden
- strasse (Strasse + Hausnummer), plz, stadt
- info: 1-2 Saetze, was die Firma macht (Deutsch), falls erkennbar

Firmen-Text:
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

// Branche auf die exakten System-Werte normalisieren (Umlaute)
function normBranche(b: string): string {
  const m: Record<string, string> = {
    "ingenieurbuero": "Ingenieurbüro",
    "ingenieurbüro": "Ingenieurbüro",
    "ausfuehrer / anlagenbau": "Ausführer / Anlagenbau",
    "ausführer / anlagenbau": "Ausführer / Anlagenbau",
    "bauunternehmen / gu": "Bauunternehmen / GU",
    "immobilien / projektentwickler": "Immobilien / Projektentwickler",
    "hersteller / industrie": "Hersteller / Industrie",
    "sonstige": "Sonstige",
  };
  return m[(b || "").trim().toLowerCase()] || "";
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
        max_tokens: 1200,
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
    if (fields.branche) fields.branche = normBranche(fields.branche);
    return json({ ok: true, fields });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});

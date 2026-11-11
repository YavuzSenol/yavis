// ============================================================
//  Supabase Edge Function: bewerbung-bewerten
//  Bewertet eine eingehende (Initiativ-)Bewerbung: Mailtext + optional Lebenslauf als PDF.
//  Gibt zurueck: ist_bewerbung, urteil (passt | unklar | nicht | keine_bewerbung), grund, name, beruf.
//  Anthropic-Key kommt aus dem projektweiten Secret ANTHROPIC_API_KEY.
//  Deploy: POST api.supabase.com/v1/projects/<ref>/functions/deploy?slug=bewerbung-bewerten (multipart)
// ============================================================

const PROMPT = `Du bewertest fuer einen Personalberater eingehende Mails an dessen Info-Postfach. Er besetzt ausschliesslich Fach- und Fuehrungspositionen in der Technischen Gebaeudeausruestung (TGA: Heizung, Lueftung, Klima, Sanitaer, Kaelte, Elektro-/Gebaeudetechnik, MSR/Gebaeudeautomation, Gebaeudeenergie, Anlagenbau/Haustechnik) und im Bauwesen rund um die TGA (Planung, Ausfuehrung, Bauleitung, Projektleitung, Kalkulation, Technische Leitung, Geschaeftsfuehrung in diesen Unternehmen).

Aufgabe: Entscheide, ob die Mail eine Bewerbung ist und ob die Person fachlich in dieses Feld passt. Nutze Mailtext UND Lebenslauf (falls beigefuegt).

Gib NUR valides JSON zurueck, ohne Erklaerung und ohne Markdown:
{
 "ist_bewerbung": true|false,
 "urteil": "passt" | "unklar" | "nicht" | "keine_bewerbung",
 "grund": "ein Satz auf Deutsch, woran du es festmachst (Beruf, Branche, letzte Stationen)",
 "name": "Vorname Nachname der bewerbenden Person, leer wenn unbekannt",
 "beruf": "aktuelle Berufsbezeichnung kurz, leer wenn unbekannt"
}

Regeln:
- "keine_bewerbung": Mail ist keine Bewerbung (Werbung, Rechnung, DMARC-/Systemmeldung, Unzustellbarkeit, Kundenanfrage, Antwort auf einen Newsletter ohne Bewerbung). Dann ist_bewerbung=false.
- "passt": klarer Bezug zur TGA oder zum technischen Bau mit TGA-Naehe (z. B. TGA-Planer, Projektleiter TGA, Bauleiter HLS/Elektro, Obermonteur mit Fuehrungsrolle, Kalkulator TGA, Techn. Leiter Anlagenbau, Gebaeudeautomation).
- "unklar": Bezug moeglich, aber nicht eindeutig (allgemeines Bauwesen, Elektrotechnik allgemein, Energieberatung, Facility Management, kaufmaennische Fuehrung in einem TGA-nahen Unternehmen, Berufseinsteiger/Studierende mit Technikbezug, zu wenig Information).
- "nicht": eindeutig fachfremd (z. B. Pflege, Gastronomie, Einzelhandel, IT/Software, Marketing, Finanzen, Logistik, Produktion ohne Bezug, Schueler, Helfer ohne Bezug). Im Zweifel IMMER "unklar", nie "nicht".
Mail-Inhalt:
`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { betreff, absender, text, pdf_base64 } = await req.json().catch(() => ({}));
    if (!text && !pdf_base64) return json({ ok: false, error: "text oder pdf_base64 fehlt" });
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ ok: false, error: "ANTHROPIC_API_KEY nicht gesetzt" });

    const inhalt = "Absender: " + String(absender || "") + "\nBetreff: " + String(betreff || "") + "\n\n" + String(text || "").slice(0, 8000);
    const content: unknown[] = [];
    if (pdf_base64) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf_base64 } });
    content.push({ type: "text", text: PROMPT + inhalt });

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 500, messages: [{ role: "user", content }] }),
    });
    const data = await resp.json();
    if (!resp.ok) return json({ ok: false, error: "Anthropic: " + (data?.error?.message || resp.status) });
    const out = data?.content?.[0]?.text || "";
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return json({ ok: false, error: "Antwort nicht lesbar" });
    const r = JSON.parse(m[0]);
    let urteil = String(r.urteil || "").toLowerCase();
    if (!["passt", "unklar", "nicht", "keine_bewerbung"].includes(urteil)) urteil = "unklar";
    if (r.ist_bewerbung === false && urteil !== "keine_bewerbung") urteil = "keine_bewerbung";
    return json({ ok: true, urteil, grund: String(r.grund || "").slice(0, 400), name: String(r.name || "").slice(0, 120), beruf: String(r.beruf || "").slice(0, 120) });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});

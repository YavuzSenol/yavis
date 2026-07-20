# YAVIS Konsistenz-Regelwerk

> Der verbindliche Standard, an dem sich JEDE Ansicht in YAVIS ausrichtet — bestehende und zukünftige.
> Bei jeder Änderung an Claude Code: "Bau das nach dem Konsistenz-Regelwerk (KONSISTENZ.md)."
> Grundprinzip: **kompakt & dicht** — viel auf einen Blick, wenig Scrollen. Maßstab ist immer das Feinere/Kompaktere, nie das Klobige.

---

## 0. Die goldene Regel
Wenn zwei Elemente dasselbe tun, müssen sie GLEICH aussehen und sich GLEICH verhalten — egal in welchem Modul (Kandidat, Ansprechpartner, Firma, Stelle). Kein Element wird im einen Modul gebaut und im anderen vergessen. Was für Kandidaten gilt, gilt sinngemäß für alle Personen-Rollen und für Firmen.

---

## 1. Dichte & Abstände
- **Referenz für "richtig":** die feine Pipeline-/Aktivitätsansicht, die Recherche-Maske, die Detail-Zeilen. DARAN richtet sich alles aus.
- Klobiges wird auf das feine Maß heruntergebracht, NIE umgekehrt.
- Keine großen Leerflächen. Dicht, aber nicht gequetscht.
- Innenabstand (Padding) in Karten/Blöcken überall gleich.

## 2. Typografie — VERBINDLICHE SKALA
- **Seitentitel (h2):** 17 px
- **Karten-Titel (h3):** 15 px
- **Fließtext / Tabellen / Eingabefelder:** 12,5–13 px
- **Labels (Großbuchstaben):** 10–11 px
- **Große Kennzahlen (Kacheln/Pipeline):** 20 px
- Gleiche Rolle = gleiche Größe und Gewicht ÜBERALL. Ein Block-Titel im Kandidaten-Modul ist exakt so groß wie im Ansprechpartner-Modul.
- Labels einheitlich (klein, gedämpfte Farbe), Werte einheitlich (etwas größer, kräftiger).

## 2b. Abstands-Raster — VERBINDLICH
- Raster: **4 / 8 / 12 / 16 px** — keine Zwischenwerte.
- Karten-Padding ~10–11 · Karten-Abstand ~12 · Feld-Gaps ~8 · Label-Abstand ~3
- Eingabefelder: Padding ~4–5 / 8 px · Buttons: ~6 / 13 px

## 3. Schreibweise & Text-Hierarchie
- **Großbuchstaben/Versalien nur bei kleinen Rubrik-Labels** (10–11 px, gedämpftes Grau). Da bewusstes, dezentes Stilmittel.
- **Alles Größere normal schreiben** (erster Buchstabe groß, Rest klein): "Pipeline", "Aktivität", "Personen", "Firmen", "Projekte", "Ansprechpartner", "Recherche", "Suchen" → NICHT in Versalien.
- Faustregel: klein & dezent = Großbuchstaben okay · groß & prominent = normale Schreibweise.
- **Klammer-/Zusatzinfo immer KLEINER** als das Hauptwort davor — nie größer. Hauptsache > Nebensache, immer.

## 4. Farbpalette — VERBINDLICH (8 Farben, Dark-Theme)
| Hex | Rolle |
|-----|-------|
| #0f1115 | Seitenhintergrund |
| #171a21 | Kacheln / Karten |
| #2a2f3a | Rahmen / Trennlinien |
| #e8eaf0 | Haupttext / Zahlen |
| #9aa3b2 | Labels / gedämpfter Text |
| #f0855a | Orange — Akzent (Titel, Links, Haupt-Aktion, Hervorhebung) |
| #e5484d | Rot — NUR dringend/gesperrt (fällige Wiedervorlagen, Sperren, Löschen, "kein Kontakt") |
| #3fb37f | Grün — NUR ok/positiv (erledigt, platziert, empfangen) |

**Feste Bedeutung, konsequent in der ganzen App:**
- Orange = Akzent/wichtig/anklickbar. EINE Variable.
- Rot = dringend oder gesperrt.
- Grün = Erfolg/positiv.
- Grau = neutral, Struktur, Labels.
- Weiß (#ffffff) als Button-Text und Schatten-Schwarz sind funktional erlaubt (keine "Fremdfarben").

**Pipeline:** alle Stufen in EINER Orange-Familie, von hell (frühe Stufe) nach kräftig (späte Stufe) abgestuft (Deckkraft ~6% → ~52% + Rahmen). Keine bunten Einzelfarben.

**Ausnahme E-Mail-HTML:** Die Farben in E-Mail-Vorlagen (Signatur, Profil-Mail, Newsletter-Tabelle) bleiben unangetastet — E-Mail-Programme verstehen keine CSS-Variablen, eine Umstellung würde die Mails beim Empfänger zerstören. Plus Kunden-CI.

## 5. Felder & Detailansicht
- Jedes Feld: Label + Wert im immer gleichen Aufbau.
- **ALLE Felder immer anzeigen, auch leere.** (Nutzer-Entscheid 15.07.2026: *"nicht cool — alle Felder anzeigen, egal wie lang"*.) Die frühere Regel "leere Felder ausblenden" wurde v233–v243 ausprobiert und mit v244 **komplett zurückgebaut** — Begründung: konstantes Layout + direktes Ausfüllen schlagen die Ruhe-Ersparnis. Bitte nicht versehentlich wieder einbauen.
- Blöcke (Karten) überall identisch aufgebaut: Titel oben, Felder darunter, gleicher Rahmen/Abstand.
- Zusammengehörige Felder beieinander (kein Scrollen/Suchen).

## 6. Status- & Auswahlfelder
- ALLE gleichartigen Status-/Auswahlfelder gleich dargestellt und bedient (z. B. Internwertung und Kontaktstatus identisch aufgebaut).
- Farben nach fester Bedeutung (siehe Palette).

## 7. Benennung (ein Begriff pro Sache)
- Dasselbe Konzept heißt ÜBERALL gleich. Nicht mal "Firma", mal "Arbeitgeber", mal "Unternehmen", mal "Kunde".
- Knöpfe behalten ihren Namen durch den ganzen Vorgang.

## 8. Tabellen & Massendaten
- Listen überall gleich aufgebaut: gleiche Zeilenhöhe, Spalten-Logik, Schrift.
- Kompakte Zeilen, viele Datensätze auf einen Blick, gut lesbar.
- Mehrfachauswahl, Massenbearbeitung, Sortierung, Spaltenkonfiguration: einheitlich in ALLEN gleichartigen Listen.
- Spaltenbreiten: sinnvolle Default-Breiten, die halten (kein ständiges Nachjustieren).

## 9. Knöpfe & Icons
- Gleiche Knopf-Typen gleich: Haupt-Aktion (kräftig), Neben-Aktion (dezent), Gefahr/Löschen (rot).
- Gleiche Größe/Abstand/Position für wiederkehrende Aktionen.
- Icons einheitlich groß: dasselbe Symbol für dieselbe Aktion. (Beispiel-Fehler: riesige Erledigt-/Bearbeiten-Icons neben winzigen Drei-Punkten → vereinheitlichen.)

---

# ANHANG A: Konkrete Fundstellen (echte Baustellen)

## Muster 1 — Dichte/Größe
- Startseite: Kacheln waren zu groß ggü. feiner Pipeline. [Phase 1 erledigt]
- Hut-Symbol vor Kandidatennamen zu groß.
- Wiedervorlage "vollgeballert": Erledigt-/Bearbeiten-Icons riesig, Drei-Punkte winzig eng.

## Muster 2 — Asymmetrie zwischen Modulen
- Personen-Recherche sehr detailliert, Firmen-Recherche nur ~5 Bereiche → angleichen.
- Einstellungen: viele Felder für Kandidaten, Pendant für Firmen fehlt → angleichen.

## Muster 3 — Anordnung unlogisch
- Kandidatenansicht: Notizen links, E-Mails rechts → Scrollen. Ziel: alles auf eine Seite, logisch gruppiert.

## Muster 4 — Funktionen zu verstreut / Daten-Müll
- Neue Funktionen (Nachfassen, "wer hat geklickt") nur dort zeigen, wo sie hingehören.
- Projekte: Feld "Remote" steht überall, nie eingetragen → entfernen/bereinigen.

## Detail-/Logikpunkte
- Personenliste: Spaltenbreiten justieren sich nicht vernünftig → greifende Default-Logik.
- Firmenansicht: "Auftraggeber-Potenzial"-Badge auf Einheitlichkeit prüfen.

## Startseite — Funktionen
- "Dranbleiben" und "Akquisevorschläge" auf-/zuklappbar machen.
- Die "X weitere überfällige" erreichbar machen: ausklappen UND Klick öffnet ALLE in der Personen-/Firmenansicht (echte Ansicht mit Filter, keine Extra-Liste).

## Eigene Idee (kein Auftrag, zur Prüfung)
- Einstellungen: lange Wertelisten (Kandidatenstatus, Anreden, Umzugsbereitschaft) ein-/ausklappbar.

---

# ANHANG B: Phasen-Fahrplan & Stand

**Erledigt (Stand 07.07.2026):**
- Sperren-Fix (DSGVO-Serienmail) ✓
- Firmen-/Stammhaus-Umbau, Abwerbeschutz konzernweit ✓
- Phase 1 — Startseite kompakt ✓ (·121)
- Farbpalette 19 → 8, inkl. Fremdfarben-Bereinigung ✓ (·121–·124)
- Phase 2 — Seitentitel überall 17px + Schreibweise (Versalien raus, Klammer-Hierarchie) ✓ (·125)
- Phase 3 — Karten & Formulare auf kompakte Dichte ✓ (3A Karten ·127, 3B Formulare ·128)
- Phase 4 — Icons/Buttons vereinheitlichen (.icobtn, Glyphen ✏️/🗑️/✓) ✓ (·129–·131, Button-§9-Feinschliff ·147)
- Phase 5 — Kandidatenansicht: Anordnung (Notizen direkt über E-Mails, 3 Spalten + Verlauf) ✓ (·135)
- Phase 6 — Modul-Asymmetrie (Firmen-Recherche 12 Filter, Firmen-Status) ✓ (·138/·139)
- Phase 7 — Aufräumen (Spaltenbreiten-Default-Logik ·143, Badge-Einheitlichkeit ·144, Remote-Feld raus)
- Startseiten-Funktionen (Dranbleiben/Akquise auf-/zuklappbar, Überfällige-Drilldown in echte Personenansicht) ✓
- **Abschluss-Audit ✓ (07.07.2026, ·199):** Typo-Skala app-weit gemessen (h2 17 / Karten-h3 15 / Versalien nur Marken-Logo + kleine Labels), Farb-Scan gegen die 8er-Palette. Gefundene Restfehler behoben: Newsletter-Schritt-Überschriften (13px-Versalien → Karten-h3), 2 Dialog-Titel 16px → 17px/700, Fremdrot #ef4444 → var(--hot), Fremdgrau #6b7280 → #9aa3b2, #888-Hinweis → var(--muted). E-Mail-HTML-Farben laut §4 bewusst unangetastet.

**Damit ist der Fahrplan abgearbeitet.** Neue Optik-Arbeit läuft weiter nach diesem Regelwerk (Plan + Vorher/Nachher zeigen, dann Freigabe, dann committen). Maßstab immer: das Kompakte/Feine gewinnt.

**Nachtrag 14.–15.07.2026 (Abschluss-Audit, Versionen ·231–·244):** fünf Wellen nach der Fundliste `AUDIT_2026-07-14_FUNDLISTE.md` — Einheitlichkeit quer durch die App (Leerzustands-Texte, Zähler-Regel, Gefahr-Knopf rechts), Firmen-Detail auf das 4-Spalten-System der Personen gehoben, Projekte-Ausbau (Papierkorb statt Hart-Löschen, Massenaktualisierung, Notizen + Dokumente), **Geräte-Sync der Einstellungen** (·235), Einstellungen-Neuordnung auf 6 Tabs mit Sofort-Speichern (·242). Dann der **§5-Rückbau** (·244, siehe oben).

Hinweis: `body.hell` (Hell-Theme) ist eine bewusste helle Entsprechung der 8 Farbrollen — kein Palette-Verstoß.

# Übergabe: Y.A.V.I.S. CRM

> Kontext-Dokument für Claude Code (oder die nächste Arbeitssitzung). Ziel: nahtlos weiterarbeiten am selbstgebauten Recruiting-CRM von Yavuz Senol (Personalvermittler, TGA/Bau, Köln). YAVIS wird "Javis" ausgesprochen.

---

## 1. Was ist YAVIS?

Ein selbstgebautes Recruiting-CRM als Ersatz für Zoho Recruit (Abo lief 7.6.2026 aus). Nutzer ist technisch affin, aber **kein Programmierer** — alle Anleitungen müssen Schritt-für-Schritt und auf Deutsch sein. Er arbeitet auf Windows, ausschließlich in OneDrive.

### Architektur (alles in Betrieb)
- **Datenbank:** Supabase (PostgreSQL-Cloud, EU, kostenlos), Projekt-ID `afbyqrwqnccgudpqxziv`
- **App:** eine einzelne `index.html` (Vanilla JS + Supabase-JS via CDN), Schrift Calibri, dunkles Theme
- **Hosting:** GitHub Pages, Repo `github.com/YavuzSenol/yavis`, live unter `yavuzsenol.github.io/yavis`
- **KI (CV-Auslese):** Anthropic API, Modell `claude-haiku-4-5-20251001`
- **Lokales Repo:** `C:\Claude` (HTTPS-Remote, Git Credential Manager eingerichtet)

### Zugangsdaten / Endpunkte
- Supabase Project URL: `https://afbyqrwqnccgudpqxziv.supabase.co`
- Supabase publishable key (öffentlich, in der App): `sb_publishable_Cn0V4tpBeLxiwl3MyTvzdg_tCcFfkl7`
- Supabase Secret-Key: nur lokal beim Nutzer (NIE in App/GitHub/Chat)
- App-Login (Supabase Auth): `senol@senolconsulting.de` + Passwort in `C:\Claude\login.local`
- Anthropic API-Key: nur lokal, in `login.local` und in `_cv_storage_nachtragen.py` (NIE committen)

### Wichtige Sicherheitsregeln
- Secret-Keys, Passwörter, API-Keys NIEMALS in die App, ins GitHub-Repo oder in den Chat.
- `login.local`, `logs_dats.txt`, `Management_token.txt` stehen in `.gitignore` — NIE committen.
- Supabase-Login für API-Tests: POST an `/auth/v1/token?grant_type=password` → access_token als Bearer.

---

## 2. Datenbestand (vollständig in YAVIS)

Importiert aus Zoho: **1.508 Kandidaten**, 196 Kunden, 303 Kontakte, 44 Stellen, 1.245 Bewerbungen, ~4.669 Notizen, ~1.807 Aufgaben, 2.423 E-Mails, Geo-Daten. Außerdem **316 Lebensläufe** in Supabase Storage (Bucket `dokumente`, privat).

ID-Format der Kandidaten: `Zrecruit_<zahl>` (z. B. `Zrecruit_16153000000376122`). Anzeige im UI: `KAN-<letzte 5 Ziffern>` (z. B. `KAN-76122`). Konvertierung via `fmtKandidatId()`.

---

## 3. Datenbankschema (Supabase)

Tabellen: `kandidaten`, `kunden`, `kontakte`, `stellen`, `bewerbungen`, `notizen`, `aufgaben`, `emails`, `plz_geo`, `dokumente`, `erfahrung`, `ausbildung`.

**`kandidaten`-Felder (Auszug):** id, vorname, nachname, voller_name, email, email_beruflich, email_zweit, telefon, telefon_privat, mobil, mobil_privat, fax, strasse, plz, stadt, bundesland, land, lat, lng, berufsbezeichnung, position_original, arbeitgeber, faehigkeiten, qualifikation, studiengang, erfahrung_jahre, gehalt_aktuell, gehalt_erwartet, kuendigungsfrist, wechselmotivation, umzugsbereitschaft, wunschregion, positionswunsch, profil_zusammenfassung, bemerkung, xing_profil, linkedin_profil, status, quelle, tags, ist_hot, abwerbeschutz, wertung, besitzer_id, geburtstag, erstellt_am, geaendert_am, letzte_aktivitaet, **begruessung, wertung_intern, bei_firma_seit, in_position_seit, kontaktstatus**, **geloescht_am** (Papierkorb-Spalte, timestamptz, nullable).

**`kunden`-Felder (echte Spaltennamen, geprüft 09.06.):** id, name, typ, branche, strasse, plz, stadt, bundesland, land, **lat, lng** (Geo, via plz_geo befüllt), telefon, fax, email, **`webseite`** (NICHT `website`!), **`info`** (NICHT `notiz`!), tags, account_manager, kundennummer, quelle, erstellt_am, geaendert_am, letzte_aktivitaet, **geloescht_am** (Papierkorb). ⚠️ In Zoho gibt es Rechnungs- UND Versandadresse, in YAVIS nur EIN Adressfeld — der korrekte Wert kommt aus der Versandadresse.

**`kontakte`-Felder (Auszug):** id, vorname, nachname, voller_name, berufsbezeichnung, email, telefon_beruflich, mobil, kunde_id, notiz, erstellt_am, geaendert_am, **geloescht_am** (Papierkorb-Spalte).

**`stellen`-Felder:** id, jobtitel, position, stellentyp, status, kunde_id, kontakt_id, strasse, plz, stadt, bundesland, land, lat, lng, remote, branche, berufserfahrung, gehalt, beschreibung, erforderliche_skills, anzahl_positionen, oeffnungsdatum, zieldatum, abschlussdatum, tags, erstellt_am, geaendert_am, letzte_aktivitaet.

**`bewerbungen`-Felder:** id, kandidat_id, stelle_id, kunde_id, jobtitel, status, stufe (Kanban-Stufe), quelle, bewertung, account_manager, personalvermittler, ablehnungsgrund, anstellungsdatum, erstellt_am, geaendert_am, letzte_aktivitaet.

**`emails`-Felder:** id, betreff, entity_id (ID des Kandidaten/Kunden/Kontakts), besitzer_id, erstellt_am, geaendert_am.
- Richtung wird als Emoji-Präfix in `betreff` gespeichert: `📤 ` = gesendet, `📥 ` = empfangen.
- Notizen als Suffix: `\n\nNotiz: xyz`.
- IDs: `yavis_<ts>_<rnd>` (manuell), `ms_<ts>_<rnd>` (Outlook-Sync), `nl_<ts>_<i>` (Newsletter).

RLS auf allen Tabellen AN.

### ⚠️ Papierkorb-SQL (einmalig in Supabase ausführen)
```sql
ALTER TABLE kandidaten ADD COLUMN IF NOT EXISTS geloescht_am timestamptz;
ALTER TABLE kunden     ADD COLUMN IF NOT EXISTS geloescht_am timestamptz;
ALTER TABLE kontakte   ADD COLUMN IF NOT EXISTS geloescht_am timestamptz;
```
Supabase → SQL Editor → New Query → ausführen. Danach aktiviert sich der Papierkorb automatisch beim nächsten Login (pruefeSoftDelete() erkennt die Spalte).

---

## 4. App-Features (index.html) — Stand 09.06.2026

### Farbschema & Design
- **Akzentfarbe:** YSC-Orange `#f0855a` (dark) / `#c85a28` (light) — eine einzige Markenfarbe
- **Gefahr/Löschen:** `--hot:#a8a29e` (dezentes Grau) — kein Rot mehr
- Buttons dezent: `editbtn`-Klasse, kein farbiger Hintergrund
- Sidebar aktiver Tab: nur Schriftgewicht + Akzentfarbe, kein oranges Hintergrund-Panel mehr
- Abwerbeschutz-Toggle: nur fett/normal, keine Farbe

### Navigation (Sidebar links)
🏠 Start · Kandidaten · Firmen · Ansprechpartner · 📋 Wiedervorlagen · 📁 Projekte · 🔍 Recherche · ✉️ Newsletter

### Kandidaten-Tab
- Liste: Name, Berufsbezeichnung, Ort, Telefon (klickbar), Status, Entfernung (bei PLZ-Suche)
- Filter: Volltextsuche, Position (21 normierte), Datenlücken, PLZ-Umkreis (RPC `kandidaten_im_umkreis`), Tags (Chips)
- Checkbox „+ niedrigere Positionen einbeziehen"
- Spalten-Konfiguration (🗂) via localStorage
- Nachfass-Modus: „nur mit XING/LinkedIn-Profil"
- **Massen-Löschen:** Checkboxes + „🗑️ Löschen" → verschiebt in Papierkorb (kein Hard-Delete)

### Kandidat-Detailseite
- Header: YSC-Foto (rund, klickbar zum Hochladen/Ändern), Name, Berufsbezeichnung · Arbeitgeber, Status-Pille
- Buttons: 📄 CV einlesen · 🔒/🔓 Abwerbeschutz · ✎ Bearbeiten · 🗑️ Löschen (→ Papierkorb) · 📧 E-Mail senden
- 3-Spalten-Layout + **sortierbare** aufklappbare Sektionen (`<details class="acc">`) — Reihenfolge via drag in localStorage
- **Wiedervorlagen-Abschnitt:** ✓ Erledigt · ✏️ Bearbeiten · 🗑️ Löschen pro Zeile
- **E-Mail senden:** Dialog mit Vorlage-Auswahl → Betreff/Text werden aus Vorlage befüllt (Platzhalter ersetzt) → „📨 In Outlook öffnen" → `mailto:` öffnet Outlook vorausgefüllt → E-Mail wird automatisch im Protokoll gespeichert
- **⚠️ Bekanntes Problem:** `mailto:?body=text` verhindert in Outlook die automatische Signatur. Lösung geplant: Microsoft Graph API (→ §8).
- Foto-Upload: speichert als `kandidat/<id>/foto.jpg` in Storage-Bucket `dokumente`

### Firmen-Tab (Kunden)
- Filter: Volltextsuche (Name, Branche, Ort), Typ-Filter (Auftraggeber / Potenzial / Lieferant / Sonstige)
- **Umkreissuche:** PLZ + Radius (25/50/100/150/200 km) — client-seitige Haversine-Formel
  - Fehlende Koordinaten werden per Batch aus `plz_geo` nachgeladen
  - Ergebnisse sortiert nach Entfernung, km-Angabe pro Zeile
  - Textsuche kombinierbar mit PLZ-Suche
- Löschen → verschiebt in Papierkorb

### Ansprechpartner-Tab (Kontakte)
- Volltextsuche, Löschen → Papierkorb

### Wiedervorlagen-Tab
- Tabelle: Fällig am · Betreff · Wer · Aktionen
- Filter: offen / fällig+überfällig / alle
- Aktionen: ✓ Erledigt · ✏️ Bearbeiten · 🗑️ Löschen
- **Massen-Auswahl:** Checkboxen + „Alle / Keine" + orangefarbene Aktionsleiste
- **📅 Datum ändern:** Datum für alle gewählten Einträge auf einmal setzen (50er-Batches)

### Projekte-Tab
- Alle 44 Stellen als Cards mit Status-Badge, Kandidaten-Anzahl
- Filter: Status + Freitextsuche; + Neue Stelle
- Detail-Ansicht: Kanban-Pipeline (6 Stufen), Kandidat hinzufügen, Bearbeiten, Löschen

### 🔍 Recherche-Maske (Stufe-1-Suche)
- Position-Chips (21), PLZ+Radius (RPC `kandidaten_im_umkreis`), Status-Dropdown (dynamisch)
- Ausschließen-Textarea (Kommagetrennt, Teilstring auf `wertung_intern`), Erreichbarkeits-Checkboxen
- Ergebnistabelle mit Kandidaten-Links

### ✉️ Newsletter-Tab (Serien-Mail)
**Schritt 1 — Empfänger auswählen:**
- Position-Chips, PLZ+Radius, Ausschließen-Textarea
- Nur Kandidaten mit E-Mail werden angezeigt
- Ergebnistabelle mit Checkboxen + „Alle auswählen" + Live-Zähler

**Schritt 2 — E-Mail verfassen:**
- Vorlage-Dropdown (aus localStorage), Betreff, Nachricht, Vorschau
- „📨 Serien-Mail an N Empfänger öffnen" → `mailto:?bcc=...`
- Automatische Protokollierung aller Empfänger in `emails`-Tabelle

### E-Mail-Vorlagen
- **29 Vorlagen** in 8 Kategorien, gespeichert in `localStorage['yavis_vorlagen']`
- Platzhalter: `{{Vorname}}`, `{{Name}}`, `{{Stelle}}`, `{{Stadt}}`, `{{Jahre}}`, `{{MeinName}}` etc.
- Verwaltung: ⚙️ → E-Mail → Verwalten → ➕/✏️/🗑️/▲▼

### ⚙️ Einstellungen-Dialog
- **Darstellung:** Farbschema (Hell/Dunkel), Kompakt-Modus, Einstellungs-Zoom (65–115%), App-Zoom (70–130%)
- **Meine Angaben:** Name, PLZ, Standard-Suchradius
- **Outlook-Verbindung:** Microsoft Graph OAuth PKCE
- **E-Mail:** Standard-BCC, E-Mail-Vorlagen, E-Mail-Signatur
- **Kandidaten-Status:** Liste selbst verwalten (localStorage: `yavis_status_liste`)
- **Datenverwaltung:** Cache leeren · Duplikate finden · CSV-Export · **🗑️ Papierkorb**
- **System:** Verbindungsinfo, Version, Abmelden

### 🗑️ Papierkorb
- Alle drei Entitäten (Kandidaten, Firmen, Kontakte) unterstützen Soft-Delete
- Löschen-Dialoge verschieben in Papierkorb statt endgültig zu löschen
- `softDeleteAktiv`-Flag: beim Login prüft `pruefeSoftDelete()` ob Spalte existiert
- Einstellungen → Datenverwaltung → Papierkorb → zeigt alle gelöschten Einträge
- Pro Zeile: ♻️ Wiederherstellen (setzt `geloescht_am = null`) oder 🗑️ Endgültig löschen
- **⚠️ SQL muss einmalig ausgeführt werden** (→ §3)

localStorage-Keys gesamt: `sb_url`, `sb_key`, `yavis_mein_name`, `yavis_meine_plz`, `yavis_radius`, `yavis_bcc`, `yavis_signatur`, `yavis_vorlagen`, `yavis_theme`, `yavis_kompakt`, `yavis_eins_zoom`, `yavis_app_zoom`, `yavis_status_liste`, `yavis_branchen` (feste Firmen-Branchen), `kunden_spalten`, `kontakte_spalten` (Spaltenkonfiguration Firmen/Ansprechpartner), `ms_access_token`, `ms_refresh_token`, `yavis_abschnitt_order`

---

## 5. Edge Functions (Supabase)

| Name | Status | Beschreibung |
|------|--------|--------------|
| `cv-auslesen` | ✅ deployed | PDF-CV hochladen → Claude extrahiert Felder → Vorschau in App |
| `profil-auslesen` | ✅ deployed | LinkedIn/XING-Profiltext → Claude extrahiert Felder → Formular vorbefüllen |
| `recherche-nlp` | ✅ deployed | Freitext-Recherche → Claude → Supabase-Filter |
| `jobs` | ✅ deployed, public | Öffentliche Stellen-API für Webflow-Widget (`verify_jwt=false`) |

**CV-Extraktion Feldregeln:**
- `berufsbezeichnung` = eine der 21 normierten Positionen — wird IMMER überschrieben
- `position_original`, `mobil_privat` — werden IMMER überschrieben
- Alle anderen Felder: nur befüllen wenn leer in DB
- Leitungs-Regel: nur bei echtem Jobtitel (Leiter/Leitung/Head of/GF)

---

## 6. Lokale Skripte

| Datei | Beschreibung |
|-------|-------------|
| `Python Lebensläufe/cv_auslesen.py` | Batch-CV-Auslese für neue Kandidaten (PDF → Claude → Supabase). API-Key hardcoded — NIE committen. |
| `_cv_storage_nachtragen.py` | CV-Auslese aus Supabase Storage für Kandidaten ohne Berufsbezeichnung. |
| `_inject_*.py` | Injektionsskripte zum Einbauen von HTML/JS-Blöcken per `str.replace` in `index.html`. Edit-Tool nicht nutzbar (Datei zu groß). |

---

## 7. Deploy-Workflow

```powershell
git add index.html
git commit -m "kurze Beschreibung"
git push
```
Danach 1–2 Min warten, in YAVIS mit Strg+F5 neu laden.

Falls Push hängt: GCM-Fenster → **„Sign in with a code"** → Code auf github.com/login/device eingeben.

---

## 8. Offene Aufgaben (Priorität)

### ✅ Erledigt am 09.06.2026 (diese Sitzung)
- **#1 Homepage-Absturz**, **#2 Papierkorb-SQL**, **#3 Microsoft Graph E-Mail-Versand** — alle erledigt/verifiziert. Graph hat 3 echte Sende-Funktionen: `msMailDirektSenden` / `serienMailDirektSenden` / `nlDirektSenden` (→ `_graphSendMail` / `/me/sendMail`). Hinweis: Versand als `contentType:'Text'` mit Signatur aus `yavis_signatur` (nicht die HTML-Outlook-Signatur).
- **Firmen + Ansprechpartner: Mehrfachauswahl** (Häkchen + „Alle auswählen") mit Aktionen **👤 An Kandidat senden** (Firmen-/Kontaktliste per Graph-Mail an Kandidat + Protokoll in `emails`) und **📥 CSV**.
- **Konfigurierbare + sortierbare Spalten** (🗂-Button) für Firmen UND Ansprechpartner; **PLZ/Ort getrennt**; Speicherung in localStorage `kunden_spalten` / `kontakte_spalten`. Klick auf Spaltenkopf = auf-/absteigend sortieren.
- **Firmen-Massenbearbeitung** (✏️ Ändern): Typ/Branche/Ort/Bundesland/Land auf die Auswahl anwenden, Option „nur leere Felder füllen".
- **Bugfix:** Firmen-Code nutzte `website` statt des DB-Feldnamens **`webseite`** (Spalte + CSV-Export).
- **DATEN-FIX (Supabase):** Der ursprüngliche Zoho-Import hatte die meist **leere Rechnungsadresse** statt der gefüllten **Versandadresse** übernommen. Skripte `_adressfix_dryrun.py` / `_adressfix_schreiben.py` (Match per `Kunde Id`=`kunden.id`): 95 Firmen Stadt/PLZ/Straße/Bundesland nachgetragen, 92 neue Koordinaten aus `plz_geo`. **Köln 14→39, Firmen ohne Koordinaten 115→23, mit PLZ 83→177.** (Backup-Quelle: `zoho backup/Kunden/Clients_001.csv`.)
- **195 Firmen** Typ „Auftraggeber" → „Auftraggeber-Potenzial" umgestellt (DB: jetzt 196 Potenzial, 0 Auftraggeber).
- **Telefonnummern vereinheitlicht:** alle 164 vorhandenen auf internationales `+49`-Format normiert; 6 fehlende per Web-Recherche nachgetragen (Telefon leer jetzt 26).
- **Branche angereichert + feste Struktur:** 88 Firmen per Web-Recherche eine Branche gegeben, dann **feste 6er-Liste** eingeführt und ALLE 196 Firmen darauf umgeordnet. Die 6 Werte: **Ingenieurbüro · Ausführer / Anlagenbau · Bauunternehmen / GU · Immobilien / Projektentwickler · Hersteller / Industrie · Sonstige**. (1 Firma noch ohne Branche: Natalie Söll.)
- **Branche = feste Dropdown-Struktur:** im Firmen-Bearbeiten-Formular UND in der Massenbearbeitung Dropdown; verwaltbar unter **Einstellungen → 🏭 Firmen-Branchen**; localStorage `yavis_branchen`, Default `BRANCHEN_STANDARD`, Getter `branchenListe()` (gebaut analog zu `statusListe()`). Hilfsskripte: `_branche_final.csv`, `_telefon_todo.json`.

### 🔴 Als Nächstes

| # | Aufgabe | Details |
|---|---------|---------|
| 1 | **Suche verbessern (in Arbeit)** | Branche als **Filter-Dropdown** im Firmen-Tab (statt Freitext, nutzt `branchenListe()`); Umkreissuche soll anzeigen „X Firmen ohne Koordinaten nicht berücksichtigt". |
| 2 | **Rest-Datenlücken (manuell)** | 26 Firmen ohne Telefon (19 ohne Webseite), 1 Firma ohne Branche (Natalie Söll — hinterlegte Webseite falsch). |
| 3 | **~13 Duplikate** | Kandidaten die auch als Ansprechpartner existieren. Duplikate-Finder in Einstellungen → Datenverwaltung vorhanden. |
| 4 | **54 Kandidaten ohne Berufsbezeichnung** | XING/LinkedIn-Profile aber kein PDF. Manuell via „📋 Aus Profil/Text" nachpflegen. |

### 🟡 Mittelfristig

| # | Aufgabe |
|---|---------|
| 5 | **Webflow-Embed** — `webflow_jobs_embed.html` liegt fertig in `C:\Claude`. In Webflow als HTML-Embed-Block einbauen. |
| 6 | **Abwerbeschutz** — Auto-Markierung wenn `arbeitgeber` = Auftraggeber |
| 7 | **Tag-Picker** — Vorschlagsliste beim Tag-Bearbeiten am Kandidaten |
| 8 | **Geburtstag-Feld** im Bearbeiten-Formular |
| 9 | **Hot-Flag** — `ist_hot` nutzbar machen (Filter + Markierung in Liste) |
| 10 | **Kandidatenprofil zusenden** — Profil-PDF per Mail an Firma/Kontakt schicken (braucht Graph API → #2) |

### 💤 Langfristig / Optional

- Vollautom. Anruf-Protokoll (Starface-Webhook)
- LinkedIn/XING-Anbindung direkt
- Kalender/Termine-Kachel
- Konfigurierbare Dashboard-Kacheln

---

## 9. Starface-Anbindung (✅ Fertig)

**STARFACE UCC Client → Einstellungen → Browser → „Web-Seite bei Anruf öffnen":**
- URL: `https://yavuzsenol.github.io/yavis/?anruf=$(calleridNational)`
- Eingehender Anruf → YAVIS öffnet direkt die passende Detailseite
- Bei Treffer: Notiz-Popup öffnet sich automatisch (Strg+Enter speichert)

---

## 10. Wichtige Verhaltenshinweise für die nächste Sitzung

- Nutzer ist kein Programmierer: konkrete Klick-für-Klick-Anleitungen, Fachbegriffe erklären. **Deutsch.**
- NIEMALS Outputs erfinden oder „ich habe getestet" ohne echten Beleg.
- Bei neuen Funktionen immer fragen: „Möchtest du das auch selbst anpassen können?"
- Für API-Tests: `login.local` lesen → Token holen → Requests mit Bearer-Token.
- ⚠️ **`login.local` hat ZWEI Passwörter:** `PASSWORT` (Supabase-App-Login, ~9 Zeichen) und `Passwort` (Starface, ~15 Zeichen). Beim Parsen **case-sensitiv** auf `PASSWORT` matchen — sonst Login-Fehler `400 invalid_credentials`. Auth-Flow: POST `/auth/v1/token?grant_type=password` mit Header `apikey`=publishable key.
- Bei Schreiboperationen immer erst Dry-Run/Probelauf anbieten.
- Git: nur HTTPS, kein SSH. Push funktioniert (GCM gespeichert).
- `login.local` und `Management_token.txt` NIE committen.
- PowerShell zeigt Umlaute manchmal falsch (nur Anzeige, App ist UTF-8).
- **Injektions-Workflow:** `index.html` ist zu groß für Edit-Tool → Python-Skript mit `str.replace()` → immer `.py`-Datei statt PowerShell-Inline (CSS `--var` crasht PS).
- **Syntax-Check nach jeder Änderung:** `C:\Claude\_final_check.py` ausführen — prüft async+var, await-in-non-async, doppelte Funktionen. Verhindert den Fehler vom 08.06. (4 versteckte JS-Syntax-Bugs = stundenlanger Ausfall).
- **Neue Funktionen:** Immer `async function` schreiben wenn die Funktion `await` enthält. Immer `let/const/var` ohne `async` davor für Variablen.
- Vorschau-Server: `python -m http.server 8765` → `http://localhost:8765/index.html`
- **Datenschutz:** E-Mail-Signatur-Feld in YAVIS leer lassen → Outlook fügt eigene Signatur an (solange kein Graph API). Mit `body=` in mailto: erscheint Outlook-Signatur nicht — bekanntes Protokoll-Limit.
- **Farbschema:** YSC-Orange `#f0855a` — CSS-Variablen `--accent`, `--accent2`, `--ok` alle gleich. Rot `#ef4444` nur für `--hot` (Löschen/Fehler). Änderung via `_inject_farben_orange.py` oder direkt in den 2 CSS-Blöcken ganz oben in index.html.

# Stufe 2 — Migrationsplan „Eine Person, viele Rollen"

> Erstellt am 09.06.2026 als Vorbereitung. **Noch NICHTS migriert.** Dieser Plan ist zum Durchlesen/Freigeben. Erst nach deinem OK (und bestätigtem Supabase-Backup) wird schrittweise umgesetzt, jeder Schritt mit Trockenlauf.

## Stand der Vorbereitung (heute erledigt, alles read-only)
- ✅ **Lokales Backup:** alle 11 Datentabellen als JSON in `C:\Claude\_backup_db\` (~17.500 Zeilen).
- ✅ **Dubletten-Analyse:** **14 Personen** sind heute Kandidat UND Ansprechpartner (Liste: `_stufe2_dubletten.json`). 10 davon sicher (Name + E-Mail identisch), 4 nur über eines von beiden.
- ⏳ **Supabase-Backup:** noch von dir auszuführen (Anleitung unten) — Pflicht vor der ersten echten Änderung.

## Ausgangslage
- `kandidaten`: 1507 Zeilen, viele Felder (21 normierte Positionen, Geo, Abwerbeschutz, Sperren), viele abhängige Tabellen.
- `kontakte`: 303 Zeilen, schlanker, hängt an `kunde_id` (Firma).
- Firmen (`kunden`) bleiben eine eigene Tabelle (NICHT Teil der Zusammenführung).

## Empfohlenes Zielmodell (risikoärmste Variante)
**`kandidaten` wird zur Personen-Tabelle erweitert; `kontakte` wird hineingeschmolzen.** Tabellenname bleibt vorerst `kandidaten` (Umbenennen würde 100+ Code-Stellen brechen — später optional).
- Neue Spalte **`rollen`** (Text, Format `;Kandidat;Ansprechpartner;` wie Tags). Bestehende 1507 → `;Kandidat;`.
- Neue Spalte **`firma_id`** (FK auf `kunden`) für die Ansprechpartner-Rolle (welche Firma). 
- Neue Spalte **`funktion`** (Job-Funktion als Ansprechpartner) — getrennt von `berufsbezeichnung` (= die 21 normierten Kandidaten-Positionen, bleiben unangetastet).

**Warum so:** kandidaten ist die „reichere" Tabelle mit den meisten Daten und Fremdschlüsseln; die 303 Kontakte einzuschmelzen ist deutlich weniger Eingriff, als beide in eine neue Tabelle zu migrieren. Die 21 Positionen, die PLZ-Umkreissuche und die FKs bleiben erhalten.

## Feld-Mapping kontakte → kandidaten (ENTSCHEIDUNGEN NÖTIG)
| kontakte | → kandidaten | Hinweis |
|---|---|---|
| vorname, nachname, voller_name | gleich | direkt |
| email, telefon_beruflich, mobil | email_beruflich, telefon, mobil | direkt |
| berufsbezeichnung (= Funktion) | **`funktion`** (neu) | NICHT in `berufsbezeichnung` (sonst kollidiert mit den 21 Positionen) — **bitte bestätigen** |
| kunde_id | **`firma_id`** (neu) | „ist Ansprechpartner bei Firma X" |
| abteilung, xing_profil, linkedin_profil, notizen, tags | gleich | direkt |
| strasse/plz/stadt/… | berufliche Adresse | **Entscheidung:** als Privat- oder Berufsadresse übernehmen? |

## Fremdschlüssel umhängen (von kontakt_id → neue Person-ID)
Diese Tabellen zeigen heute auf `kontakte` und müssen sauber umgehängt werden:
- `notizen.kontakt_id`
- `aufgaben.verknuepft_mit` (Wiedervorlagen)
- `emails.entity_id`
- `stellen.kontakt_id`
- `dokumente.kontakt_id`
(Die Tabellen, die auf `kandidaten` zeigen — bewerbungen, erfahrung, ausbildung, notizen.kandidat_id, dokumente.kandidat_id — bleiben unverändert, da `kandidaten` die Zieltabelle ist.)

## Migrationsschritte (jeder mit Trockenlauf, Stopp & Freigabe)
1. **Supabase-Backup** (du) + lokales Backup (✅ da).
2. **DDL:** Spalten `rollen`, `firma_id`, `funktion` zu `kandidaten` hinzufügen; alle bestehenden → `rollen=';Kandidat;'`. (additiv, kein Risiko)
3. **14 Dubletten zusammenführen:** beim vorhandenen Kandidaten `rollen` um `Ansprechpartner` ergänzen, `firma_id`/`funktion` aus dem Kontakt übernehmen, dessen FKs (Notizen/Aufgaben/Emails/Stellen/Dokumente) auf die Kandidaten-ID umhängen, den doppelten Kontakt löschen. **Trockenlauf zeigt vorher die 14 Fälle einzeln.**
4. **289 übrige Kontakte** als neue Personen in `kandidaten` anlegen (`rollen=';Ansprechpartner;'`, Felder gemäß Mapping), ihre FKs umhängen. **Trockenlauf zählt vorher.**
5. **App-Umbau:** Tab „Ansprechpartner" entfällt, „Kandidaten" wird **„Personen"** mit Rollen-Filter (Kandidat / Ansprechpartner / Doppelrolle). Bestehende Funktionen (Umkreissuche, 21 Positionen, Recherche-Maske, Sperren, Direktansprache) bleiben. Optik wie im Mockup `_mockup_rollen.html`.
6. **Doku** (`UEBERGABE_YAVIS.md`, `CLAUDE.md`) aktualisieren.

## Offene Entscheidungen für dich (vor Schritt 2)
1. Tabellenname `kandidaten` vorerst beibehalten (empfohlen) oder gleich auf `personen` umbenennen (mehr Aufwand/Risiko)?
2. Kontakt-„Funktion" in neues Feld `funktion` (empfohlen) — ok?
3. Rollen-Werte: nur **Kandidat / Ansprechpartner** (Firmen-Typen wie Auftraggeber/Lieferant bleiben Eigenschaft der Firma) — ok, oder willst du sie auch an der Person?
4. Kontakt-Adresse als Privat- oder Berufsadresse übernehmen?

## Geschätzter Aufwand (siehe Chat)
~8–14 h fokussierte Arbeit, sinnvoll auf 2–3 Sitzungen verteilt; größter Block ist der App-Umbau (Schritt 5).

-- YAVIS: Ordner-Feld für Personen und Firmen
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen (Run).
-- Legt je eine Textspalte "ordner" an. "if not exists" = mehrfaches Ausführen schadet nicht.

alter table kandidaten add column if not exists ordner text;
alter table kunden     add column if not exists ordner text;

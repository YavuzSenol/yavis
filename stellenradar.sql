-- Stellenradar: gefundene Stellenanzeigen für die Kundenakquise (angelegt 25.11.2026).
-- Nur neue Tabelle, ändert nichts Bestehendes. Keine personenbezogenen Daten in dieser Datei.
create table if not exists public.stellenfunde (
  id                  text primary key,
  gefunden_am         date not null default current_date,
  quelle              text,
  firma               text not null,
  titel               text not null,
  ort                 text,
  ebene               text,
  ansprechperson      text,
  link                text,
  suchwort            text,
  status              text not null default 'neu' check (status in ('neu','gemerkt','verworfen','mandat')),
  kunde_id            text,
  stelle_id           text,
  notiz               text,
  erstellt_am         timestamptz not null default now(),
  geaendert_am        timestamptz not null default now()
);
alter table public.stellenfunde enable row level security;
drop policy if exists app_access on public.stellenfunde;
create policy app_access on public.stellenfunde for all to authenticated using (true) with check (true);

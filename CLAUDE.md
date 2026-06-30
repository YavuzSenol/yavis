# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Y.A.V.I.S. CRM** ("Javis") — a self-built recruiting CRM that replaces Zoho Recruit for Yavuz Senol (recruiter, TGA/Bau, Köln). The whole app is a single static `index.html` (Vanilla JS + Supabase-JS via CDN), backed by a Supabase (PostgreSQL) cloud database, hosted on GitHub Pages.

The user is technically literate but **not a programmer**. Explanations and instructions must be in **German**, step-by-step, click-by-click, with jargon explained. Never invent tool output or claim something was built/tested without real evidence. Offer a dry run before any write operation.

**Read `UEBERGABE_YAVIS.md` first** — it is the living handover doc (current feature status, open tasks, DB schema, endpoints). Keep it updated as work progresses.

## Architecture

- **Frontend:** `index.html` — one file, no build step. Vanilla JS, `<script>` block starts ~line 267. Supabase JS client loaded from CDN. Dark theme, Calibri font. All state in module-level vars; navigation is a left sidebar (`<nav class="sidebar">`, ~line 333) that show/hides `<div>` sections via `data-view`, plus `localStorage` for Supabase URL/key (`sb_url`, `sb_key`). Seven views: 🏠 Start / 👥 Personen / Firmen / 📋 Wiedervorlagen / 📁 Projekte / 🔍 Recherche / ✉️ Newsletter. Note the legacy `data-view` ids: **Personen** is `kandidaten` and **Firmen** is `kunden`. Since the 29.06.2026 "Personen-Konsolidierung" (Phase 3, Variante B) there is **one combined Personen pool** — candidates and contacts are no longer separate tabs; a person is a Kandidat and/or Ansprechpartner by role (filter chips: Alle / Kandidat / Ansprechpartner).
- **Backend:** Supabase project `afbyqrwqnccgudpqxziv` (EU). RLS is ON for every table, so all DB access requires an authenticated session — the app logs in via Supabase Auth, and scripts must obtain a token before reading/writing.
- **CV extraction:** Anthropic API, model `claude-haiku-4-5-20251001`. Two code paths share the same extraction logic:
  - `Python Lebensläufe/cv_auslesen.py` — local batch script for new candidates (PDF → Claude → Supabase).
  - Supabase Edge Function `cv-auslesen` (code in `cv_auslesen_edge.ts`, referenced by the "📄 CV einlesen" button in the app). Check `UEBERGABE_YAVIS.md` §5 for deploy status.
- **File storage:** Supabase Storage bucket `dokumente` (private). CVs and candidate photos live under `kandidat/<id>/...`; access via signed URLs (`createSignedUrl`).

### CV-extraction field rules (shared by both code paths)
- `berufsbezeichnung` = one of 21 normalized positions — **always overwritten**.
- `position_original`, `mobil_privat` — **always overwritten**.
- All other fields: **only filled if empty** in the DB. Never clobber existing data.
- "Leitung" titles only when there's a real job title (Leiter / Leitung / Head of / GF).

### Database
~12 tables, candidate-centric: `kandidaten`, `kunden`, `kontakte`, `stellen`, `bewerbungen`, `notizen`, `aufgaben`, `emails`, `dokumente`, `erfahrung`, `ausbildung`, plus geo lookups (`plz_geo`, `vorwahl_geo`). Candidate IDs use the format `Zrecruit_<number>` (carried over from the Zoho import). Full `kandidaten` field list is in `UEBERGABE_YAVIS.md` §3.

## Commands

```powershell
# Local preview server (config in .claude/launch.json)
python -m http.server 8765      # then open http://localhost:8765/index.html

# Probe whether the Edge Function is deployed (should return {"ok":false,...} if live)
curl -s -X POST "https://afbyqrwqnccgudpqxziv.supabase.co/functions/v1/cv-auslesen" -H "Content-Type: application/json" -d "{}" --max-time 20

# Run the local CV batch script (needs: pip install anthropic pdfplumber; Python 3.12)
python "Python Lebensläufe/cv_auslesen.py"   # set WIRKLICH_SCHREIBEN=False for a dry run
```

There is no build, lint, or test suite — this is a static-file project.

## Deploy / workflow

Repo: `github.com/YavuzSenol/yavis`, live at `yavuzsenol.github.io/yavis`. Local repo is `C:\Claude`, branch `main` tracks `origin/main`.

**Direct push now works** (set up 05.06.2026 via Git Credential Manager device-flow login; HTTPS, credentials cached in Windows — no popup on subsequent pushes, no SSH). To ship a change to `index.html`:

```powershell
git add index.html
git commit -m "kurze Beschreibung"
git push
```

After 1–2 min reload the live app with Ctrl+F5. The old manual GitHub-web-upload route still works as a fallback but is no longer necessary.

If a push ever hangs on auth, the device-code flow is the reliable path: kill the stuck `git.exe`, re-run `git push`, and in the Git Credential Manager dialog choose **"Sign in with a code"** (the browser-redirect option failed on this machine) → enter the code at github.com/login/device → Authorize.

## Secrets — important

`login.local`, `logs_dats.txt`, and any `Management_token.txt` hold live credentials (Supabase password, Anthropic API key, GitHub password). These must **never** be committed, pasted into the app, or sent to GitHub/chat. `cv_auslesen.py` currently has keys hardcoded in its KONFIGURATION block — keep them out of any commit. Confirm `.gitignore` covers these files before any `git add`. For API tests, read the email+password from `login.local`, POST to `/auth/v1/token?grant_type=password`, then use the returned `access_token` as a Bearer token.

## Notes

- PowerShell sometimes renders umlauts incorrectly in its console output — that's a display issue only; the app and data are UTF-8 clean.
- The handover doc references the local repo as `C:\Claude\YAVIS_CRM`, but the active git repo is `C:\Claude` itself (where `index.html` lives). The `.claude/settings.local.json` allowlist still points some commands at the old `YAVIS_CRM` path.
- `recruiting_app.html` is an older/alternate standalone version; `index.html` is the live app.

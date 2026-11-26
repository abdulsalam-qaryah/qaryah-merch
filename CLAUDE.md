# CLAUDE.md – qaryah-merch

Field merchandising system for Al Qaryah's egg department (Riyadh). The user is the department manager; talk to them in Saudi Arabic. All UI text is Arabic (RTL).

Full history, decisions, and the open to-do list are in `docs/سجل_المشروع.md`. Read it before starting work.

## Layout
- `claude-artifact/app.html`: **the single source of the UI**. It is a claude.ai Artifact page (no doctype/head) that uses `window.claude.use('db'|'user'|'assets'|'downloads'|'sample')`. It is published at https://claude.ai/artifact/EA4XspUSmBoXMpZE9evkcw.
- `index.html`: the standalone build served by GitHub Pages. **Generated, do not edit by hand.** Rebuild with `python3 tools/build_standalone.py` after changing `claude-artifact/app.html`.
- `runtime.js`: provides the same `window.claude.use(...)` API on top of Supabase (supabase-js 2.118.0 UMD). Handles the username/password login screen (username → `username@merch.qaryah.sa`), db (`docs` table: collection/id/data jsonb, realtime refetch), photos (`photos` bucket), CSV downloads, and AI via the `shelf-ai` Edge Function.
- `config.js`: Supabase URL plus publishable key (public by design), and `AI_ENABLED`.
- `supabase/1_schema.sql`: table, RLS, `is_admin`/`is_approved`/`doc_merge`, admin-by-username trigger, and the storage bucket. Idempotent.
- `supabase/2_branches.sql`: 5 regions and 257 branches, `on conflict do nothing`.
- `supabase/3_attendance.sql`: `is_supervisor()` and policies letting supervisors write `reviews` (uniform review / excused days). Idempotent.
- `supabase/4_privacy_challenge.sql`: v14 RLS. Reps read only their own branches, reports, POs/trips on their branches and their own `notifs`; `pricewatch` (daily brand challenge) is first-write-wins: only admins can update or delete it. Idempotent.
- `supabase/functions/shelf-ai/index.ts`: Deno Edge Function. Calls Claude through `@anthropic-ai/sdk` (`claude-opus-5-5`, `fallbacks: "default"`); the key lives in Supabase secret `ANTHROPIC_API_KEY`.
- `data/`: original branches Excel, the organized archive workbook, and `seed/` JSON (the records as loaded).
- `manifest.webmanifest`, `sw.js`, `icons/`: PWA install with the Al Qaryah logo.

## Rules
- Keep both versions working from the one UI source. Standalone-only behavior goes behind `window.APP_STANDALONE` / `window.APP_SIGNOUT` / `window.APP_IMG` checks.
- Document paths are always two segments (`collection/id`). The runtime does not support sub-collections.
- Never commit secrets: no `service_role` key, no DB password, no Anthropic key, no user passwords.
- Brand colors: red `#AC1F23`, cream `#F2EDD9`/`#FBF8F0`, yellow `#E7B13A`, and secondaries `#7A1318`/`#661720`. Do not distort or recolor the logo.
- After UI changes:
  1. Rebuild `index.html`.
  2. Republish the Artifact from `claude-artifact/app.html`.
  3. Commit and push to `main` (GitHub Pages deploys from `main` root; `.nojekyll` is present).
- This cloud environment cannot reach `*.supabase.co` or `*.github.io`, so verify against those through the user.

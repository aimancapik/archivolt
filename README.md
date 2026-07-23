# Archivolt

Archivolt is a local-first documentation archive with a private Supabase sync layer and an MCP bridge for Codex.

The browser is the human UI. The local MCP process can list, read, search, create, and update pages in the same revisioned archive without silently overwriting concurrent browser changes.

## Run locally

Without Supabase variables, Archivolt stays local and uses browser storage:

```powershell
npm install
npm run dev
```

## Temporary browser access

The browser currently uses the fixed access code `246260`. Unlocking is remembered on that browser until **Lock** is selected.

This is a temporary client-side gate, not secure authentication: the code is present in the built JavaScript. A browser with an existing Supabase session keeps private sync; otherwise Archivolt falls back to browser storage.

## Private Supabase sync

1. Back up the existing `archive_state/main.data` value.
2. Run `supabase.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env` and fill in:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is for the local MCP process only. Never prefix it with `VITE_`, commit it, or add it to a browser deployment.

Public share creation is intentionally disabled in this release.

## MCP

Project-local Codex configuration lives in `.codex/config.toml`. Restart or reopen Codex after installing dependencies or changing MCP environment values.

Available tools:

- `list_projects`: list projects and page counts
- `create_project`: create a uniquely keyed project with an index page
- `list_pages`: list bounded page metadata for a project
- `read_page`: read by page key or an unambiguous title
- `search_pages`: search bounded results across page content
- `create_note`: always create a uniquely keyed page
- `update_note`: replace an existing page using its exact `pageKey`

Create and update are deliberately separate. Use `list_pages`, `read_page`, or `search_pages` to obtain the exact key before calling `update_note`.

```powershell
npm run mcp:self-check
npm run mcp
```

## Checks

```powershell
npm test
npm run lint
npm run build
```

The browser displays `Saving`, `Saved`, `Offline`, or `Conflict`. On conflict, keeping local explicitly replaces the newest remote archive; using remote first stores the browser copy in `archivolt.conflictBackup`.

## Deferred

- secure public sharing and expiry controls
- archive export UI and version history
- normalized project/page tables
- remote HTTP MCP and MCP resources
- append/delete tools and bundle refactoring

# Archivolt

Archivolt is a local-first documentation archive with a small MCP bridge for Codex.

The app is still the human UI. The MCP server is the agent door: Codex can create notes directly in the same Supabase-backed archive.

## Local Flow

```text
You ask Codex
  -> Codex calls Archivolt MCP
  -> MCP writes a page into Supabase archive_state
  -> Archivolt loads the page in the browser
```

## Use Case

Use this when you want Codex to capture work without opening the app form manually.

Examples:

```text
Create an Archivolt note titled "Site Visit 30 June" with this body:
- Checked inverter status
- Found loose terminal
- Follow up with replacement photo
```

```text
Summarize this chat into an Archivolt note called "MCP Setup Notes".
```

Codex writes the note as a document page under the default project `nexus-ui`.

You can also say it casually:

```text
save this as archivolt note
```

Repo instructions in `AGENTS.md` tell Codex to choose the Archivolt MCP, pick/list projects, and format the note nicely.

Say `update`, `replace`, `overwrite`, or `refresh` when you want Codex to reuse the closest existing document instead of creating a new page.

## Run

```powershell
npm install
npm run dev
```

## MCP

Project-local Codex config lives in `.codex/config.toml`.

After installing dependencies, restart or reopen Codex in this repo so it loads the MCP server.

Available tools:

- `list_projects`: list Archivolt project IDs
- `create_note`: create a Markdown note as an Archivolt page

Manual check:

```powershell
npm run mcp:self-check
```

Manual MCP start:

```powershell
npm run mcp
```

## Build

```powershell
npm run lint
npm run build
```

## Later

Skipped for now:

- realtime refresh after MCP writes
- auth hardening for write access
- packaging this MCP as a reusable plugin

Add those when Archivolt needs multi-user or non-local use.

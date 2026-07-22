# Archivolt Agent Rules

When the user asks to create, save, capture, log, summarize, or turn something into a note, prefer the Archivolt MCP tools.

Default behavior:

- If the project is unclear, call `list_projects` first.
- If the user gives a project name instead of an ID, pick the closest project ID from `list_projects`.
- If no project is mentioned, use `nexus-ui`.
- Call `create_note` with a short title and a clean Markdown body.
- `create_note` always creates a new uniquely keyed page.
- When the user asks to update, replace, overwrite, or refresh, find the exact `pageKey` with `list_pages`, `read_page`, or `search_pages`, then call `update_note`.
- Never guess a `pageKey` for an update.

Make notes readable without being asked:

- use `##` headings for sections
- use short paragraphs for context
- use bullets for facts/findings
- use `- [ ]` and `- [x]` for action items
- use fenced code blocks with a language for commands or code

Do not ask the user to format the note unless the content is genuinely missing.

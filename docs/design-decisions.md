# Design decisions

## 2025-06-21 — Initial plugin design

### Goal

Sync GitHub starred repositories into Obsidian notes on a recurring schedule, with secure token storage and customizable note templates.

### Reference plugins

- [obsidian-github-stars-manager](https://github.com/EmberSparks/obsidian-github-stars-manager): template variable list and GitHub metadata fields
- [obsidian-github-stars](https://github.com/flyingnobita/obsidian-github-stars): minimal PAT usage and `requestUrl` for GitHub API calls

### Secret storage

The GitHub personal access token is **not** stored in plugin `data.json`. Settings store only the secret **name**; the value is read at runtime via `app.secretStorage.getSecret()`. The settings UI uses Obsidian’s `SecretComponent` (requires Obsidian 1.11.4+).

Default secret name: `github-stars-sync-pat`.

### Sync model

1. Fetch all starred repositories from `GET /user/starred` (paginated, `Accept: application/vnd.github.star+json`).
2. For each repository, render the configured filename and note templates.
3. Create notes that do not exist yet.
4. Optionally update existing notes when **Update existing notes** is enabled.

Repository ID → note path mappings are persisted so renames in the filename template do not duplicate notes unnecessarily.

### Update behavior

**Update existing notes** defaults to **off** so manual edits in note bodies are preserved. When enabled, the plugin re-renders the full note from the template on each sync (similar to a one-way export).

### Scheduling

Automatic sync uses `registerInterval` with a user-configurable hour interval (1–168 hours). A deferred sync runs once shortly after plugin load when auto sync is enabled.

### Dependencies

No runtime npm dependencies are bundled. GitHub access uses Obsidian’s `requestUrl` instead of Octokit to keep the plugin small and mobile-friendly.

### Template scope

Template variables mirror the comprehensive set from obsidian-github-stars-manager’s properties export, adapted for a single markdown template rather than a separate properties editor.

User-specific fields such as `{{notes}}`, `{{user_tags}}`, and `{{linked_note}}` from that plugin are intentionally omitted because this plugin does not maintain a separate enhancement layer.

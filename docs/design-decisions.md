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

## 2025-06-21 — GitHub star list metadata

### Source

GitHub does not expose star list membership on the REST `GET /user/starred` endpoint. The plugin fetches list membership separately via the official GraphQL API (`viewer.lists` and paginated `UserList.items`).

### Merge strategy

During sync:

1. REST fetch provides starred repository metadata.
2. GraphQL fetch builds a `repoId → [{ name, slug, url }]` map using each list’s `databaseId`.
3. Repositories are enriched before template rendering.

If the GraphQL fetch fails (for example missing `read:user` scope), sync still completes using starred repository data and records a warning.

### Template variables

- `{{star_names}}` / `{{star_links}}` — YAML frontmatter lists
- `{{star_names_inline}}` / `{{star_links_inline}}` — inline comma-separated values
- `{{star_lists_markdown}}` — markdown links to the list pages on GitHub

List URLs follow GitHub’s public format: `https://github.com/stars/<login>/lists/<slug>`.

## 2026-07-25 — Star list maps of content (MOC)

### Goal

Let users generate one "map of content" note per GitHub star list, and optionally link repository notes back to those MOC notes via wikilinks, without requiring a second plugin or manual note curation.

### Distinctness and identity

Star lists are deduplicated by `slug` (GitHub's stable per-list identifier) across all enriched repositories in a sync, since a user's star list names are already unique but slugs are the field also used to build the list's canonical URL.

### Filenames and linking

A MOC note's filename is the sanitized star list **name** (not slug), written to a separate configurable destination folder (default `GitHub Stars/MOCs`). Using the plain name as the filename means `[[Star List Name]]` wikilinks resolve correctly regardless of which folder the MOC note lives in, matching how Obsidian resolves wikilinks by filename rather than full path.

### Create-only, never overwrite

Sync only creates MOC notes that do not already exist. Unlike repository notes (which have an **Update existing notes** toggle), MOC notes have no re-render option, since they are meant to be user-curated landing pages rather than generated exports.

### Linking repository notes to MOCs

The existing `{{star_names}}` and `{{star_names_inline}}` template variables are reused rather than adding new ones. When **Link star names to maps of content** is enabled, each star name is wrapped as `[[name]]` before being formatted into the YAML list / inline string. `{{star_lists_markdown}}` (which links out to GitHub) is intentionally left unchanged, since it serves a different purpose (an external reference, not a vault-internal MOC link).

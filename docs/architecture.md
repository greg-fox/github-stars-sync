# Architecture

## Module layout

```text
src/
  main.ts                 Plugin lifecycle, commands, sync scheduling
  settings.ts             Settings schema and normalization
  secrets.ts              Secret storage helpers
  constants.ts            Defaults and template variable catalog
  types.ts                Shared interfaces
  github/
    client.ts             GitHub REST API (starred repos, auth test)
    graphql.ts            Shared GraphQL request helper
    starLists.ts          GraphQL star list membership lookup
    enrichRepositories.ts Merge list metadata onto starred repos
    pagination.ts         Link header pagination helper
  template/
    engine.ts             Template rendering and filename sanitization
  sync/
    syncService.ts        Sync orchestration
    noteWriter.ts         Vault folder and file create/update
    mocWriter.ts          Distinct star list collection and MOC note create
  ui/
    settingsTab.ts        Plugin settings UI
```

## Sync flow

```mermaid
flowchart TD
  A[Trigger: interval / command / ribbon] --> B[Read PAT from secret storage]
  B --> C{Token present?}
  C -- No --> D[Show error notice]
  C -- Yes --> E[Fetch starred repos via REST]
  E --> F[Fetch star list membership via GraphQL]
  F --> G[Merge list metadata onto repos]
  G --> H[Render templates per repository]
  H --> I{Mapped note exists and<br/>not owned by another repo?}
  I -- Yes --> K{Update existing enabled?}
  I -- No --> T{File at rendered path?}
  T -- No --> J[Create note]
  T -- Yes --> U{Frontmatter github_id, id,<br/>or url matches repo?}
  U -- Yes --> K
  U -- No --> V{File at path-repo-id?}
  V -- No --> J
  V -- Yes, matching --> K
  V -- Yes, not matching --> W[Report error, write nothing]
  K -- No --> L[Skip]
  K -- Yes --> M[Modify note]
  J --> N{MOCs enabled?}
  W --> N
  M --> N
  L --> N
  N -- No --> S[Save sync state]
  N -- Yes --> O[Collect distinct star lists]
  O --> P{MOC note exists?}
  P -- No --> Q[Create MOC note]
  P -- Yes --> R[Skip]
  Q --> S
  R --> S
```

## Persisted data

Plugin `data.json` contains:

- User settings (folder, templates, sync interval, secret name)
- Sync state (`lastSyncTime`, `lastSyncError`, `repoNotes` map)

## Note ownership

`repoNotes` maps each repository ID to the note path it owns. During a sync a path can belong to only one repository, so colliding filenames never overwrite each other. An existing note that is not in `repoNotes` is adopted only when its frontmatter `github_id`, `id`, or `url` identifies the same repository; otherwise the note is created as `<filename>-<repository id>.md`.

Secrets are stored separately by Obsidian and are not part of `data.json`.

## Testing

Unit tests cover template rendering, settings normalization, pagination, secret helpers, GitHub client pagination, MOC note writing, and sync notice formatting. UI and Obsidian vault integration are validated manually in Obsidian.

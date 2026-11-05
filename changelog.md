# Changelog

## 2026-11-05T00:00:00Z

- Report GitHub authentication and rate limit errors with clear messages; requests now inspect status codes instead of failing with a generic error
- Detect rate limiting from 403 responses, `retry-after`, and GraphQL `RATE_LIMITED` errors, including the reset time when available
- Never overwrite notes the plugin does not own; colliding filenames and unrelated existing notes now get a `<filename>-<repository id>.md` note instead
- Adopt existing notes only when their frontmatter `github_id`, `id`, or `url` matches the repository; add `github_id` to the default note template
- Substitute template placeholders in a single pass so placeholder text and `$` sequences in values are kept literally
- Link star names to maps of content by full note path with the list name as alias; sanitize characters that break wikilinks in filenames
- Quote and escape all YAML list items; add `{{description_yaml}}`
- Document that deleted repository notes are recreated on the next sync
- Fix a doubled period in the star list warning
- Track renamed and moved repository notes and folders instead of creating duplicates; find relocated notes by frontmatter during sync
- Show a notice when an automatic sync fails or finishes with errors or warnings
- Add `{{star_mocs}}` and `{{star_mocs_markdown}}` links from repository notes to their maps of content, and `{{notes_folder}}` for map of content templates
- The default map of content template embeds a base that lists the repositories linking to it
- Add `{{archived}}`, `{{homepage}}`, `{{license}}`, `{{default_branch}}`, and `{{synced_at}}` template variables
- Refresh the settings tab after **Sync now** so the last sync time and error are current
- Update existing notes with `Vault.process`, and use only the Vault API when checking for existing folders
- Clean up the startup sync timer and the sync interval when the plugin unloads; debounce interval changes from settings
- Remove the redundant `obsidian-api.d.ts` declarations and the unreachable secret storage fallback
- Replace em dashes in settings text
- Update the license holder, document network use and privacy in the README, and verify tag and version in the release workflow

## 2026-07-25T00:00:00Z

- Add a "Maps of content" settings section to create one note per distinct GitHub star list
- Add destination folder, template (`{{star_name}}` / `{{star_link}}`), and a toggle to link star names in repository notes to their map of content note
- Map of content notes are only created when missing; existing ones are never overwritten
- Add unit tests for map of content rendering and note writing

## 2025-06-21T12:00:00Z

- Fetch GitHub star list membership via GraphQL during sync
- Add template variables for star list names, links, and markdown links
- Gracefully continue sync with a warning when star list metadata cannot be fetched
- Document star list support in README and design notes

## 2025-06-21T00:00:00Z

- Initial GitHub Stars Sync plugin implementation
- Secure PAT storage via Obsidian SecretComponent and SecretStorage
- Configurable note and filename templates with GitHub metadata variables
- Manual and automatic starred repository synchronization
- Unit tests with Vitest
- Added `docs/` design and architecture notes
- Updated README with build, install, PAT, and settings documentation

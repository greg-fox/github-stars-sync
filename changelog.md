# Changelog

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

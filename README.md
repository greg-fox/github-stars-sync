# GitHub Stars Sync

Synchronize your GitHub starred repositories into Obsidian notes. Configure a personal access token (stored in Obsidian’s secure keychain), choose where notes are created, and customize the note template with repository metadata.

## Features

- Fetches all repositories you have starred on GitHub
- Creates one note per starred repository in a configurable vault folder
- Custom filename and note templates with `{{variable}}` placeholders
- Stores your GitHub personal access token in [Obsidian secret storage](https://docs.obsidian.md/plugins/guides/secret-storage) (not in `data.json`)
- Automatic background sync on a configurable interval
- Manual sync via command palette or ribbon icon
- Optional maps of content: one note per distinct GitHub star list, with repository notes linking back to them

## Requirements

- Obsidian **1.11.4** or later (for secret storage)
- Node.js 18+ (for development builds)
- A GitHub personal access token with **`public_repo`** scope (or **`repo`** if you star private repositories)

## Network use and privacy

This plugin connects to GitHub. It does not contact any other service and does not collect telemetry.

- **What it calls:** the GitHub REST API (`https://api.github.com/user`, `https://api.github.com/user/starred`) and the GitHub GraphQL API (`https://api.github.com/graphql`, for star list membership).
- **When it calls them:** when you run **Sync now**, the **Sync GitHub stars now** command, or the ribbon icon; when you select **Test connection**; and, if **Automatic sync** is enabled, shortly after Obsidian starts and then on the configured interval.
- **What is sent:** your personal access token, in the `Authorization` header of each request to GitHub. No vault content, file names, or other personal data is sent.
- **What is stored:** the token is kept in Obsidian secret storage, not in the plugin's `data.json`. `data.json` holds your settings, the last sync time and error, and a map of repository IDs to note paths.
- **What is written:** notes are created and updated only inside the folders you configure, using data returned by GitHub.

Turn off **Automatic sync** if you want the plugin to contact GitHub only when you ask it to.

## Build and install

### Development

```bash
npm install
npm run dev
```

Copy or symlink the plugin folder into your vault:

```text
<Vault>/.obsidian/plugins/github-stars-sync/
```

The folder must contain `main.js`, `manifest.json`, and optionally `styles.css`.

Reload Obsidian and enable **GitHub Stars Sync** under **Settings → Community plugins**.

### Production build

```bash
npm run build
```

### Tests

```bash
npm test
```

## Create a minimal GitHub personal access token

1. Open GitHub → **Settings → Developer settings → Personal access tokens**.
2. Create a **fine-grained** or **classic** token.
3. Grant read access to your starred repositories:
   - **Classic token:** enable the `public_repo` scope (use `repo` if you need private starred repos) and **`read:user`** (or `user`) so star list metadata can be fetched via GraphQL.
   - **Fine-grained token:** allow read access to **Metadata**, repository contents you star, and **Profile** / user read permissions needed for star lists.
4. Copy the generated token.

## Configure the plugin

Open **Settings → Community plugins → GitHub Stars Sync**.

### Personal access token

Use the **Personal access token** secret selector to create or choose a secret in Obsidian’s keychain. Only the secret *name* is saved in plugin settings; the token value stays in secret storage.

Click **Test connection** to verify the token works.

### Note output

| Setting | Description |
| --- | --- |
| **Notes folder** | Vault folder for synced notes (default: `GitHub Stars`) |
| **Filename template** | Filename pattern without `.md` (default: `{{owner}}-{{name}}`) |
| **Note template** | Full markdown template for each note |
| **Update existing notes** | Re-render notes from the template on each sync (off by default to preserve manual edits) |

The plugin only writes to notes it created, or to existing notes whose frontmatter identifies the same repository (`github_id`, `id`, or `url`). If another note already uses the rendered filename, or two repositories render to the same filename, the new note is saved as `<filename>-<repository id>.md` instead of overwriting anything. The default template includes `github_id: {{id}}` for this purpose.

### Synchronization

| Setting | Description |
| --- | --- |
| **Automatic sync** | Fetch stars on a schedule |
| **Sync interval (hours)** | Hours between automatic syncs (1–168) |
| **Sync now** | Run a sync immediately |

You can also run **Sync GitHub stars now** from the command palette or click the star ribbon icon.

Automatic syncs run quietly. If one fails, or finishes with errors or warnings (for example, star lists could not be fetched), a notice shows what went wrong.

### Maps of content

| Setting | Description |
| --- | --- |
| **Create star list maps of content** | When enabled, creates one note per distinct GitHub star list found among your starred repositories |
| **Destination folder** | Vault folder for star list map of content notes (default: `GitHub Stars/MOCs`) |
| **Link star names to maps of content** | When enabled, `{{star_names}}` and `{{star_names_inline}}` in repository notes become `[[wikilinks]]` to the matching map of content note instead of plain text |
| **Map of content template** | Markdown template for each map of content note, using `{{star_name}}` and `{{star_link}}` placeholders |

Sync only *creates* map of content notes that don't already exist; existing map of content notes are never overwritten, so manual edits are preserved.

## Template variables

Use these placeholders in the filename and note templates:

| Variable | Description |
| --- | --- |
| `{{name}}` | Repository name |
| `{{full_name}}` | `owner/repo` |
| `{{owner}}` | Owner login |
| `{{description}}` | Repository description |
| `{{description_yaml}}` | Repository description as a quoted, escaped YAML string. Use it in frontmatter without surrounding quotes, for example `description: {{description_yaml}}` |
| `{{language}}` | Primary language |
| `{{url}}` | GitHub URL |
| `{{id}}` | Repository ID |
| `{{stars}}` | Star count |
| `{{forks}}` | Fork count |
| `{{watchers}}` | Watcher count |
| `{{issues}}` | Open issue count |
| `{{created_at}}` | Created date (ISO 8601) |
| `{{updated_at}}` | Updated date (ISO 8601) |
| `{{pushed_at}}` | Last push date (ISO 8601) |
| `{{starred_at}}` | When you starred the repo (ISO 8601) |
| `{{star_names}}` | GitHub star list names as a YAML list |
| `{{star_links}}` | GitHub star list URLs as a YAML list |
| `{{star_names_inline}}` | Comma-separated star list names |
| `{{star_links_inline}}` | Comma-separated star list URLs |
| `{{star_lists_markdown}}` | Markdown bullet links to each star list |
| `{{is_private}}` | `true` or `false` |
| `{{is_fork}}` | `true` or `false` |
| `{{topics}}` | YAML list of topics |
| `{{topics_inline}}` | Comma-separated topics |

YAML list variables (`{{topics}}`, `{{star_names}}`, `{{star_links}}`) quote every item, so values such as `2024` or `true` stay strings in frontmatter.

Star list links use GitHub’s public list URLs, for example `https://github.com/stars/<username>/lists/<slug>`.

## Known issues

### Deleted repository notes are recreated on the next sync

This plugin treats GitHub as the source of truth and keeps a backup of your starred repositories in the vault. If you delete a repository note while the repository is still starred on GitHub, the next sync (manual or automatic) recreates it.

To remove a repository from the vault permanently, unstar it on GitHub first, then delete the note.

Renaming or moving a repository note (or its folder) is safe: the plugin follows the rename, and if a note was moved while the plugin was disabled, the next sync finds it by its `github_id` frontmatter (or by `id` or `url` inside the notes folder) instead of creating a duplicate.

## Documentation

Design notes and architecture details live in the [`docs/`](docs/) folder.

## License

0-BSD (see [LICENSE](LICENSE)).

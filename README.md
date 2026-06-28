# GitHub Stars Sync

Synchronize your GitHub starred repositories into Obsidian notes. Configure a personal access token (stored in Obsidian’s secure keychain), choose where notes are created, and customize the note template with repository metadata.

## Features

- Fetches all repositories you have starred on GitHub
- Creates one note per starred repository in a configurable vault folder
- Custom filename and note templates with `{{variable}}` placeholders
- Stores your GitHub personal access token in [Obsidian secret storage](https://docs.obsidian.md/plugins/guides/secret-storage) (not in `data.json`)
- Automatic background sync on a configurable interval
- Manual sync via command palette or ribbon icon

## Requirements

- Obsidian **1.11.4** or later (for secret storage)
- Node.js 18+ (for development builds)
- A GitHub personal access token with **`public_repo`** scope (or **`repo`** if you star private repositories)

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

### Synchronization

| Setting | Description |
| --- | --- |
| **Automatic sync** | Fetch stars on a schedule |
| **Sync interval (hours)** | Hours between automatic syncs (1–168) |
| **Sync now** | Run a sync immediately |

You can also run **Sync GitHub stars now** from the command palette or click the star ribbon icon.

## Template variables

Use these placeholders in the filename and note templates:

| Variable | Description |
| --- | --- |
| `{{name}}` | Repository name |
| `{{full_name}}` | `owner/repo` |
| `{{owner}}` | Owner login |
| `{{description}}` | Repository description |
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

Star list links use GitHub’s public list URLs, for example `https://github.com/stars/<username>/lists/<slug>`.

## Documentation

Design notes and architecture details live in the [`docs/`](docs/) folder.

## License

0-BSD (see [LICENSE](LICENSE)).

import { normalizePath, TFile, type MetadataCache, type Vault } from 'obsidian';
import type { GithubRepository } from '../types';

/**
 * Returns an updated copy of `repoNotes` after a vault rename, or `null`
 * when no tracked note was affected. Handles both a renamed or moved note
 * and a renamed or moved folder that contains tracked notes.
 */
export function applyRenameToRepoNotes(
	repoNotes: Record<string, string>,
	oldPath: string,
	newPath: string,
): Record<string, string> | null {
	if (!oldPath || oldPath === newPath) {
		return null;
	}

	const folderPrefix = `${oldPath}/`;
	let changed = false;
	const next: Record<string, string> = {};

	for (const [repoKey, path] of Object.entries(repoNotes)) {
		if (path === oldPath) {
			next[repoKey] = newPath;
			changed = true;
		} else if (path.startsWith(folderPrefix)) {
			next[repoKey] = `${newPath}/${path.slice(folderPrefix.length)}`;
			changed = true;
		} else {
			next[repoKey] = path;
		}
	}

	return changed ? next : null;
}

function isInFolder(path: string, folder: string): boolean {
	if (!folder) {
		return true;
	}
	return path.toLowerCase().startsWith(`${folder.toLowerCase()}/`);
}

function frontmatterKey(value: unknown): string | null {
	if (typeof value === 'number' || typeof value === 'string') {
		const key = String(value).trim();
		return key || null;
	}
	return null;
}

function addTo(index: Map<string, TFile[]>, key: string, file: TFile): void {
	const files = index.get(key);
	if (files) {
		files.push(file);
	} else {
		index.set(key, [file]);
	}
}

export type RelocatedNoteFinder = (repository: GithubRepository) => TFile[];

/**
 * Builds a finder that locates a repository's note when it is no longer at
 * its tracked path, for example after it was renamed or moved while the
 * plugin was not running, or after `data.json` was lost.
 *
 * A note matches when its frontmatter `github_id` equals the repository ID
 * anywhere in the vault. The looser `id` and `url` keys are only trusted
 * inside the notes folder, so unrelated notes elsewhere that mention a
 * repository URL are never adopted.
 *
 * The frontmatter index is built lazily on first use and once per sync.
 */
export function createRelocatedNoteFinder(
	vault: Vault,
	metadataCache: MetadataCache | undefined,
	notesFolder: string,
): RelocatedNoteFinder {
	if (!metadataCache) {
		return () => [];
	}

	let byId: Map<string, TFile[]> | null = null;
	let byUrl: Map<string, TFile[]> | null = null;
	const folder = normalizePath(notesFolder || '/').replace(/^\/$/, '');

	const buildIndex = (): void => {
		byId = new Map();
		byUrl = new Map();

		for (const file of vault.getMarkdownFiles()) {
			if (!(file instanceof TFile)) {
				continue;
			}

			const frontmatter: Record<string, unknown> | undefined =
				metadataCache.getFileCache(file)?.frontmatter;
			if (!frontmatter) {
				continue;
			}

			const githubId = frontmatterKey(frontmatter.github_id);
			if (githubId) {
				addTo(byId, githubId, file);
			}

			if (!isInFolder(file.path, folder)) {
				continue;
			}

			const id = frontmatterKey(frontmatter.id);
			if (id && id !== githubId) {
				addTo(byId, id, file);
			}

			const url = frontmatter.url;
			if (typeof url === 'string' && url.trim()) {
				addTo(byUrl, url.trim().toLowerCase(), file);
			}
		}
	};

	return (repository) => {
		if (!byId || !byUrl) {
			buildIndex();
		}

		const matches = [...(byId?.get(String(repository.id)) ?? [])];
		if (repository.html_url) {
			for (const file of byUrl?.get(repository.html_url.toLowerCase()) ?? []) {
				if (!matches.includes(file)) {
					matches.push(file);
				}
			}
		}

		return matches;
	};
}

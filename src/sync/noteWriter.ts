import {
	normalizePath,
	TFile,
	TFolder,
	type MetadataCache,
	Vault,
} from 'obsidian';
import type { GithubRepository, SyncResult } from '../types';
import { renderFilename, renderTemplate } from '../template/engine';
import type { GithubStarsSyncSettings } from '../settings';
import { createRelocatedNoteFinder } from './noteTracking';

/**
 * Makes sure `folderPath` exists in the vault and returns the path that
 * should be used for writing into it. If a folder with the same name but
 * different casing already exists (common on case-insensitive file systems
 * such as macOS and Windows), that folder's actual path is returned so sync
 * writes into the existing folder instead of failing.
 */
export async function ensureFolderExists(
	vault: Vault,
	folderPath: string,
): Promise<string> {
	const normalizedPath = normalizePath(folderPath);
	if (!normalizedPath || normalizedPath === '/') {
		return '';
	}

	const existing = findExistingFolderPath(vault, normalizedPath);
	if (existing !== null) {
		return existing;
	}

	try {
		await vault.createFolder(normalizedPath);
		return normalizedPath;
	} catch (error) {
		// Vault.createFolder throws "Folder already exists." when the folder
		// is on disk but the vault index does not have it at this exact path
		// (case mismatch, external creation, index not yet refreshed). Re-check
		// the vault index, then trust the error message rather than querying
		// the adapter, so only the Vault API is used.
		const resolved = findExistingFolderPath(vault, normalizedPath);
		if (resolved !== null) {
			return resolved;
		}
		if (error instanceof Error && /already exists/i.test(error.message)) {
			return normalizedPath;
		}
		throw error;
	}
}

function findExistingFolderPath(vault: Vault, path: string): string | null {
	const exact = vault.getAbstractFileByPath(path);
	if (exact instanceof TFile) {
		throw new Error(`"${path}" is a file, not a folder.`);
	}
	if (exact) {
		return exact.path ?? path;
	}

	const lowerPath = path.toLowerCase();
	const match = vault
		.getAllLoadedFiles()
		.find(
			(file) =>
				file instanceof TFolder && file.path.toLowerCase() === lowerPath,
		);
	return match ? match.path : null;
}

export interface WriteRepositoryNotesOptions {
	/**
	 * Used to read frontmatter so the plugin only adopts files that belong to
	 * the same repository, and to find notes that were renamed or moved away
	 * from their tracked path. Without it, unmapped existing files are never
	 * adopted and relocated notes are not found.
	 */
	metadataCache?: MetadataCache;
}

function pathKey(path: string): string {
	// Vaults commonly live on case-insensitive file systems.
	return path.toLowerCase();
}

/**
 * Returns true when an existing, unmapped file appears to be the note for
 * `repository`, based on identifiers in its frontmatter.
 */
function fileBelongsToRepository(
	file: TFile,
	repository: GithubRepository,
	metadataCache: MetadataCache | undefined,
): boolean {
	const frontmatter: Record<string, unknown> | undefined =
		metadataCache?.getFileCache(file)?.frontmatter;
	if (!frontmatter) {
		return false;
	}

	const repoId = String(repository.id);
	for (const key of ['github_id', 'id']) {
		const value = frontmatter[key];
		if (
			(typeof value === 'number' || typeof value === 'string') &&
			String(value).trim() === repoId
		) {
			return true;
		}
	}

	const url = frontmatter.url;
	return (
		typeof url === 'string' &&
		Boolean(repository.html_url) &&
		url.trim().toLowerCase() === repository.html_url.toLowerCase()
	);
}

export async function writeRepositoryNotes(
	vault: Vault,
	settings: GithubStarsSyncSettings,
	repositories: GithubRepository[],
	repoNotes: Record<string, string>,
	updateExistingNotes: boolean,
	options: WriteRepositoryNotesOptions = {},
): Promise<{ result: SyncResult; repoNotes: Record<string, string> }> {
	const result: SyncResult = {
		created: 0,
		updated: 0,
		skipped: 0,
		errors: [],
		warnings: [],
		mocsCreated: 0,
		mocsSkipped: 0,
	};

	const nextRepoNotes = { ...repoNotes };
	const notesFolder = await ensureFolderExists(vault, settings.notesFolder);

	// Paths already owned by a repository. A repository may only write to a
	// path it owns, so two repositories can never share (and overwrite) the
	// same note, and notes the plugin did not create are left untouched.
	const owners = new Map<string, string>();
	for (const [repoKey, path] of Object.entries(repoNotes)) {
		const key = pathKey(path);
		if (!owners.has(key) && vault.getAbstractFileByPath(path) instanceof TFile) {
			owners.set(key, repoKey);
		}
	}

	const isFreeFor = (path: string, repoKey: string): boolean => {
		const owner = owners.get(pathKey(path));
		return owner === undefined || owner === repoKey;
	};

	const claim = (path: string, repoKey: string): void => {
		owners.set(pathKey(path), repoKey);
		nextRepoNotes[repoKey] = path;
	};

	const findRelocated = createRelocatedNoteFinder(
		vault,
		options.metadataCache,
		notesFolder,
	);

	const writeExisting = async (
		file: TFile,
		repoKey: string,
		content: string,
	): Promise<void> => {
		claim(file.path, repoKey);
		if (!updateExistingNotes) {
			result.skipped++;
			return;
		}

		await vault.process(file, () => content);
		result.updated++;
	};

	for (const repository of repositories) {
		const repoKey = String(repository.id);

		try {
			const filename = renderFilename(
				settings.filenameTemplate,
				repository,
			);
			const content = renderTemplate(settings.noteTemplate, repository, {
				linkStarNamesToMoc: settings.mocEnabled && settings.mocLinkStarNames,
				mocFolder: settings.mocDestinationFolder,
			});

			const mappedPath = nextRepoNotes[repoKey];
			const mappedFile = mappedPath
				? vault.getAbstractFileByPath(mappedPath)
				: null;
			if (mappedFile instanceof TFile && isFreeFor(mappedFile.path, repoKey)) {
				await writeExisting(mappedFile, repoKey, content);
				continue;
			}

			// The note may have been renamed or moved while the plugin was not
			// tracking it. Find it by frontmatter before creating a duplicate.
			const relocated = findRelocated(repository).find(
				(file) =>
					isFreeFor(file.path, repoKey) &&
					vault.getAbstractFileByPath(file.path) === file,
			);
			if (relocated) {
				await writeExisting(relocated, repoKey, content);
				continue;
			}

			// Try the rendered filename first, then a variant suffixed with the
			// stable repository ID if the first is taken by something else.
			const candidates = [
				normalizePath(`${notesFolder}/${filename}.md`),
				normalizePath(`${notesFolder}/${filename}-${repoKey}.md`),
			];

			let handled = false;
			for (const candidate of candidates) {
				if (!isFreeFor(candidate, repoKey)) {
					continue;
				}

				const existing = vault.getAbstractFileByPath(candidate);
				if (existing instanceof TFile) {
					if (
						fileBelongsToRepository(
							existing,
							repository,
							options.metadataCache,
						)
					) {
						await writeExisting(existing, repoKey, content);
						handled = true;
						break;
					}
					continue;
				}
				if (existing) {
					continue;
				}

				const createdFile = await vault.create(candidate, content);
				claim(createdFile.path, repoKey);
				result.created++;
				handled = true;
				break;
			}

			if (!handled) {
				throw new Error(
					`"${candidates[0]}" already exists and belongs to another note.`,
				);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Unknown write error';
			result.errors.push(`${repository.full_name}: ${message}`);
		}
	}

	return { result, repoNotes: nextRepoNotes };
}

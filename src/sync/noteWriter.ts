import { normalizePath, TFile, TFolder, Vault } from 'obsidian';
import type { GithubRepository, SyncResult } from '../types';
import { renderFilename, renderTemplate } from '../template/engine';
import type { GithubStarsSyncSettings } from '../settings';

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
		// the vault and the underlying adapter before treating it as a failure.
		const resolved = findExistingFolderPath(vault, normalizedPath);
		if (resolved !== null) {
			return resolved;
		}
		if (await vault.adapter.exists(normalizedPath)) {
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

export async function writeRepositoryNotes(
	vault: Vault,
	settings: GithubStarsSyncSettings,
	repositories: GithubRepository[],
	repoNotes: Record<string, string>,
	updateExistingNotes: boolean,
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

	for (const repository of repositories) {
		const repoKey = String(repository.id);

		try {
			const filename = renderFilename(
				settings.filenameTemplate,
				repository,
			);
			const filePath = normalizePath(
				`${notesFolder}/${filename}.md`,
			);
			const content = renderTemplate(settings.noteTemplate, repository, {
				linkStarNamesToMoc: settings.mocEnabled && settings.mocLinkStarNames,
			});
			const existingPath = nextRepoNotes[repoKey];
			const existingFile = existingPath
				? vault.getAbstractFileByPath(existingPath)
				: vault.getAbstractFileByPath(filePath);

			if (existingFile instanceof TFile) {
				if (!updateExistingNotes) {
					result.skipped++;
					nextRepoNotes[repoKey] = existingFile.path;
					continue;
				}

				await vault.modify(existingFile, content);
				nextRepoNotes[repoKey] = existingFile.path;
				result.updated++;
				continue;
			}

			const createdFile = await vault.create(filePath, content);
			nextRepoNotes[repoKey] = createdFile.path;
			result.created++;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Unknown write error';
			result.errors.push(`${repository.full_name}: ${message}`);
		}
	}

	return { result, repoNotes: nextRepoNotes };
}

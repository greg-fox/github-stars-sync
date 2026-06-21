import { normalizePath, TFile, Vault } from 'obsidian';
import type { GithubRepository, SyncResult } from '../types';
import { renderFilename, renderTemplate } from '../template/engine';
import type { GithubStarsSyncSettings } from '../settings';

export async function ensureFolderExists(
	vault: Vault,
	folderPath: string,
): Promise<void> {
	const normalizedPath = normalizePath(folderPath);
	if (!normalizedPath || vault.getAbstractFileByPath(normalizedPath)) {
		return;
	}

	await vault.createFolder(normalizedPath);
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
	};

	const nextRepoNotes = { ...repoNotes };
	await ensureFolderExists(vault, settings.notesFolder);

	for (const repository of repositories) {
		const repoKey = String(repository.id);

		try {
			const filename = renderFilename(
				settings.filenameTemplate,
				repository,
			);
			const filePath = normalizePath(
				`${settings.notesFolder}/${filename}.md`,
			);
			const content = renderTemplate(settings.noteTemplate, repository);
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

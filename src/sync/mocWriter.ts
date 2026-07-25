import { normalizePath, TFile, Vault } from 'obsidian';
import type { StarListEntry } from '../types';
import { renderMocFilename, renderMocTemplate } from '../template/engine';
import type { GithubStarsSyncSettings } from '../settings';
import { ensureFolderExists } from './noteWriter';

export interface MocWriteResult {
	created: number;
	skipped: number;
	errors: string[];
}

export function collectDistinctStarLists(
	repositories: Array<{ starLists?: StarListEntry[] }>,
): StarListEntry[] {
	const bySlug = new Map<string, StarListEntry>();

	for (const repository of repositories) {
		for (const starList of repository.starLists ?? []) {
			if (!bySlug.has(starList.slug)) {
				bySlug.set(starList.slug, starList);
			}
		}
	}

	return [...bySlug.values()];
}

export async function writeStarListMocs(
	vault: Vault,
	settings: GithubStarsSyncSettings,
	starLists: StarListEntry[],
): Promise<MocWriteResult> {
	const result: MocWriteResult = { created: 0, skipped: 0, errors: [] };

	if (starLists.length === 0) {
		return result;
	}

	await ensureFolderExists(vault, settings.mocDestinationFolder);

	for (const starList of starLists) {
		try {
			const filename = renderMocFilename(starList);
			const filePath = normalizePath(
				`${settings.mocDestinationFolder}/${filename}.md`,
			);

			if (vault.getAbstractFileByPath(filePath) instanceof TFile) {
				result.skipped++;
				continue;
			}

			const content = renderMocTemplate(settings.mocTemplate, starList);
			await vault.create(filePath, content);
			result.created++;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Unknown write error';
			result.errors.push(`${starList.name}: ${message}`);
		}
	}

	return result;
}

import { describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import type { Vault } from 'obsidian';
import { DEFAULT_SETTINGS } from '../../src/settings';
import type { StarListEntry } from '../../src/types';
import {
	collectDistinctStarLists,
	writeStarListMocs,
} from '../../src/sync/mocWriter';

const obsidianList: StarListEntry = {
	name: 'Obsidian',
	slug: 'obsidian',
	url: 'https://github.com/stars/octocat/lists/obsidian',
};

const cliList: StarListEntry = {
	name: 'CLI Tools',
	slug: 'cli-tools',
	url: 'https://github.com/stars/octocat/lists/cli-tools',
};

function createVaultMock(options?: { existingPaths?: string[] }) {
	const createdPaths: string[] = [];
	const createdContents: string[] = [];

	const vault = {
		getAbstractFileByPath: vi.fn((path: string) => {
			if (options?.existingPaths?.includes(path)) {
				return Object.assign(new TFile(), { path });
			}
			return null;
		}),
		createFolder: vi.fn(async () => undefined),
		create: vi.fn(async (path: string, content: string) => {
			createdPaths.push(path);
			createdContents.push(content);
			return { path } as TFile;
		}),
	} as unknown as Vault;

	return { vault, createdPaths, createdContents };
}

describe('collectDistinctStarLists', () => {
	it('dedupes star lists by slug across repositories', () => {
		const distinct = collectDistinctStarLists([
			{ starLists: [obsidianList, cliList] },
			{ starLists: [obsidianList] },
			{ starLists: undefined },
		]);

		expect(distinct).toEqual([obsidianList, cliList]);
	});

	it('returns an empty array when no repositories have star lists', () => {
		expect(collectDistinctStarLists([{}, { starLists: [] }])).toEqual([]);
	});
});

describe('writeStarListMocs', () => {
	it('creates a MOC note for each distinct star list', async () => {
		const { vault, createdPaths, createdContents } = createVaultMock();

		const result = await writeStarListMocs(
			vault,
			DEFAULT_SETTINGS,
			[obsidianList, cliList],
		);

		expect(result.created).toBe(2);
		expect(result.skipped).toBe(0);
		expect(createdPaths).toEqual([
			`${DEFAULT_SETTINGS.mocDestinationFolder}/Obsidian.md`,
			`${DEFAULT_SETTINGS.mocDestinationFolder}/CLI Tools.md`,
		]);
		expect(createdContents[0]).toContain('# Obsidian');
		expect(createdContents[0]).toContain(
			'https://github.com/stars/octocat/lists/obsidian',
		);
	});

	it('skips MOC notes that already exist', async () => {
		const existingPath = `${DEFAULT_SETTINGS.mocDestinationFolder}/Obsidian.md`;
		const { vault, createdPaths } = createVaultMock({
			existingPaths: [existingPath],
		});

		const result = await writeStarListMocs(vault, DEFAULT_SETTINGS, [
			obsidianList,
		]);

		expect(result.created).toBe(0);
		expect(result.skipped).toBe(1);
		expect(createdPaths).toHaveLength(0);
	});

	it('does nothing when there are no star lists', async () => {
		const { vault, createdPaths } = createVaultMock();
		const result = await writeStarListMocs(vault, DEFAULT_SETTINGS, []);

		expect(result).toEqual({ created: 0, skipped: 0, errors: [] });
		expect(createdPaths).toHaveLength(0);
	});
});

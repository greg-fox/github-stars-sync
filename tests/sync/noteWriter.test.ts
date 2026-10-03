import { describe, expect, it, vi } from 'vitest';
import { TFile, TFolder } from 'obsidian';
import type { Vault } from 'obsidian';
import { DEFAULT_SETTINGS } from '../../src/settings';
import type { GithubRepository } from '../../src/types';
import { ensureFolderExists, writeRepositoryNotes } from '../../src/sync/noteWriter';

const sampleRepository: GithubRepository = {
	id: 99,
	node_id: 'node',
	name: 'demo',
	full_name: 'owner/demo',
	private: false,
	owner: { login: 'owner' },
	html_url: 'https://github.com/owner/demo',
	description: 'Demo',
	fork: false,
	url: 'https://api.github.com/repos/owner/demo',
	stargazers_count: 1,
	watchers_count: 1,
	language: 'TypeScript',
	forks_count: 0,
	open_issues_count: 0,
	topics: [],
	created_at: '2024-01-01T00:00:00Z',
	updated_at: '2024-01-01T00:00:00Z',
	pushed_at: '2024-01-01T00:00:00Z',
	starred_at: '2024-02-01T00:00:00Z',
};

function createVaultMock(options?: {
	existingFile?: TFile | null;
}) {
	const createdPaths: string[] = [];
	const modified: Array<{ path: string; content: string }> = [];

	const vault = {
		getAbstractFileByPath: vi.fn((path: string) => {
			if (options?.existingFile && options.existingFile.path === path) {
				return options.existingFile;
			}
			return null;
		}),
		getAllLoadedFiles: vi.fn(() => []),
		createFolder: vi.fn(async () => undefined),
		create: vi.fn(async (path: string, content: string) => {
			createdPaths.push(path);
			return { path } as TFile;
		}),
		modify: vi.fn(async (file: TFile, content: string) => {
			modified.push({ path: file.path, content });
		}),
	} as unknown as Vault;

	return { vault, createdPaths, modified };
}

describe('writeRepositoryNotes', () => {
	it('creates notes for new repositories', async () => {
		const { vault, createdPaths } = createVaultMock();
		const { result, repoNotes } = await writeRepositoryNotes(
			vault,
			DEFAULT_SETTINGS,
			[sampleRepository],
			{},
			false,
		);

		expect(result.created).toBe(1);
		expect(createdPaths).toEqual(['GitHub Stars/owner-demo.md']);
		expect(repoNotes['99']).toBe('GitHub Stars/owner-demo.md');
	});

	it('skips existing notes when updates are disabled', async () => {
		const existingFile = Object.assign(new TFile(), {
			path: 'GitHub Stars/owner-demo.md',
		});
		const { vault, modified } = createVaultMock({ existingFile });
		const { result } = await writeRepositoryNotes(
			vault,
			DEFAULT_SETTINGS,
			[sampleRepository],
			{ '99': existingFile.path },
			false,
		);

		expect(result.skipped).toBe(1);
		expect(modified).toHaveLength(0);
	});

	it('updates existing notes when enabled', async () => {
		const existingFile = Object.assign(new TFile(), {
			path: 'GitHub Stars/owner-demo.md',
		});
		const { vault, modified } = createVaultMock({ existingFile });
		const { result } = await writeRepositoryNotes(
			vault,
			DEFAULT_SETTINGS,
			[sampleRepository],
			{ '99': existingFile.path },
			true,
		);

		expect(result.updated).toBe(1);
		expect(modified).toHaveLength(1);
	});
});

describe('ensureFolderExists', () => {
	function folderAt(path: string): TFolder {
		const folder = new TFolder();
		folder.path = path;
		return folder;
	}

	it('returns the existing path without creating when the folder is indexed', async () => {
		const createFolder = vi.fn();
		const vault = {
			getAbstractFileByPath: vi.fn(() => folderAt('GitHub Stars')),
			getAllLoadedFiles: vi.fn(() => []),
			createFolder,
		} as unknown as Vault;

		await expect(ensureFolderExists(vault, 'GitHub Stars')).resolves.toBe(
			'GitHub Stars',
		);
		expect(createFolder).not.toHaveBeenCalled();
	});

	it('reuses an existing folder whose name differs only by case', async () => {
		const createFolder = vi.fn();
		const vault = {
			getAbstractFileByPath: vi.fn(() => null),
			getAllLoadedFiles: vi.fn(() => [folderAt('github stars')]),
			createFolder,
		} as unknown as Vault;

		await expect(ensureFolderExists(vault, 'GitHub Stars')).resolves.toBe(
			'github stars',
		);
		expect(createFolder).not.toHaveBeenCalled();
	});

	it('continues when createFolder reports the folder already exists in the index', async () => {
		let folderNowExists = false;
		const vault = {
			getAbstractFileByPath: vi.fn(() =>
				folderNowExists ? folderAt('GitHub Stars') : null,
			),
			getAllLoadedFiles: vi.fn(() => []),
			createFolder: vi.fn(async () => {
				folderNowExists = true;
				throw new Error('Folder already exists.');
			}),
		} as unknown as Vault;

		await expect(ensureFolderExists(vault, 'GitHub Stars')).resolves.toBe(
			'GitHub Stars',
		);
	});

	it('continues when the folder exists on disk but is not in the vault index', async () => {
		const vault = {
			getAbstractFileByPath: vi.fn(() => null),
			getAllLoadedFiles: vi.fn(() => []),
			createFolder: vi.fn(async () => {
				throw new Error('Folder already exists.');
			}),
			adapter: { exists: vi.fn(async () => true) },
		} as unknown as Vault;

		await expect(ensureFolderExists(vault, 'GitHub Stars')).resolves.toBe(
			'GitHub Stars',
		);
	});

	it('throws when the path is a file', async () => {
		const file = new TFile();
		file.path = 'GitHub Stars';
		const vault = {
			getAbstractFileByPath: vi.fn(() => file),
			getAllLoadedFiles: vi.fn(() => []),
			createFolder: vi.fn(),
		} as unknown as Vault;

		await expect(ensureFolderExists(vault, 'GitHub Stars')).rejects.toThrow(
			'is a file, not a folder',
		);
	});

	it('rethrows when the folder still does not exist after a failed create', async () => {
		const vault = {
			getAbstractFileByPath: vi.fn(() => null),
			getAllLoadedFiles: vi.fn(() => []),
			createFolder: vi.fn(async () => {
				throw new Error('Disk full');
			}),
			adapter: { exists: vi.fn(async () => false) },
		} as unknown as Vault;

		await expect(ensureFolderExists(vault, 'GitHub Stars')).rejects.toThrow(
			'Disk full',
		);
	});
});

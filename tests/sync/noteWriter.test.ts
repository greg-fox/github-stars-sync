import { describe, expect, it, vi } from 'vitest';
import { TFile, TFolder } from 'obsidian';
import type { MetadataCache, Vault } from 'obsidian';
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
		process: vi.fn(async (file: TFile, fn: (data: string) => string) => {
			const content = fn('');
			modified.push({ path: file.path, content });
			return content;
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

function createStatefulVault(files: Record<string, Record<string, unknown> | null>) {
	const byPath = new Map<string, TFile>();
	const frontmatter = new Map<TFile, Record<string, unknown> | null>();
	for (const [path, fm] of Object.entries(files)) {
		const file = Object.assign(new TFile(), { path });
		byPath.set(path, file);
		frontmatter.set(file, fm);
	}

	const created: Array<{ path: string; content: string }> = [];
	const modified: Array<{ path: string; content: string }> = [];

	const vault = {
		getAbstractFileByPath: vi.fn((path: string) => byPath.get(path) ?? null),
		getAllLoadedFiles: vi.fn(() => []),
		getMarkdownFiles: vi.fn(() => [...byPath.values()]),
		createFolder: vi.fn(async () => undefined),
		create: vi.fn(async (path: string, content: string) => {
			if (byPath.has(path)) {
				throw new Error('File already exists.');
			}
			const file = Object.assign(new TFile(), { path });
			byPath.set(path, file);
			created.push({ path, content });
			return file;
		}),
		process: vi.fn(async (file: TFile, fn: (data: string) => string) => {
			const content = fn('');
			modified.push({ path: file.path, content });
			return content;
		}),
	} as unknown as Vault;

	const metadataCache = {
		getFileCache: vi.fn((file: TFile) => {
			const fm = frontmatter.get(file);
			return fm ? { frontmatter: fm } : null;
		}),
	} as unknown as MetadataCache;

	return { vault, metadataCache, created, modified };
}

describe('writeRepositoryNotes ownership', () => {
	const settings = {
		...DEFAULT_SETTINGS,
		noteTemplate: '{{full_name}}',
	};

	it('does not overwrite an unrelated note at the target path', async () => {
		const { vault, metadataCache, created, modified } = createStatefulVault({
			'GitHub Stars/owner-demo.md': { title: 'My own note' },
		});

		const { result, repoNotes } = await writeRepositoryNotes(
			vault,
			settings,
			[sampleRepository],
			{},
			true,
			{ metadataCache },
		);

		expect(modified).toHaveLength(0);
		expect(created).toEqual([
			{ path: 'GitHub Stars/owner-demo-99.md', content: 'owner/demo' },
		]);
		expect(result.created).toBe(1);
		expect(repoNotes['99']).toBe('GitHub Stars/owner-demo-99.md');
	});

	it('does not adopt an unmapped note when no metadata cache is available', async () => {
		const { vault, created, modified } = createStatefulVault({
			'GitHub Stars/owner-demo.md': { github_id: 99 },
		});

		await writeRepositoryNotes(vault, settings, [sampleRepository], {}, true);

		expect(modified).toHaveLength(0);
		expect(created.map((entry) => entry.path)).toEqual([
			'GitHub Stars/owner-demo-99.md',
		]);
	});

	it.each([
		['github_id', { github_id: 99 }],
		['id', { id: '99' }],
		['url', { url: 'https://github.com/owner/demo' }],
	])('adopts an unmapped note whose frontmatter %s matches', async (_label, fm) => {
		const { vault, metadataCache, created, modified } = createStatefulVault({
			'GitHub Stars/owner-demo.md': fm,
		});

		const { result, repoNotes } = await writeRepositoryNotes(
			vault,
			settings,
			[sampleRepository],
			{},
			true,
			{ metadataCache },
		);

		expect(created).toHaveLength(0);
		expect(modified).toEqual([
			{ path: 'GitHub Stars/owner-demo.md', content: 'owner/demo' },
		]);
		expect(result.updated).toBe(1);
		expect(repoNotes['99']).toBe('GitHub Stars/owner-demo.md');
	});

	it('gives repositories whose filenames collide separate notes', async () => {
		const first: GithubRepository = {
			...sampleRepository,
			id: 1,
			name: 'c',
			full_name: 'a-b/c',
			owner: { login: 'a-b' },
			html_url: 'https://github.com/a-b/c',
		};
		const second: GithubRepository = {
			...sampleRepository,
			id: 2,
			name: 'b-c',
			full_name: 'a/b-c',
			owner: { login: 'a' },
			html_url: 'https://github.com/a/b-c',
		};
		const { vault, metadataCache, created, modified } = createStatefulVault({});

		const { repoNotes } = await writeRepositoryNotes(
			vault,
			settings,
			[first, second],
			{},
			true,
			{ metadataCache },
		);

		expect(modified).toHaveLength(0);
		expect(created).toEqual([
			{ path: 'GitHub Stars/a-b-c.md', content: 'a-b/c' },
			{ path: 'GitHub Stars/a-b-c-2.md', content: 'a/b-c' },
		]);
		expect(repoNotes).toEqual({
			'1': 'GitHub Stars/a-b-c.md',
			'2': 'GitHub Stars/a-b-c-2.md',
		});
	});

	it('keeps colliding repositories separate on later syncs', async () => {
		const first: GithubRepository = {
			...sampleRepository,
			id: 1,
			name: 'c',
			full_name: 'a-b/c',
			owner: { login: 'a-b' },
		};
		const second: GithubRepository = {
			...sampleRepository,
			id: 2,
			name: 'b-c',
			full_name: 'a/b-c',
			owner: { login: 'a' },
		};
		const { vault, metadataCache, created, modified } = createStatefulVault({
			'GitHub Stars/a-b-c.md': null,
			'GitHub Stars/a-b-c-2.md': null,
		});

		await writeRepositoryNotes(
			vault,
			settings,
			[second, first],
			{ '1': 'GitHub Stars/a-b-c.md', '2': 'GitHub Stars/a-b-c-2.md' },
			true,
			{ metadataCache },
		);

		expect(created).toHaveLength(0);
		expect(modified).toEqual([
			{ path: 'GitHub Stars/a-b-c-2.md', content: 'a/b-c' },
			{ path: 'GitHub Stars/a-b-c.md', content: 'a-b/c' },
		]);
	});

	it('splits two repositories previously mapped to the same note', async () => {
		const other: GithubRepository = {
			...sampleRepository,
			id: 100,
			full_name: 'owner/demo-other',
		};
		const { vault, metadataCache, created, modified } = createStatefulVault({
			'GitHub Stars/owner-demo.md': null,
		});

		const { repoNotes } = await writeRepositoryNotes(
			vault,
			settings,
			[sampleRepository, other],
			{
				'99': 'GitHub Stars/owner-demo.md',
				'100': 'GitHub Stars/owner-demo.md',
			},
			true,
			{ metadataCache },
		);

		expect(modified).toEqual([
			{ path: 'GitHub Stars/owner-demo.md', content: 'owner/demo' },
		]);
		expect(created).toEqual([
			{ path: 'GitHub Stars/owner-demo-100.md', content: 'owner/demo-other' },
		]);
		expect(repoNotes['100']).toBe('GitHub Stars/owner-demo-100.md');
	});

	it('reports an error when every candidate path belongs to other notes', async () => {
		const { vault, metadataCache, created, modified } = createStatefulVault({
			'GitHub Stars/owner-demo.md': null,
			'GitHub Stars/owner-demo-99.md': null,
		});

		const { result } = await writeRepositoryNotes(
			vault,
			settings,
			[sampleRepository],
			{},
			true,
			{ metadataCache },
		);

		expect(created).toHaveLength(0);
		expect(modified).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('owner/demo');
	});
});

describe('writeRepositoryNotes rendering options', () => {
	it('links star names to MOC notes in the configured MOC folder', async () => {
		const { vault, created } = createStatefulVault({});

		await writeRepositoryNotes(
			vault,
			{
				...DEFAULT_SETTINGS,
				noteTemplate: '{{star_names_inline}}',
				mocEnabled: true,
				mocLinkStarNames: true,
				mocDestinationFolder: 'Lists/MOCs',
			},
			[
				{
					...sampleRepository,
					starLists: [
						{ name: 'AI/ML', slug: 'ai-ml', url: 'https://example.com/ai-ml' },
					],
				},
			],
			{},
			false,
		);

		expect(created[0]?.content).toBe('[[Lists/MOCs/AI-ML|AI/ML]]');
	});

	it('treats paths that differ only by case as the same note', async () => {
		const other: GithubRepository = {
			...sampleRepository,
			id: 100,
			full_name: 'Owner/Demo',
			owner: { login: 'Owner' },
			name: 'Demo',
		};
		const { vault, created } = createStatefulVault({
			'GitHub Stars/owner-demo.md': null,
		});

		await writeRepositoryNotes(
			vault,
			{ ...DEFAULT_SETTINGS, noteTemplate: '{{full_name}}' },
			[other],
			{ '99': 'GitHub Stars/owner-demo.md' },
			true,
		);

		expect(created.map((entry) => entry.path)).toEqual([
			'GitHub Stars/Owner-Demo-100.md',
		]);
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
		} as unknown as Vault;

		await expect(ensureFolderExists(vault, 'GitHub Stars')).rejects.toThrow(
			'Disk full',
		);
	});
});

describe('writeRepositoryNotes relocated notes', () => {
	const settings = { ...DEFAULT_SETTINGS, noteTemplate: '{{full_name}}' };

	it('updates a tracked note that was moved instead of creating a duplicate', async () => {
		const { vault, metadataCache, created, modified } = createStatefulVault({
			'Projects/demo renamed.md': { github_id: 99 },
		});

		const { result, repoNotes } = await writeRepositoryNotes(
			vault,
			settings,
			[sampleRepository],
			{ '99': 'GitHub Stars/owner-demo.md' },
			true,
			{ metadataCache },
		);

		expect(created).toHaveLength(0);
		expect(modified).toEqual([
			{ path: 'Projects/demo renamed.md', content: 'owner/demo' },
		]);
		expect(result.updated).toBe(1);
		expect(repoNotes['99']).toBe('Projects/demo renamed.md');
	});

	it('re-tracks a moved note without modifying it when updates are disabled', async () => {
		const { vault, metadataCache, created, modified } = createStatefulVault({
			'Projects/demo renamed.md': { github_id: 99 },
		});

		const { result, repoNotes } = await writeRepositoryNotes(
			vault,
			settings,
			[sampleRepository],
			{ '99': 'GitHub Stars/owner-demo.md' },
			false,
			{ metadataCache },
		);

		expect(created).toHaveLength(0);
		expect(modified).toHaveLength(0);
		expect(result.skipped).toBe(1);
		expect(repoNotes['99']).toBe('Projects/demo renamed.md');
	});

	it('does not adopt a note outside the notes folder that only matches by url', async () => {
		const { vault, metadataCache, created, modified } = createStatefulVault({
			'Journal/reading.md': { url: 'https://github.com/owner/demo' },
		});

		await writeRepositoryNotes(
			vault,
			settings,
			[sampleRepository],
			{ '99': 'GitHub Stars/owner-demo.md' },
			true,
			{ metadataCache },
		);

		expect(modified).toHaveLength(0);
		expect(created.map((entry) => entry.path)).toEqual([
			'GitHub Stars/owner-demo.md',
		]);
	});

	it('does not adopt a matching note that another repository owns', async () => {
		const { vault, metadataCache, created, modified } = createStatefulVault({
			'GitHub Stars/other.md': { github_id: 99 },
		});

		await writeRepositoryNotes(
			vault,
			settings,
			[sampleRepository],
			{ '99': 'GitHub Stars/missing.md', '5': 'GitHub Stars/other.md' },
			true,
			{ metadataCache },
		);

		expect(modified).toHaveLength(0);
		expect(created.map((entry) => entry.path)).toEqual([
			'GitHub Stars/owner-demo.md',
		]);
	});

	it('still recreates a deleted note when no relocated copy exists', async () => {
		const { vault, metadataCache, created } = createStatefulVault({});

		await writeRepositoryNotes(
			vault,
			settings,
			[sampleRepository],
			{ '99': 'GitHub Stars/owner-demo.md' },
			true,
			{ metadataCache },
		);

		expect(created.map((entry) => entry.path)).toEqual([
			'GitHub Stars/owner-demo.md',
		]);
	});
});

describe('writeRepositoryNotes MOC links', () => {
	it('links to the MOC folder using its real casing', async () => {
		const mocFolderNode = Object.assign(new TFolder(), {
			path: 'Clippings/github-stars-mocs',
		});
		const { vault, created } = createStatefulVault({});
		vi.mocked(vault.getAllLoadedFiles).mockReturnValue([mocFolderNode]);

		await writeRepositoryNotes(
			vault,
			{
				...DEFAULT_SETTINGS,
				noteTemplate: '{{star_mocs_markdown}}',
				mocEnabled: true,
				mocDestinationFolder: 'clippings/github-stars-mocs',
			},
			[
				{
					...sampleRepository,
					starLists: [
						{ name: 'Software', slug: 'software', url: 'https://example.com/s' },
					],
				},
			],
			{},
			false,
		);

		expect(created[0]?.content).toBe(
			'- [[Clippings/github-stars-mocs/Software|Software]]',
		);
	});
});


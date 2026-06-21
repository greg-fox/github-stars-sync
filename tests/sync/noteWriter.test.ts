import { describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import type { Vault } from 'obsidian';
import { DEFAULT_SETTINGS } from '../../src/settings';
import type { GithubRepository } from '../../src/types';
import { writeRepositoryNotes } from '../../src/sync/noteWriter';

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

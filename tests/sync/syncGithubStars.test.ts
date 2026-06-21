import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { syncGithubStars } from '../../src/sync/syncService';

vi.mock('../../src/github/client', () => ({
	fetchStarredRepositories: vi.fn(async () => [
		{
			id: 7,
			node_id: 'node',
			name: 'repo',
			full_name: 'me/repo',
			private: false,
			owner: { login: 'me' },
			html_url: 'https://github.com/me/repo',
			description: null,
			fork: false,
			url: 'https://api.github.com/repos/me/repo',
			stargazers_count: 0,
			watchers_count: 0,
			language: null,
			forks_count: 0,
			open_issues_count: 0,
			topics: [],
			created_at: '',
			updated_at: '',
			pushed_at: '',
			starred_at: '2024-01-01T00:00:00Z',
		},
	]),
	classifyGithubError: vi.fn((error: unknown) =>
		error instanceof Error ? error.message : 'Unknown error',
	),
}));

describe('syncGithubStars', () => {
	it('throws when no token is configured', async () => {
		const app = {
			secretStorage: {
				getSecret: vi.fn().mockReturnValue(null),
			},
			vault: {
				getAbstractFileByPath: vi.fn().mockReturnValue(null),
				createFolder: vi.fn(),
				create: vi.fn(),
				modify: vi.fn(),
			},
		} as unknown as App;

		await expect(
			syncGithubStars(app, {
				settings: DEFAULT_SETTINGS,
				syncState: {
					lastSyncTime: null,
					lastSyncError: null,
					repoNotes: {},
				},
			}),
		).rejects.toThrow('No GitHub personal access token found');
	});

	it('creates notes when sync succeeds', async () => {
		const create = vi.fn(async (path: string) => ({ path }));
		const app = {
			secretStorage: {
				getSecret: vi.fn().mockReturnValue('ghp_test'),
			},
			vault: {
				getAbstractFileByPath: vi.fn().mockReturnValue(null),
				createFolder: vi.fn(async () => undefined),
				create,
				modify: vi.fn(),
			},
		} as unknown as App;

		const outcome = await syncGithubStars(app, {
			settings: DEFAULT_SETTINGS,
			syncState: {
				lastSyncTime: null,
				lastSyncError: null,
				repoNotes: {},
			},
		});

		expect(outcome.result.created).toBe(1);
		expect(outcome.syncState.lastSyncTime).not.toBeNull();
		expect(create).toHaveBeenCalledOnce();
	});
});

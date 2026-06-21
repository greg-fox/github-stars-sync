import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import {
	fetchAuthenticatedUser,
	fetchStarredRepositories,
} from '../../src/github/client';

describe('fetchStarredRepositories', () => {
	beforeEach(() => {
		vi.mocked(requestUrl).mockReset();
	});

	it('paginates through starred repositories', async () => {
		vi.mocked(requestUrl)
			.mockResolvedValueOnce({
				status: 200,
				json: [
					{
						starred_at: '2024-01-01T00:00:00Z',
						repo: {
							id: 1,
							name: 'one',
							full_name: 'owner/one',
							owner: { login: 'owner' },
						},
					},
				],
				headers: {
					link: '<https://api.github.com/user/starred?page=2>; rel="next"',
				},
			} as never)
			.mockResolvedValueOnce({
				status: 200,
				json: [
					{
						starred_at: '2024-02-01T00:00:00Z',
						repo: {
							id: 2,
							name: 'two',
							full_name: 'owner/two',
							owner: { login: 'owner' },
						},
					},
				],
				headers: {},
			} as never);

		const repositories = await fetchStarredRepositories({
			token: 'ghp_test',
		});

		expect(repositories).toHaveLength(2);
		expect(repositories[0]?.starred_at).toBe('2024-01-01T00:00:00Z');
		expect(requestUrl).toHaveBeenCalledTimes(2);
	});

	it('returns the authenticated GitHub login', async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 200,
			json: { login: 'octocat' },
			headers: {},
		} as never);

		await expect(fetchAuthenticatedUser('ghp_test')).resolves.toEqual({
			login: 'octocat',
		});
	});
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import {
	classifyGithubError,
	fetchAuthenticatedUser,
	fetchStarredRepositories,
	GithubApiError,
} from '../../src/github/client';
import { graphqlRequest } from '../../src/github/graphql';

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

describe('GitHub error handling', () => {
	beforeEach(() => {
		vi.mocked(requestUrl).mockReset();
	});

	it('requests with throw disabled so status codes can be inspected', async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 200,
			json: { login: 'octocat' },
			headers: {},
		} as never);

		await fetchAuthenticatedUser('ghp_test');

		expect(vi.mocked(requestUrl).mock.calls[0]?.[0]).toMatchObject({
			throw: false,
		});
	});

	it('maps 401 responses to an authentication message', async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 401,
			json: { message: 'Bad credentials' },
			headers: {},
		} as never);

		const error = await fetchAuthenticatedUser('ghp_bad').catch(
			(caught: unknown) => caught,
		);

		expect(error).toBeInstanceOf(GithubApiError);
		expect(classifyGithubError(error)).toBe(
			'Authentication failed. Check your personal access token.',
		);
	});

	it('maps 403 without rate limit headers to an authentication message', async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 403,
			json: {},
			headers: { 'x-ratelimit-remaining': '4999' },
		} as never);

		const error = await fetchStarredRepositories({ token: 'ghp_test' }).catch(
			(caught: unknown) => caught,
		);

		expect(classifyGithubError(error)).toBe(
			'Authentication failed. Check your personal access token.',
		);
	});

	it('treats 403 with exhausted primary rate limit as rate limiting', async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 403,
			json: {},
			headers: {
				'X-RateLimit-Remaining': '0',
				'X-RateLimit-Reset': '1700000000',
			},
		} as never);

		const error = await fetchStarredRepositories({ token: 'ghp_test' }).catch(
			(caught: unknown) => caught,
		);

		expect(error).toBeInstanceOf(GithubApiError);
		expect((error as GithubApiError).rateLimited).toBe(true);
		expect((error as GithubApiError).rateLimitReset?.getTime()).toBe(
			1700000000 * 1000,
		);
		expect(classifyGithubError(error)).toMatch(/^GitHub rate limit exceeded/);
	});

	it('treats 403 with retry-after as a secondary rate limit', async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 403,
			json: {},
			headers: { 'retry-after': '60' },
		} as never);

		const error = await fetchStarredRepositories({ token: 'ghp_test' }).catch(
			(caught: unknown) => caught,
		);

		expect(classifyGithubError(error)).toBe(
			'GitHub rate limit exceeded. Try again later.',
		);
	});

	it('treats 429 as rate limiting', async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 429,
			json: {},
			headers: {},
		} as never);

		const error = await fetchStarredRepositories({ token: 'ghp_test' }).catch(
			(caught: unknown) => caught,
		);

		expect(classifyGithubError(error)).toBe(
			'GitHub rate limit exceeded. Try again later.',
		);
	});

	it('raises GithubApiError for failed GraphQL requests', async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 401,
			json: {},
			headers: {},
		} as never);

		const error = await graphqlRequest('ghp_bad', 'query { viewer { login } }').catch(
			(caught: unknown) => caught,
		);

		expect(vi.mocked(requestUrl).mock.calls[0]?.[0]).toMatchObject({
			throw: false,
		});
		expect(error).toBeInstanceOf(GithubApiError);
		expect((error as GithubApiError).status).toBe(401);
	});
});

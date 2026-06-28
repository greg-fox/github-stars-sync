import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { fetchStarListMembership } from '../../src/github/starLists';

describe('fetchStarListMembership', () => {
	beforeEach(() => {
		vi.mocked(requestUrl).mockReset();
	});

	it('builds a repo id to star list membership map', async () => {
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 200,
			json: {
				data: {
					viewer: {
						login: 'octocat',
						lists: {
							pageInfo: {
								hasNextPage: false,
								endCursor: null,
							},
							nodes: [
								{
									id: 'list-1',
									name: 'Obsidian',
									slug: 'obsidian',
									items: {
										pageInfo: {
											hasNextPage: false,
											endCursor: null,
										},
										nodes: [{ databaseId: 42 }],
									},
								},
							],
						},
					},
				},
			},
		} as never);

		const membership = await fetchStarListMembership('ghp_test');

		expect(membership.get(42)).toEqual([
			{
				name: 'Obsidian',
				slug: 'obsidian',
				url: 'https://github.com/stars/octocat/lists/obsidian',
			},
		]);
	});
});

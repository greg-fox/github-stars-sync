import { describe, expect, it } from 'vitest';
import { enrichRepositoriesWithStarLists } from '../../src/github/enrichRepositories';
import { buildStarListUrl } from '../../src/github/starLists';
import type { GithubRepository } from '../../src/types';

const sampleRepository: GithubRepository = {
	id: 42,
	node_id: 'node',
	name: 'demo',
	full_name: 'owner/demo',
	private: false,
	owner: { login: 'owner' },
	html_url: 'https://github.com/octocat/demo',
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
};

describe('buildStarListUrl', () => {
	it('builds the public GitHub stars list URL', () => {
		expect(buildStarListUrl('octocat', 'obsidian-plugins')).toBe(
			'https://github.com/stars/octocat/lists/obsidian-plugins',
		);
	});
});

describe('enrichRepositoriesWithStarLists', () => {
	it('attaches list metadata to repositories by database id', () => {
		const membership = new Map([
			[
				42,
				[
					{
						name: 'Obsidian',
						slug: 'obsidian',
						url: 'https://github.com/stars/octocat/lists/obsidian',
					},
				],
			],
		]);

		const [repository] = enrichRepositoriesWithStarLists(
			[sampleRepository],
			membership,
		);

		expect(repository?.starLists).toEqual([
			{
				name: 'Obsidian',
				slug: 'obsidian',
				url: 'https://github.com/stars/octocat/lists/obsidian',
			},
		]);
	});
});

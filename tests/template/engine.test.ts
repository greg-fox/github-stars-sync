import { describe, expect, it } from 'vitest';
import { renderFilename, renderTemplate } from '../../src/template/engine';
import type { GithubRepository } from '../../src/types';

const sampleRepository: GithubRepository = {
	id: 42,
	node_id: 'node',
	name: 'demo',
	full_name: 'owner/demo',
	private: false,
	owner: { login: 'owner' },
	html_url: 'https://github.com/owner/demo',
	description: 'A demo repo',
	fork: true,
	url: 'https://api.github.com/repos/owner/demo',
	stargazers_count: 100,
	watchers_count: 50,
	language: 'TypeScript',
	forks_count: 12,
	open_issues_count: 3,
	topics: ['obsidian', 'plugin'],
	created_at: '2020-01-01T00:00:00Z',
	updated_at: '2024-01-01T00:00:00Z',
	pushed_at: '2024-06-01T00:00:00Z',
	starred_at: '2024-06-02T00:00:00Z',
};

describe('renderTemplate', () => {
	it('replaces repository placeholders', () => {
		const rendered = renderTemplate(
			'# {{full_name}} ({{stars}} stars)\n{{topics_inline}}',
			sampleRepository,
		);

		expect(rendered).toContain('# owner/demo (100 stars)');
		expect(rendered).toContain('obsidian, plugin');
	});

	it('formats star list metadata for templates', () => {
		const rendered = renderTemplate(
			'names: {{star_names}}\nlinks: {{star_links}}\n{{star_lists_markdown}}',
			{
				...sampleRepository,
				starLists: [
					{
						name: 'Obsidian',
						slug: 'obsidian',
						url: 'https://github.com/stars/octocat/lists/obsidian',
					},
				],
			},
		);

		expect(rendered).toContain('- Obsidian');
		expect(rendered).toContain(
			'https://github.com/stars/octocat/lists/obsidian',
		);
		expect(rendered).toContain('[Obsidian](https://github.com/stars/octocat/lists/obsidian)');
	});

	it('formats topics as YAML', () => {
		const rendered = renderTemplate('topics: {{topics}}', sampleRepository);
		expect(rendered).toContain('- obsidian');
		expect(rendered).toContain('- plugin');
	});
});

describe('renderFilename', () => {
	it('sanitizes invalid filename characters', () => {
		const repository: GithubRepository = {
			...sampleRepository,
			name: 'bad/name',
			full_name: 'owner/bad/name',
		};

		expect(renderFilename('{{owner}}-{{name}}', repository)).toBe(
			'owner-bad-name',
		);
	});
});

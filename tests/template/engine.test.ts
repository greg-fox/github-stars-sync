import { describe, expect, it } from 'vitest';
import {
	renderFilename,
	renderMocFilename,
	renderMocTemplate,
	renderTemplate,
} from '../../src/template/engine';
import type { GithubRepository, StarListEntry } from '../../src/types';

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

const starListEntry: StarListEntry = {
	name: 'Obsidian',
	slug: 'obsidian',
	url: 'https://github.com/stars/octocat/lists/obsidian',
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

	it('wraps star names in wikilinks when MOC linking is enabled', () => {
		const repository: GithubRepository = {
			...sampleRepository,
			starLists: [
				{
					name: 'Obsidian',
					slug: 'obsidian',
					url: 'https://github.com/stars/octocat/lists/obsidian',
				},
			],
		};

		const rendered = renderTemplate(
			'names: {{star_names}}\ninline: {{star_names_inline}}',
			repository,
			{ linkStarNamesToMoc: true },
		);

		expect(rendered).toContain('[[Obsidian]]');
	});

	it('leaves star names as plain text when MOC linking is disabled', () => {
		const repository: GithubRepository = {
			...sampleRepository,
			starLists: [
				{
					name: 'Obsidian',
					slug: 'obsidian',
					url: 'https://github.com/stars/octocat/lists/obsidian',
				},
			],
		};

		const rendered = renderTemplate(
			'inline: {{star_names_inline}}',
			repository,
		);

		expect(rendered).toBe('inline: Obsidian');
	});
});

describe('renderMocTemplate', () => {
	it('replaces star_name and star_link placeholders', () => {
		const rendered = renderMocTemplate(
			'# {{star_name}}\n[Open]({{star_link}})',
			starListEntry,
		);

		expect(rendered).toBe(
			'# Obsidian\n[Open](https://github.com/stars/octocat/lists/obsidian)',
		);
	});
});

describe('renderMocFilename', () => {
	it('sanitizes invalid filename characters from the star list name', () => {
		expect(
			renderMocFilename({ ...starListEntry, name: 'Dev/Ops Tools' }),
		).toBe('Dev-Ops Tools');
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

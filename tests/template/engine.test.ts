import { describe, expect, it } from 'vitest';
import {
	mocWikilink,
	renderFilename,
	renderMocFilename,
	renderMocTemplate,
	renderTemplate,
	sanitizeFilename,
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

describe('renderTemplate placeholder safety', () => {
	it('does not expand placeholders that appear inside substituted values', () => {
		const rendered = renderTemplate('{{description}} | {{url}}', {
			...sampleRepository,
			description: 'Use {{url}} and {{star_lists_markdown}} here',
		});

		expect(rendered).toBe(
			'Use {{url}} and {{star_lists_markdown}} here | https://github.com/owner/demo',
		);
	});

	it('leaves unknown placeholders untouched', () => {
		expect(renderTemplate('{{nope}} {{name}}', sampleRepository)).toBe(
			'{{nope}} demo',
		);
	});

	it('does not resolve inherited object properties as placeholders', () => {
		expect(renderTemplate('{{constructor}} {{toString}}', sampleRepository)).toBe(
			'{{constructor}} {{toString}}',
		);
	});

	it('does not interpret replacement patterns in values', () => {
		expect(
			renderTemplate('{{description}}', {
				...sampleRepository,
				description: "costs $& and $' and $1",
			}),
		).toBe("costs $& and $' and $1");
	});
});

describe('renderMocTemplate', () => {
	it('does not expand placeholders inside a star list name', () => {
		expect(
			renderMocTemplate('{{star_name}} {{star_link}}', {
				...starListEntry,
				name: '{{star_link}}',
			}),
		).toBe('{{star_link}} https://github.com/stars/octocat/lists/obsidian');
	});

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

describe('MOC wikilinks', () => {
	it('links to the MOC note by full path with the list name as alias', () => {
		expect(mocWikilink('GitHub Stars/MOCs', starListEntry)).toBe(
			'[[GitHub Stars/MOCs/Obsidian|Obsidian]]',
		);
	});

	it('links to the sanitized MOC filename when the list name has special characters', () => {
		expect(
			mocWikilink('GitHub Stars/MOCs', { ...starListEntry, name: 'AI/ML' }),
		).toBe('[[GitHub Stars/MOCs/AI-ML|AI/ML]]');
		expect(
			mocWikilink('MOCs', { ...starListEntry, name: 'Tools: CLI #1' }),
		).toBe('[[MOCs/Tools- CLI -1|Tools: CLI #1]]');
	});

	it('strips characters from the alias that would break the link', () => {
		expect(
			mocWikilink('MOCs', { ...starListEntry, name: 'a|b [c]' }),
		).toBe('[[MOCs/a-b -c-|ab c]]');
	});

	it('omits the folder when the MOC folder is the vault root', () => {
		expect(mocWikilink('', starListEntry)).toBe('[[Obsidian]]');
		expect(mocWikilink('/', starListEntry)).toBe('[[Obsidian]]');
	});

	it('uses MOC wikilinks in rendered star names', () => {
		const rendered = renderTemplate(
			'{{star_names_inline}}\n{{star_names}}',
			{
				...sampleRepository,
				starLists: [{ ...starListEntry, name: 'AI/ML' }],
			},
			{ linkStarNamesToMoc: true, mocFolder: 'GitHub Stars/MOCs' },
		);

		expect(rendered).toContain('[[GitHub Stars/MOCs/AI-ML|AI/ML]]');
		expect(rendered).toContain('- "[[GitHub Stars/MOCs/AI-ML|AI/ML]]"');
	});
});

describe('sanitizeFilename', () => {
	it('replaces characters that break Obsidian links', () => {
		expect(sanitizeFilename('a#b^c[d]e|f')).toBe('a-b-c-d-e-f');
	});

	it('removes leading dots and trailing dots or spaces', () => {
		expect(sanitizeFilename('.github')).toBe('github');
		expect(sanitizeFilename('name. . ')).toBe('name');
	});

	it('falls back when nothing usable remains', () => {
		expect(sanitizeFilename('')).toBe('Untitled');
		expect(sanitizeFilename('...', 'fallback')).toBe('fallback');
	});
});

describe('renderMocFilename', () => {
	it('falls back to the slug when the list name is empty', () => {
		expect(renderMocFilename({ ...starListEntry, name: '' })).toBe('obsidian');
	});

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

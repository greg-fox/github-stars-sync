import { describe, expect, it } from 'vitest';
import { renderTemplate, toYamlString } from '../../src/template/engine';
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
	fork: false,
	url: 'https://api.github.com/repos/owner/demo',
	stargazers_count: 0,
	watchers_count: 0,
	language: 'TypeScript',
	forks_count: 0,
	open_issues_count: 0,
	topics: [],
	created_at: '2020-01-01T00:00:00Z',
	updated_at: '2024-01-01T00:00:00Z',
	pushed_at: '2024-06-01T00:00:00Z',
	starred_at: '2024-06-02T00:00:00Z',
};

describe('YAML formatting', () => {
	it('quotes list items that YAML would otherwise parse as non-strings', () => {
		const rendered = renderTemplate('names: {{star_names}}', {
			...sampleRepository,
			starLists: ['2024', 'true', 'null', 'yes', '- dash', '~'].map(
				(name) => ({ name, slug: name, url: `https://example.com/${name}` }),
			),
		});

		expect(rendered).toBe(
			[
				'names: ',
				'  - "2024"',
				'  - "true"',
				'  - "null"',
				'  - "yes"',
				'  - "- dash"',
				'  - "~"',
			].join('\n'),
		);
	});

	it('escapes backslashes, quotes, and control characters', () => {
		const value = 'C:\\path "quoted"\nnext\tend';
		const quoted = toYamlString(value);

		expect(quoted).toBe('"C:\\\\path \\"quoted\\"\\nnext\\tend"');
		expect(JSON.parse(quoted)).toBe(value);
	});

	it('provides a YAML-safe description variable', () => {
		const rendered = renderTemplate('description: {{description_yaml}}', {
			...sampleRepository,
			description: 'Fast: "tiny" \\ # parser',
		});

		expect(rendered).toBe('description: "Fast: \\"tiny\\" \\\\ # parser"');
	});

	it('renders an empty YAML string for a missing description', () => {
		expect(
			renderTemplate('description: {{description_yaml}}', {
				...sampleRepository,
				description: null,
			}),
		).toBe('description: ""');
	});
});

import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../../src/template/engine';
import type { GithubRepository } from '../../src/types';

const repository: GithubRepository = {
	id: 42,
	node_id: 'node',
	name: 'demo',
	full_name: 'owner/demo',
	private: false,
	owner: { login: 'owner' },
	html_url: 'https://github.com/owner/demo',
	description: null,
	fork: false,
	url: 'https://api.github.com/repos/owner/demo',
	stargazers_count: 0,
	watchers_count: 0,
	language: null,
	forks_count: 0,
	open_issues_count: 0,
	topics: [],
	archived: true,
	homepage: ' https://demo.dev ',
	license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
	default_branch: 'main',
	created_at: '',
	updated_at: '',
	pushed_at: '',
};

const template =
	'{{archived}}|{{homepage}}|{{license}}|{{default_branch}}|{{synced_at}}';

describe('repository metadata variables', () => {
	it('renders archived, homepage, license, default branch, and sync time', () => {
		expect(
			renderTemplate(template, repository, {
				syncedAt: '2026-11-05T12:00:00.000Z',
			}),
		).toBe('true|https://demo.dev|MIT|main|2026-11-05T12:00:00.000Z');
	});

	it('falls back to the license name when there is no SPDX identifier', () => {
		expect(
			renderTemplate('{{license}}', {
				...repository,
				license: { key: 'other', name: 'Other', spdx_id: 'NOASSERTION' },
			}),
		).toBe('Other');
	});

	it('renders empty or false values when metadata is missing', () => {
		expect(
			renderTemplate(template, {
				...repository,
				archived: undefined,
				homepage: null,
				license: null,
				default_branch: undefined,
			}),
		).toBe('false||||');
	});
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_MOC_TEMPLATE } from '../../src/constants';
import { renderMocTemplate, renderTemplate } from '../../src/template/engine';
import type { GithubRepository, StarListEntry } from '../../src/types';

const ai: StarListEntry = {
	name: 'AI/ML',
	slug: 'ai-ml',
	url: 'https://github.com/stars/octocat/lists/ai-ml',
};
const software: StarListEntry = {
	name: 'Software',
	slug: 'software',
	url: 'https://github.com/stars/octocat/lists/software',
};

const repository = {
	id: 1,
	name: 'demo',
	full_name: 'owner/demo',
	owner: { login: 'owner' },
	html_url: 'https://github.com/owner/demo',
	topics: [],
	starLists: [ai, software],
} as unknown as GithubRepository;

describe('star_mocs variables', () => {
	const options = { mocEnabled: true, mocFolder: 'Clippings/github-stars-mocs' };

	it('renders markdown bullet links to each MOC note', () => {
		expect(renderTemplate('{{star_mocs_markdown}}', repository, options)).toBe(
			[
				'- [[Clippings/github-stars-mocs/AI-ML|AI/ML]]',
				'- [[Clippings/github-stars-mocs/Software|Software]]',
			].join('\n'),
		);
	});

	it('renders a quoted YAML list of MOC links for frontmatter', () => {
		expect(renderTemplate('mocs: {{star_mocs}}', repository, options)).toBe(
			[
				'mocs: ',
				'  - "[[Clippings/github-stars-mocs/AI-ML|AI/ML]]"',
				'  - "[[Clippings/github-stars-mocs/Software|Software]]"',
			].join('\n'),
		);
	});

	it('links regardless of the "Link star names" toggle', () => {
		expect(
			renderTemplate('{{star_names_inline}}|{{star_mocs_markdown}}', repository, {
				...options,
				linkStarNamesToMoc: false,
			}),
		).toBe(
			'AI/ML, Software|- [[Clippings/github-stars-mocs/AI-ML|AI/ML]]\n- [[Clippings/github-stars-mocs/Software|Software]]',
		);
	});

	it('renders empty when maps of content are disabled', () => {
		expect(
			renderTemplate('[{{star_mocs_markdown}}] {{star_mocs}}', repository, {
				mocFolder: 'Clippings/github-stars-mocs',
			}),
		).toBe('[] []');
	});
});

describe('MOC template', () => {
	it('exposes the notes folder', () => {
		expect(
			renderMocTemplate('{{notes_folder}}', software, {
				notesFolder: 'Clippings/github-stars',
			}),
		).toBe('Clippings/github-stars');
	});

	it('renders the default template with a base filtered to linking notes', () => {
		const rendered = renderMocTemplate(DEFAULT_MOC_TEMPLATE, software, {
			notesFolder: 'Clippings/github-stars',
		});

		expect(rendered).toContain('# Software');
		expect(rendered).toContain('```base\n');
		expect(rendered).toContain('- file.inFolder("Clippings/github-stars")');
		expect(rendered).toContain('- file.hasLink(this.file)');
		expect(rendered).not.toContain('{{');
	});
});

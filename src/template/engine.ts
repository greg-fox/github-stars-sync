import type { GithubRepository, StarListEntry } from '../types';

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;

export function sanitizeFilename(name: string): string {
	return name.replace(INVALID_FILENAME_CHARS, '-').trim();
}

export interface RenderTemplateOptions {
	linkStarNamesToMoc?: boolean;
}

export function renderTemplate(
	template: string,
	repository: GithubRepository,
	options: RenderTemplateOptions = {},
): string {
	const linkStarNamesToMoc = options.linkStarNamesToMoc ?? false;
	const starNames = (repository.starLists ?? []).map((list) =>
		linkStarNamesToMoc ? `[[${list.name}]]` : list.name,
	);

	const replacements: Record<string, string> = {
		name: repository.name ?? '',
		full_name: repository.full_name ?? '',
		owner: repository.owner?.login ?? '',
		description: repository.description ?? '',
		language: repository.language ?? '',
		url: repository.html_url ?? '',
		id: String(repository.id ?? ''),
		stars: String(repository.stargazers_count ?? 0),
		forks: String(repository.forks_count ?? 0),
		watchers: String(repository.watchers_count ?? 0),
		issues: String(repository.open_issues_count ?? 0),
		created_at: repository.created_at ?? '',
		updated_at: repository.updated_at ?? '',
		pushed_at: repository.pushed_at ?? '',
		starred_at: repository.starred_at ?? '',
		is_private: repository.private ? 'true' : 'false',
		is_fork: repository.fork ? 'true' : 'false',
		topics: formatTopicsYaml(repository.topics ?? []),
		topics_inline: (repository.topics ?? []).join(', '),
		star_names: formatYamlStringList(starNames),
		star_links: formatYamlStringList(
			(repository.starLists ?? []).map((list) => list.url),
		),
		star_names_inline: formatInlineList(starNames),
		star_links_inline: formatInlineList(
			(repository.starLists ?? []).map((list) => list.url),
		),
		star_lists_markdown: formatStarListsMarkdown(repository.starLists ?? []),
	};

	return applyReplacements(template, replacements);
}

export function renderFilename(
	template: string,
	repository: GithubRepository,
): string {
	const rendered = renderTemplate(template, repository);
	return sanitizeFilename(rendered);
}

export function renderMocTemplate(
	template: string,
	starList: StarListEntry,
): string {
	const replacements: Record<string, string> = {
		star_name: starList.name ?? '',
		star_link: starList.url ?? '',
	};

	return applyReplacements(template, replacements);
}

export function renderMocFilename(starList: StarListEntry): string {
	return sanitizeFilename(starList.name ?? '');
}

function formatTopicsYaml(topics: string[]): string {
	return formatYamlStringList(topics);
}

function formatYamlStringList(values: string[]): string {
	if (values.length === 0) {
		return '[]';
	}

	return `\n${values.map((value) => `  - ${escapeYamlString(value)}`).join('\n')}`;
}

function escapeYamlString(value: string): string {
	if (/[:#"'[\]{}&,*?|>!%@`]|^\s|\s$/.test(value)) {
		return `"${value.replace(/"/g, '\\"')}"`;
	}

	return value;
}

function formatInlineList(values: string[]): string {
	return values.join(', ');
}

function formatStarListsMarkdown(starLists: StarListEntry[]): string {
	if (starLists.length === 0) {
		return '';
	}

	return starLists
		.map((list) => `- [${list.name}](${list.url})`)
		.join('\n');
}

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Substitutes every `{{key}}` placeholder in a single pass, so placeholder
 * text inside substituted values (for example a repository description
 * containing `{{url}}`) is emitted literally instead of being expanded.
 * Unknown placeholders are left untouched.
 */
function applyReplacements(
	template: string,
	replacements: Record<string, string>,
): string {
	return template.replace(PLACEHOLDER_PATTERN, (match, key: string) =>
		Object.prototype.hasOwnProperty.call(replacements, key)
			? (replacements[key] ?? match)
			: match,
	);
}

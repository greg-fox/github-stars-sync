import type { GithubRepository } from '../types';

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;

export function sanitizeFilename(name: string): string {
	return name.replace(INVALID_FILENAME_CHARS, '-').trim();
}

export function renderTemplate(
	template: string,
	repository: GithubRepository,
): string {
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
	};

	let rendered = template;
	for (const [key, value] of Object.entries(replacements)) {
		rendered = rendered.replaceAll(`{{${key}}}`, value);
	}

	return rendered;
}

export function renderFilename(
	template: string,
	repository: GithubRepository,
): string {
	const rendered = renderTemplate(template, repository);
	return sanitizeFilename(rendered);
}

function formatTopicsYaml(topics: string[]): string {
	if (topics.length === 0) {
		return '[]';
	}

	return `\n${topics.map((topic) => `  - ${topic}`).join('\n')}`;
}

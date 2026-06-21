export const DEFAULT_PAT_SECRET_NAME = 'github-stars-sync-pat';

export const GITHUB_API_BASE = 'https://api.github.com';

export const GITHUB_STARRED_ACCEPT = 'application/vnd.github.star+json';

export const MIN_SYNC_INTERVAL_HOURS = 1;

export const MAX_SYNC_INTERVAL_HOURS = 168;

export const DEFAULT_NOTE_TEMPLATE = `---
title: "{{full_name}}"
url: "{{url}}"
owner: "{{owner}}"
language: "{{language}}"
stars: {{stars}}
forks: {{forks}}
starred_at: "{{starred_at}}"
topics: {{topics}}
---

# {{full_name}}

{{description}}

[Open on GitHub]({{url}})
`;

export const TEMPLATE_VARIABLES = [
	{ name: 'name', description: 'Repository name' },
	{ name: 'full_name', description: 'Owner and repository name (owner/repo)' },
	{ name: 'owner', description: 'Repository owner login' },
	{ name: 'description', description: 'Repository description' },
	{ name: 'language', description: 'Primary programming language' },
	{ name: 'url', description: 'Repository URL on GitHub' },
	{ name: 'id', description: 'GitHub repository ID' },
	{ name: 'stars', description: 'Star count' },
	{ name: 'forks', description: 'Fork count' },
	{ name: 'watchers', description: 'Watcher count' },
	{ name: 'issues', description: 'Open issue count' },
	{ name: 'created_at', description: 'Repository creation date (ISO 8601)' },
	{ name: 'updated_at', description: 'Last update date (ISO 8601)' },
	{ name: 'pushed_at', description: 'Last push date (ISO 8601)' },
	{ name: 'starred_at', description: 'When you starred the repository (ISO 8601)' },
	{ name: 'is_private', description: 'Whether the repository is private (true/false)' },
	{ name: 'is_fork', description: 'Whether the repository is a fork (true/false)' },
	{ name: 'topics', description: 'Repository topics as a YAML list' },
	{ name: 'topics_inline', description: 'Repository topics as a comma-separated string' },
] as const;

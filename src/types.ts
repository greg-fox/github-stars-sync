export interface GithubRepositoryOwner {
	login: string;
	avatar_url?: string;
}

export interface GithubRepository {
	id: number;
	node_id: string;
	name: string;
	full_name: string;
	private: boolean;
	owner: GithubRepositoryOwner;
	html_url: string;
	description: string | null;
	fork: boolean;
	url: string;
	stargazers_count: number;
	watchers_count: number;
	language: string | null;
	forks_count: number;
	open_issues_count: number;
	topics: string[];
	created_at: string;
	updated_at: string;
	pushed_at: string;
	starred_at?: string;
}

export interface StarredRepositoryResponse {
	starred_at: string;
	repo: GithubRepository;
}

export interface SyncState {
	lastSyncTime: string | null;
	lastSyncError: string | null;
	repoNotes: Record<string, string>;
}

export interface SyncResult {
	created: number;
	updated: number;
	skipped: number;
	errors: string[];
}

export interface TemplateContext {
	repository: GithubRepository;
}

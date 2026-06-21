import { requestUrl, type RequestUrlResponse } from 'obsidian';
import {
	GITHUB_API_BASE,
	GITHUB_STARRED_ACCEPT,
} from '../constants';
import type { GithubRepository, StarredRepositoryResponse } from '../types';
import { getNextPageLink } from './pagination';

export class GithubApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = 'GithubApiError';
	}
}

export interface GithubClientOptions {
	token: string;
}

function parseJsonResponse<T>(response: RequestUrlResponse): T {
	if (response.status < 200 || response.status >= 300) {
		throw new GithubApiError(
			`GitHub API request failed with status ${response.status}`,
			response.status,
		);
	}

	return response.json as T;
}

export async function fetchAuthenticatedUser(
	token: string,
): Promise<{ login: string }> {
	const response = await requestUrl({
		url: `${GITHUB_API_BASE}/user`,
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
		},
	});

	const data = parseJsonResponse<{ login: string }>(response);
	return { login: data.login };
}

export async function fetchStarredRepositories(
	options: GithubClientOptions,
): Promise<GithubRepository[]> {
	const repositories: GithubRepository[] = [];
	let nextUrl: string | null =
		`${GITHUB_API_BASE}/user/starred?per_page=100&page=1`;

	while (nextUrl) {
		const response = await requestUrl({
			url: nextUrl,
			method: 'GET',
			headers: {
				Authorization: `Bearer ${options.token}`,
				Accept: GITHUB_STARRED_ACCEPT,
				'X-GitHub-Api-Version': '2022-11-28',
			},
		});

		const page = parseJsonResponse<StarredRepositoryResponse[]>(response);
		for (const item of page) {
			if (!item.repo) {
				continue;
			}

			repositories.push({
				...item.repo,
				starred_at: item.starred_at,
			});
		}

		nextUrl = getNextPageLink(response.headers.link);
	}

	return repositories;
}

export function classifyGithubError(error: unknown): string {
	if (error instanceof GithubApiError) {
		if (error.status === 401 || error.status === 403) {
			return 'Authentication failed. Check your personal access token.';
		}
		if (error.status === 429) {
			return 'GitHub rate limit exceeded. Try again later.';
		}
		return error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return 'Unknown error while contacting GitHub.';
}

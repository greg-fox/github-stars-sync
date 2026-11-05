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
		readonly rateLimited = false,
		readonly rateLimitReset: Date | null = null,
	) {
		super(message);
		this.name = 'GithubApiError';
	}
}

export interface GithubClientOptions {
	token: string;
}

function getHeader(
	headers: Record<string, string> | undefined,
	name: string,
): string | undefined {
	if (!headers) {
		return undefined;
	}

	const target = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === target) {
			return value;
		}
	}

	return undefined;
}

/**
 * Throws a {@link GithubApiError} when the response is not successful.
 *
 * Requests must be made with `throw: false`, otherwise `requestUrl` rejects
 * with a generic error before the status can be inspected here.
 *
 * GitHub signals rate limiting with 429, or with 403 and
 * `x-ratelimit-remaining: 0` (primary limit) or a `retry-after` header
 * (secondary limit), so 403 alone does not imply an authentication problem.
 */
export function assertOkResponse(
	response: RequestUrlResponse,
	label = 'GitHub API request',
): void {
	if (response.status >= 200 && response.status < 300) {
		return;
	}

	const remaining = getHeader(response.headers, 'x-ratelimit-remaining');
	const retryAfter = getHeader(response.headers, 'retry-after');
	const rateLimited =
		response.status === 429 ||
		(response.status === 403 &&
			(remaining === '0' || retryAfter !== undefined));

	const resetHeader = getHeader(response.headers, 'x-ratelimit-reset');
	const resetSeconds = resetHeader ? Number.parseInt(resetHeader, 10) : NaN;
	const rateLimitReset = Number.isFinite(resetSeconds)
		? new Date(resetSeconds * 1000)
		: null;

	throw new GithubApiError(
		`${label} failed with status ${response.status}`,
		response.status,
		rateLimited,
		rateLimitReset,
	);
}

function parseJsonResponse<T>(response: RequestUrlResponse): T {
	assertOkResponse(response);
	return response.json as T;
}

export async function fetchAuthenticatedUser(
	token: string,
): Promise<{ login: string }> {
	const response = await requestUrl({
		url: `${GITHUB_API_BASE}/user`,
		method: 'GET',
		throw: false,
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
			throw: false,
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
		if (error.rateLimited || error.status === 429) {
			return error.rateLimitReset
				? `GitHub rate limit exceeded. Try again after ${error.rateLimitReset.toLocaleTimeString()}.`
				: 'GitHub rate limit exceeded. Try again later.';
		}
		if (error.status === 401 || error.status === 403) {
			return 'Authentication failed. Check your personal access token.';
		}
		return error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return 'Unknown error while contacting GitHub.';
}

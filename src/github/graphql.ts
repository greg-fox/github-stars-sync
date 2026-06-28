import { requestUrl, type RequestUrlResponse } from 'obsidian';
import { GITHUB_API_BASE } from '../constants';
import { GithubApiError } from './client';

export interface GraphQlError {
	message: string;
}

export interface GraphQlResponse<T> {
	data?: T;
	errors?: GraphQlError[];
}

export async function graphqlRequest<T>(
	token: string,
	query: string,
	variables: Record<string, unknown> = {},
): Promise<T> {
	const response = await requestUrl({
		url: `${GITHUB_API_BASE}/graphql`,
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'X-GitHub-Api-Version': '2022-11-28',
		},
		body: JSON.stringify({ query, variables }),
	});

	const payload = parseGraphQlResponse<T>(response);
	if (payload.errors?.length) {
		throw new Error(payload.errors.map((error) => error.message).join('; '));
	}

	if (!payload.data) {
		throw new Error('GitHub GraphQL response did not include data.');
	}

	return payload.data;
}

function parseGraphQlResponse<T>(
	response: RequestUrlResponse,
): GraphQlResponse<T> {
	if (response.status < 200 || response.status >= 300) {
		throw new GithubApiError(
			`GitHub GraphQL request failed with status ${response.status}`,
			response.status,
		);
	}

	return response.json as GraphQlResponse<T>;
}

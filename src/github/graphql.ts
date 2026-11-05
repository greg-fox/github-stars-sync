import { requestUrl, type RequestUrlResponse } from 'obsidian';
import { GITHUB_API_BASE } from '../constants';
import { assertOkResponse, GithubApiError } from './client';

export interface GraphQlError {
	message: string;
	type?: string;
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
		throw: false,
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
		const message = payload.errors.map((error) => error.message).join('; ');
		// GitHub reports GraphQL rate limiting as HTTP 200 with an error of
		// type RATE_LIMITED rather than a 403/429 status.
		if (payload.errors.some((error) => error.type === 'RATE_LIMITED')) {
			throw new GithubApiError(message, response.status, true);
		}
		throw new Error(message);
	}

	if (!payload.data) {
		throw new Error('GitHub GraphQL response did not include data.');
	}

	return payload.data;
}

function parseGraphQlResponse<T>(
	response: RequestUrlResponse,
): GraphQlResponse<T> {
	assertOkResponse(response, 'GitHub GraphQL request');
	return response.json as GraphQlResponse<T>;
}

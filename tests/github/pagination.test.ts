import { describe, expect, it } from 'vitest';
import { getNextPageLink } from '../../src/github/pagination';
import { classifyGithubError, GithubApiError } from '../../src/github/client';

describe('getNextPageLink', () => {
	it('returns the next page URL from a Link header', () => {
		const header =
			'<https://api.github.com/user/starred?page=2>; rel="next", <https://api.github.com/user/starred?page=5>; rel="last"';

		expect(getNextPageLink(header)).toBe(
			'https://api.github.com/user/starred?page=2',
		);
	});

	it('returns null when no next link exists', () => {
		expect(getNextPageLink(undefined)).toBeNull();
		expect(getNextPageLink('<https://api.github.com?page=1>; rel="prev"')).toBeNull();
	});
});

describe('classifyGithubError', () => {
	it('maps auth and rate limit errors to friendly messages', () => {
		expect(classifyGithubError(new GithubApiError('fail', 401))).toContain(
			'Authentication failed',
		);
		expect(classifyGithubError(new GithubApiError('fail', 429))).toContain(
			'rate limit',
		);
	});

	it('falls back to generic messages', () => {
		expect(classifyGithubError(new Error('network down'))).toBe(
			'network down',
		);
		expect(classifyGithubError('broken')).toBe(
			'Unknown error while contacting GitHub.',
		);
	});
});

import { describe, expect, it } from 'vitest';
import {
	formatBackgroundSyncIssues,
	formatSyncFailure,
	formatSyncNotice,
} from '../../src/sync/syncService';
import type { SyncResult } from '../../src/types';

describe('formatSyncNotice', () => {
	it('summarizes sync counts', () => {
		expect(
			formatSyncNotice({
				created: 2,
				updated: 1,
				skipped: 3,
				errors: [],
				warnings: [],
			}),
		).toBe('GitHub stars sync complete: 2 created, 1 updated, 3 skipped.');
	});
});

const cleanResult: SyncResult = {
	created: 1,
	updated: 0,
	skipped: 0,
	errors: [],
	warnings: [],
	mocsCreated: 0,
	mocsSkipped: 0,
};

describe('formatSyncFailure', () => {
	it('prefixes the error so the notice is clearly about this plugin', () => {
		expect(formatSyncFailure('Authentication failed. Check your personal access token.')).toBe(
			'GitHub stars sync failed: Authentication failed. Check your personal access token.',
		);
	});
});

describe('formatBackgroundSyncIssues', () => {
	it('returns null when a background sync completes cleanly', () => {
		expect(formatBackgroundSyncIssues(cleanResult)).toBeNull();
	});

	it('reports the error count and the first error', () => {
		expect(
			formatBackgroundSyncIssues({
				...cleanResult,
				errors: ['a/b: Disk full', 'c/d: Disk full'],
			}),
		).toBe('GitHub stars sync finished with 2 errors. First error: a/b: Disk full');
	});

	it('uses the singular for one error', () => {
		expect(
			formatBackgroundSyncIssues({ ...cleanResult, errors: ['a/b: Disk full'] }),
		).toBe('GitHub stars sync finished with 1 error. First error: a/b: Disk full');
	});

	it('includes warnings', () => {
		expect(
			formatBackgroundSyncIssues({
				...cleanResult,
				warnings: ['Star list metadata was not synced: rate limited.'],
			}),
		).toBe('Star list metadata was not synced: rate limited.');
	});
});

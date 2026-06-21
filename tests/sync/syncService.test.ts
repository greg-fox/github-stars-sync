import { describe, expect, it } from 'vitest';
import { formatSyncNotice } from '../../src/sync/syncService';

describe('formatSyncNotice', () => {
	it('summarizes sync counts', () => {
		expect(
			formatSyncNotice({
				created: 2,
				updated: 1,
				skipped: 3,
				errors: [],
			}),
		).toBe('GitHub stars sync complete: 2 created, 1 updated, 3 skipped.');
	});
});

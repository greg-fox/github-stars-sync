import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { getPatFromSecretStorage } from '../src/secrets';

describe('secret storage helpers', () => {
	it('returns null when secret name is empty', () => {
		const app = {
			secretStorage: {
				getSecret: vi.fn().mockReturnValue('token'),
			},
		} as unknown as App;

		expect(getPatFromSecretStorage(app, '   ')).toBeNull();
	});

	it('reads the token from secret storage', () => {
		const getSecret = vi.fn().mockReturnValue('ghp_test');
		const app = {
			secretStorage: { getSecret },
		} as unknown as App;

		expect(getPatFromSecretStorage(app, 'github-stars-sync-pat')).toBe(
			'ghp_test',
		);
		expect(getSecret).toHaveBeenCalledWith('github-stars-sync-pat');
	});

});

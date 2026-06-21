import { describe, expect, it } from 'vitest';
import {
	normalizeSettings,
	normalizeSyncIntervalHours,
} from '../src/settings';

describe('normalizeSyncIntervalHours', () => {
	it('clamps invalid and out-of-range values', () => {
		expect(normalizeSyncIntervalHours(Number.NaN)).toBe(24);
		expect(normalizeSyncIntervalHours(0)).toBe(1);
		expect(normalizeSyncIntervalHours(999)).toBe(168);
		expect(normalizeSyncIntervalHours(12.7)).toBe(13);
	});
});

describe('normalizeSettings', () => {
	it('fills defaults and trims string fields', () => {
		const settings = normalizeSettings({
			notesFolder: '  Stars  ',
			patSecretName: '  my-token  ',
			syncIntervalHours: 0,
		});

		expect(settings.notesFolder).toBe('Stars');
		expect(settings.patSecretName).toBe('my-token');
		expect(settings.syncIntervalHours).toBe(1);
		expect(settings.autoSync).toBe(true);
	});
});

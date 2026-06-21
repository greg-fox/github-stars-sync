import {
	DEFAULT_NOTE_TEMPLATE,
	DEFAULT_PAT_SECRET_NAME,
	MAX_SYNC_INTERVAL_HOURS,
	MIN_SYNC_INTERVAL_HOURS,
} from './constants';

export interface GithubStarsSyncSettings {
	patSecretName: string;
	notesFolder: string;
	filenameTemplate: string;
	noteTemplate: string;
	autoSync: boolean;
	syncIntervalHours: number;
	updateExistingNotes: boolean;
}

export const DEFAULT_SETTINGS: GithubStarsSyncSettings = {
	patSecretName: DEFAULT_PAT_SECRET_NAME,
	notesFolder: 'GitHub Stars',
	filenameTemplate: '{{owner}}-{{name}}',
	noteTemplate: DEFAULT_NOTE_TEMPLATE,
	autoSync: true,
	syncIntervalHours: 24,
	updateExistingNotes: false,
};

export function normalizeSyncIntervalHours(hours: number): number {
	if (!Number.isFinite(hours)) {
		return DEFAULT_SETTINGS.syncIntervalHours;
	}

	return Math.min(
		MAX_SYNC_INTERVAL_HOURS,
		Math.max(MIN_SYNC_INTERVAL_HOURS, Math.round(hours)),
	);
}

export function normalizeSettings(
	settings: Partial<GithubStarsSyncSettings>,
): GithubStarsSyncSettings {
	return {
		...DEFAULT_SETTINGS,
		...settings,
		syncIntervalHours: normalizeSyncIntervalHours(
			settings.syncIntervalHours ?? DEFAULT_SETTINGS.syncIntervalHours,
		),
		patSecretName:
			settings.patSecretName?.trim() || DEFAULT_PAT_SECRET_NAME,
		notesFolder: settings.notesFolder?.trim() || DEFAULT_SETTINGS.notesFolder,
		filenameTemplate:
			settings.filenameTemplate?.trim() || DEFAULT_SETTINGS.filenameTemplate,
		noteTemplate: settings.noteTemplate ?? DEFAULT_SETTINGS.noteTemplate,
	};
}

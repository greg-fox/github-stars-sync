import type { App } from 'obsidian';
import {
	classifyGithubError,
	fetchStarredRepositories,
} from '../github/client';
import { getPatFromSecretStorage } from '../secrets';
import type { GithubStarsSyncSettings } from '../settings';
import type { SyncResult, SyncState } from '../types';
import { writeRepositoryNotes } from './noteWriter';

export interface SyncOptions {
	settings: GithubStarsSyncSettings;
	syncState: SyncState;
}

export interface SyncOutcome {
	result: SyncResult;
	syncState: SyncState;
}

export async function syncGithubStars(
	app: App,
	options: SyncOptions,
): Promise<SyncOutcome> {
	const token = getPatFromSecretStorage(app, options.settings.patSecretName);
	if (!token) {
		throw new Error(
			'No GitHub personal access token found. Add one in plugin settings.',
		);
	}

	const syncState: SyncState = {
		...options.syncState,
		lastSyncError: null,
	};

	try {
		const repositories = await fetchStarredRepositories({ token });
		const { result, repoNotes } = await writeRepositoryNotes(
			app.vault,
			options.settings,
			repositories,
			syncState.repoNotes,
			options.settings.updateExistingNotes,
		);

		return {
			result,
			syncState: {
				...syncState,
				repoNotes,
				lastSyncTime: new Date().toISOString(),
				lastSyncError: result.errors.length > 0 ? result.errors[0] ?? null : null,
			},
		};
	} catch (error) {
		const message = classifyGithubError(error);
		throw new Error(message);
	}
}

export function formatSyncNotice(result: SyncResult): string {
	const parts = [
		`${result.created} created`,
		`${result.updated} updated`,
		`${result.skipped} skipped`,
	];

	if (result.errors.length > 0) {
		parts.push(`${result.errors.length} errors`);
	}

	return `GitHub stars sync complete: ${parts.join(', ')}.`;
}

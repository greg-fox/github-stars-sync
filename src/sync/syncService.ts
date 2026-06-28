import type { App } from 'obsidian';
import {
	classifyGithubError,
	fetchStarredRepositories,
} from '../github/client';
import { enrichRepositoriesWithStarLists } from '../github/enrichRepositories';
import { fetchStarListMembership } from '../github/starLists';
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
	const warnings: string[] = [];

	try {
		const repositories = await fetchStarredRepositories({ token });
		let enrichedRepositories = repositories;

		try {
			const membership = await fetchStarListMembership(token);
			enrichedRepositories = enrichRepositoriesWithStarLists(
				repositories,
				membership,
			);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to fetch GitHub star lists.';
			warnings.push(
				`Star list metadata was not synced: ${message}. Notes were still created from starred repositories.`,
			);
		}

		const { result, repoNotes } = await writeRepositoryNotes(
			app.vault,
			options.settings,
			enrichedRepositories,
			syncState.repoNotes,
			options.settings.updateExistingNotes,
		);

		return {
			result: {
				...result,
				warnings,
			},
			syncState: {
				...syncState,
				repoNotes,
				lastSyncTime: new Date().toISOString(),
				lastSyncError:
					result.errors.length > 0 ? result.errors[0] ?? null : null,
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

	if (result.warnings.length > 0) {
		parts.push(`${result.warnings.length} warnings`);
	}

	return `GitHub stars sync complete: ${parts.join(', ')}.`;
}

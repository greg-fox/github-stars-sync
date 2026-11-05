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
import { collectDistinctStarLists, writeStarListMocs } from './mocWriter';
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
			// Classified messages are full sentences; drop the trailing period
			// so it does not double up with the sentence below.
			const message = classifyGithubError(error).replace(/\.+$/, '');
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
			{ metadataCache: app.metadataCache },
		);

		let mocsCreated = 0;
		let mocsSkipped = 0;
		const errors = [...result.errors];

		if (options.settings.mocEnabled) {
			const starLists = collectDistinctStarLists(enrichedRepositories);
			const mocResult = await writeStarListMocs(
				app.vault,
				options.settings,
				starLists,
			);
			mocsCreated = mocResult.created;
			mocsSkipped = mocResult.skipped;
			errors.push(...mocResult.errors.map((message) => `MOC: ${message}`));
		}

		return {
			result: {
				...result,
				errors,
				warnings,
				mocsCreated,
				mocsSkipped,
			},
			syncState: {
				...syncState,
				repoNotes,
				lastSyncTime: new Date().toISOString(),
				lastSyncError: errors.length > 0 ? errors[0] ?? null : null,
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

	if (result.mocsCreated > 0 || result.mocsSkipped > 0) {
		parts.push(`${result.mocsCreated} MOCs created`);
		parts.push(`${result.mocsSkipped} MOCs skipped`);
	}

	return `GitHub stars sync complete: ${parts.join(', ')}.`;
}

/**
 * Notice text for a sync that failed outright, shown even when the sync
 * ran in the background so a broken token or network problem is noticed.
 */
export function formatSyncFailure(message: string): string {
	return `GitHub stars sync failed: ${message}`;
}

/**
 * Notice text for a background sync that completed with errors or
 * warnings, or `null` when it completed cleanly.
 */
export function formatBackgroundSyncIssues(result: SyncResult): string | null {
	if (result.errors.length === 0 && result.warnings.length === 0) {
		return null;
	}

	const lines: string[] = [];
	if (result.errors.length > 0) {
		const count = result.errors.length;
		lines.push(
			`GitHub stars sync finished with ${count} ${count === 1 ? 'error' : 'errors'}. First error: ${result.errors[0]}`,
		);
	}
	lines.push(...result.warnings);

	return lines.join('\n');
}

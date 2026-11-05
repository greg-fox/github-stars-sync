import { debounce, Notice, Plugin } from 'obsidian';
import {
	normalizeSettings,
	type GithubStarsSyncSettings,
} from './settings';
import { GithubStarsSyncSettingTab } from './ui/settingsTab';
import {
	formatBackgroundSyncIssues,
	formatSyncFailure,
	formatSyncNotice,
	syncGithubStars,
} from './sync/syncService';
import type { SyncState } from './types';
import { applyRenameToRepoNotes } from './sync/noteTracking';

const DEFAULT_SYNC_STATE: SyncState = {
	lastSyncTime: null,
	lastSyncError: null,
	repoNotes: {},
};

export default class GithubStarsSyncPlugin extends Plugin {
	settings!: GithubStarsSyncSettings;
	syncState: SyncState = { ...DEFAULT_SYNC_STATE };
	private syncInProgress = false;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('star', 'Sync GitHub stars', () => {
			void this.runSync({ showNotice: true });
		});

		this.addCommand({
			id: 'sync-github-stars',
			name: 'Sync GitHub stars now',
			callback: () => {
				void this.runSync({ showNotice: true });
			},
		});

		this.addSettingTab(new GithubStarsSyncSettingTab(this.app, this));

		// Keep tracked note paths current when notes or their folders are
		// renamed or moved, so the next sync updates them in place instead of
		// creating duplicates.
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				void this.handleRename(file.path, oldPath);
			}),
		);
		this.refreshSyncInterval();

		// Registered once so the active interval is always cleared on unload,
		// however many times it has been replaced.
		this.register(() => {
			this.scheduleSyncIntervalRefresh.cancel();
			this.stopSyncInterval();
		});

		if (this.settings.autoSync) {
			const startupSyncId = window.setTimeout(() => {
				void this.runSync({ showNotice: false });
			}, 5000);
			this.register(() => window.clearTimeout(startupSyncId));
		}
	}

	async loadSettings() {
		const loaded = (await this.loadData()) as
			| Partial<GithubStarsSyncSettings & SyncState>
			| null;

		this.settings = normalizeSettings(loaded ?? {});
		this.syncState = {
			lastSyncTime: loaded?.lastSyncTime ?? null,
			lastSyncError: loaded?.lastSyncError ?? null,
			repoNotes: loaded?.repoNotes ?? {},
		};
	}

	async saveSettings() {
		await this.saveData({
			...this.settings,
			...this.syncState,
		});
	}

	private activeSyncIntervalId: number | null = null;

	private stopSyncInterval(): void {
		if (this.activeSyncIntervalId !== null) {
			window.clearInterval(this.activeSyncIntervalId);
			this.activeSyncIntervalId = null;
		}
	}

	refreshSyncInterval(): void {
		this.stopSyncInterval();

		if (!this.settings.autoSync) {
			return;
		}

		const intervalMs = this.settings.syncIntervalHours * 60 * 60 * 1000;
		this.activeSyncIntervalId = window.setInterval(() => {
			void this.runSync({ showNotice: false });
		}, intervalMs);
	}

	/**
	 * Restarts the sync interval once input settles, so typing a value such
	 * as "12" does not briefly schedule a 1 hour interval.
	 */
	readonly scheduleSyncIntervalRefresh = debounce(
		() => this.refreshSyncInterval(),
		1000,
		true,
	);

	private async handleRename(newPath: string, oldPath: string): Promise<void> {
		const repoNotes = applyRenameToRepoNotes(
			this.syncState.repoNotes,
			oldPath,
			newPath,
		);
		if (!repoNotes) {
			return;
		}

		this.syncState = { ...this.syncState, repoNotes };
		await this.saveSettings();
	}

	async runSync(options: { showNotice: boolean }): Promise<void> {
		if (this.syncInProgress) {
			if (options.showNotice) {
				new Notice('GitHub stars sync is already running.');
			}
			return;
		}

		this.syncInProgress = true;

		try {
			const outcome = await syncGithubStars(this.app, {
				settings: this.settings,
				syncState: this.syncState,
			});

			this.syncState = outcome.syncState;
			await this.saveSettings();

			if (options.showNotice) {
				const notice = formatSyncNotice(outcome.result);
				new Notice(
					outcome.result.warnings.length > 0
						? `${notice}\n${outcome.result.warnings.join('\n')}`
						: notice,
					8000,
				);
			} else {
				// Background syncs stay quiet unless something went wrong.
				const failureNotice = formatBackgroundSyncIssues(outcome.result);
				if (failureNotice) {
					new Notice(failureNotice, 10000);
				}
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Sync failed.';
			this.syncState = {
				...this.syncState,
				lastSyncError: message,
			};
			await this.saveSettings();

			new Notice(
				options.showNotice ? message : formatSyncFailure(message),
				options.showNotice ? 8000 : 10000,
			);
		} finally {
			this.syncInProgress = false;
		}
	}
}

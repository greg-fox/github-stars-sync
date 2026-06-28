import { Notice, Plugin } from 'obsidian';
import {
	normalizeSettings,
	type GithubStarsSyncSettings,
} from './settings';
import { GithubStarsSyncSettingTab } from './ui/settingsTab';
import {
	formatSyncNotice,
	syncGithubStars,
} from './sync/syncService';
import type { SyncState } from './types';

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
		this.refreshSyncInterval();

		if (this.settings.autoSync) {
			window.setTimeout(() => {
				void this.runSync({ showNotice: false });
			}, 5000);
		}
	}

	onunload() {
		this.refreshSyncInterval(true);
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

	refreshSyncInterval(clearOnly = false): void {
		this.stopSyncInterval();

		if (clearOnly || !this.settings.autoSync) {
			return;
		}

		const intervalMs = this.settings.syncIntervalHours * 60 * 60 * 1000;
		this.activeSyncIntervalId = window.setInterval(() => {
			void this.runSync({ showNotice: false });
		}, intervalMs);
		this.registerInterval(this.activeSyncIntervalId);
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
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Sync failed.';
			this.syncState = {
				...this.syncState,
				lastSyncError: message,
			};
			await this.saveSettings();

			if (options.showNotice) {
				new Notice(message, 8000);
			}
		} finally {
			this.syncInProgress = false;
		}
	}
}

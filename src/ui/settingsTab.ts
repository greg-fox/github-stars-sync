import {
	App,
	Notice,
	PluginSettingTab,
	SecretComponent,
	Setting,
} from 'obsidian';
import {
	MAX_SYNC_INTERVAL_HOURS as MAX_SYNC_HOURS,
	MIN_SYNC_INTERVAL_HOURS as MIN_SYNC_HOURS,
	TEMPLATE_VARIABLES,
} from '../constants';
import type GithubStarsSyncPlugin from '../main';
import {
	DEFAULT_SETTINGS,
	normalizeSyncIntervalHours,
} from '../settings';
import { fetchAuthenticatedUser } from '../github/client';
import { getPatFromSecretStorage, hasSecretStorage } from '../secrets';

export class GithubStarsSyncSettingTab extends PluginSettingTab {
	plugin: GithubStarsSyncPlugin;

	constructor(app: App, plugin: GithubStarsSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('GitHub authentication')
			.setHeading();

		if (hasSecretStorage(this.app)) {
			new Setting(containerEl)
				.setName('Personal access token')
				.setDesc(
					'Select or create a secret in Obsidian’s keychain. The token is stored outside plugin data.json.',
				)
				.addComponent((el) =>
					new SecretComponent(this.app, el)
						.setValue(this.plugin.settings.patSecretName)
						.onChange(async (secretName) => {
							this.plugin.settings.patSecretName =
								secretName?.trim() || DEFAULT_SETTINGS.patSecretName;
							await this.plugin.saveSettings();
						}),
				);

			new Setting(containerEl)
				.setName('Test token')
				.setDesc('Verify that the selected secret can access GitHub.')
				.addButton((button) => {
					button
						.setButtonText('Test connection')
						.setCta()
						.onClick(async () => {
							button.setDisabled(true);
							try {
								const token = getPatFromSecretStorage(
									this.app,
									this.plugin.settings.patSecretName,
								);
								if (!token) {
									new Notice(
										'No token found for the selected secret name.',
									);
									return;
								}

								const user = await fetchAuthenticatedUser(token);
								new Notice(
									`Connected to GitHub as ${user.login}.`,
								);
							} catch (error) {
								const message =
									error instanceof Error
										? error.message
										: 'Token test failed.';
								new Notice(message, 8000);
							} finally {
								button.setDisabled(false);
							}
						});
				});
		} else {
			new Setting(containerEl)
				.setName('Personal access token')
				.setDesc(
					'Secret storage requires Obsidian 1.11.4 or later. Upgrade Obsidian to store your token securely.',
				);
		}

		new Setting(containerEl)
			.setName('Note output')
			.setHeading();

		new Setting(containerEl)
			.setName('Notes folder')
			.setDesc('Folder inside the vault where starred repository notes are created.')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.notesFolder)
					.setValue(this.plugin.settings.notesFolder)
					.onChange(async (value) => {
						this.plugin.settings.notesFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Filename template')
			.setDesc(
				'Template for note filenames without extension. Supports the same variables as the note template.',
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.filenameTemplate)
					.setValue(this.plugin.settings.filenameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.filenameTemplate = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Note template')
			.setDesc(
				'Markdown template for each starred repository. Use {{variable}} placeholders.',
			)
			.addTextArea((text) => {
				text.inputEl.rows = 14;
				text.inputEl.addClass('github-stars-sync-template-input');
				text
					.setValue(this.plugin.settings.noteTemplate)
					.onChange(async (value) => {
						this.plugin.settings.noteTemplate = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Reset note template')
			.setDesc('Restore the default note template.')
			.addButton((button) =>
				button.setButtonText('Reset').onClick(async () => {
					this.plugin.settings.noteTemplate =
						DEFAULT_SETTINGS.noteTemplate;
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		const variablesEl = containerEl.createDiv(
			'github-stars-sync-template-variables',
		);
		variablesEl.createEl('p', {
			text: 'Available template variables:',
		});
		const listEl = variablesEl.createEl('ul');
		for (const variable of TEMPLATE_VARIABLES) {
			const item = listEl.createEl('li');
			item.createEl('code', { text: `{{${variable.name}}}` });
			item.appendText(` — ${variable.description}`);
		}

		new Setting(containerEl)
			.setName('Synchronization')
			.setHeading();

		new Setting(containerEl)
			.setName('Automatic sync')
			.setDesc('Periodically fetch starred repositories from GitHub.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoSync)
					.onChange(async (value) => {
						this.plugin.settings.autoSync = value;
						await this.plugin.saveSettings();
						this.plugin.refreshSyncInterval();
						this.display();
					}),
			);

		if (this.plugin.settings.autoSync) {
			new Setting(containerEl)
				.setName('Sync interval (hours)')
				.setDesc(
					`How often to sync automatically (${MIN_SYNC_HOURS} hour minimum, ${MAX_SYNC_HOURS} hour maximum).`,
				)
				.addText((text) => {
					text.inputEl.type = 'number';
					text.inputEl.min = String(MIN_SYNC_HOURS);
					text.inputEl.step = '1';
					text
						.setValue(String(this.plugin.settings.syncIntervalHours))
						.onChange(async (value) => {
							const parsed = Number.parseInt(value, 10);
							this.plugin.settings.syncIntervalHours =
								normalizeSyncIntervalHours(parsed);
							await this.plugin.saveSettings();
							this.plugin.refreshSyncInterval();
						});
				});
		}

		new Setting(containerEl)
			.setName('Update existing notes')
			.setDesc(
				'When enabled, re-render notes from the template on each sync. Disable to preserve manual edits.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.updateExistingNotes)
					.onChange(async (value) => {
						this.plugin.settings.updateExistingNotes = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Sync now')
			.setDesc('Fetch starred repositories and create or update notes immediately.')
			.addButton((button) =>
				button.setButtonText('Sync now').setCta().onClick(async () => {
					button.setDisabled(true);
					try {
						await this.plugin.runSync({ showNotice: true });
					} finally {
						button.setDisabled(false);
					}
				}),
			);

		if (this.plugin.syncState.lastSyncTime) {
			new Setting(containerEl)
				.setName('Last sync')
				.setDesc(
					new Date(this.plugin.syncState.lastSyncTime).toLocaleString(),
				);
		}

		if (this.plugin.syncState.lastSyncError) {
			new Setting(containerEl)
				.setName('Last sync error')
				.setDesc(this.plugin.syncState.lastSyncError);
		}
	}
}

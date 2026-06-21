import type { BaseComponent } from 'obsidian';

declare module 'obsidian' {
	export class SecretStorage {
		getSecret(id: string): string | null;
		setSecret(id: string, secret: string): void;
		listSecrets(): string[];
	}

	export class SecretComponent extends BaseComponent {
		constructor(app: import('obsidian').App, containerEl: HTMLElement);
		setValue(value: string): this;
		onChange(callback: (value: string | null) => void | Promise<void>): this;
	}

	interface App {
		secretStorage: SecretStorage;
	}

	interface Setting {
		addComponent<T extends BaseComponent>(
			cb: (el: HTMLElement) => T,
		): Setting;
	}
}

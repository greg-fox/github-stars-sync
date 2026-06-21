import type { App } from 'obsidian';

export function getPatFromSecretStorage(
	app: App,
	secretName: string,
): string | null {
	const normalizedName = secretName.trim();
	if (!normalizedName || !app.secretStorage) {
		return null;
	}

	return app.secretStorage.getSecret(normalizedName);
}

export function hasSecretStorage(app: App): boolean {
	return Boolean(
		app.secretStorage &&
			typeof app.secretStorage.getSecret === 'function',
	);
}

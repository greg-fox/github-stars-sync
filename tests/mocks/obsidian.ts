import { vi } from 'vitest';

export const requestUrl = vi.fn();

export function normalizePath(path: string): string {
	return path.replace(/\\/g, '/');
}

export class TFile {}

export class Vault {}

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	resolve: {
		alias: {
			obsidian: path.resolve(__dirname, 'tests/mocks/obsidian.ts'),
		},
	},
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/main.ts', 'src/ui/**', 'src/obsidian-api.d.ts'],
		},
	},
});

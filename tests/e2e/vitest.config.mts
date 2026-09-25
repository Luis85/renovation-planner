import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Deliberately independent of the root `vitest.config.ts`: no jsdom, no `obsidian` alias, no
// coverage. These cases drive a REAL Obsidian, one at a time.
export default defineConfig({
	test: {
		name: 'native-obsidian',
		environment: 'node',
		include: ['tests/e2e/**/*.e2e.ts'],
		pool: 'forks',
		maxWorkers: 1,
		fileParallelism: false,
		retry: 0,
		testTimeout: 120_000,
		hookTimeout: 180_000,
		expect: { poll: { timeout: 10_000, interval: 100 } },
		reporters: ['default', 'junit'],
		outputFile: { junit: path.resolve('e2e-results/junit.xml') },
		passWithNoTests: false,
	},
});

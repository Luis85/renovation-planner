import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { noSsrSfc } from '../../../../scripts/vitest-no-ssr-sfc.mjs';

/**
 * The child run `tests/build/no-ssr-sfc.test.ts` spawns: the real Vue plugin behind the real
 * refusal, over two specs that import the same `Probe.vue` — one in node, one in jsdom. Named
 * exactly rather than globbed, for the reason `.fallowrc.json` gives about fixtures: a glob
 * absorbs the next file and tells nobody. `root` is the repository so the fixtures' relative
 * imports resolve, and there is no coverage and no reporter beyond the JSON one the parent
 * reads.
 */
export default defineConfig({
	plugins: [noSsrSfc(), vue()],
	test: {
		root: process.cwd(),
		environment: 'node',
		include: [
			'tests/build/fixtures/sfcEnvironment/nodeImportsSfc.fixture.ts',
			'tests/build/fixtures/sfcEnvironment/jsdomImportsSfc.fixture.ts',
		],
	},
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { assembledStyles } from './scripts/vite-assembled-styles.mjs';

/**
 * The browser harness: the real view, the real stylesheet and Obsidian's own app.css, in a
 * browser, with no Obsidian. `npm run harness` starts it and prints the URL.
 *
 * `test-build.mjs` exists so a HUMAN can look at the plugin — it needs a vault, the app and
 * a GUI. This is the same need for a session that has a browser and no Obsidian.
 *
 * What it is not: a test. Nothing here asserts what gets drawn, there is no baseline to
 * diff against, and it is deliberately outside `npm run check`. The check that keeps it
 * alive is `tests/harness/harness.test.ts`, which vitest already runs.
 *
 * It is a dev SERVER rather than a static bundle, and that is a change from the source
 * project this harness came from: there, the page was an IIFE opened over `file://`, since
 * a `file://` page cannot load ES modules — every file is its own opaque origin. Over http
 * that constraint is gone, so the entry is a plain module and a partial edit reloads the
 * page. What was lost with it is a folder a headless browser can screenshot without a
 * server; add `vite build` here the day something needs one.
 */
export default defineConfig({
	// The page and its two static sheets live here; `/styles.css` is answered by the plugin
	// below, from the partials on disk.
	root: 'tests/harness',
	resolve: {
		alias: {
			// The types-only 'obsidian' package, resolved to the same runtime stand-in
			// `vitest.config.ts` points the suite at. Inline for fallow's sake (see the
			// note there); `tests/build/config-alias.test.ts` pins the two literals
			// together, so moving the mock cannot fix the suite and silently strand
			// this page for the next `npm run harness`.
			obsidian: fileURLToPath(new URL('./tests/helpers/obsidian-mock.ts', import.meta.url)),
		},
	},
	server: {
		open: true,
		// The assembler and the mock are outside `root`, so the server has to be allowed to
		// read them.
		fs: { allow: ['..', '../..'] },
	},
	plugins: [assembledStyles()],
});

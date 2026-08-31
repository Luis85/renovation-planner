import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { assembledStyles } from './scripts/vite-assembled-styles.mjs';

/**
 * The plugin build: one CommonJS file in `dist/`, which is what Obsidian loads once
 * `test-build.mjs` copies it into a vault or a release ships it as an asset.
 * `--mode development` keeps the sourcemap and the warnings; the default mode is
 * the release.
 *
 * Vite rather than esbuild because the SDD's UI stack is Vue 3 — single-file components
 * need a build tool that compiles them, and `@vitejs/plugin-vue` is one line in the
 * `plugins` array below when the first component arrives. Nothing else about this file
 * changes then.
 */
const OBSIDIAN_PROVIDED = [
	'obsidian',
	'electron',
	'@codemirror/autocomplete',
	'@codemirror/collab',
	'@codemirror/commands',
	'@codemirror/language',
	'@codemirror/lint',
	'@codemirror/search',
	'@codemirror/state',
	'@codemirror/view',
	'@lezer/common',
	'@lezer/highlight',
	'@lezer/lr',
	...builtinModules,
];

/**
 * There is deliberately NO source-pointer banner on the bundle, and this is the note that
 * keeps it from being re-added on reflex.
 *
 * The sample plugin's esbuild config prints "visit the github repository of this plugin"
 * at the top of `main.js`. Vite's minifier strips comments — measured here, both as
 * `output.banner` and as a `/*!` legal comment in the source, and the release bundle came
 * out clean both times while the development one kept it. So the choices were a
 * `writeBundle` hook that prepends the text after minification, or nothing.
 *
 * Nothing, because the pointer already exists where a user actually looks:
 * `manifest.json`'s `authorUrl`, which Obsidian shows in the plugin list, and the `repo`
 * field of the community-list entry. A comment inside a minified file is the least
 * discoverable of the three. Re-add it with a `writeBundle` hook if a reviewer asks.
 */

export default defineConfig(({ mode }) => ({
	plugins: [vue(), assembledStyles()],
	build: {
		/**
		 * `dist/`, not the repository root.
		 *
		 * An Obsidian plugin folder holds `main.js`, `manifest.json` and `styles.css`
		 * together, which is why the sample plugin builds into the root — and Vite refuses
		 * to do that quietly: `outDir` at the root warns on every single build that it could
		 * overwrite sources, and a warning nobody can clear is one everybody learns to skip.
		 * Nothing here needs the artifacts at the root anyway: `test-build.mjs` copies them
		 * into `.obsidian/plugins/<id>/` and the release uploads them as assets, both of
		 * which read a path.
		 */
		outDir: 'dist',
		// The SYNTAX floor, which is not `tsconfig.json`'s `lib`: that is ES2021 and says
		// which APIs exist. A method call is not downlevelled and esbuild polyfills
		// nothing, so the two move independently — see CLAUDE.md's Gotchas.
		target: 'es2020',
		minify: mode !== 'development',
		// Inline, so a stack trace in Obsidian's console points at the TypeScript rather
		// than at one long bundled line. Never in the release: a plugin ships one file.
		sourcemap: mode === 'development' ? 'inline' : false,
		lib: {
			entry: 'src/main.ts',
			formats: ['cjs'],
			fileName: () => 'main.js',
		},
		rollupOptions: {
			external: OBSIDIAN_PROVIDED,
			output: {
				/**
				 * NAMED, not the `auto` default, and this is the one line in the file that is
				 * about Obsidian's loader rather than about bundling.
				 *
				 * `auto` sees a lone default export and emits `module.exports = Plugin`.
				 * `named` emits `exports.default = Plugin` with the `__esModule` marker — the
				 * shape esbuild produced for every plugin built from the sample repository,
				 * and therefore the shape known to load. Which of the two Obsidian accepts
				 * cannot be checked here, so it takes the one with a track record.
				 */
				exports: 'named',
			},
		},
	},
}));

import { transform } from 'lightningcss';
import { assembleStyles } from './styles-assemble.mjs';

/**
 * The one Vite plugin both configs need: the stylesheet Obsidian loads.
 *
 * It is NOT built by Vite's CSS pipeline, deliberately. Vite would inline the `@import`
 * chain perfectly well, and `styles-assemble.mjs` would go away with it — along with the
 * gates it holds and Vite has no opinion about: a partial no entry file imports, an entry
 * line the assembler cannot resolve (both silently absent from the shipped sheet
 * otherwise, the one failure a stylesheet cannot report), and a partial over the 400-line
 * cap. All fail the build today. Losing them to delete sixty lines is the wrong trade.
 *
 * So: one assembler, two consumers, exactly as before.
 *
 * - `generateBundle` emits `styles.css` as an asset, so it lands in whatever `outDir` the
 *   config declares rather than in a path this file has to know.
 * - `configureServer` answers the harness page's `/styles.css` from the partials on disk,
 *   so what is on screen is the CSS being edited and never a stale build, and a partial
 *   edit reloads the page.
 */
/**
 * Typed by JSDoc rather than a sibling `.d.mts` — an annotation here cannot drift from
 * the implementation the way a hand-written declaration file can.
 *
 * @returns {import('vite').Plugin} the shared stylesheet plugin
 */
export function assembledStyles() {
	let minify = false;
	return {
		name: 'assembled-styles',

		configResolved(config) {
			// The sheet follows the BUILD's own minify switch: an asset emitted by a plugin
			// hook is outside Vite's CSS pipeline, so without this the release would ship a
			// readable styles.css beside a minified main.js. `--mode development` stays
			// readable on purpose — that build exists to be debugged — and the dev server
			// below always serves the readable form.
			minify = config.build.minify !== false;
		},

		generateBundle() {
			const sheet = assembleStyles();
			// lightningcss, because it is what Vite 8 itself minifies CSS with — the sheet
			// leaves this hook as it would leave Vite's own pipeline. A named devDependency,
			// not a reach into Vite's internals: `transformWithEsbuild` is deprecated in the
			// rolldown Vite and requires esbuild, which nothing here installs.
			const source = minify
				? transform({ filename: 'styles.css', code: Buffer.from(sheet), minify: true }).code.toString()
				: sheet;
			this.emitFile({ type: 'asset', fileName: 'styles.css', source });
		},

		configureServer(server) {
			server.middlewares.use('/styles.css', (_req, res) => {
				res.setHeader('Content-Type', 'text/css');
				// Assembled per request rather than cached: the assembler throws on an
				// unimported partial or one over the cap, and a dev server that kept serving
				// the last good copy would hide exactly that.
				res.end(assembleStyles());
			});
			server.watcher.add('styles');
			server.watcher.on('change', (file) => {
				// A full reload rather than a CSS swap: this sheet is not a module Vite knows
				// about, so there is no HMR boundary to update.
				if (file.replaceAll('\\', '/').includes('/styles/')) server.hot.send({ type: 'full-reload' });
			});
		},
	};
}

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
export function assembledStyles() {
	return {
		name: 'assembled-styles',

		generateBundle() {
			this.emitFile({ type: 'asset', fileName: 'styles.css', source: assembleStyles() });
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

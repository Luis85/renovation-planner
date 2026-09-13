/**
 * "No test that runs in the NODE environment reaches a `.vue` file", checked at the forbidden
 * thing: the transform that would compile it.
 *
 * The defect this exists for passed every gate and reddened CI anyway. A node-environment test
 * imported a pure function from a module whose graph reached the editor's SFCs; vitest compiled
 * each of those in SSR shape (an `if` for a `v-if`, a ternary for `<select v-model>`) without
 * ever rendering them, and the v8 coverage merge appended those SSR-only arms — 84 uncovered
 * branches across 17 forms nobody had touched — to the client-shaped arms the jsdom suites
 * cover. Branches fell below the 98% floor with every test green.
 *
 * **The discriminator is the pipeline's own, measured rather than read off a directive.** A
 * throwaway plugin logging every `.vue` `load`/`transform` under vitest 4.1 + Vite 8 reported
 * `ssr=true` with `this.environment.name === 'ssr'` for the node-environment spec and
 * `ssr=false` / `client` for the jsdom one — so the hook's `options.ssr` is the whole test.
 * Nothing here reads a test file, an `@vitest-environment` comment or `vitest.config.ts`:
 * whatever vitest decides the environment is, this sees the transform it produces.
 *
 * Registered in `vitest.config.ts` ONLY. `vite.config.ts` builds the plugin, where `ssr` is
 * never set, and the harness config serves a browser; neither has the SSR shape to refuse.
 *
 * **What it cannot see**, so nobody reads it wider: a `.vue` that never reaches Vite's
 * transform — mocked away with `vi.mock`, or compiled by a second Vite instance a test starts
 * itself (`prototypes-not-bundled.test.ts` runs a real `vite build` from `vite.config.ts`,
 * which does not carry this plugin). Neither shape adds an SSR-compiled SFC to the coverage
 * map, which is the harm this refuses.
 */

/**
 * Why a transform is refused, or `null` when it is not: an SSR transform of a `.vue` module,
 * sub-requests (`?vue&type=…`) included, since the id's PATH is what names the SFC.
 *
 * @param {string} id the module id Vite hands the hook, query and all
 * @param {boolean | undefined} ssr the hook's own `options.ssr`
 * @returns {string | null} the failure text naming the file, or `null` to pass it through
 */
export function ssrSfcRefusal(id, ssr) {
	if (ssr !== true) return null;
	const [path] = id.split('?', 1);
	if (path === undefined || !path.endsWith('.vue')) return null;
	return (
		`${path} was compiled in SSR shape: a test running in the node environment reaches this SFC ` +
		'through its imports. Its v-if/v-model arms would be counted as uncovered branches in the ' +
		'coverage merge. Give the test `// @vitest-environment jsdom` if it mounts something, or ' +
		'move what it needs into a module with no .vue below it.'
	);
}

/**
 * @returns {import('vite').Plugin} the plugin `vitest.config.ts` registers
 */
export function noSsrSfc() {
	return {
		name: 'rp:no-ssr-sfc',
		enforce: 'pre',
		transform(_code, id, options) {
			const refusal = ssrSfcRefusal(id, options?.ssr);
			if (refusal !== null) throw new Error(refusal);
			return null;
		},
	};
}

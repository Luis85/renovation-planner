import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import vitestConfig from '../../vitest.config';
import harnessConfig from '../../vite.harness.config';

/**
 * The `obsidian → tests/helpers/obsidian-mock.ts` alias is written INLINE in both
 * configs, because fallow resolves it by reading the literal — a shared module would
 * blind it to every `import ... from 'obsidian'`. Inline twice means it can drift:
 * moving the mock updates the config whose failure is loud (the suite errors) while the
 * harness config keeps a dead path that nothing notices until the next `npm run
 * harness`. This is the check that makes that drift fail `npm run check` instead.
 */

const aliasOf = (config: { resolve?: { alias?: unknown } }) => {
	const alias = config.resolve?.alias as Record<string, string> | undefined;

	// Read through the local rather than off the end of the optional chain: `(x?.y as T).z`
	// short-circuits to `undefined` and then reads a property of it, so the helper would
	// throw a TypeError on a config with no alias instead of letting the assertions below
	// say which config is missing one. The empty string keeps the return a `string` and
	// fails both of them.
	return alias?.obsidian ?? '';
};

describe('the obsidian module alias', () => {
	it('is the same file in the suite config and the harness config', () => {
		expect(aliasOf(harnessConfig)).toBe(aliasOf(vitestConfig));
	});

	// Not just equal — equal AND real: two configs agreeing on a moved-away path would
	// pass the identity check while both were broken.
	it('points at a mock that exists', () => {
		const target = aliasOf(vitestConfig);

		expect(target.endsWith('obsidian-mock.ts')).toBe(true);
		expect(existsSync(target)).toBe(true);
	});
});

/**
 * A TRIPWIRE, not a proof, and the label matters. `@vitejs/plugin-vue` has to be in every
 * config that transforms source, and each omission is invisible in a different place: the
 * `vite.config.ts` one at `npm run build`, the `vitest.config.ts` one at `npm test`, and
 * the `vite.harness.config.ts` one at `npm run harness` — which is deliberately outside
 * `npm run check`, so nothing in the gate would notice it going missing.
 *
 * What this checks is only that a plugin with that name is PRESENT. It does not check that
 * the plugin works, which is what `tests/presentation/views/viewRoot.test.ts` proves by
 * effect for the suite (an SFC import fails at parse without it) and what a screenshot
 * proves for the harness. Reading a config is exactly what those two refuse to rely on;
 * this exists because one of the three surfaces has no other watcher at all.
 */
// Widened to `unknown` on purpose: `flat(Infinity)` over the config's own plugin union type is
// TS2589 (excessively deep instantiation), measured.
const registeredPlugins = (config: { plugins?: unknown }): { name?: unknown; enforce?: unknown }[] =>
	(Array.isArray(config.plugins) ? config.plugins.flat(Infinity) : []).filter(
		(plugin): plugin is { name?: unknown; enforce?: unknown } => typeof plugin === 'object' && plugin !== null,
	);

const pluginNames = (config: { plugins?: unknown }): string[] =>
	registeredPlugins(config)
		.map((plugin) => (typeof plugin.name === 'string' ? plugin.name : ''))
		.filter((name) => name !== '');

describe('the Vue plugin, in every config that transforms source', () => {
	it('is named by the suite config', () => {
		expect(pluginNames(vitestConfig).join(' ')).toContain('vue');
	});

	// The one with no gate in `npm run check`, which is the whole reason this file says so.
	it('is named by the harness config', () => {
		expect(pluginNames(harnessConfig).join(' ')).toContain('vue');
	});
});

/**
 * The `build-lint` project's `include` is DERIVED from the import graph (`eslintBootingTests` in
 * `vitest.config.ts`), and the two files the first, text-matched version of that derivation
 * missed are the pin: `tests/helpers/eslint.test.ts` reaches the shared instance as a sibling
 * (`./eslint`) from outside `tests/build/`, and `tests/build/lint-edited.test.ts` imports nothing
 * and SPAWNS the hook. A derivation that dropped either would put an ESLint boot back into the
 * parallel projects, where its `beforeAll` times out under load — the flake this split exists to
 * close. Read off the real config object, so what is pinned is what vitest runs.
 */
describe('the ESLint-booting project', () => {
	it('is derived to include the two files a text pattern once missed, and only test files', () => {
		const projects = (vitestConfig as { test?: { projects?: { test?: { name?: string; include?: string[] } }[] } }).test?.projects ?? [];
		const included = projects.find((project) => project.test?.name === 'build-lint')?.test?.include ?? [];

		expect(included).toContain('tests/helpers/eslint.test.ts');
		expect(included).toContain('tests/build/lint-edited.test.ts');
		expect(included.filter((file) => !file.endsWith('.test.ts'))).toEqual([]);
	});
});

/**
 * The SSR-SFC refusal (`scripts/vitest-no-ssr-sfc.mjs`) is a gate only while the suite config
 * REGISTERS it: `tests/build/no-ssr-sfc.test.ts` drives the plugin through a fixture config of
 * its own, so deleting `noSsrSfc()` from `vitest.config.ts` switched the rule off with every
 * test green — watched, with the line removed, before this case existed. Asked of the real
 * config object rather than of its text: the plugin is present by name, and the REGISTERED object
 * carries `enforce: 'pre'`. That flag, not its position in the array, is what runs its transform
 * ahead of `vite:vue`'s — Vite orders plugins by `enforce` first, so a copy placed after the Vue
 * plugin still ran first (measured by the review that replaced an array-order pin here). A `pre`
 * flag dropped from the plugin, or a registered object that lost it, would hand the hook compiled
 * output instead of the SFC; `no-ssr-sfc.test.ts` pins the flag on a fresh `noSsrSfc()`, this
 * pins it on the one the suite config actually registers.
 */
describe('the SSR-SFC refusal, in the suite config', () => {
	it('is registered with the pre flag that orders it ahead of the Vue plugin', () => {
		const registered = registeredPlugins(vitestConfig).find((plugin) => plugin.name === 'rp:no-ssr-sfc');

		expect(registered).toBeDefined();
		expect(registered?.enforce).toBe('pre');
	});
});

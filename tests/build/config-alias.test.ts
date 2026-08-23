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

		expect(target).toMatch(/obsidian-mock\.ts$/);
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
const pluginNames = (config: { plugins?: unknown }): string[] =>
	(Array.isArray(config.plugins) ? config.plugins.flat(Infinity) : [])
		.map((plugin) => (typeof plugin === 'object' && plugin !== null && 'name' in plugin ? String(plugin.name) : ''))
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

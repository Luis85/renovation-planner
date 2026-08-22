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

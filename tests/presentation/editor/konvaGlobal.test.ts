/**
 * @vitest-environment jsdom
 *
 * Konva puts ITSELF on `window` at module scope, once per plugin load, and warns on
 * `console.error` when it finds one already there. Deactivating and reactivating the plugin
 * did exactly that — reported from a real vault — because nothing took the global back off.
 *
 * Driven against `window` rather than against Konva: what the plugin owns is the claim and
 * the release, and a test that imported Konva would be asserting on upstream's module scope
 * instead of on this plugin's cleanup.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { claimKonvaGlobal } from '../../../src/presentation/editor/scene/konvaGlobal';

const host = window as unknown as Record<string, unknown>;

/** What Konva's own `_injectGlobal` does, minus the console line. */
function injectGlobal(instance: unknown): void {
	host['Konva'] = instance;
}

afterEach(() => {
	delete host['Konva'];
});

describe('the global Konva installs on window', () => {
	it('releases the global this load claimed', () => {
		injectGlobal({ version: 'ours' });

		const release = claimKonvaGlobal();
		expect(host['Konva']).toBeDefined();
		release();

		// GONE, not undefined-valued: Konva's check is `typeof glob.Konva !== 'undefined'`,
		// which a leftover key holding `undefined` would also pass — but `in` would not, and
		// a half-removed global is the kind of thing that reads as fixed while leaking.
		expect('Konva' in host).toBe(false);
	});

	/**
	 * The reason the release is conditional. Another plugin that also bundles Konva
	 * overwrites this global when IT loads; unloading afterwards must not take away
	 * something we no longer own.
	 */
	it('leaves a global another load has since replaced alone', () => {
		injectGlobal({ version: 'ours' });
		const release = claimKonvaGlobal();

		injectGlobal({ version: 'someone else' });
		release();

		expect(host['Konva']).toEqual({ version: 'someone else' });
	});

	/** Nothing to claim — the honest answer is a disposer that does nothing. */
	it('answers a no-op when no global was installed', () => {
		const release = claimKonvaGlobal();

		expect(() => release()).not.toThrow();
		expect('Konva' in host).toBe(false);
	});

	/**
	 * The symptom the user saw, reproduced through Konva's own condition: a second load
	 * finds no global left behind, so `_injectGlobal` has nothing to complain about.
	 */
	it('leaves a second load with nothing to warn about', () => {
		injectGlobal({ version: 'first load' });
		const release = claimKonvaGlobal();
		release();

		expect(typeof host['Konva'] !== 'undefined').toBe(false);
	});
});

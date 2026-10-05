/**
 * @vitest-environment jsdom
 *
 * Vue pushes a setter onto `__VUE_INSTANCE_SETTERS__` and `__VUE_SSR_SETTERS__` at module scope,
 * once per plugin load, and the lists are shared with every other Vue-bundling plugin.
 *
 * A reload is SIMULATED by planting a fresh entry before each load, because that is what
 * re-evaluating `main.js` does and what a test file cannot: its Vue is imported once. Planting
 * also keeps the worker's real Vue setter out of reach — releasing THAT would break every later
 * mount in this file, which is the hazard `vueGlobals.ts` gates against.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, onUnmounted } from 'vue';
import { claimVueGlobals, trackVueApp } from '../../../src/presentation/views/vueGlobals';
import { installObsidianDom } from '../../helpers/dom';
import { loadedPlugin, openViewOnLeaf } from '../../helpers/plugin';
import { RENOVATION_PROJECT_VIEW } from '../../../src/presentation/views/RenovationProjectView';

const KEYS = ['__VUE_INSTANCE_SETTERS__', '__VUE_SSR_SETTERS__'] as const;
const host = window as unknown as Record<string, unknown[] | undefined>;

/** What `registerGlobalSetter` does for one load; answers the entries it pushed. */
function evaluateBundle(name: string): (() => void)[] {
	return KEYS.map((key) => {
		const entry = Object.defineProperty(() => undefined, 'name', { value: name });
		(host[key] ??= []).push(entry);
		return entry;
	});
}

const lengths = (): number[] => KEYS.map((key) => host[key]?.length ?? 0);
const holds = (entries: unknown[]): boolean[] => KEYS.map((key, i) => host[key]?.includes(entries[i]) ?? false);

/** Each list as Vue's own import left it: the ARRAY, which Vue's closure holds, and its entries. */
let baseline: { list: unknown[]; entries: unknown[] }[];

beforeEach(() => {
	installObsidianDom();
	baseline = KEYS.map((key) => {
		const list = host[key] ?? [];
		return { list, entries: [...list] };
	});
});

afterEach(() => {
	// Restored IN PLACE and re-attached, whatever a case planted, released or deleted: a copy
	// would leave Vue's closure pushing into an array `window` no longer holds.
	KEYS.forEach((key, i) => {
		const { list, entries } = baseline[i];
		list.splice(0, list.length, ...entries);
		host[key] = list;
	});
});

describe('the setters Vue pushes onto window', () => {
	/** Or every case below plants on a `window` Vue never writes to, and proves nothing. */
	it('reads the lists where Vue\'s own import put them', () => {
		expect(baseline.map(({ entries }) => entries.length)).toEqual([1, 1]);
	});

	it('takes this load\'s entries off on unload, leaving another plugin\'s', async () => {
		const foreign = evaluateBundle('another plugin');
		const ours = evaluateBundle('this load');
		const before = lengths();
		const { plugin } = await loadedPlugin();

		plugin.onunload();

		expect(holds(ours)).toEqual([false, false]);
		expect(holds(foreign)).toEqual([true, true]);
		expect(lengths()).toEqual(before.map((n) => n - 1));
	});

	it('does not grow across two disables and re-enables', async () => {
		const before = lengths();
		for (const load of ['first', 'second']) {
			evaluateBundle(load);
			const { plugin } = await loadedPlugin();
			plugin.onunload();
		}
		expect(lengths()).toEqual(before);
	});

	/** The gate driven through a view the plugin's own factory built, not a bare app. */
	it('holds the release while a view is open and lets it go when the view closes', async () => {
		const ours = evaluateBundle('this load');
		const loaded = await loadedPlugin();
		const { view } = await openViewOnLeaf(loaded.plugin, loaded.workspace, RENOVATION_PROJECT_VIEW);

		loaded.plugin.onunload();
		expect(holds(ours)).toEqual([true, true]);

		await (view as unknown as { onClose: () => Promise<void> }).onClose();
		expect(holds(ours)).toEqual([false, false]);
	});

	it('answers a no-op when no list was there to claim', () => {
		KEYS.forEach((key) => delete host[key]);

		claimVueGlobals()();

		expect(KEYS.map((key) => key in host)).toEqual([false, false]);
	});

	it('deletes a list it emptied rather than leaving an empty array behind', () => {
		KEYS.forEach((key) => delete host[key]);
		evaluateBundle('alone');

		claimVueGlobals()();

		expect(KEYS.map((key) => key in host)).toEqual([false, false]);
	});

	it('leaves an entry another load has since removed alone', () => {
		const ours = evaluateBundle('this load');
		const release = claimVueGlobals();
		KEYS.forEach((key, i) => host[key]?.splice(host[key].indexOf(ours[i]), 1));
		const before = lengths();

		release();

		expect(lengths()).toEqual(before);
	});

	/**
	 * The ordering hazard: Vue calls the setters from every lifecycle hook, unmount's own
	 * included, so the release waits until the last of this load's apps has finished unmounting.
	 */
	it('waits for a still-mounted app to finish unmounting', async () => {
		const ours = evaluateBundle('this load');
		const settersSeenByHook: boolean[] = [];
		const app = createApp(
			defineComponent({
				setup() {
					onUnmounted(() => settersSeenByHook.push(...holds(ours)));
					return () => h('div');
				},
			}),
		);
		trackVueApp(app);
		app.mount(document.createElement('div'));

		claimVueGlobals()();
		expect(holds(ours)).toEqual([true, true]);

		app.unmount();
		expect(settersSeenByHook).toEqual([true, true]);
		await Promise.resolve();
		expect(holds(ours)).toEqual([false, false]);
	});
});

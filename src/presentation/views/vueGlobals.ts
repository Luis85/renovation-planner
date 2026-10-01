import type { App } from 'vue';

/**
 * Vue installs itself on `window` too, and this is how the plugin takes its entries back off —
 * `konvaGlobal.ts`'s `claimKonvaGlobal` is the same release for Konva.
 *
 * `@vue/runtime-core` registers two setters at MODULE SCOPE, read from the built bundle:
 *
 * ```js
 * const registerGlobalSetter = (key, setter) => {
 *   let setters;
 *   if (!(setters = g[key])) setters = g[key] = [];
 *   setters.push(setter);
 *   return (v) => { if (setters.length > 1) setters.forEach((set) => set(v)); else setters[0](v); };
 * };
 * ```
 *
 * once for `__VUE_INSTANCE_SETTERS__` and once for `__VUE_SSR_SETTERS__`. Obsidian evaluates
 * `main.js` on every load, so every load pushes one more setter onto each list and nothing took
 * one off: each setter closes over its own load's module scope, so a disable and re-enable kept
 * every previous load's whole bundle reachable from `window`. The lists are SHARED with every
 * other Vue-bundling plugin, so only this load's entry may go — by identity, never by position.
 *
 * **Not before every app of this load has unmounted**, and that is why the release is gated
 * rather than run straight from `onunload`. The function above calls `setters[0]` when it holds
 * one entry, so this load's Vue running after its entry left would THROW (`setters[0] is not a
 * function`) with the list empty, or — with exactly one foreign entry left — write this load's
 * component instance into ANOTHER plugin's Vue. Vue calls that function from every lifecycle
 * hook, unmount's included. Obsidian 1.13.7 was measured closing the Plan Editor before
 * `onunload`; every other pane, version and mobile is unmeasured, and the suite drives a view
 * still mounted after it (`unloadWithViewOpen.test.ts`). So a view still mounted when the plugin
 * unloads defers the release to its own unmount.
 *
 * `__VUE__` is left: it is the boolean `true`, which retains nothing, and every Vue copy writes
 * the same value, so whether it is still this load's is not a question anything can answer.
 */

/** The two lists `registerGlobalSetter` pushes onto, named once so claim and release agree. */
const SETTER_LISTS = ['__VUE_INSTANCE_SETTERS__', '__VUE_SSR_SETTERS__'] as const;

/** `window` and not `globalThis`, for `konvaGlobal.ts`'s reason. */
const host = window as unknown as Record<string, unknown>;

/** This load's Vue apps that have mounted and not yet unmounted. */
const live = new Set<App>();

/** The release `onunload` asked for while an app was still mounted. */
let pending: (() => void) | null = null;

function settle(): void {
	if (live.size > 0 || !pending) return;
	const release = pending;
	pending = null;
	release();
}

/**
 * Count `app` as live until it unmounts. Called at every `createApp` site, beside
 * `nextAppIdPrefix()`.
 *
 * A microtask rather than the `onUnmount` callback itself: Vue runs those cleanups BEFORE it
 * tears the tree down, and the teardown's own `onBeforeUnmount`/`onUnmounted` hooks still call
 * the setters. `unmount()` is synchronous, so the microtask runs after all of it.
 */
export function trackVueApp(app: App): void {
	live.add(app);
	app.onUnmount(() => {
		live.delete(app);
		queueMicrotask(settle);
	});
}

/**
 * Claim the setters importing this bundle pushed, and answer the function that releases them.
 *
 * Claimed at load, as Konva's global is: Vue's module scope has already run by the time Obsidian
 * calls `onload`, so the LAST entry of each list is this load's. A list that is absent, or an
 * entry another load has since removed, is left alone.
 */
export function claimVueGlobals(): () => void {
	const claimed = SETTER_LISTS.map((key) => [key, (host[key] as unknown[] | undefined)?.at(-1)] as const);
	return () => {
		pending = () => {
			for (const [key, entry] of claimed) {
				const list = host[key] as unknown[] | undefined;
				const at = list?.indexOf(entry) ?? -1;
				if (!list || at < 0) continue;
				list.splice(at, 1);
				if (list.length === 0) delete host[key];
			}
		};
		settle();
	};
}

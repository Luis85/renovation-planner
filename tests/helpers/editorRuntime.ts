import { EDITOR_RUNTIME, type EditorRuntime } from '../../src/presentation/editor/runtime';

/**
 * The `EditorRuntime` a mounted Plan Editor provided, reached through Vue's own provides map.
 *
 * **Its own module rather than a function in `tests/helpers/editor.ts`, for exactly the reason
 * `settle.ts` and `planFixtures.ts`'s `fakeQueries` are**: that file imports Konva, Pinia,
 * `@vue/test-utils` and the native canvas binding, and `tests/harness/planEditor.ts` runs in the
 * BROWSER bundle and may import none of them. This file imports one symbol from `src/`. The
 * jsdom door (`runtimeOf`) stays in `editor.ts` and re-exports what is here, so there is one
 * lookup rather than two that can drift onto different keys.
 *
 * The cast is what `PlanEditorView.root` being private costs: `mount` is
 * `createApp(PlanEditorRoot)` and keeps what `app.mount(host)` answered there, which is the root
 * component's public instance proxy — the same kind of object `wrapper.vm` is.
 */
export function runtimeInProxy(proxy: unknown): EditorRuntime {
	const instance = (proxy as { $: { provides: Record<symbol, unknown> } }).$;
	const runtime = instance.provides[EDITOR_RUNTIME as unknown as symbol];
	if (runtime === undefined) {
		throw new Error('expected the mounted tree to have provided an EditorRuntime');
	}
	return runtime as EditorRuntime;
}

/** The runtime of a Plan Editor the PLUGIN (or the browser harness) mounted. */
export function runtimeOfPluginView(view: unknown): EditorRuntime {
	return runtimeInProxy((view as { root: unknown }).root);
}

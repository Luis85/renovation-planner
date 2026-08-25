// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, inject, onBeforeUnmount, onMounted, ref, resolveComponent } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import VueKonva from 'vue-konva';
import type { HarnessEntry } from './entries';
import type * as EntriesModule from './entries';
import { harnessEditorContext, seedFixture } from './fixture';
import EmptyLayer from '../../src/presentation/editor/layers/EmptyLayer.vue';
import { PLAN_EDITOR_CONTEXT } from '../../src/presentation/editor/PlanEditorContext';
import { installEditorEnvironment, settle as flushAsync, settleUntil } from '../helpers/editor';

/**
 * CRITERION 8 — "an entry that throws names itself in the index rather than blanking the page,
 * and an empty prototypes tree still lists the components" — and the two mechanisms the whole
 * feature's honesty rests on.
 *
 * There was no committed check for any of it. The brief prescribed `IndexPage.vue` verbatim and
 * prescribed no test, because its Step 7 was a LOOK in a browser; that look was unavailable to
 * the session that built this, so the criterion's only check was gone before the file existed.
 * `IndexPage.vue` is a hundred lines of stated invariants, and not one of them failed anything
 * if deleted. `CLAUDE.md`: an invariant asserted in a comment gets a test that fails without it.
 *
 * **The assertion that matters most in every failure case is that `data-entry` is ABSENT.** It
 * is what `scripts/harness-shot.mjs` waits for, and the actor it exists for cannot see that a
 * screenshot is empty. A page that says "failed" while still advertising readiness is worse
 * than one that says nothing, because it is photographed and reported as a success.
 *
 * Three of these cases drive a REAL source of a Vue warning — `EmptyLayer` mounted bare, a real
 * `resolveComponent` miss, and `EmptyLayer` handed a prop of the WRONG TYPE — rather than a
 * component written to emit a string. That mattered twice over. It is what turned up the hole
 * that made `IndexPage.vue` classify by "every Vue warning is a defect" instead of by an
 * allowlist: the allowlist named the missing prop and the unresolved tag, and a wrong prop TYPE
 * warned, threw nothing, resolved `<Suspense>` and would have been photographed as a success.
 * And it is what keeps these cases about Vue's behaviour rather than about a string this file
 * chose — a hand-rolled emitter would pass whatever Vue actually does.
 *
 * The entry lists are mocked and the components are real. `import.meta.glob` is what discovery
 * uses in a browser, and it cannot produce a module that REJECTS or a component that throws —
 * which is every case here. `entries.test.ts` covers the derivation the glob feeds; Task 7
 * closes the glob's own pattern against the tree.
 */
const state = vi.hoisted(() => ({
	prototypes: [] as HarnessEntry[],
	components: [] as HarnessEntry[],
}));

vi.mock('./entries', () => ({
	prototypeEntries: () => state.prototypes,
	componentEntries: () => state.components,
}));

// Imported AFTER the mock so the glob module it names is the stub. The import itself is
// hoisted by the transform; `vi.mock` is hoisted above it, which is what makes this work.
const { default: IndexPage } = await import('./IndexPage.vue');

function entryFor(id: string, component: () => Promise<unknown>): HarnessEntry {
	return {
		id,
		label: id.split(/[:/]/).pop() ?? id,
		kind: id.startsWith('prototype:') ? 'prototype' : 'component',
		component,
	};
}

/** A module the way `import.meta.glob` hands one over: the component under `default`. */
const moduleOf = (component: unknown) => () => Promise.resolve({ default: component });

/** What the stage is advertising as READY, which is `undefined` when it advertises nothing. */
const stageEntry = (wrapper: VueWrapper): string | undefined =>
	wrapper.find('.rp-harness-stage').attributes('data-entry');

/**
 * Mount the index at a URL, the way the page is reached. `?entry=` is read in `setup()`, so it
 * has to be on `window.location` BEFORE the mount rather than after it.
 *
 * `seedFixture()` and `PLAN_EDITOR_CONTEXT` mirror the app config `page.ts` gives the index in
 * production — Pinia and the editor context alongside `VueKonva` — so a REAL component reading
 * a store or `usePlanEditorContext()` mounts into the thing being asserted about rather than a
 * lighter stand-in that only the fake entries in this file happened not to need. Harmless to
 * every existing case here: none of the fakes below read a store or inject the context, and
 * `seedFixture()`'s `setActivePinia` call only matters to a component that calls
 * `useProjectStore()`/`useEditorStore()`, which none of them do.
 */
async function openIndex(query: string): Promise<VueWrapper> {
	window.history.replaceState({}, '', query === '' ? '/' : `/?${query}`);

	const host = document.createElement('div');

	document.body.appendChild(host);

	const wrapper = mount(IndexPage, {
		attachTo: host,
		global: {
			plugins: [seedFixture(), VueKonva],
			provide: { [PLAN_EDITOR_CONTEXT as symbol]: harnessEditorContext() },
		},
	});

	await flushAsync();

	return wrapper;
}

/**
 * The REAL discovery, bypassing the mock above. `./entries` is mocked file-wide for this file
 * — `vi.mock` above has no per-test opt-out — and the mock is a deliberate pass-through
 * (`() => state.prototypes` / `() => state.components`), so pointing `state` at what the ACTUAL
 * glob returns (via `vi.importActual`, which reads past the mock) makes `IndexPage` render the
 * real tree through the exact same mounting path every other case in this file uses, rather
 * than a second one built to bypass it.
 */
const real = await vi.importActual<typeof EntriesModule>('./entries');

/**
 * Opens one entry through the index the way a designer actually would — by id, with the REAL
 * `prototypeEntries()`/`componentEntries()` behind it — for the rendered-document case below.
 * Reuses `openIndex` rather than mounting a second way, and overwrites `state` only for the
 * duration of this one open; `beforeEach` puts the fixtures back before the next test.
 *
 * `openIndex`'s own `settle()` is a FIXED four microtasks and one macrotask, tuned for the
 * fixtures elsewhere in this file — `component: () => Promise.resolve({ default: … })`, which
 * resolves in one microtask. A real entry's `component()` is a genuine dynamic `import()`
 * through the module runner, real I/O whose duration this file does not control, and the fixed
 * wait is not long enough for it: measured against the first real prototype tried here, the
 * stage was still showing "Pick an entry." after `openIndex` returned. So this waits for the
 * OUTCOME instead of a tick count — either the stage names what it rendered, or the entry
 * reported a failure — which is `settleUntil`, already built for exactly this shape of race
 * (`tests/helpers/editor.ts`, written for a real image decode).
 */
async function openEntryInIndex(id: string): Promise<VueWrapper> {
	state.prototypes = real.prototypeEntries();
	state.components = real.componentEntries();

	const wrapper = await openIndex(`entry=${encodeURIComponent(id)}`);

	await settleUntil(
		() =>
			wrapper.find('.rp-harness-stage').attributes('data-entry') !== undefined ||
			wrapper.find('.rp-harness-failure').exists(),
		`${id} to settle`,
	);

	return wrapper;
}

/** A component that throws while rendering — the half a try/catch around the import cannot see. */
const Exploding = defineComponent({
	setup() {
		return () => {
			throw new Error('boom');
		};
	},
});

/** A tag that resolves to nothing, which is what an unregistered `<StatusBar />` produces. */
const Unresolved = defineComponent({
	setup: () => () => h(resolveComponent('NoSuchComponent') as string),
});

/**
 * EVERY required prop present, and one of them the WRONG TYPE — the case an allowlist written
 * from "missing prop" and "unresolved tag" does not see. `EmptyLayer`'s `transform` is an
 * object; a string passes Vue's `required` check and fails its type check, and Vue only WARNS.
 * Nothing throws either: the template spreads `...props.transform`, and spreading a string is
 * legal, so `onErrorCaptured` never fires. The entry draws malformed and the stage would be
 * marked ready.
 *
 * The wrong prop goes to the REAL component, so the warning is Vue's own rather than a string
 * this file wrote down — the same reason the two cases above drive `EmptyLayer` bare and a real
 * `resolveComponent` miss.
 */
const WrongPropType = defineComponent({
	setup: () => () => h(EmptyLayer, { layerId: 'zone', transform: 'bad' as never, visible: true }),
});

/**
 * A clean first render whose subtree grows a defective child later — the shape
 * `tests/helpers/editor.ts` records for `PlanEditorRoot`, which mounts `PlanCanvas` a promise
 * tick after mount whenever the store is not pre-seeded. Driven from outside so the two phases
 * can be observed separately rather than raced.
 */
const lateDefect = ref(false);
const GrowsADefect = defineComponent({
	setup: () => () => (lateDefect.value ? h(EmptyLayer) : h('p', 'clean')),
});

/**
 * An entry whose ASYNC lifecycle hook rejects, on a gate this file opens — so "after the user
 * navigated away" is a sequence rather than a race. Vue wraps lifecycle hooks in
 * `callWithAsyncErrorHandling`, so the rejection is routed through the error channel exactly as a
 * synchronous render throw is, just later: after the entry has been unmounted and replaced.
 */
const lateFailureGates: Array<() => void> = [];

/**
 * Release ONE mount's gate, oldest first — `releaseLateFailure(0)` is the first mount of the
 * entry, whatever has been mounted since.
 *
 * One gate per MOUNT rather than one per module, because the A -> B -> A case below mounts the
 * same entry twice: a single module-level variable is overwritten by the second `setup()`, so
 * "release the gate" released the wrong one and the first mount stayed pending forever.
 */
function releaseLateFailure(which = 0): void {
	lateFailureGates[which]?.();
}

const FailsAfterYouLeave = defineComponent({
	setup() {
		const gate = new Promise<void>((resolve) => {
			lateFailureGates.push(resolve);
		});

		onMounted(async () => {
			await gate;
			throw new Error('late failure from the entry you left');
		});

		return () => h('p', 'the entry you are about to leave');
	},
});

const StillHere = defineComponent({ setup: () => () => h('p', 'the entry you moved to') });

const Abandoned = defineComponent({ setup: () => () => h('p', 'the entry you abandoned') });

/**
 * Module loads this file finishes by hand, oldest first — one per CALL of `entry.component()`,
 * which is what `open()` awaits and what the generation guard sits on the far side of.
 */
const gatedModules: Array<{ resolve: (module: { default: unknown }) => void; reject: (error: Error) => void }> = [];

/** An entry whose module arrives when this file says so, and not before. */
function gatedModule(): () => Promise<unknown> {
	return () =>
		new Promise((resolve, reject) => {
			gatedModules.push({ resolve, reject });
		});
}

/**
 * An entry that raises a Vue warning while it is being TORN DOWN. A real warning from real Vue
 * API use — `inject` of a key nothing provides answers `injection "…" not found.` — rather than a
 * hand-rolled string, for the reason every other case here does the same. The particular misuse
 * is a stand-in: what is under test is who OWNS `renderDefects` when two entries overlap, not
 * which warning got into it.
 */
const WarnsWhileUnmounting = defineComponent({
	setup() {
		onBeforeUnmount(() => {
			inject('a-provide-that-does-not-exist');
		});

		return () => h('p', 'the entry that complains on the way out');
	},
});

/**
 * The warning channel's twin of `FailsAfterYouLeave`: an entry that raises a Vue warning from an
 * async lifecycle continuation, on a gate this file opens, once its own instance is long gone.
 * `inject()` outside a `setup()` is a real Vue misuse with a real Vue warning
 * (`inject() can only be used inside setup()…`) rather than a string written down here.
 *
 * One gate per MOUNT, for the reason `lateFailureGates` gives.
 */
const lateWarningGates: Array<() => void> = [];

const WarnsAfterYouLeave = defineComponent({
	setup() {
		const gate = new Promise<void>((resolve) => {
			lateWarningGates.push(resolve);
		});

		onMounted(async () => {
			await gate;
			inject('a-provide-that-does-not-exist');
		});

		return () => h('p', 'the entry that complains once you have gone');
	},
});

beforeEach(() => {
	installEditorEnvironment();
	document.body.replaceChildren();
	gatedModules.length = 0;
	lateFailureGates.length = 0;
	lateWarningGates.length = 0;
	lateDefect.value = false;
	state.prototypes = [];
	state.components = [
		entryFor('component:editor/shell/StatusBar', moduleOf(defineComponent({ setup: () => () => h('p', 'fine') }))),
		entryFor('component:views/ViewRoot', moduleOf(defineComponent({ setup: () => () => h('p', 'also fine') }))),
	];
});

describe('the harness index, with nothing to open', () => {
	it('lists the components even though the prototypes tree is empty', async () => {
		const wrapper = await openIndex('index');

		expect(wrapper.text()).toContain('No prototypes yet');
		expect(wrapper.findAll('nav li').map((li) => li.text())).toEqual([
			'StatusBarcomponent',
			'ViewRootcomponent',
		]);

		wrapper.unmount();
	});

	it('reports an `?entry=` that names nothing rather than opening the first one', async () => {
		const wrapper = await openIndex('entry=prototype:Nope');

		expect(wrapper.find('.rp-harness-failure').text()).toBe('no entry named prototype:Nope');
		expect(stageEntry(wrapper)).toBeUndefined();

		wrapper.unmount();
	});
});

describe('the harness index, opening an entry', () => {
	it('marks the stage with the id it actually rendered', async () => {
		const wrapper = await openIndex('entry=component:views/ViewRoot');

		expect(stageEntry(wrapper)).toBe('component:views/ViewRoot');
		expect(wrapper.find('.rp-harness-failure').exists()).toBe(false);

		wrapper.unmount();
	});

	it('names an entry whose module fails to import, and keeps the list', async () => {
		state.components = [entryFor('component:Broken', () => Promise.reject(new Error('no such module')))];

		const wrapper = await openIndex('entry=component:Broken');

		expect(wrapper.find('.rp-harness-failure').text()).toContain('component:Broken failed to load: no such module');
		// Criterion 8's "rather than blanking the page": the index is still navigable.
		expect(wrapper.findAll('nav li')).toHaveLength(1);
		expect(stageEntry(wrapper)).toBeUndefined();

		wrapper.unmount();
	});

	it('names an entry that throws while rendering, which the loader catch cannot see', async () => {
		state.components = [entryFor('component:Exploding', moduleOf(Exploding))];

		const wrapper = await openIndex('entry=component:Exploding');

		expect(wrapper.find('.rp-harness-failure').text()).toContain('component:Exploding failed to render: boom');
		expect(wrapper.findAll('nav li')).toHaveLength(1);
		expect(stageEntry(wrapper)).toBeUndefined();

		wrapper.unmount();
	});

	/**
	 * The LOADER await's guard — the fourth of the four `generation` names, and the one with no
	 * behavioural check until now. Its two arms fail differently, so both are driven here:
	 *
	 * - a stale RESOLVE draws the abandoned module under the open entry's name, which is why the
	 *   text on the stage is asserted and not just `data-entry`. `settle()` refuses to re-mark a
	 *   stage it no longer owns, so the marker keeps saying the entry the reader chose while the
	 *   picture underneath it is of the one they left — the exact capture-the-wrong-component
	 *   outcome, and one an assertion on the marker alone cannot see.
	 * - a stale REJECT replaces a page that is drawing perfectly with a card accusing an entry the
	 *   reader has already left.
	 *
	 * Two clicks in quick succession is the natural way in, but a race is not what this drives:
	 * the loads finish when this file says so, which makes the ordering a sequence rather than
	 * something to be lucky about.
	 */
	it('lets neither half of a stale entry load reach a page that has moved on', async () => {
		state.components = [
			entryFor('component:SlowToLoad', gatedModule()),
			entryFor('component:StillHere', moduleOf(StillHere)),
			entryFor('component:SlowToFail', gatedModule()),
		];

		const wrapper = await openIndex('entry=component:SlowToLoad');

		// Nothing is advertised while a module is still loading — a blank stage is the honest
		// picture, and the marker is what an eyeless capture waits for.
		expect(stageEntry(wrapper)).toBeUndefined();

		await wrapper.findAll('nav li a')[1].trigger('click');
		await flushAsync();

		expect(stageEntry(wrapper)).toBe('component:StillHere');

		// The abandoned module finally arrives.
		gatedModules[0].resolve({ default: Abandoned });
		await flushAsync();

		expect(stageEntry(wrapper)).toBe('component:StillHere');
		expect(wrapper.find('.rp-harness-stage').text()).toContain('the entry you moved to');
		expect(wrapper.find('.rp-harness-stage').text()).not.toContain('abandoned');

		// The other arm, and back to the entry the reader is already on: two mounts, one id.
		await wrapper.findAll('nav li a')[2].trigger('click');
		await flushAsync();
		await wrapper.findAll('nav li a')[1].trigger('click');
		await flushAsync();

		expect(stageEntry(wrapper)).toBe('component:StillHere');

		gatedModules[1].reject(new Error('no such module'));
		await flushAsync();

		expect(stageEntry(wrapper)).toBe('component:StillHere');
		expect(wrapper.find('.rp-harness-failure').exists()).toBe(false);

		wrapper.unmount();
	});
});

describe('the harness index, refusing to advertise a hole', () => {
	it('treats a real component missing its required props as a failure, not a render', async () => {
		state.components = [entryFor('component:editor/layers/EmptyLayer', moduleOf(EmptyLayer))];

		const wrapper = await openIndex('entry=component:editor/layers/EmptyLayer');

		// The wording is VUE's, taken from a real component with real `required` props rather
		// than written down here — which is the whole point: reword it upstream and this reds.
		expect(wrapper.find('.rp-harness-failure').text()).toContain('did not render cleanly');
		expect(wrapper.find('.rp-harness-failure').text()).toContain('Missing required prop');
		expect(stageEntry(wrapper)).toBeUndefined();

		wrapper.unmount();
	});

	it('treats a prop of the wrong type as a failure, not a render', async () => {
		state.components = [entryFor('component:WrongPropType', moduleOf(WrongPropType))];

		const wrapper = await openIndex('entry=component:WrongPropType');

		expect(wrapper.find('.rp-harness-failure').text()).toContain('did not render cleanly');
		expect(wrapper.find('.rp-harness-failure').text()).toContain('Invalid prop');
		expect(stageEntry(wrapper)).toBeUndefined();

		wrapper.unmount();
	});

	it('treats a tag that resolves to nothing as a failure, not a render', async () => {
		state.components = [entryFor('component:Unresolved', moduleOf(Unresolved))];

		const wrapper = await openIndex('entry=component:Unresolved');

		expect(wrapper.find('.rp-harness-failure').text()).toContain('Failed to resolve component');
		expect(stageEntry(wrapper)).toBeUndefined();

		wrapper.unmount();
	});

	/**
	 * The THIRD asynchronous path, after the loader await and the Suspense resolve — and the only
	 * one with no guard until now. Vue delivers a rejection to the capture hook even though the
	 * instance that raised it is already unmounted, and a hook that reads the CURRENT `renderedId`
	 * blames whatever is on screen. The consequence is the worst this page can produce: a working
	 * entry pulled off the stage and replaced by a card accusing it, for a fault in an entry the
	 * user has already left.
	 *
	 * Both halves are asserted, because either alone is satisfiable by doing the wrong thing. The
	 * open entry must be left ALONE — a test that only checked "no failure card" would pass against
	 * a page that swallowed the error entirely. And the stale failure must still reach the ONE
	 * channel an eyeless agent reads, `console.error`, which `scripts/harness-shot.mjs` records and
	 * exits non-zero on — a test that only checked the stage would pass against a silent drop,
	 * which is the green-signal-that-means-nothing this whole page exists to refuse.
	 */
	it('does not blame the open entry for a failure the previous one left behind', async () => {
		state.components = [
			entryFor('component:LeftBehind', moduleOf(FailsAfterYouLeave)),
			entryFor('component:StillHere', moduleOf(StillHere)),
		];

		const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const wrapper = await openIndex('entry=component:LeftBehind');

		expect(stageEntry(wrapper)).toBe('component:LeftBehind');

		// The navigation, through the link the page actually offers.
		await wrapper.findAll('nav li a')[1].trigger('click');
		await flushAsync();

		expect(stageEntry(wrapper)).toBe('component:StillHere');

		// Only now does the entry the user left finally fail.
		releaseLateFailure();
		await flushAsync();

		expect(stageEntry(wrapper)).toBe('component:StillHere');
		expect(wrapper.find('.rp-harness-failure').exists()).toBe(false);
		expect(errors.mock.calls.flat().join(' ')).toContain('component:LeftBehind');

		errors.mockRestore();
		wrapper.unmount();
	});

	/**
	 * The same stale failure, with the reader coming BACK — A -> B -> A, which is the case an
	 * attribution keyed on the entry ID cannot answer at all.
	 *
	 * Two mounts of one entry share an id, so `EntryBoundary`'s snapshot of it identifies the
	 * ENTRY and not the MOUNT: the first A's boundary reports `component:ComesBackClean`, the
	 * second A is on the stage under the same name, and an id comparison reads them as the same
	 * thing. The consequence is the one the whole apparatus exists to prevent, reached by a route
	 * the previous case cannot: a healthy, correctly rendered entry pulled off the stage and
	 * accused, for a fault in a mount the reader already left.
	 *
	 * Both halves again, for the reason the case above states: left alone on the stage, and still
	 * loud in `console.error`, which is the one channel an eyeless `harness-shot` records. The
	 * error text is asserted rather than just the id — the id is the same for both mounts here, so
	 * "names the entry" would be satisfied by a message about the wrong one.
	 */
	it('does not blame a second mount of an entry for the first mount it left behind', async () => {
		state.components = [
			entryFor('component:ComesBackClean', moduleOf(FailsAfterYouLeave)),
			entryFor('component:StillHere', moduleOf(StillHere)),
		];

		const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const wrapper = await openIndex('entry=component:ComesBackClean');

		expect(stageEntry(wrapper)).toBe('component:ComesBackClean');

		await wrapper.findAll('nav li a')[1].trigger('click');
		await flushAsync();
		// Back to the entry just left, which mounts it a SECOND time under the same id.
		await wrapper.findAll('nav li a')[0].trigger('click');
		await flushAsync();

		expect(stageEntry(wrapper)).toBe('component:ComesBackClean');

		// The FIRST mount's gate, not the second's — the second is the one on the stage.
		releaseLateFailure(0);
		await flushAsync();

		expect(stageEntry(wrapper)).toBe('component:ComesBackClean');
		expect(wrapper.find('.rp-harness-failure').exists()).toBe(false);
		expect(errors.mock.calls.flat().join(' ')).toContain(
			'harness entry component:ComesBackClean failed after the page moved on',
		);

		errors.mockRestore();
		wrapper.unmount();
	});

	/**
	 * The twin of the case above, in the channel a per-entry boundary cannot reach: Vue has exactly
	 * ONE `config.warnHandler` per app, so `renderDefects` is a single shared array and a warning
	 * raised while entry A tears down lands in it after `open(B)` has already emptied it.
	 *
	 * The ordering is not a coincidence to be lucky about, it is the NORMAL one: `open()` clears
	 * the array and sets `openComponent` to null synchronously, which only QUEUES Vue's re-render;
	 * the flush that actually unmounts A runs on the microtask queue, ahead of the module await
	 * resuming. So A's teardown warning is reliably in the array by the time B's `<Suspense>`
	 * resolves and `settle()` reads it.
	 */
	it('does not blame the open entry for a warning the previous one raised on its way out', async () => {
		state.components = [
			entryFor('component:WarnsOnUnmount', moduleOf(WarnsWhileUnmounting)),
			entryFor('component:StillHere', moduleOf(StillHere)),
		];

		const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const wrapper = await openIndex('entry=component:WarnsOnUnmount');

		expect(stageEntry(wrapper)).toBe('component:WarnsOnUnmount');

		await wrapper.findAll('nav li a')[1].trigger('click');
		await flushAsync();

		expect(stageEntry(wrapper)).toBe('component:StillHere');
		expect(wrapper.find('.rp-harness-failure').exists()).toBe(false);
		expect(errors.mock.calls.flat().join(' ')).toContain('component:WarnsOnUnmount');

		errors.mockRestore();
		wrapper.unmount();
	});

	/**
	 * A -> B -> A in the WARNING channel, which an external review round reported as the same
	 * defect one channel over — and it is NOT reachable, for a reason that belongs to Vue rather
	 * than to `IndexPage.vue`. This case is what measured that, and what keeps the sentence beside
	 * the `warnHandler` guard honest if Vue ever changes its mind.
	 *
	 * The first A raises a real Vue warning from an async continuation, long after the second A is
	 * on the stage. Vue consults `config.warnHandler` only when its warning STACK is non-empty —
	 * the stack is pushed around a synchronous mount, patch or async-setup resolve — so a
	 * continuation resuming with its own instance already unmounted has no stack, and Vue sends the
	 * warning to `console.warn` itself.
	 *
	 * **The `[Vue warn]:` prefix is the whole discriminator, so it is asserted rather than the
	 * message alone.** Vue's own fallback writes that prefix; this page's handler chains through
	 * with the bare message and a trace argument. A prefixed, single-argument call is therefore
	 * proof that the warning HAPPENED and that the handler was never offered it — which is what
	 * separates "unreachable" from "the test failed to produce a warning at all", the way this
	 * whole file distrusts a green that could mean nothing.
	 */
	it('is never offered a warning raised by a mount the reader already left', async () => {
		state.components = [
			entryFor('component:ComesBackClean', moduleOf(WarnsAfterYouLeave)),
			entryFor('component:StillHere', moduleOf(StillHere)),
		];

		const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const warns = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const wrapper = await openIndex('entry=component:ComesBackClean');

		expect(stageEntry(wrapper)).toBe('component:ComesBackClean');

		await wrapper.findAll('nav li a')[1].trigger('click');
		await flushAsync();
		await wrapper.findAll('nav li a')[0].trigger('click');
		await flushAsync();

		expect(stageEntry(wrapper)).toBe('component:ComesBackClean');

		// The FIRST mount's gate, not the second's — the second is the one on the stage.
		lateWarningGates[0]?.();
		await flushAsync();

		// Vue's own console fallback, with Vue's own prefix and nothing else: the page's handler
		// neither collected this warning nor reported it stale, because it never ran.
		expect(warns.mock.calls).toEqual([
			['[Vue warn]: inject() can only be used inside setup() or functional components.'],
		]);
		expect(errors.mock.calls).toEqual([]);

		// And so the healthy second mount is left exactly where it was.
		expect(stageEntry(wrapper)).toBe('component:ComesBackClean');
		expect(wrapper.find('.rp-harness-failure').exists()).toBe(false);

		warns.mockRestore();
		errors.mockRestore();
		wrapper.unmount();
	});

	/**
	 * The one `settle()`'s single read cannot cover on its own, and it is why `reportLateDefect`
	 * exists. Both phases are asserted: the marker has to go ON for a subtree that resolved
	 * clean — otherwise this would pass against a page that never marks anything — and it has to
	 * come OFF once the hole appears.
	 */
	it('takes the marker back off when a defect arrives after the subtree resolved', async () => {
		state.components = [entryFor('component:GrowsADefect', moduleOf(GrowsADefect))];

		const wrapper = await openIndex('entry=component:GrowsADefect');

		expect(stageEntry(wrapper)).toBe('component:GrowsADefect');

		lateDefect.value = true;
		await flushAsync();

		expect(stageEntry(wrapper)).toBeUndefined();
		expect(wrapper.find('.rp-harness-failure').text()).toContain('component:GrowsADefect did not render cleanly');

		wrapper.unmount();
	});
});

/**
 * CRITERION 5's sixth route, and the one no source scan can see: a template can render a real
 * stylesheet `<link>` with no import and no build step at all.
 * `<component is="link" rel="stylesheet" href="…/concept.css" />` is valid Vue and produces a
 * genuine one, and `<component :is="tag">` with a computed value is not statically knowable
 * even in principle. `harness.test.ts`'s three cases all read SOURCE — the page's HTML, the
 * module graph, a sheet's own `@import`s — and none of them can see a node a render produces.
 *
 * So this asks the DOCUMENT instead, once an entry has mounted through the index — the only
 * place every route, thought of or not, converges on. **It does not replace the source scans**:
 * those catch a sheet in the edit loop, before anything runs, and they cover the whole of `src/`
 * and `tests/helpers/`, most of which nothing here ever mounts. This closes the category for the
 * entries a test actually drives; neither instrument subsumes the other, and the next reader
 * should not delete one for the other.
 *
 * Lives in THIS file rather than in `harness.test.ts` for a specific, measured reason: `./entries`
 * is mocked file-wide above (`vi.mock('./entries', …)`), and the whole point of the loop below is
 * to drive the REAL glob (`real`, via `vi.importActual`) rather than a fixture — a case that mounted
 * one hard-coded component, or that read the mocked `state`, would not exercise the route it
 * exists for. Mounting through `IndexPage` (`openEntryInIndex`, which reuses `openIndex` above)
 * rather than importing a component directly is what makes the check mean anything: the question
 * is what the PAGE ends up with, which is exactly what `open()`'s async pipeline and `<Suspense>`
 * decide — not what one component renders in isolation.
 */

/** Module scope because it captures nothing per-call; `unicorn/consistent-function-scoping`. */
const cssNodes = (): number => document.querySelectorAll('link[rel~=stylesheet i], style').length;

describe('the harness index, the one-sheet claim over the rendered document', () => {
	/**
	 * The control. It proves the mounting path and the counting work, so the loop below is not
	 * silently doing nothing while the prototypes tree is empty — a reader who finds an
	 * `it.each` with zero iterations and no control has no way to tell "covers nothing today"
	 * from "broken". A COMPONENT rather than a prototype, and deliberately so: it cannot exercise
	 * the `<component is="link">` route at all (nothing here composes one into it), which is
	 * exactly why the loop beneath it — over real PROTOTYPES — is not redundant with this one.
	 *
	 * **The `stageEntry` assertion is load-bearing, not decoration.** `openEntryInIndex` settles
	 * on EITHER the stage naming what it rendered OR a failure card — so an id that resolves to
	 * nothing, a module that fails to import, or one that throws would all still leave the CSS
	 * count unchanged and this test green, while silently proving nothing about a mount that
	 * actually happened. Asserting the id the stage actually rendered is what keeps this case
	 * failing when `component:editor/shell/StatusBar` stops resolving — a renamed file, a moved
	 * one, a broken glob — rather than degrading into "a failure card adds no stylesheet".
	 */
	it('adds no stylesheet to the document when a component mounts', async () => {
		const before = cssNodes();

		const page = await openEntryInIndex('component:editor/shell/StatusBar');

		expect(stageEntry(page)).toBe('component:editor/shell/StatusBar');
		expect(cssNodes()).toBe(before);

		page.unmount();
	});

	/**
	 * The real ones, from the real glob — EMPTY until Task 7 adds a first file under
	 * `src/prototypes/`. Task 5 runs before any prototype exists, so today this `it.each` has
	 * zero iterations and covers nothing; that is stated here rather than left for a reader to
	 * wonder about. The moment Task 7 lands `ZoneSummary.vue`, this starts covering it with NO
	 * EDIT to this file — `real.prototypeEntries()` re-globs at file-load time, which is the same
	 * "the tree is the registration" property the whole feature is built on, turned on its own
	 * guard.
	 */
	it.each(real.prototypeEntries())('adds no stylesheet when $id mounts', async ({ id }) => {
		const before = cssNodes();

		const page = await openEntryInIndex(id);

		expect(cssNodes()).toBe(before);

		page.unmount();
	});
});

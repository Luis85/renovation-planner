// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, inject, onBeforeUnmount, onMounted, onUnmounted, ref, resolveComponent } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import VueKonva from 'vue-konva';
import type { HarnessEntry } from './entries';
import type * as EntriesModule from './entries';
import { harnessEditorContext, seedFixture } from './fixture';
import EmptyLayer from '../../src/presentation/editor/layers/EmptyLayer.vue';
import { PLAN_EDITOR_CONTEXT } from '../../src/presentation/editor/PlanEditorContext';
import { installEditorEnvironment, settle as flushAsync, settleUntil } from '../helpers/editor';
import { useEditorStore } from '../../src/presentation/stores/EditorStore';
import { drawSchemeToggle } from './theme';
import { DEFAULT_VIEWPORT, screenPoint } from '../../src/presentation/editor/viewport/Viewport';

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
 * most cases here: `seedFixture()`'s `setActivePinia` call only matters to a component that
 * calls `useProjectStore()`/`useEditorStore()`, and most of the fakes below read no store and
 * inject no context. `PansTheCamera`/`ReadsTheCamera` (Finding A's regression) are the
 * deliberate exception — they exist specifically to call `useEditorStore()` against this same
 * Pinia, the way a real interaction does.
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
 * Finding A's pair — the same store call `PlanCanvas` makes on a real pointer drag
 * (`beginPan`/`continuePan`/`endPan`), so the mutation this drives is a real interaction
 * rather than a store field poked directly, and a component that only READS the store, the
 * way `StatusBar` does. Together they are the smallest real reproduction of "the second entry
 * draws against whatever the first one left behind": open the first, let it pan the camera,
 * open the second, and check what it sees.
 */
const PansTheCamera = defineComponent({
	setup() {
		const editor = useEditorStore();
		editor.beginPan(screenPoint(0, 0));
		editor.continuePan(screenPoint(120, 40));
		editor.endPan();

		return () => h('p', 'panned');
	},
});

const ReadsTheCamera = defineComponent({
	setup() {
		const editor = useEditorStore();

		return () => h('p', `pan:${editor.viewport.pan.x},${editor.viewport.pan.y}`);
	},
});

/**
 * Round 8's reproduction. Nothing under `src/presentation` mutates a store from an unmount
 * hook today (measured — `grep -rn "onUnmounted\|onBeforeUnmount" src/presentation` finds three
 * hits and none touches Pinia), so this is a component built to have the shape the fix guards
 * against: it mutates the editor store — the same `beginPan`/`continuePan`/`endPan` sequence
 * `PansTheCamera` uses on a real drag — from `onUnmounted`, which fires once Vue's reactive
 * flush actually tears this entry down rather than when `open()` merely queues that teardown.
 */
const PansOnUnmount = defineComponent({
	setup() {
		onUnmounted(() => {
			const editor = useEditorStore();
			editor.beginPan(screenPoint(0, 0));
			editor.continuePan(screenPoint(120, 40));
			editor.endPan();
		});

		return () => h('p', 'about to pan on the way out');
	},
});

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

	/**
	 * Round 8. `?entry=` with no value: `URLSearchParams.get('entry')` answers `''`, not `null`
	 * — measured — and `has('entry')` answers `true`, so `page.ts` routes here exactly as it
	 * would for a named entry. The truthiness check this used to fail on (`if (requested &&
	 * !initial)`) treated `''` the same as "no `entry` param at all" and suppressed the
	 * failure, leaving the stage showing "Pick an entry." with nothing open — the bad outcome
	 * for `harness-shot`, which would then sit through its whole timeout on a request the page
	 * knew was invalid at load. This is the same shape `resolveShots` in `scripts/entryShots.mjs`
	 * already refuses at the argv seam (Task 6 Minor 4); this is that shape at the URL seam.
	 */
	it('reports an `?entry=` with an empty name instead of showing the picker', async () => {
		const wrapper = await openIndex('entry=');

		expect(wrapper.find('.rp-harness-failure').text()).toBe('an entry was requested with an empty name');
		expect(stageEntry(wrapper)).toBeUndefined();

		wrapper.unmount();
	});
});

/**
 * Findings B and F, together — `.prevent` cancelled navigation and `open()` never touched
 * history, so a refreshed or copied URL opened the wrong screen; and a `hrefFor` built from
 * the id alone would have made that fix WORSE, replacing a correct `?index&theme=light` with
 * a lossy `?entry=…`. Both land on the Designer actor (`docs/actors/Designer.md`), which is
 * why neither had a gate watching it before this.
 */
describe('the harness index, the address bar following the opened entry', () => {
	it('updates the address bar with replaceState, not pushState, when an entry opens', async () => {
		const wrapper = await openIndex('index');
		const replace = vi.spyOn(window.history, 'replaceState');
		const push = vi.spyOn(window.history, 'pushState');

		await wrapper.findAll('nav li a')[0].trigger('click');
		await flushAsync();

		expect(new URLSearchParams(window.location.search).get('entry')).toBe(
			'component:editor/shell/StatusBar',
		);
		expect(replace).toHaveBeenCalled();
		// The index is one page; a back-button stack of every entry glanced at is not what a
		// designer wants — back should leave the harness, not walk backwards through it.
		expect(push).not.toHaveBeenCalled();

		replace.mockRestore();
		push.mockRestore();
		wrapper.unmount();
	});

	it('keeps `?theme` and `?phone` when the address bar follows a click, and drops `index`', async () => {
		const wrapper = await openIndex('index&theme=light&phone');

		await wrapper.findAll('nav li a')[0].trigger('click');
		await flushAsync();

		const after = new URLSearchParams(window.location.search);

		expect(after.get('entry')).toBe('component:editor/shell/StatusBar');
		expect(after.get('theme')).toBe('light');
		expect(after.has('phone')).toBe(true);
		expect(after.has('index')).toBe(false);

		wrapper.unmount();
	});

	/**
	 * Round 8. `hrefFor` clones `window.location.search`, so it is only ever as current as the
	 * URL — and until this round, `drawSchemeToggle` (`theme.ts`) never touched the URL at all,
	 * just a local `scheme` variable and the body classes. The divergence between the two was
	 * always there; it became CONSEQUENTIAL once `hrefFor` started faithfully propagating
	 * whatever the URL said, re-asserting a stale scheme instead of dropping it. The chosen
	 * remedy makes the URL the single source of truth `wantedScheme` already assumes at
	 * load — the toggle writes `theme` into it — rather than deriving links from the scheme on
	 * screen, which would leave two places stating the same fact.
	 *
	 * `hrefFor` itself is not reactive to a `history.replaceState` call — nothing here asserts
	 * that it magically re-runs on its own — so this drives it the way the page actually would:
	 * opening a different entry re-renders the whole list, `hrefFor` included, against
	 * whatever the URL says by then.
	 */
	it('carries the scheme the toggle switched to, once something re-renders the list', async () => {
		const wrapper = await openIndex('index');

		drawSchemeToggle();
		document.body.querySelector<HTMLElement>('.rp-harness-scheme')?.click();

		expect(new URLSearchParams(window.location.search).get('theme')).toBe('light');

		await wrapper.findAll('nav li a')[0].trigger('click');
		await flushAsync();

		const other = wrapper.findAll('nav li a')[1].element as HTMLAnchorElement;

		expect(new URLSearchParams(new URL(other.href).search).get('theme')).toBe('light');

		wrapper.unmount();
	});

	/**
	 * The modifier half. `.exact` on the click handler makes Vue skip BOTH the handler and
	 * `.prevent` together whenever a system modifier key is held (measured in
	 * `@vue/runtime-dom`'s `modifierGuards`/`withModifiers` — `exact`'s guard returns early
	 * before `prevent`'s runs), so a Cmd/Ctrl-click falls through to the anchor's own `href`
	 * and the browser's own new-tab behaviour, exactly as a plain anchor would. Both halves —
	 * modified and plain — are asserted, because either alone would pass against a handler
	 * that ran unconditionally: `event.defaultPrevented` is the direct, jsdom-visible signal
	 * that the handler did or did not run, which is why this is testable at all rather than
	 * being the "genuinely untestable in jsdom" case the brief allowed for.
	 */
	it('leaves a modified click alone, so Cmd/Ctrl-click can still open a new tab', async () => {
		const wrapper = await openIndex('index');
		const link = wrapper.findAll('nav li a')[0].element as HTMLAnchorElement;

		const modified = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
		link.dispatchEvent(modified);
		await flushAsync();

		expect(modified.defaultPrevented).toBe(false);
		// The handler never ran: the stage is exactly where it started.
		expect(stageEntry(wrapper)).toBeUndefined();

		const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
		link.dispatchEvent(plain);
		await flushAsync();

		expect(plain.defaultPrevented).toBe(true);
		expect(stageEntry(wrapper)).toBe('component:editor/shell/StatusBar');

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

	/**
	 * Finding A. Regression for `page.ts` calling `seedFixture()` once for the app's whole
	 * lifetime while `PlanEditorRoot` (and other real components) mutate the shared editor
	 * store on ordinary use — `open()` now calls `reseedFixture()` on every navigation, and
	 * this is what fails without that call: the second entry would draw the PANNED viewport
	 * the first one left behind rather than the seeded default.
	 */
	it('reseeds the world before the next entry, so a pan the first one made does not draw the second', async () => {
		state.components = [
			entryFor('component:PansTheCamera', moduleOf(PansTheCamera)),
			entryFor('component:ReadsTheCamera', moduleOf(ReadsTheCamera)),
		];

		const wrapper = await openIndex('entry=component:PansTheCamera');

		expect(stageEntry(wrapper)).toBe('component:PansTheCamera');

		await wrapper.findAll('nav li a')[1].trigger('click');
		await flushAsync();

		expect(stageEntry(wrapper)).toBe('component:ReadsTheCamera');
		expect(wrapper.find('.rp-harness-stage').text()).toBe(`pan:${DEFAULT_VIEWPORT.pan.x},${DEFAULT_VIEWPORT.pan.y}`);

		wrapper.unmount();
	});

	/**
	 * Round 8. `reseedFixture()` used to be `open()`'s FIRST statement, synchronous and ahead of
	 * the outgoing entry's actual teardown: `openComponent.value = null` only QUEUES Vue's
	 * reactive flush, which runs on the microtask queue ahead of the awaited module resuming — so
	 * an outgoing entry's `onUnmounted` mutating a store lands AFTER the reset, and the incoming
	 * entry inherits that mutation instead of the seeded value. `PansOnUnmount` is built to have
	 * exactly that hook, since nothing under `src/presentation` does today.
	 */
	it('does not let the outgoing entry\'s unmount mutation survive the reset', async () => {
		state.components = [entryFor('component:PansOnUnmount', moduleOf(PansOnUnmount)), entryFor('component:ReadsTheCamera', moduleOf(ReadsTheCamera))];

		const wrapper = await openIndex('entry=component:PansOnUnmount');

		expect(stageEntry(wrapper)).toBe('component:PansOnUnmount');

		await wrapper.findAll('nav li a')[1].trigger('click');
		await flushAsync();

		expect(stageEntry(wrapper)).toBe('component:ReadsTheCamera');
		expect(wrapper.find('.rp-harness-stage').text()).toBe(`pan:${DEFAULT_VIEWPORT.pan.x},${DEFAULT_VIEWPORT.pan.y}`);

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
	 *
	 * **Carries the control's `stageEntry` assertion too, and it is load-bearing here for the
	 * same reason** (see the control's own comment): with zero iterations to run today, THIS is
	 * the assertion that keeps the day Task 7 lands a prototype from silently proving nothing —
	 * without it, a prototype that fails to import or throws while rendering would still leave
	 * the CSS count unchanged and this case green, having never actually inspected what mounted.
	 * A round of review that added the control's assertion without this one found exactly that
	 * gap: a prototype planted to throw made the loop pass.
	 */
	it.each(real.prototypeEntries())('adds no stylesheet when $id mounts', async ({ id }) => {
		const before = cssNodes();

		const page = await openEntryInIndex(id);

		expect(stageEntry(page)).toBe(id);
		expect(cssNodes()).toBe(before);

		page.unmount();
	});
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, onMounted, ref, resolveComponent } from 'vue';
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
let releaseLateFailure: () => void = () => undefined;

const FailsAfterYouLeave = defineComponent({
	setup() {
		const gate = new Promise<void>((resolve) => {
			releaseLateFailure = resolve;
		});

		onMounted(async () => {
			await gate;
			throw new Error('late failure from the entry you left');
		});

		return () => h('p', 'the entry you are about to leave');
	},
});

const StillHere = defineComponent({ setup: () => () => h('p', 'the entry you moved to') });

beforeEach(() => {
	installEditorEnvironment();
	document.body.replaceChildren();
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
	 */
	it('adds no stylesheet to the document when a component mounts', async () => {
		const before = cssNodes();

		const page = await openEntryInIndex('component:editor/shell/StatusBar');

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

// @vitest-environment jsdom
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPinia, type Pinia } from 'pinia';
import { mount, type VueWrapper } from '@vue/test-utils';
import VueKonva from 'vue-konva';
import type { Component } from 'vue';
import { discoverEntries, prototypeEntries, registrableComponents } from './entries';
import { harnessEditorContext, seedFixture } from './fixture';
import { HARNESS_PLAN } from './planEditor';
import { PLAN_EDITOR_CONTEXT, type PlanEditorContext } from '../../src/presentation/editor/PlanEditorContext';
import PlanEditorRoot from '../../src/presentation/editor/PlanEditorRoot.vue';
import StatusBar from '../../src/presentation/editor/shell/StatusBar.vue';
import { installEditorEnvironment } from '../helpers/editor';

/**
 * jsdom for the whole file, because the last block mounts two real components. The discovery
 * cases below are pure and would run in `node`; splitting them into a second file to save
 * that would put criterion 7 somewhere the task brief does not name, which is how it went
 * untested the first time.
 */

/**
 * Discovery, tested here on the SHAPE `import.meta.glob` returns rather than on the glob
 * itself: what can go wrong in these cases is the id derivation, and a hand-built map is the
 * only way to drive a collision that does not exist on disk.
 *
 * That leaves the glob's own PATTERN unasserted, and a pattern that stops matching the tree
 * is the failure where nothing a designer adds ever appears. "The prototypes tree IS the
 * registration" below closes it, comparing discovery against the tree walked independently,
 * now that a real `.vue` under `src/prototypes/` exists to find — on an empty tree that
 * assertion would be `[] === []`, vacuous and green for the wrong reason.
 *
 * The id is a URL, so it has to be UNIQUE across everything the index lists. A basename is
 * not: `src/prototypes/StatusBar.vue` and `src/presentation/editor/shell/StatusBar.vue` are
 * two different entries a designer would reasonably have at once — a mock of a component
 * next to the component — and collapsing them makes the second unreachable by URL and
 * uncapturable by `harness-shot`.
 */
describe('harness entry discovery', () => {
	it('qualifies the id by kind, so a mock and its real component are both reachable', () => {
		const [prototype] = discoverEntries({ '/src/prototypes/StatusBar.vue': () => Promise.resolve({}) }, 'prototype');
		const [component] = discoverEntries(
			{ '/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}) },
			'component',
		);

		expect(prototype.id).not.toBe(component.id);
		expect(prototype.id).toBe('prototype:StatusBar');
		expect(component.id).toBe('component:editor/shell/StatusBar');
	});

	it('keeps two components with the same basename in different directories distinct', () => {
		const entries = discoverEntries(
			{
				'/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}),
				'/src/presentation/views/StatusBar.vue': () => Promise.resolve({}),
			},
			'component',
		);

		expect(new Set(entries.map((entry) => entry.id)).size).toBe(2);
	});

	/**
	 * The case a FLATTENING id gets wrong, and the reason the separator is preserved rather
	 * than replaced. `a-b/C.vue` and `a/b-C.vue` collapse to the same string the moment `/`
	 * becomes `-`, because `-` is legal in a directory name — so the encoding has to be
	 * reversible, not merely qualified.
	 */
	it('does not collapse a directory name containing the separator character', () => {
		const entries = discoverEntries(
			{
				'/src/presentation/a-b/C.vue': () => Promise.resolve({}),
				'/src/presentation/a/b-C.vue': () => Promise.resolve({}),
			},
			'component',
		);

		expect(new Set(entries.map((entry) => entry.id)).size).toBe(2);
	});

	it('keeps a human-readable label even though the id is qualified', () => {
		const [entry] = discoverEntries(
			{ '/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}) },
			'component',
		);

		expect(entry.label).toBe('StatusBar');
	});

	it('sorts by id, so the index does not reorder itself between runs', () => {
		const entries = discoverEntries(
			{
				'/src/prototypes/Zebra.vue': () => Promise.resolve({}),
				'/src/prototypes/Alpha.vue': () => Promise.resolve({}),
			},
			'prototype',
		);

		expect(entries.map((entry) => entry.label)).toEqual(['Alpha', 'Zebra']);
	});

	it('returns nothing for an empty tree rather than throwing', () => {
		expect(discoverEntries({}, 'prototype')).toEqual([]);
	});
});

/**
 * A template-only prototype writes `<StatusBar />`, so the registry is keyed by LABEL — an id
 * containing `:` and `/` is not a valid tag. Labels are not unique, which is the third place
 * that has mattered in this design.
 *
 * The two collisions are NOT the same question, and an earlier draft treating them alike broke
 * the headline workflow. A mock named after the component it stands in for is not an ambiguity
 * to refuse — replacing that component is the entire reason the mock exists, so the prototype
 * takes the tag. A collision WITHIN one kind has no such answer and is still refused.
 */
describe('registering components for template-only prototypes', () => {
	it('registers an unambiguous label under its tag', () => {
		const { byTag, ambiguous, shadowed } = registrableComponents(
			discoverEntries({ '/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}) }, 'component'),
		);

		expect([...byTag.keys()]).toEqual(['StatusBar']);
		expect(ambiguous).toEqual([]);
		expect(shadowed).toEqual([]);
	});

	it('lets a mock take the tag from the component it stands in for', () => {
		const { byTag, ambiguous, shadowed } = registrableComponents([
			...discoverEntries({ '/src/prototypes/StatusBar.vue': () => Promise.resolve({}) }, 'prototype'),
			...discoverEntries(
				{ '/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}) },
				'component',
			),
		]);

		// The likeliest collision of all, and it is the WORKFLOW rather than a mistake: a
		// designer redrawing `StatusBar` writes a mock called `StatusBar`, and `<StatusBar />`
		// in their prototype has to mean the mock. Refusing both — the earlier draft — left the
		// tag unresolved in exactly the case this feature exists to serve.
		expect(byTag.get('StatusBar')?.kind).toBe('prototype');
		expect(ambiguous).toEqual([]);
		// Reported, because a component quietly replaced is worth one line in the console.
		expect(shadowed).toEqual(['StatusBar']);
	});

	it('refuses a duplicated label rather than letting the last one win', () => {
		const { byTag, ambiguous } = registrableComponents(
			discoverEntries(
				{
					'/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}),
					'/src/presentation/views/StatusBar.vue': () => Promise.resolve({}),
				},
				'component',
			),
		);

		// Two of one kind: no winner exists, so neither is registered. `IndexPage.vue` turns the
		// unresolved tag that follows into a named entry failure, so this is visible rather than
		// a warning nobody reads.
		expect(byTag.has('StatusBar')).toBe(false);
		expect(ambiguous).toEqual(['StatusBar']);
	});

	it('refuses two mocks sharing a label, since neither stands in for the other', () => {
		const { byTag, ambiguous, shadowed } = registrableComponents(
			discoverEntries(
				{
					'/src/prototypes/StatusBar.vue': () => Promise.resolve({}),
					'/src/prototypes/toolbar/StatusBar.vue': () => Promise.resolve({}),
				},
				'prototype',
			),
		);

		expect(byTag.has('StatusBar')).toBe(false);
		expect(ambiguous).toEqual(['StatusBar']);
		expect(shadowed).toEqual([]);
	});
});

/**
 * CRITERION 7 — "two components mounted from one prototype read the same plan: a value shown
 * by both matches", held here because only this task's app installs the VueKonva that
 * `PlanEditorRoot` needs, and Task 3's fixture could not.
 *
 * **What it does NOT prove, stated first because the criterion's literal wording promises it
 * and this tree cannot deliver it:** that two components render the SAME value. Of the
 * prop-free components reading `useProjectStore`, exactly one renders a PLAN-level value —
 * `StatusBar`, which renders `plan.name`. `PlanEditorRoot` reads `status`; `ZoneLayer`,
 * `BackgroundLayer` and `InteractionLayer` all declare required props. The plan name a reader
 * sees inside `PlanEditorRoot` comes from the `StatusBar` nested in its own template, so
 * "the name appears in both" would exercise two `StatusBar` instances and would still pass
 * with `PlanEditorRoot` no longer reading the store at all. The honest pair arrives with the
 * second plan-level consumer.
 *
 * What is held instead is the criterion's substance, and it is what the fixture's own header
 * argues for: two DIFFERENT components, two DIFFERENT fields of one store, one seeded world —
 * and it fails if either component stops reading it.
 *
 * Two shapes are forbidden here however this is written, both because they pass whatever the
 * fixture does. Mounting ONE component twice proves that Pinia returns one store instance per
 * Pinia, which is true with no fixture at all — it is the defect Task 3's first attempt
 * shipped. And a case that survives an unseeded store proves nothing about seeding, which is
 * what the second case below exists to refuse: it mounts the same two components against a
 * bare `createPinia()` — the fixture with its assignments removed — and watches both
 * observations go the other way.
 */
/**
 * The app configuration Step 6 gives the index — Pinia, VueKonva and the editor context — so
 * what these two components mount into is the thing being asserted about rather than a
 * lighter stand-in. `attachTo` a real element because Konva measures its container and the
 * theme resolver reads through `getComputedStyle`.
 *
 * The context is taken as an ARGUMENT rather than built here, so that one `harnessEditorContext()`
 * covers both mounts the way `page.ts`'s single `app.provide` does. Building one per mount
 * would have been immaterial to the assertions and would have made this comment's claim of
 * fidelity false, which is the more expensive of the two.
 */
function mountLikeTheIndex(component: Component, pinia: Pinia, context: PlanEditorContext): VueWrapper {
	const host = document.createElement('div');

	document.body.appendChild(host);

	return mount(component, {
		attachTo: host,
		global: {
			plugins: [pinia, VueKonva],
			provide: { [PLAN_EDITOR_CONTEXT as symbol]: context },
		},
	});
}

/**
 * The two observations, taken from the DOM the mount produced and never from the store.
 *
 * Deliberately NOT awaited: `PlanEditorRoot` re-hydrates from `context.queries` in
 * `onMounted`, and `harnessDeps()` answers `HARNESS_PLAN` for any plan id — so a settled
 * assertion would pass on an empty fixture, seeded a tick later by the queries instead. What
 * the fixture exists to provide is a world in place before the FIRST synchronous mount, and
 * that is exactly what the un-awaited DOM shows.
 */
function observe(pinia: Pinia): { statusBarText: string; rootHasCanvas: boolean; rootMessage: boolean } {
	// ONE context across both mounts, as the index provides one across the whole app.
	const context = harnessEditorContext();
	const statusBar = mountLikeTheIndex(StatusBar, pinia, context);
	const root = mountLikeTheIndex(PlanEditorRoot, pinia, context);

	const observed = {
		statusBarText: statusBar.text(),
		rootHasCanvas: root.find('.rp-plan-canvas').exists(),
		rootMessage: root.find('.rp-editor-canvas-message').exists(),
	};

	root.unmount();
	statusBar.unmount();

	return observed;
}

describe('two different components against one seeded world', () => {
	it("shows the fixture's plan name in StatusBar and PlanEditorRoot's ready branch", () => {
		installEditorEnvironment();

		const observed = observe(seedFixture());

		// `StatusBar` reads `plan`.
		expect(observed.statusBarText).toContain(HARNESS_PLAN.name);
		// `PlanEditorRoot` reads `status`, and draws its canvas only on `ready` — the message
		// element is what it draws for missing, failed and still-loading instead.
		expect(observed.rootHasCanvas).toBe(true);
		expect(observed.rootMessage).toBe(false);
	});

	/**
	 * The negative, which is what makes the case above mean anything. A bare `createPinia()`
	 * IS `seedFixture()` with its project-store assignments removed — the store these two
	 * mounts actually read from. `seedFixture()` also calls `reseedFixture()`'s other three
	 * resets (`useEditorStore().reset()`, `useWorkspaceStore().reset()`,
	 * `useSelectionStore().clear()`, added for Finding A's fixture reset), but those put a
	 * store back to the exact values a FRESH Pinia already holds, so they make no observable
	 * difference against a bare `createPinia()` here. So this is still the "comment out the
	 * assignments and watch it go red" check, kept rather than performed once and thrown away.
	 */
	it('loses BOTH observations when the world is not seeded', () => {
		installEditorEnvironment();

		const observed = observe(createPinia());

		expect(observed.statusBarText).not.toContain(HARNESS_PLAN.name);
		expect(observed.rootHasCanvas).toBe(false);
		expect(observed.rootMessage).toBe(true);
	});
});

/** Every `.vue` under a directory, walked rather than globbed — the independent side. */
function vueFilesUnder(directory: string, prefix = ''): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

		if (entry.isDirectory()) return vueFilesUnder(path.join(directory, entry.name), relative);

		return entry.name.endsWith('.vue') ? [relative] : [];
	});
}

/**
 * Criterion 1, and the only case in this file that drives the real `import.meta.glob`.
 *
 * The test does NOT write the `.vue` file itself, and could not: `import.meta.glob` is resolved
 * when Vite transforms this module, so a file created at run time is invisible to it and the
 * assertion would fail for a reason that says nothing about registration. The file added by
 * Step 1 is the one being added; what is asserted is that adding it to the TREE was the whole
 * of adding it — nothing names it anywhere else.
 *
 * The id is mapped back to a path rather than the path forward to an id, deliberately: an
 * expected id built by the test's own copy of `idFor` would be a second derivation agreeing
 * with itself. The inverse is also the reversibility `idFor` claims when it keeps the path
 * separator — a flattened id would fail here once a nested prototype exists, but the tree
 * today holds two top-level `.vue` files (`ZoneSummary.vue` and `ZonePanel.vue`) and no
 * nesting, so a flattened id would currently be byte-identical to the real one and pass; this
 * case does not yet exercise that guarantee.
 *
 * `src/prototypes` is resolved against `process.cwd()` rather than through `REPO`
 * (`../helpers/oxlint`'s `fileURLToPath(new URL('../..', import.meta.url))`): this file runs
 * under `@vitest-environment jsdom`, where `import.meta.url` for a module vitest transforms is
 * not a `file:` URL and `fileURLToPath` throws `The URL must be of scheme file` before a single
 * test runs — measured, not assumed. `harness.test.ts` and `fixture.test.ts` are the same
 * jsdom-scoped file and already read the tree by a bare path (`'styles/chrome.css'`, …) for
 * exactly this reason: `npm run check`'s vitest step runs from the repository root, so a path
 * relative to `process.cwd()` is the one spelling that works in both environments. That trades
 * one hazard for its opposite rather than removing a hazard outright: `REPO` exists precisely
 * so a test is immune to another file's `chdir` (`tests/helpers/oxlint.ts`'s own comment —
 * `tests/build/styles.test.ts` chdirs, contained by its `afterEach` restore and vitest's
 * per-file isolation), and `process.cwd()` here is exposed to exactly that hazard in exchange
 * for working under jsdom at all.
 */
describe('the prototypes tree IS the registration', () => {
	it('discovers every .vue on disk, with nothing registering them', () => {
		const onDisk = vueFilesUnder(path.join(process.cwd(), 'src', 'prototypes')).toSorted();

		// First, because an empty tree would make the equality below `[] === []` — vacuous, and
		// exactly the "only passes while empty" failure the PBI's criterion 9 names.
		expect(onDisk).toContain('ZoneSummary.vue');

		// `toSorted`, not `sort`: `unicorn/no-array-sort` is on for `tests/` under
		// `--deny-warnings`, which is what forced the same change in `entries.ts`.
		const discovered = prototypeEntries()
			.map((entry) => `${entry.id.replace(/^prototype:/, '')}.vue`)
			.toSorted();

		expect(discovered).toEqual(onDisk);
	});
});

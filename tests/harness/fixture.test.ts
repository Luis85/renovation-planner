// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia, storeToRefs } from 'pinia';
import { mount } from '@vue/test-utils';
import { createApp } from 'vue';
import { reseedFixture, seedFixture, harnessEditorContext } from './fixture';
import { DialogStackingError, useDialogStore } from '../../src/presentation/dialogs/dialog-store';
import { settle } from '../helpers/editor';
import {
	PLAN_EDITOR_CONTEXT,
	usePlanEditorContext,
	type PlanEditorContext,
} from '../../src/presentation/editor/PlanEditorContext';
import { HARNESS_PLAN, HARNESS_ZONES, harnessDeps } from './planEditor';
import { createInspectorStoreDefinition } from '../../src/presentation/editor/inspector/inspector-store';
import { isErr, ok } from '../../src/core/result/Result';
import type { ZoneId } from '../../src/domain/zone/ZoneId';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';
import StatusBar from '../../src/presentation/editor/shell/StatusBar.vue';

/**
 * The one world every index entry mounts against. Two claims held here: it is SEEDED (a
 * component reading the store finds a plan, with no per-entry setup — held against the
 * REAL `StatusBar`, not a stub, because a fake here must not be thinner than the
 * component it stands in for), and the editor context it hands out is one
 * `usePlanEditorContext()` ACCEPTS.
 *
 * A third claim this fixture was originally asked to hold — two DIFFERENT components
 * mounted from one prototype agree on the same plan — is not held in this file. See the
 * comment before the final case below for why, and where it moved.
 *
 * The final case is driven through a real `createApp` rather than asserted on the
 * returned object, because the failure it guards is a key mismatch: a context built
 * correctly and provided under a symbol the consumer does not inject looks perfect in a
 * shape assertion and throws on mount. `usePlanEditorContext` throws rather than warning, so
 * the index would show Task 4's named-failure card for every component that reads it.
 */
describe('the harness fixture', () => {
	it('seeds the project store with the harness plan and zones', () => {
		seedFixture();

		const { plan, zones } = storeToRefs(useProjectStore());

		expect(plan.value?.id).toBe(HARNESS_PLAN.id);
		expect(zones.value.size).toBe(HARNESS_ZONES.length);
	});

	it('mounts the real StatusBar with no per-entry setup, because the fixture is already there', () => {
		const pinia = seedFixture();

		// `StatusBar` takes no props and calls `usePlanEditorContext()` nowhere — only its
		// parent `PlanEditorRoot` does — so the fixture's Pinia is the whole world it needs.
		const wrapper = mount(StatusBar, { global: { plugins: [pinia] } });

		expect(wrapper.text()).toContain(HARNESS_PLAN.name);

		wrapper.unmount();
	});

	/*
	 * Criterion 7 — "two components mounted from one prototype read the same plan: a value
	 * shown by both matches" — is not held here. It needs two DIFFERENT real components;
	 * the only prop-free pair that reads `useProjectStore` is `StatusBar` and
	 * `PlanEditorRoot` (`PlanEditorRoot.vue`), and `PlanEditorRoot` additionally needs
	 * `app.use(VueKonva)`, which this task's fixture does not install — only Task 4's
	 * index app does. Mounting one component twice, or reading one Pinia store twice,
	 * would prove only that Pinia returns the same store instance for one active Pinia
	 * (it always does) and would assert nothing about this fixture being one world.
	 * Held in Task 4, against `StatusBar` and `PlanEditorRoot` mounted together.
	 */

	it('provides a context `usePlanEditorContext()` accepts, so a real component can mount', () => {
		let seen: PlanEditorContext | undefined;

		const app = createApp({
			setup() {
				seen = usePlanEditorContext();

				return () => null;
			},
		});

		app.provide(PLAN_EDITOR_CONTEXT, harnessEditorContext());
		app.mount(document.createElement('div'));

		expect(seen?.planId).toBe(HARNESS_PLAN.id);

		app.unmount();
	});

	/**
	 * The precondition `reseedFixture`'s inspector-store paragraph names but does not reset
	 * for: `InspectorPanel.vue` must stay the ONLY reader of `inspectorDto`, because
	 * `dto`'s self-correction on remount is that panel's own `watch(..., { immediate: true })`
	 * — nothing here re-runs it for a second consumer.
	 *
	 * A CATEGORY check rather than an enumeration: this scans every `.ts`/`.vue` file under
	 * `src/` for the literal property-read `.inspectorDto` and asserts there is exactly one,
	 * naming the file itself only in the failure message. A future second reader fails this
	 * wherever it is added, without this test having named it in advance — the shape
	 * `harness.test.ts`'s stylesheet-import scan already uses for the same reason.
	 *
	 * Stated limit, not hidden: a reader reached through destructuring
	 * (`const { inspectorDto } = runtime`) carries no `.inspectorDto` substring, so this scan
	 * does not see it — the same class of gap the `.css`-import scan documents for its own
	 * pattern.
	 */
	it('is the only reader of `inspectorDto` under src/, so the fixture never resetting it stays safe', () => {
		const MODULE = /\.(?:ts|tsx|vue)$/;
		const sources = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
				const full = path.join(dir, entry.name);
				return entry.isDirectory() ? sources(full) : MODULE.test(entry.name) ? [full] : [];
			});

		const readers = sources('src')
			.filter((file) => readFileSync(file, 'utf8').includes('.inspectorDto'))
			// Posix-normalized before the comparison below: `path.join` above emits `\` on the
			// Windows CI leg, and this assertion names a literal path.
			.map((file) => file.replaceAll(path.sep, '/'));

		expect(readers).toEqual(['src/presentation/editor/shell/InspectorPanel.vue']);
	});
});

/**
 * The Inspector's READ, which the harness used to refuse along with every write.
 *
 * `PlanEditorCommandServices` carries `zoneInspector` beside the commands (SDD §59: the query
 * shares a selection with them), and `harnessDeps()` reached for `unavailablePlanEditorCommands()`
 * wholesale — so the one read in that bundle answered `settings.unrecovered` on a page whose
 * fixture holds the zone in full. `InspectorStore` has no error variant to show for it
 * (`InspectorDto` is `empty | zone | multiple`), so the canvas showed Kitchen selected and the
 * Inspector showed nothing, with no error anywhere. A stand-in must not be kinder than the real
 * thing, must not be thinner than it, and must not be HARSHER than it either.
 *
 * Driven through `InspectorStore` rather than only against the query, because the defect was
 * only ever visible one level up: the query returning `err` and the query returning `ok(null)`
 * produce the SAME `{ kind: 'empty' }`, so a case asserting on the query alone would go on
 * passing against a store that discarded the answer.
 */
describe('the harness Inspector query', () => {
	it('answers a seeded zone instead of refusing it, so the panel is not silently empty', async () => {
		setActivePinia(createPinia());

		const kitchen = HARNESS_ZONES[0];
		const useInspector = createInspectorStoreDefinition({
			query: harnessDeps().commands.zoneInspector,
			// `requirementsQuery` IS reached by `hydrateFrom` — slice 10 made the rows ride the
			// same ticket as the zone — so it is answered rather than stubbed away, from the same
			// bundle as the query above. Empty is the fixture world's honest answer: it seeds no
			// Requirements. `dispatcher` and `toCommand` are the two `hydrateFrom` genuinely does
			// not reach, and are required only by the deps type.
			requirementsQuery: {
				execute: ({ zoneId }) => harnessDeps().queries.getRequirementsForZone(String(zoneId)),
			},
			dispatcher: { run: () => Promise.resolve(ok('wrote')) },
			toCommand: () => ({}) as never,
		});
		const inspector = useInspector();

		await inspector.hydrateFrom([kitchen.id as ZoneId]);

		// 4200 x 3000 mm, through the same `core/geometry` operation `Zone.area()` calls — the
		// number is asserted rather than only the kind, since `areaMm2` is what the panel prints.
		expect(inspector.dto).toEqual({ kind: 'zone', id: kitchen.id, name: 'Kitchen', areaMm2: 4200 * 3000 });
	});

	it('still refuses every write, which is the honest answer for a page with no vault', async () => {
		const { commands } = harnessDeps();

		const created = await commands.createZone.execute({} as never);

		expect(isErr(created) && created.error.code).toBe('settings.unrecovered');
	});
});

/**
 * The dialog left open when a designer navigates away.
 *
 * `DialogHost` unmounts WITHOUT settling — deliberately, since the entry it belonged to is
 * gone — while the index keeps one Pinia for its whole life. So without this the next entry
 * inherited an open dialog and its first `openDialog` threw `DialogStackingError`: an entry
 * that worked or not depending on which entry preceded it, which is the one property
 * `reseedFixture` exists to remove.
 *
 * It is also the case `reseedFixture`'s own comment predicted — "a store added later is a store
 * this reset will miss" — realised by a MERGE rather than by an edit, with both sides complete
 * and correct alone.
 */
describe('reseedFixture, on a dialog nobody closed', () => {
	it('forgets it, so the next entry can open one', async () => {
		setActivePinia(seedFixture());

		const store = useDialogStore();
		let resumed = false;
		// A flag rather than an await: the assertion at the end is that this continuation NEVER
		// runs, and awaiting a promise that must not settle would hang the case instead of
		// failing it.
		const noteResumption = (): boolean => (resumed = true);

		void store
			.openDialog({ kind: 'confirm', title: 'Delete', message: 'Sure?', confirmLabel: 'Delete' })
			.then(noteResumption);

		expect(store.current).not.toBeNull();

		reseedFixture();
		await settle();

		expect(store.current).toBeNull();
		expect(() => store.openDialog({ kind: 'confirm', title: 'Next', message: 'Again?', confirmLabel: 'Go' })).not.toThrow(
			DialogStackingError,
		);

		/**
		 * The half that makes this an ABANDONMENT rather than a cancellation, and the reason the
		 * first version of this fix was wrong. Settling the promise resumes the OUTGOING entry's
		 * continuation a microtask later — after everything has been re-seeded — so whatever it
		 * writes lands on the world the next entry is about to draw. `DialogHost.vue` states the
		 * same policy at its own `onBeforeUnmount`: it deliberately does not resolve, because the
		 * view is gone and there is nothing left to dispatch on its behalf.
		 */
		expect(resumed, 'the outgoing entry resumed after the world was re-seeded').toBe(false);
	});

	// The other direction: reseeding with nothing open must not invent a settle or throw.
	it('says nothing when no dialog is open', () => {
		setActivePinia(seedFixture());

		expect(() => reseedFixture()).not.toThrow();
		expect(useDialogStore().current).toBeNull();
	});
});

/**
 * The world a prototype can now WRITE to, which is new: a mock may carry a `<script setup>`,
 * so it may call `useProjectStore()` and assign through it. Pinia's state is a deep reactive
 * proxy over whatever object was seeded, so this is not a claim about the store's API — it is
 * a claim about which objects that proxy is standing over.
 *
 * Watched failing with `structuredClone` removed, and ALL FOUR assertions red — measured
 * with `expect.soft` rather than assumed from the first one to stop the case. Both the plan's
 * `name` and the zone's `points[0].x` come back as the prototype's values, on the store side
 * AND on the module constants, which is the two halves of the same fact: the re-seed put back
 * the very objects the prototype had just edited, so "reproducible" was true only for an entry
 * that happened to be the first one opened.
 *
 * The second half is the one a re-seed could never repair. `points[0].x` is there because a
 * SHALLOW copy would leave it writing through while the `name` assertion went green.
 */
describe('reseedFixture, on a world the previous entry edited', () => {
	it('puts back values a prototype wrote through the store, and never lets it edit the fixture itself', () => {
		setActivePinia(seedFixture());

		const project = useProjectStore();
		const kitchen = HARNESS_ZONES[0];
		if (project.plan === null || kitchen === undefined) throw new Error('the fixture seeded nothing to mutate');
		const seededVertex = project.zones.get(kitchen.id)?.points[0];
		if (seededVertex === undefined) throw new Error('the fixture seeded no kitchen');

		// What a scripted mock reaching for the store would plausibly do: rename the plan it is
		// drawing, and nudge a vertex. The second is the one a shallow copy would miss.
		// Cast deliberately: these two writes are exactly what the DTO's `readonly` forbids, and
		// forbidding them is not the claim — `readonly` is erased at runtime, so only a real
		// mutation can show the fixture replaces a NESTED edit a shallow copy would miss.
		(project.plan as { name: string }).name = 'Edited by a prototype';
		(seededVertex as { x: number }).x = 999;

		reseedFixture();

		expect(project.plan?.name).toBe('Ground floor');
		expect(project.zones.get(kitchen.id)?.points[0]?.x).toBe(0);

		// The half a re-seed cannot repair, and therefore the half worth guarding: the module
		// constants every other consumer of this fixture reads — `harnessDeps`'s queries, the
		// two cases at the top of this file — are still what they were declared as.
		expect(HARNESS_PLAN.name).toBe('Ground floor');
		expect(kitchen.points[0]?.x).toBe(0);
	});
});

/**
 * The OTHER way the fixture constants reach reactive state, and the one `reseedFixture`'s
 * clone cannot see: a prototype composing `PlanEditorRoot` hydrates the project store through
 * `harnessDeps().queries`, which replaces everything the reseed assigned. Answering with the
 * module constants therefore re-opened the same leak one seam over — and made the fake
 * thinner than the query it stands in for, which builds its DTOs from notes it has just read
 * and so hands every caller objects of its own.
 *
 * Driven through the real `hydrate` rather than asserted on the query's return value: the
 * defect is not "the query returns a shared object", it is "a store mutation reaches the
 * fixture", and only the store can show that. Watched failing with both `structuredClone`
 * calls removed from `planEditor.ts` — the plan name and the zone vertex both come back as
 * the prototype's values, while the reseed case above stayed GREEN, which is the measurement
 * that the two seams are independent rather than two spellings of one.
 */
describe('the harness queries, hydrating a store a prototype then writes to', () => {
	it('never hand out the fixture objects themselves', async () => {
		setActivePinia(seedFixture());

		const project = useProjectStore();
		const kitchen = HARNESS_ZONES[0];
		if (kitchen === undefined) throw new Error('the fixture declares no zones');

		await project.hydrate(harnessDeps().queries, HARNESS_PLAN.id);

		const hydratedVertex = project.zones.get(kitchen.id)?.points[0];
		if (project.plan === null || hydratedVertex === undefined) throw new Error('hydration seeded nothing');

		// Cast deliberately: these two writes are exactly what the DTO's `readonly` forbids, and
		// forbidding them is not the claim — `readonly` is erased at runtime, so only a real
		// mutation can show the fixture replaces a NESTED edit a shallow copy would miss.
		(project.plan as { name: string }).name = 'Edited after hydrating';
		(hydratedVertex as { x: number }).x = 999;

		expect(HARNESS_PLAN.name).toBe('Ground floor');
		expect(kitchen.points[0]?.x).toBe(0);
	});
});

// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia, storeToRefs } from 'pinia';
import { mount } from '@vue/test-utils';
import { createApp } from 'vue';
import { reseedFixture, seedFixture, harnessEditorContext } from './fixture';
import { cancelResultFor, DialogStackingError, useDialogStore } from '../../src/presentation/dialogs/dialog-store';
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
			.map((file) => file.split(path.sep).join('/'));

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
			// Neither is reached by `hydrateFrom`; both are required by the deps type.
			dispatcher: { run: () => Promise.resolve(ok(undefined)) },
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
	it('abandons it, so the next entry can open one', async () => {
		setActivePinia(seedFixture());

		const store = useDialogStore();
		// Awaited below rather than dropped: abandoning has to SETTLE the promise, not merely
		// clear the ref — a caller left awaiting forever is the failure that would replace the
		// one being fixed.
		const pending = store.openDialog({ kind: 'confirm', title: 'Delete', body: 'Sure?', confirmLabel: 'Delete' });

		expect(store.current).not.toBeNull();

		reseedFixture();

		// Compared against `cancelResultFor` rather than a literal: each kind has its OWN cancel
		// shape (`confirm` settles to `'cancel'`, a form to `{ action: 'cancel' }`), and what this
		// case is about is that an abandoned dialog ends the way a DISMISSED one does — not what
		// that value happens to be for this kind.
		expect(await pending).toEqual(cancelResultFor('confirm'));
		expect(store.current).toBeNull();
		expect(() => store.openDialog({ kind: 'confirm', title: 'Next', body: 'Again?', confirmLabel: 'Go' })).not.toThrow(
			DialogStackingError,
		);
	});

	// The other direction: reseeding with nothing open must not invent a settle or throw.
	it('says nothing when no dialog is open', () => {
		setActivePinia(seedFixture());

		expect(() => reseedFixture()).not.toThrow();
		expect(useDialogStore().current).toBeNull();
	});
});

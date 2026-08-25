// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { storeToRefs } from 'pinia';
import { mount } from '@vue/test-utils';
import { createApp } from 'vue';
import { seedFixture, harnessEditorContext } from './fixture';
import {
	PLAN_EDITOR_CONTEXT,
	usePlanEditorContext,
	type PlanEditorContext,
} from '../../src/presentation/editor/PlanEditorContext';
import { HARNESS_PLAN, HARNESS_ZONES } from './planEditor';
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
});

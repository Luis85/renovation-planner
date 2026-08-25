// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { storeToRefs } from 'pinia';
import { createApp } from 'vue';
import { seedFixture, harnessEditorContext } from './fixture';
import {
	EDITOR_CONTEXT,
	useEditorContext,
	type EditorContext,
} from '../../src/presentation/editor/EditorContext';
import { HARNESS_PLAN, HARNESS_ZONES } from './planEditor';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';

/**
 * The one world every index entry mounts against. Three claims worth a test: it is SEEDED
 * (a component reading the store finds a plan, with no per-entry setup), it is ONE world
 * (two stores created from it agree, which is what makes two components on a prototype
 * consistent), and the editor context it hands out is one `useEditorContext()` ACCEPTS.
 *
 * The third is driven through a real `createApp` rather than asserted on the returned
 * object, because the failure it guards is a key mismatch: a context built correctly and
 * provided under a symbol the consumer does not inject looks perfect in a shape assertion
 * and throws on mount. `useEditorContext` throws rather than warning, so the index would
 * show Task 4's named-failure card for every component that reads it.
 */
describe('the harness fixture', () => {
	it('seeds the project store with the harness plan and zones', () => {
		seedFixture();

		const { plan, zones } = storeToRefs(useProjectStore());

		expect(plan.value?.id).toBe(HARNESS_PLAN.id);
		expect(zones.value.size).toBe(HARNESS_ZONES.length);
	});

	it('gives two readers the same plan, which is what makes two components agree', () => {
		seedFixture();

		const first = storeToRefs(useProjectStore()).plan;
		const second = storeToRefs(useProjectStore()).plan;

		expect(first.value).toBe(second.value);
	});

	it('provides a context `useEditorContext()` accepts, so a real component can mount', () => {
		let seen: EditorContext | undefined;

		const app = createApp({
			setup() {
				seen = useEditorContext();

				return () => null;
			},
		});

		app.provide(EDITOR_CONTEXT, harnessEditorContext());
		app.mount(document.createElement('div'));

		expect(seen?.planId).toBe(HARNESS_PLAN.id);

		app.unmount();
	});
});

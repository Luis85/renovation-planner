// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useDetailPlanActions } from '../../../../src/presentation/editor/hierarchy/detailPlanActions';

/**
 * D4: the returned action-list function's `context === undefined` arm — no `PlanEditorContext`
 * provided at all — had no case. `canvasContextMenuStandalone.test.ts` mounts `CanvasContextMenu`
 * outside the editor shell for the SAME reason (`useDetailPlanActions`' own docblock), but never
 * selects a zone, so `useCanvasMenuActions` never calls into this composition's returned function
 * either way. `useDetailPlanActions` is reachable directly and needs neither `EditorRuntime` nor
 * a canvas, so this drives the arm rather than the heavier route.
 */
it('answers no detail-plan actions when mounted with no PlanEditorContext provided', () => {
	let actions: unknown;
	const Host = defineComponent({
		setup() {
			const detailPlanActions = useDetailPlanActions();
			actions = detailPlanActions('zone-1', 'Kitchen', false);
			return () => null;
		},
	});
	mount(Host, { global: { plugins: [createPinia()] } });
	expect(actions).toEqual([]);
});

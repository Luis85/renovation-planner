// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../helpers/editor';
import { referenceWorkspace } from '../../harness/referenceWorkspace';
import { harnessDeps, HARNESS_PLAN } from '../../harness/planEditor';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { expectOk } from '../../helpers/domain';

describe('editor continuation into existing host surfaces', () => {
	it('opens the current project and library without replacing the selected editor or viewport', async () => {
		const workspace = referenceWorkspace(harnessDeps(), HARNESS_PLAN, true);
		await workspace.ready;
		const room = expectOk(await workspace.deps.commands.createZone.execute({ planId: workspace.plan.id, name: 'Study', zoneType: 'Room', geometry: { points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }] } })).zone.entity;
		const navigation = { project: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined), library: vi.fn<() => void>() };
		const harness = await mountPlanEditorCanvas({ navigation, plan: HARNESS_PLAN, queries: workspace.deps.queries, commands: workspace.deps.commands, vault: workspace.deps.vault });
		const runtime = runtimeOf(harness), selection = useSelectionStore(harness.pinia), editor = useEditorStore(harness.pinia);
		runtime.renovation.focus(room.id, 'materials'); await settle();
		const viewport = { ...editor.viewport }, stage = harness.stage;
		await harness.wrapper.get('[data-rp-open-library]').trigger('click');
		await harness.wrapper.get('[data-rp-open-project]').trigger('click');
		expect(navigation.library).toHaveBeenCalledOnce();
		expect(navigation.project).toHaveBeenCalledWith(room.projectId);
		expect(selection.selectedIds).toEqual([room.id]); expect(editor.viewport).toEqual(viewport); expect(harness.stage).toBe(stage);
		harness.wrapper.unmount();
	});
});

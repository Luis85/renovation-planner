import type { PlanEditorContext } from '../../src/presentation/editor/PlanEditorContext';
import type { EditorClipboard } from '../../src/presentation/editor/clipboard/editorClipboard';
import { referenceWorkspace } from '../harness/referenceWorkspace';
import { HARNESS_PLAN, harnessDeps } from '../harness/planEditor';
import { mountPlanEditorCanvas, runtimeOf } from './editor';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';
import { useSelectionStore } from '../../src/presentation/editor/selection/selection-store';
import { useDialogStore } from '../../src/presentation/dialogs/dialog-store';
import { expectDefined } from './domain';

export async function structureEditor(planning = false, navigation?: PlanEditorContext['navigation'], clipboard?: EditorClipboard) {
	const workspace = referenceWorkspace(harnessDeps(), HARNESS_PLAN, planning);
	await workspace.ready;
	const harness = await mountPlanEditorCanvas({ navigation, clipboard, plan: HARNESS_PLAN, queries: workspace.deps.queries, commands: workspace.deps.commands, vault: workspace.deps.vault });
	return { ...workspace, ...harness, runtime: runtimeOf(harness), services: expectDefined(workspace.deps.commands.structure, 'structure services'),
		project: useProjectStore(harness.pinia), selection: useSelectionStore(harness.pinia), dialogs: useDialogStore(harness.pinia) };
}

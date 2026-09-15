import { watch } from 'vue';
import type { EditorViewPreferences } from '../PlanEditorContext';
import { useEditorStore } from '../../stores/EditorStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';

/**
 * The View menu's grid and snap choices follow the user from leaf to leaf on this device: seeded once from the
 * device slot, and each written back as it changes. ONE field per write, because this leaf's snapshot of the OTHER
 * choice may be older than another leaf's. `undefined` — no slot bound — keeps the stores' defaults.
 */
export function useViewPreferences(preferences: EditorViewPreferences | undefined): void {
	const editor = useEditorStore(), workspace = useWorkspaceStore();
	const saved = preferences?.read() ?? {};
	workspace.gridVisible = saved.gridVisible ?? workspace.gridVisible;
	editor.snappingEnabled = saved.snappingEnabled ?? editor.snappingEnabled;
	watch(() => workspace.gridVisible, (gridVisible) => preferences?.write({ gridVisible }));
	watch(() => editor.snappingEnabled, (snappingEnabled) => preferences?.write({ snappingEnabled }));
}

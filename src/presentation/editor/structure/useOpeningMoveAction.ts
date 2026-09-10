import { nextTick } from 'vue';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useEditorRuntime } from '../runtime';

/** Both entry points keep the selected opening and hand keyboard focus to the canvas. */
export function useOpeningMoveAction() {
	const runtime = useEditorRuntime(), workspace = useWorkspaceStore();
	return (id: string, opener: Element | null = document.activeElement): void => {
		const root = opener?.closest('.renovation-plan-editor');
		if (!runtime.openingMove.start(id)) return;
		workspace.closeOverlay();
		void nextTick(() => root?.querySelector<HTMLElement>('.rp-plan-canvas')?.focus());
	};
}

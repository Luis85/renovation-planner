import type { ToolId } from '../tools/editor-tool';
import type { ToolManager } from '../tools/tool-manager';
import { plainPress } from './keyboard';

/** Editing/finishing a geometry draft shares the guarded banner action. */
export function finishShortcut(event: KeyboardEvent, activeTool: ToolId | null, deps: { toolManager: ToolManager; finishArea: () => void }): boolean {
	if (event.key === 'Backspace' && activeTool === 'draw-wall') {
		event.preventDefault();
		if (!event.repeat) deps.toolManager.editActiveCorner(-1, null);
		return true;
	}
	if (event.key === 'Enter' && (activeTool === 'draw-area' || activeTool === 'draw-wall' || activeTool?.startsWith('place-'))) {
		event.preventDefault();
		if (plainPress(event)) {
			if (activeTool === 'draw-area') deps.finishArea();
			else deps.toolManager.finishActiveTool();
		}
		return true;
	}
	return false;
}


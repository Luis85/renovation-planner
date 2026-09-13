import { draftingKind } from '../../../domain/spatial/SpatialElement';
import type { Point } from '../../../core/geometry/Point';
import type { StringKey } from '../../i18n/locales/en';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import type { ElementToolId } from '../elements/elementDraft';
import type { CanvasMenuAction, CanvasMenuSubmenu } from './useCanvasMenuActions';

const DRAFTING_TOOLS: readonly { readonly id: string; readonly tool: ElementToolId; readonly label: StringKey; readonly icon: string }[] = [
	{ id: 'draft-dimension', tool: 'draw-dimension', label: 'editor.add.dimension.label', icon: 'rp-dimension' },
	{ id: 'draft-section', tool: 'draw-section', label: 'editor.add.section.label', icon: 'rp-section' },
	{ id: 'draft-view', tool: 'place-view', label: 'editor.add.view.label', icon: 'rp-view' },
	{ id: 'draft-hatch', tool: 'draw-hatch', label: 'editor.add.hatch.label', icon: 'rp-hatch' },
	{ id: 'draft-text', tool: 'place-text', label: 'editor.add.text.label', icon: 'rp-text' },
	{ id: 'draft-boundary', tool: 'draw-boundary', label: 'editor.add.boundary.label', icon: 'rp-boundary' },
	{ id: 'draft-grid', tool: 'place-grid', label: 'editor.add.grid.label', icon: 'rp-grid' },
];

/** Right-click › Drafting: every drafting tool, started at the point the menu opened, and a section line's Flip direction (plan drafting tools design §7). */
export function useDraftingMenuActions(opened: () => Point) {
	const runtime = useEditorRuntime(), project = useProjectStore();
	function submenu(blocked: boolean): CanvasMenuSubmenu {
		const disabled = blocked || !runtime.elementTask.available;
		return { id: 'drafting-menu', label: 'editor.drafting.menu', group: 'create', icon: 'pencil',
			children: DRAFTING_TOOLS.map(entry => ({ id: entry.id, label: entry.label, group: 'create', icon: entry.icon, disabled, run: () => runtime.elementTask.startAt(entry.tool, opened()) })) };
	}
	/** Whether `id` is a drafting mark, which carries no renovation records. */
	function isMark(id: string): boolean {
		return project.structure.elements?.some(item => item.id === id && draftingKind(item.kind)) === true;
	}
	function flip(id: string, blocked: boolean): CanvasMenuAction[] {
		if (!project.structure.elements?.some(item => item.id === id && item.kind === 'section')) return [];
		return [{ id: 'flip-section', label: 'editor.drafting.flip', group: 'edit', icon: 'rotate-cw', disabled: blocked || runtime.elementActions.active.value, run: () => runtime.elementActions.flip(id) }];
	}
	return { submenu, flip, isMark };
}

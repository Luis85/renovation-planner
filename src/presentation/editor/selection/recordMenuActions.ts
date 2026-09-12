import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';
import { contextSource, defaultRenovationContext } from '../renovation/defaultRenovationContext';
import { usePlanningContextIfProvided } from '../planning/planningContext';
import { EDITOR_MODE_ICONS } from '../editorIcons';
import type { CanvasMenuAction } from './useCanvasMenuActions';

const reason = (off: boolean) => off ? 'editor.input.records-unavailable' as const : undefined;

/** Add › Work item, Note and Photo: the existing forms, opened on the right-clicked target in its default room (spec §5.3). */
export function useRecordMenuActions(): (targetId: string, blocked: boolean) => CanvasMenuAction[] {
	const runtime = useEditorRuntime(), project = useProjectStore(), session = useRenovationSession(), planning = usePlanningContextIfProvided();
	function context(targetId: string): string {
		return defaultRenovationContext(contextSource(project), targetId, session.targetId === targetId ? session.roomId : '');
	}
	async function evidence(targetId: string, mode: 'notes' | 'photos'): Promise<void> {
		runtime.renovation.focus(context(targetId), mode);
		await planning?.edit('evidence');
	}
	return (targetId, blocked) => {
		const records = !runtime.renovation.available, files = records || !planning?.files || !planning.context.commands.planning;
		return [
			{ id: 'add-work', label: 'editor.input.add.work', group: 'records', icon: EDITOR_MODE_ICONS.work, disabled: blocked || records, reason: reason(records),
				run: async () => { const room = context(targetId); runtime.renovation.focus(room, 'work'); await runtime.renovation.edit('work', room); } },
			{ id: 'add-note', label: 'editor.input.add.note', group: 'records', icon: EDITOR_MODE_ICONS.notes, disabled: blocked || files, reason: reason(files), run: () => evidence(targetId, 'notes') },
			{ id: 'add-photo', label: 'editor.input.add.photo', group: 'records', icon: EDITOR_MODE_ICONS.photos, disabled: blocked || files, reason: reason(files), run: () => evidence(targetId, 'photos') },
		];
	};
}

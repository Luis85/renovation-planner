import { nextTick, onBeforeUnmount, shallowRef } from 'vue';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { createRoomEditLifecycle, type RoomEditRuntime } from '../roomEditLifecycle';
import { useRenovationSession } from '../renovation/renovationSession';
import { tr } from '../../i18n/strings';
import { dimensionTexts, roomDimensions, type DimensionsText } from './roomDimensions';
import { createRoomDimensionDraft, type RoomDimensionDraft } from './roomDimensionDraft';
import { RoomDimensionTool } from './RoomDimensionTool';

export function createRoomDimensionAction(context: PlanEditorContext,
	runtime: RoomEditRuntime & Pick<EditorRuntime, 'renderState' | 'toolManager' | 'setTool' | 'returnToSelect'>) {
	const draft = shallowRef<RoomDimensionDraft | null>(null), session = useRenovationSession();
	let alive = true, resolvePresentation: (() => void) | null = null, axis: keyof DimensionsText = 'width';
	function stop(): void {
		draft.value = null;
		runtime.renderState.previewPolygon = null;
		resolvePresentation?.();
		resolvePresentation = null;
	}
	function finish(): void {
		stop();
		// ToolManager may be inside an outgoing cancel. Leave that mutation before switching.
		void nextTick(() => { if (alive && runtime.activeToolId.value === 'edit-room-dimension') runtime.returnToSelect(); });
	}
	const busy = (): boolean => draft.value?.controls.busy.value ?? false;
	function cancel(): void { if (!busy()) finish(); }
	const lifecycle = createRoomEditLifecycle(context, runtime, {
		tool: 'edit-room-dimension', faultEvent: 'editor.dimension.open.faulted',
		latest: current => {
			const box = current?.zoneType === 'Room' ? roomDimensions(current.points) : null;
			return box ? tr('editor.resize.latest', dimensionTexts(box)) : tr('editor.resize.latest-unavailable');
		},
	}, (baseline, controls) => {
		const box = roomDimensions(baseline.entity.geometry.points);
		if (box === null) return Promise.resolve();
		return new Promise<void>(resolve => {
			resolvePresentation = resolve;
			draft.value = createRoomDimensionDraft(baseline, controls, { axis, box, logger: context.commands.logger, finish,
				preview: polygon => { runtime.renderState.previewPolygon = polygon?.points ?? null; } });
		});
	});
	async function open(id: ZoneId, requestedAxis: keyof DimensionsText): Promise<void> {
		if (!alive || runtime.writesBlocked.value || runtime.activeToolId.value !== 'select' || session.perspective === 'review') return;
		axis = requestedAxis;
		runtime.setTool('edit-room-dimension');
		await lifecycle.open(id);
		if (alive && runtime.toolManager.activeToolId === 'edit-room-dimension' && draft.value === null) runtime.returnToSelect();
	}
	runtime.toolManager.register(new RoomDimensionTool({ busy, stop, cancel }));
	onBeforeUnmount(() => { alive = false; stop(); });
	return { draft, open, cancel };
}

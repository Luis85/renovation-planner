import { markRaw } from 'vue';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { createRoomEditAction, type RoomEditRuntime } from '../roomEditAction';
import { tr } from '../../i18n/strings';
import OutlinePointsForm from './OutlinePointsForm.vue';
export function createOutlineEditAction(context: PlanEditorContext, runtime: RoomEditRuntime & Pick<EditorRuntime, 'renderState'>) {
	const action = createRoomEditAction(context, runtime, {
		faultEvent: 'editor.outline.open.faulted', accepts: () => true,
		latest: current => current ? tr('editor.outline.latest', { name: current.name }) : tr('editor.area.unavailable'),
		form: ({ entity, version }, { busy, blocked, latest, commit }) => ({
			kind: 'form', title: tr('editor.outline.title', { name: entity.name }), component: markRaw(OutlinePointsForm), busy,
			props: { points: entity.geometry.points, busy, blocked, latest, logger: context.commands.logger,
				dispatch: (forward: Polygon) => commit({ kind: 'geometry', zoneId: entity.id, forward, inverse: entity.geometry, expected: version }),
				preview: (polygon: Polygon | null) => { runtime.renderState.previewPolygon = polygon?.points ?? null; },
			},
		}),
	});
	return { editOutline: action.open, blocked: action.blocked };
}

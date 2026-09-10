import { markRaw } from 'vue';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { createRoomEditAction, type RoomEditRuntime } from '../roomEditAction';
import { tr } from '../../i18n/strings';
import { dimensionTexts, roomDimensions } from './roomDimensions';
import RoomDimensionsForm from './RoomDimensionsForm.vue';

export function createRoomResizeAction(context: PlanEditorContext, runtime: RoomEditRuntime & Pick<EditorRuntime, 'renderState'>) {
	const action = createRoomEditAction(context, runtime, {
		faultEvent: 'editor.resize.open.faulted',
		latest: current => {
			const bounds = current?.zoneType === 'Room' ? roomDimensions(current.points, current.bulges) : null;
			return bounds !== null ? tr('editor.resize.latest', dimensionTexts(bounds)) : tr('editor.resize.latest-unavailable');
		},
		form: ({ entity, version }, { busy, blocked, latest, commit }) => {
			const box = roomDimensions(entity.geometry.points, entity.geometry.bulges);
			if (box === null) return null;
			return { kind: 'form', title: tr('editor.resize.title', { name: entity.name }), component: markRaw(RoomDimensionsForm), busy,
				props: { points: entity.geometry.points, box, busy, blocked, latest, logger: context.commands.logger,
					// `version` spans BOTH of the zone's files (`observeZone`): a sidecar entry edited
					// out of band after this dialog opened reaches the conflict arm, not disk.
					dispatch: (polygon: Polygon) => commit({ kind: 'geometry', zoneId: entity.id, forward: polygon, inverse: entity.geometry, expected: version }),
					preview: (polygon: Polygon | null) => { runtime.renderState.previewPolygon = polygon?.points ?? null; },
				},
			};
		},
	});
	return { resizeRoom: action.open, resizeRoomBlocked: action.blocked };
}

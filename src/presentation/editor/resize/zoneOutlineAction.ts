import { markRaw } from 'vue';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { createRoomEditAction, type RoomEditRuntime } from '../roomEditAction';
import { tr } from '../../i18n/strings';
import { zoneTypeLabel } from '../shell/zoneTypeLabel';
import OutlinePointsForm from './OutlinePointsForm.vue';

/**
 * BP-04 slices A and A2: correcting a measured corner by typing its position, for any Zone,
 * without redrawing it and without dragging. Every corner's fields are rendered at once — slice
 * A's shape, and still the shape, because a chosen corner here moves FOCUS rather than hiding
 * its siblings. Slice A2 added the `highlight` prop below, which is what draws the numbered
 * chosen-corner list on the shared form and what puts the chosen corner's mark on the canvas
 * (`tools/render-state.ts`'s `highlightedVertex`, drawn by `layers/InteractionLayer.vue`).
 *
 * **BP-04 is not closed by this file.** Slice B — the production door that reaches it — is still
 * outstanding (limitation L-24: nothing in the UI opens this action), and is blocked on owner
 * copy.
 *
 * The forward polygon carries POINTS ONLY. `MoveSpatialObjectCommand` runs it through
 * `preservePointCurves`, which retains the saved bulges by index while the point count is
 * unchanged — so a curved Zone survives a typed correction, and adding or removing a corner
 * (which this form cannot do) is what that function refuses instead of guessing, driven end to
 * end by `tests/application/commands/curvedGeometry.test.ts`'s `observes curve-only peer
 * changes and refuses ambiguous point-only topology changes without writing`.
 */
export function createZoneOutlineAction(context: PlanEditorContext, runtime: RoomEditRuntime & Pick<EditorRuntime, 'renderState'>) {
	const action = createRoomEditAction(context, runtime, {
		faultEvent: 'editor.zone-outline.open.faulted',
		// EVERY zone type, and deliberately not a list of the seven `ZoneType` declares. "Room
		// and Area" is the UI's pair of words for that whole vocabulary — "Area" is this
		// codebase's word for a zone that is not a Room (`createAreaDetailsAction`, the
		// `editor.area.*` keys, the `draw-area` tool) and is not a `ZoneType` value at all. A
		// typed corner position means the same thing for a Garden as for a Room, so there is
		// nothing to exclude, and a list of seven is a list that silently omits the eighth.
		accepts: () => true,
		latest: current => current ? tr('editor.area.latest', { name: current.name, type: tr(zoneTypeLabel(current.zoneType)) }) : tr('editor.area.unavailable'),
		form: ({ entity, version }, { busy, blocked, latest, commit }) => ({
			// `editor.element.edit` titles a ZONE dialog. Both locales are already written and
			// both are fully generic ("Edit {name}" / "{name} bearbeiten"), and slice A mints no
			// string in either. Recorded as a copy item for the release owner, who supplies a
			// purpose-built key in both locales later (controller ruling R-S10-1).
			kind: 'form', title: tr('editor.element.edit', { name: entity.name }), component: markRaw(OutlinePointsForm), busy,
			props: { points: entity.geometry.points, hint: 'editor.area.coordinates-hint', busy, blocked, latest, logger: context.commands.logger,
				// `version` spans BOTH of the zone's files, exactly as `roomResizeAction` states:
				// a sidecar entry edited out of band after this dialog opened reaches the
				// conflict arm rather than disk.
				dispatch: (polygon: Polygon) => commit({ kind: 'geometry', zoneId: entity.id, forward: polygon, inverse: entity.geometry, expected: version }),
				preview: (polygon: Polygon | null) => { runtime.renderState.previewPolygon = polygon?.points ?? null; },
				// BP-04 slice A2's half: passing this prop AT ALL is what draws the chosen-corner
				// list, so the list and the highlight cannot arrive without each other. The index
				// is into this zone's saved outline, which is what `InteractionLayer` draws its
				// vertex handles from.
				highlight: (index: number | null) => { runtime.renderState.highlightedVertex = index; },
			},
		}),
	});
	return { editZoneOutline: action.open, zoneOutlineBlocked: action.blocked };
}

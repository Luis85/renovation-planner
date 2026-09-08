import { markRaw } from 'vue';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { ZoneDetails } from '../../../application/commands/zone/EditZoneDetails';
import { createRoomEditAction, type RoomEditRuntime } from '../roomEditAction';
import { tr } from '../../i18n/strings';
import { zoneTypeLabel } from '../shell/zoneTypeLabel';
import AreaDetailsForm from './AreaDetailsForm.vue';

export function createAreaDetailsAction(context: PlanEditorContext, runtime: RoomEditRuntime) {
	const action = createRoomEditAction(context, runtime, {
		faultEvent: 'editor.area-details.open.faulted', accepts: zone => zone.zoneType !== 'Room',
		latest: current => current ? tr('editor.area.latest', { name: current.name, type: tr(zoneTypeLabel(current.zoneType)) }) : tr('editor.area.unavailable'),
		form: ({ entity, version }, { busy, blocked, latest, commit }) => ({
			kind: 'form', title: tr('editor.area.details'), component: markRaw(AreaDetailsForm), busy,
			props: { value: { name: entity.name, zoneType: entity.zoneType }, busy, blocked, latest, logger: context.commands.logger,
				dispatch: (forward: ZoneDetails) => commit({ kind: 'details', zoneId: entity.id, forward, inverse: { name: entity.name, zoneType: entity.zoneType }, expected: version }),
			},
		}),
	});
	return { editAreaDetails: action.open, areaDetailsBlocked: action.blocked };
}

import { markRaw } from 'vue';
import type { PlanEditorContext } from '../PlanEditorContext';
import { createRoomEditAction, type RoomEditRuntime, type RoomEditDefinition } from '../roomEditAction';
import { tr } from '../../i18n/strings';
import RoomNameForm from './RoomNameForm.vue';

export function createRoomNamingAction(context: PlanEditorContext, runtime: RoomEditRuntime) {
	const action = createRoomEditAction(context, runtime, {
		faultEvent: 'editor.rename.open.faulted',
		latest: current => current?.zoneType === 'Room'
			? tr('editor.rename.latest', { name: current.name }) : tr('editor.rename.latest-unavailable'),
		form: ({ entity, version }, { busy, blocked, latest, commit }) => ({
			kind: 'form', title: tr('editor.rename.title'), component: markRaw(RoomNameForm), busy,
			props: { name: entity.name, busy, blocked, latest, logger: context.commands.logger,
				dispatch: (name: string) => commit({ kind: 'name', zoneId: entity.id, name, inverse: entity.name, expected: version }),
			},
		}),
	} satisfies RoomEditDefinition);
	return { renameRoom: action.open, renameRoomBlocked: action.blocked };
}

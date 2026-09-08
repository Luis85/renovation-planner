import { computed, markRaw, onBeforeUnmount, ref, watch } from 'vue';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import { GetZone } from '../../../application/queries/GetZone';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import { err } from '../../../core/result/Result';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useDialogStore } from '../../dialogs/dialog-store';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { tr } from '../../i18n/strings';
import { dimensionTexts, roomDimensions } from './roomDimensions';
import RoomDimensionsForm from './RoomDimensionsForm.vue';

/** Snapshot/version acquisition and command decoration stay in the per-leaf runtime. */
export function createRoomResizeAction(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'commitField' | 'renderState' | 'activeToolId' | 'refreshProjection'>) {
	const project = useProjectStore(), selection = useSelectionStore(), saves = useSaveStateStore(), dialogs = useDialogStore();
	const loading = ref(false);
	const blocked = computed(() => project.stale || saves.state === 'saving');
	let alive = true;
	let generation = 0;
	watch([() => selection.selectedIds, runtime.activeToolId], () => { generation++; }, { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; });
	const available = (id: string): boolean => alive && !blocked.value && dialogs.current === null && runtime.activeToolId.value === 'select'
		&& selection.selectedIds.length === 1 && selection.selectedIds[0] === id;

	async function open(id: ZoneId): Promise<void> {
		if (loading.value || !available(id)) return;
		loading.value = true;
		const started = generation;
		try {
			const loaded = await new GetZone(context.commands.zones).execute({ zoneId: id });
			if (!available(id) || started !== generation) return;
			if (!loaded.ok) { notifyOperationFailure(loaded.error); return; }
			if (loaded.value === null) return;
			const { entity, version } = loaded.value;
			const box = roomDimensions(entity.geometry.points);
			if (entity.zoneType !== 'Room' || entity.planId !== context.planId || box === null) return;
			const busy = ref(false);
			const latest = ref<string | null>(null);
			const dispatch = async (polygon: Polygon) => {
				if (!alive || blocked.value) return Promise.resolve(err(staleWriteRefusal()));
				// `version` spans BOTH of the zone's files (`observeZone`): a sidecar entry edited
				// out of band after this dialog opened reaches the conflict arm below, not disk.
				const result = await runtime.commitField({ kind: 'geometry', zoneId: id, forward: polygon, inverse: entity.geometry, expected: version });
				if (!result.ok && WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(`.${code}`))) {
					// Show the current projection after a conflict without rebasing the draft.
					await runtime.refreshProjection();
					const current = project.zones.get(id);
					const bounds = current?.zoneType === 'Room' ? roomDimensions(current.points) : null;
					latest.value = !project.stale && bounds !== null
						? tr('editor.resize.latest', dimensionTexts(bounds)) : tr('editor.resize.latest-unavailable');
				}
				return result;
			};
			await dialogs.openDialog({ kind: 'form', title: tr('editor.resize.title', { name: entity.name }),
				component: markRaw(RoomDimensionsForm), busy,
				props: { points: entity.geometry.points, box, busy, blocked, latest, dispatch, logger: context.commands.logger,
					preview: (polygon: Polygon | null) => { runtime.renderState.previewPolygon = polygon?.points ?? null; } },
			});
		} catch (cause) {
			if (alive) notifyFault(cause, context.commands.logger, 'editor.resize.open.faulted');
		} finally { loading.value = false; }
	}
	return { resizeRoom: open, resizeRoomBlocked: computed(() => loading.value || blocked.value || runtime.activeToolId.value !== 'select') };
}

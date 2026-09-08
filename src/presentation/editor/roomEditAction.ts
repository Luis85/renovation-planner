import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { WRITE_BOUNDARY_CODES, type Loaded } from '../../application/ports/versioning';
import { GetZone } from '../../application/queries/GetZone';
import { err } from '../../core/result/Result';
import type { Zone } from '../../domain/zone/Zone';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { PlanEditorContext } from './PlanEditorContext';
import type { EditorRuntime } from './runtime';
import type { FormDescriptor } from '../dialogs/dialog-store';
import type { ZoneDto } from '../read-models/PlanDto';
import { useProjectStore } from '../stores/ProjectStore';
import { useSelectionStore } from './selection/selection-store';
import { useSaveStateStore } from './save-state/save-state-store';
import { useDialogStore } from '../dialogs/dialog-store';
import { notifyFault, notifyOperationFailure } from '../notices/notify';
import { staleWriteRefusal } from './tools/with-stale-gate';

export type RoomEditRuntime = Pick<EditorRuntime, 'commitField' | 'activeToolId' | 'refreshProjection'>;
export interface RoomEditDefinition {
	readonly faultEvent: string;
	latest(current: ZoneDto | undefined): string;
	form(baseline: Loaded<Zone>, controls: {
		readonly busy: Ref<boolean>;
		readonly blocked: Readonly<Ref<boolean>>;
		readonly latest: Readonly<Ref<string | null>>;
		readonly commit: EditorRuntime['commitField'];
	}): FormDescriptor | null;
}

/** Shared versioned modal lifecycle for existing-room metadata and dimensions. */
export function createRoomEditAction(context: PlanEditorContext, runtime: RoomEditRuntime, definition: RoomEditDefinition) {
	const project = useProjectStore(), selection = useSelectionStore(), saves = useSaveStateStore(), dialogs = useDialogStore();
	const loading = ref(false);
	const blocked = computed(() => project.stale || saves.state === 'saving');
	let alive = true, generation = 0;
	watch([() => selection.selectedIds, runtime.activeToolId], () => { generation++; }, { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; generation++; });
	const available = (id: string): boolean => alive && !blocked.value && dialogs.current === null
		&& runtime.activeToolId.value === 'select' && selection.selectedIds.length === 1 && selection.selectedIds[0] === id;

	async function open(id: ZoneId): Promise<void> {
		if (loading.value || !available(id)) return;
		loading.value = true;
		const started = generation;
		try {
			const loaded = await new GetZone(context.commands.zones).execute({ zoneId: id });
			if (!available(id) || started !== generation) return;
			if (!loaded.ok) { notifyOperationFailure(loaded.error); return; }
			if (loaded.value === null) return;
			const { entity } = loaded.value;
			if (entity.zoneType !== 'Room' || entity.planId !== context.planId) return;
			const busy = ref(false), latest = ref<string | null>(null);
			const commit: EditorRuntime['commitField'] = async edit => {
				if (!alive || started !== generation || blocked.value) return err(staleWriteRefusal());
				const result = await runtime.commitField(edit);
				if (!result.ok && WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(`.${code}`))) {
					await runtime.refreshProjection();
					latest.value = definition.latest(project.stale ? undefined : project.zones.get(id));
				}
				return result;
			};
			const descriptor = definition.form(loaded.value, { busy, blocked, latest, commit });
			if (descriptor !== null) await dialogs.openDialog(descriptor);
		} catch (cause) {
			if (alive) notifyFault(cause, context.commands.logger, definition.faultEvent);
		} finally { loading.value = false; }
	}
	return { open, blocked: computed(() => loading.value || blocked.value || runtime.activeToolId.value !== 'select') };
}

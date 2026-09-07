import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { WRITE_BOUNDARY_CODES, type Loaded } from '../../application/ports/versioning';
import { GetZone } from '../../application/queries/GetZone';
import { err } from '../../core/result/Result';
import type { Zone } from '../../domain/zone/Zone';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { PlanEditorContext } from './PlanEditorContext';
import type { EditorRuntime } from './runtime';
import type { ToolId } from './tools/editor-tool';
import type { ZoneDto } from '../read-models/PlanDto';
import { useProjectStore } from '../stores/ProjectStore';
import { useSelectionStore } from './selection/selection-store';
import { useSaveStateStore } from './save-state/save-state-store';
import { useDialogStore } from '../dialogs/dialog-store';
import { notifyFault, notifyOperationFailure } from '../notices/notify';
import { staleWriteRefusal } from './tools/with-stale-gate';

export type RoomEditRuntime = Pick<EditorRuntime, 'commitField' | 'activeToolId' | 'refreshProjection' | 'writesBlocked'>;
export interface RoomEditControls {
	readonly busy: Ref<boolean>;
	readonly blocked: Readonly<Ref<boolean>>;
	readonly latest: Readonly<Ref<string | null>>;
	readonly current: Readonly<Ref<boolean>>;
	readonly commit: EditorRuntime['commitField'];
}
export interface RoomEditOptions {
	readonly faultEvent: string;
	readonly tool?: ToolId;
	readonly accepts?: (zone: Zone) => boolean;
	latest(current: ZoneDto | undefined): string;
}

/** One versioned read/commit lifetime for modal and inline Room editing. */
export function createRoomEditLifecycle(context: PlanEditorContext, runtime: RoomEditRuntime, definition: RoomEditOptions,
	present: (baseline: Loaded<Zone>, controls: RoomEditControls) => Promise<unknown>) {
	const project = useProjectStore(), selection = useSelectionStore(), saves = useSaveStateStore(), dialogs = useDialogStore();
	const loading = ref(false);
	const blocked = computed(() => runtime.writesBlocked.value || saves.state === 'saving');
	const generation = ref(0);
	let alive = true;
	watch([() => selection.selectedIds, runtime.activeToolId], () => { generation.value++; }, { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; generation.value++; });
	const available = (id: string): boolean => alive && !blocked.value && dialogs.current === null
		&& runtime.activeToolId.value === (definition.tool ?? 'select') && selection.selectedIds.length === 1 && selection.selectedIds[0] === id;

	async function open(id: ZoneId): Promise<void> {
		if (loading.value || !available(id)) return;
		loading.value = true;
		const started = generation.value;
		try {
			const loaded = await new GetZone(context.commands.zones).execute({ zoneId: id });
			if (!available(id) || started !== generation.value) return;
			if (!loaded.ok) { notifyOperationFailure(loaded.error); return; }
			if (loaded.value === null) return;
			const { entity } = loaded.value;
			if (entity.planId !== context.planId || !(definition.accepts?.(entity) ?? entity.zoneType === 'Room')) return;
			const busy = ref(false), latest = ref<string | null>(null);
			const commit: EditorRuntime['commitField'] = async edit => {
				if (!alive || started !== generation.value || blocked.value) return err(staleWriteRefusal());
				const result = await runtime.commitField(edit);
				if (!result.ok && WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(`.${code}`))) {
					await runtime.refreshProjection();
					latest.value = definition.latest(project.stale ? undefined : project.zones.get(id));
				}
				return result;
			};
			await present(loaded.value, { busy, blocked, latest, current: computed(() => alive && started === generation.value), commit });
		} catch (cause) {
			if (alive) notifyFault(cause, context.commands.logger, definition.faultEvent);
		} finally { loading.value = false; }
	}
	return { open, blocked: computed(() => loading.value || blocked.value || runtime.activeToolId.value !== (definition.tool ?? 'select')) };
}

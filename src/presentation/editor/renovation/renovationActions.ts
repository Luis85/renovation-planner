import { computed, markRaw, onBeforeUnmount, ref } from 'vue';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { sameRenovation } from '../../../domain/renovation/sameRenovation';
import type { EntityId } from '../../../core/identity/EntityId';
import type { PlanId } from '../../../domain/plan/PlanId';
import { err } from '../../../core/result/Result';
import { undoSuperseded } from '../../../application/editor/WriteLedger';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import type { RenovationBaseline, RenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import type { EditorRuntime } from '../runtime';
import type { PlanEditorContext } from '../PlanEditorContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useSelectionStore } from '../selection/selection-store';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { tr } from '../../i18n/strings';
import { useRenovationSession, type Perspective, type RenovationMode } from './renovationSession';
import { renovationDraft, type RenovationEditKind } from './renovationDraft';
import RenovationForm from './RenovationForm.vue';

export function createRenovationActions(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'activeToolId' | 'returnToSelect' | 'dispatcher' | 'refreshProjection' | 'structureTask'>) {
	const project = useProjectStore(), selection = useSelectionStore(), editor = useEditorStore();
	const session = useRenovationSession(), dialogs = useDialogStore(), save = useSaveStateStore();
	const loading = ref(false);
	const blocked = computed(() => loading.value || project.stale || save.state === 'saving' || session.perspective === 'review');
	let alive = true;
	let previous: { ids: typeof selection.selectedIds; viewport: typeof editor.viewport; roomId: string; focusedId: string; mode: RenovationMode } | null = null;
	onBeforeUnmount(() => { alive = false; });
	async function perspective(next: Perspective): Promise<void> {
		if (dialogs.current || save.state === 'saving' || loading.value || next === session.perspective) return;
		if (runtime.activeToolId.value !== 'select' && runtime.activeToolId.value !== null) {
			const result = await dialogs.openDialog({ kind: 'confirm', title: tr('renovation.navigation.title'), message: tr('renovation.navigation.message') });
			if (!alive || result !== 'confirm') return;
		}
		if (next === 'review') previous = { ids: [...selection.selectedIds], viewport: { ...editor.viewport }, roomId: session.roomId, focusedId: session.focusedId, mode: session.mode };
		if (session.perspective === 'review' && next === 'renovate' && previous) {
			selection.select(previous.ids); editor.viewport = previous.viewport;
			Object.assign(session, { roomId: previous.roomId, focusedId: previous.focusedId, mode: previous.mode });
		}
		runtime.returnToSelect(); session.perspective = next;
	}
	function focus(roomId: string, mode: RenovationMode, id = ''): void {
		if (dialogs.current || save.state === 'saving') return;
		if (runtime.activeToolId.value !== 'select' && runtime.activeToolId.value !== null) {
			void perspective('renovate').then(() => { if (alive && runtime.activeToolId.value === 'select') focus(roomId, mode, id); return undefined; });
			return;
		}
		runtime.returnToSelect();
		Object.assign(session, { roomId, mode, focusedId: id, perspective: 'renovate' });
		selection.select([roomId as EntityId<string>]);
	}
	function matches(read: RenovationBaseline): boolean {
		return sameRenovation(project.plan?.renovation, read.plan.entity.renovation)
			&& sameGeometryDocument({ structure: project.structure, intended: project.intended, calibration: project.plan?.calibration ?? null,
				objects: [...project.zones.values()].map(item => ({ id: item.id, points: item.points })) },
			{ ...read.geometry.document, structure: read.geometry.document.structure ?? EMPTY_STRUCTURE,
				objects: read.geometry.document.objects.filter(item => project.zones.has(item.id)) });
	}
	async function baseline(): Promise<RenovationBaseline | null> {
		const read = await context.commands.renovation?.read(context.planId as PlanId);
		if (!alive) return null;
		if (!read?.ok) { if (read) notifyOperationFailure(read.error); return null; }
		if (!matches(read.value)) { notifyOperationFailure(undoSuperseded(context.planId as PlanId)); await runtime.refreshProjection(); return null; }
		return read.value;
	}
	async function edit(kind: RenovationEditKind, roomId: string, id = ''): Promise<void> {
		if (blocked.value || dialogs.current || project.zones.get(roomId)?.zoneType !== 'Room') return;
		loading.value = true;
		const selected = selection.selectedIds.join('|');
		try {
			const read = await baseline();
			if (!read || !alive || selected !== selection.selectedIds.join('|')) return;
			const draft = renovationDraft(kind, roomId, id, read.plan.entity.renovation);
			const busy = ref(false);
			await dialogs.openDialog({ kind: 'form', title: tr(`renovation.edit.${kind}`), component: markRaw(RenovationForm), busy,
				props: { draft, baseline: read, busy, paused: computed(() => project.stale),
					dispatch: (input: RenovationInput) => alive && context.commands.renovation
						? runtime.dispatcher.run(context.commands.renovation.command(read, input, runtime.structureTask.ledger))
						: Promise.resolve(err(undoSuperseded(context.planId as PlanId))),
				},
			});
		} catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'renovation.edit.failed'); }
		finally { loading.value = false; }
	}
	async function change(make: (read: RenovationBaseline) => RenovationInput, message: string): Promise<void> {
		if (blocked.value || dialogs.current || !context.commands.renovation) return;
		loading.value = true;
		try {
			const read = await baseline();
			if (!read) return;
			const answer = await dialogs.openDialog({ kind: 'confirm', title: tr('renovation.confirm'), message });
			if (!alive || answer !== 'confirm') return;
			const result = await runtime.dispatcher.run(context.commands.renovation.command(read, make(read), runtime.structureTask.ledger));
			if (alive && !result.ok) notifyOperationFailure(result.error);
		} catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'renovation.change.failed'); }
		finally { loading.value = false; }
	}
	return { perspective, focus, edit, change, blocked, available: context.commands.renovation !== undefined };
}

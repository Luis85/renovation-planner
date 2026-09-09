import { computed, markRaw, ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { RotationShape } from '../elements/objectRotation';
import { rotationChanged, rotationPivot, rotationPoints } from '../elements/objectRotation';
import { createDraftRetry } from '../forms/createDraftRetry';
import { useDialogStore } from '../../dialogs/dialog-store';
import { tr } from '../../i18n/strings';
import { err } from '../../../core/result/Result';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import type { createGroupOperations, GroupOperationRuntime } from './groupOperations';
import { groupRotationTarget, type GroupSnapshot } from './groupSnapshot';
import { adjustedNeighbours, rotatedGroup } from './groupTransforms';
import GroupRotationDialog from './GroupRotationDialog.vue';

export function createGroupRotation(context: PlanEditorContext, runtime: GroupOperationRuntime, operations: ReturnType<typeof createGroupOperations>) {
	const dialogs = useDialogStore();
	function preview(snapshot: GroupSnapshot | null, points?: readonly Point[]): void {
		operations.preview.value = snapshot && points && operations.current(snapshot) ? rotatedGroup(snapshot, points) : null;
	}
	async function rotate(snapshot: GroupSnapshot, degrees?: number): Promise<void> {
		const element = groupRotationTarget(snapshot, true), pivot = element ? rotationPivot(element) : null;
		if (!element || !pivot) return;
		if (degrees !== undefined) {
			const points = rotationPoints(element, degrees, pivot), next = points ? rotatedGroup(snapshot, points) : null;
			if (next && points && rotationChanged(element.points, points)) await operations.commit(snapshot, next);
			return;
		}
		await operations.operate(snapshot, async (_baseline, dispatch) => {
			const busy = ref(false), latest = ref<string | null>(null), blocked = computed(() => !operations.current(snapshot));
			const affectedNeighbours = computed(() => operations.preview.value ? adjustedNeighbours(snapshot, operations.preview.value) : 0);
			const send = async (points: readonly Point[]) => {
				const next = rotatedGroup(snapshot, points); if (!next) return err(staleWriteRefusal());
				const result = await dispatch(next);
				if (!result.ok && !operations.current(snapshot)) latest.value = tr('editor.element.changed');
				return result;
			};
			await dialogs.openDialog({ kind: 'form', title: tr('editor.rotation.title', { name: snapshot.name }), component: markRaw(GroupRotationDialog), busy, props: {
				summary: tr('editor.group.transform-hint'), affectedNeighbours, form: { element, pivot, busy, blocked, latest, inputBlocked: blocked,
					retry: createDraftRetry(runtime.refreshProjection, () => operations.current(snapshot), context.commands.logger), openSource: () => context.openPlanNote(), logger: context.commands.logger,
					dispatch: send, preview: (points: readonly Point[] | null) => preview(points ? snapshot : null, points ?? undefined) },
			} });
		});
	}
	async function move(points: readonly Point[], original: RotationShape): Promise<void> {
		const snapshot = original.group; if (!snapshot || !operations.current(snapshot)) return;
		const next = rotatedGroup(snapshot, points); if (!next) return;
		await operations.commit(snapshot, next);
	}
	return { preview, rotate, move };
}

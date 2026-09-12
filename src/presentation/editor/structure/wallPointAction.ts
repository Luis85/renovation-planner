import { onBeforeUnmount, type Ref } from 'vue';
import type { PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { AppError } from '../../../core/errors/AppError';
import type { Result } from '../../../core/result/Result';
import { createEntityId } from '../../../core/identity/generateId';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { Structure } from '../../../domain/spatial/Structure';
import { splitWall } from '../../../domain/spatial/splitWall';
import type { PlanEditorContext } from '../PlanEditorContext';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import type { StructureServices } from './structureBulkEdit';

/**
 * A wall cut where the context menu opened, so its new junction drags like any wall end. It takes
 * the single edit's admission, stale-baseline check and reviewed write, so one undo joins the wall again.
 */
export function createWallPointAction(context: PlanEditorContext, state: {
	readonly active: Ref<boolean>;
	readonly unavailable: () => boolean;
	readonly prepareBaseline: (result: Result<PlanGeometrySnapshot, AppError>) => { snapshot: PlanGeometrySnapshot | null; recovery: Promise<void> | null };
	readonly reviewedWrite: (services: StructureServices, snapshot: PlanGeometrySnapshot) => { dispatch: (next: Structure) => Promise<DispatchResult> };
}) {
	let alive = true;
	onBeforeUnmount(() => { alive = false; });
	async function addPoint(id: string, offset: number): Promise<void> {
		const services = context.commands.structure;
		if (state.unavailable() || !services) return;
		state.active.value = true;
		try {
			const read = await services.read(context.planId as PlanId);
			if (!alive) return;
			const { snapshot, recovery } = state.prepareBaseline(read);
			if (!snapshot?.document.structure) { await recovery; return; }
			const cut = splitWall(snapshot.document.structure, id, offset, createEntityId('wall'));
			const result = cut.ok ? await state.reviewedWrite(services, snapshot).dispatch(cut.value.structure) : cut;
			if (alive && !result.ok) notifyOperationFailure(result.error);
		} catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.structure.edit-failed'); }
		finally { state.active.value = false; }
	}
	return { addPoint };
}

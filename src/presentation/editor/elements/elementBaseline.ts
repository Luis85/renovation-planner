import { computed, onBeforeUnmount, shallowRef } from 'vue';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import type { RenovationBaseline } from '../../../application/commands/renovation/RenovationCommand';
import type { PlanId } from '../../../domain/plan/PlanId';
import { undoSuperseded } from '../../../application/editor/WriteLedger';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import { sameElementMetadata } from '../../../domain/spatial/SpatialElement';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { spatialError } from '../../../domain/spatial/structureGeometry';
import { useProjectStore } from '../../stores/ProjectStore';
import { notifyFault } from '../../notices/notify';
import { tr } from '../../i18n/strings';
import { createElementDraft, ELEMENT_TOOLS, type ElementDraft, type ElementToolId } from './elementDraft';

/** A draft captures one baseline; read-only recovery cannot replace a captured baseline. */
export function createElementBaseline(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'refreshProjection'>, draft: ElementDraft) {
	const project = useProjectStore(), baseline = shallowRef<RenovationBaseline | null>(null);
	let alive = true, generation = 0, retrying = false;
	function stop(): void { generation++; retrying = false; Object.assign(draft, createElementDraft()); baseline.value = null; }
	function matches(read: RenovationBaseline): boolean {
		return sameElementMetadata(project.plan?.spatialElements, read.plan.entity.spatialElements) && sameGeometryDocument(
			{ objects: [], calibration: project.plan?.calibration ?? null, groups: project.groups, structure: project.structure, intended: project.intended },
			{ ...read.geometry.document, objects: [], structure: read.geometry.document.structure ?? EMPTY_STRUCTURE });
	}
	async function readBaseline(ticket: number): Promise<void> {
		draft.loading = true;
		try {
			const read = await context.commands.renovation?.read(context.planId as PlanId);
			if (!alive || generation !== ticket) return;
			if (!read?.ok) { draft.error = read ? read.error : spatialError('unavailable'); return; }
			if (!matches(read.value)) { draft.error = undoSuperseded(context.planId as PlanId); draft.conflict = true; await runtime.refreshProjection(); return; }
			baseline.value = read.value; draft.error = null;
		} catch (cause) { if (alive && ticket === generation) { draft.error = spatialError('unavailable'); notifyFault(cause, context.commands.logger, 'editor.element.read-failed'); } }
		finally { if (ticket === generation) draft.loading = false; }
	}
	function start(id: ElementToolId): void {
		stop(); draft.kind = ELEMENT_TOOLS[id];
		draft.name = tr(`editor.add.${draft.kind === 'object' ? 'item' : draft.kind}.label`);
		void readBaseline(generation);
	}
	async function retry(): Promise<void> {
		if (!alive || draft.loading || draft.busy || retrying) return;
		const ticket = generation; retrying = true;
		try {
			await runtime.refreshProjection();
			if (!alive || ticket !== generation) return;
			if (!baseline.value && !draft.conflict) await readBaseline(ticket);
		} catch (cause) { if (alive && ticket === generation) notifyFault(cause, context.commands.logger, 'editor.refresh.failed'); }
		finally { if (ticket === generation) retrying = false; }
	}
	const needsRead = computed(() => baseline.value === null && !draft.loading && !draft.conflict);
	onBeforeUnmount(() => { alive = false; stop(); });
	return { baseline, needsRead, start, stop, retry, ticket: () => generation, current: (ticket: number) => alive && ticket === generation };
}

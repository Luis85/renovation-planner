import type { Point } from '../../../core/geometry/Point';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { SessionWriteLedger } from '../../../application/editor/WriteLedger';
import { GetZone } from '../../../application/queries/GetZone';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { useProjectStore } from '../../stores/ProjectStore';
import { ReversibleMoveZoneCommand } from '../tools/reversible-move-zone-command';
import type { UndoableCommand } from '../tools/undoable-command';
import { err, ok } from '../../../core/result/Result';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import { elementInput } from './elementInput';
import { tr } from '../../i18n/strings';
import type { NamedRotationShape } from './objectRotation';

type Project = ReturnType<typeof useProjectStore>;
export function projectedRotationTarget(project: Project, id: string, walls: boolean): NamedRotationShape | null {
	const zone = project.zones.get(id);
	if (zone) return { id, name: zone.name, kind: zone.zoneType === 'Room' ? 'room' : 'area', points: zone.points };
	const element = project.structure.elements?.find(item => item.id === id), name = project.plan?.spatialElements?.find(item => item.id === id)?.name;
	if (element && name) return { ...element, name };
	if (!walls) return null;
	const opening = project.structure.openings.find(item => item.id === id), wall = project.structure.walls.find(item => item.id === (opening?.hostId ?? id));
	return wall ? { id, kind: 'wall', name: tr('editor.structure.wall-number', { n: String(project.structure.walls.indexOf(wall) + 1) }), points: [wall.start, wall.end], wall } : null;
}
export interface RotationBaseline {
	readonly shape: NamedRotationShape;
	command(points: readonly Point[]): UndoableCommand;
}
/** Source-specific reads/commands retain the existing guarded Zone and two-document element paths. */
async function readZoneBaseline(context: PlanEditorContext, shape: NamedRotationShape, ledger: SessionWriteLedger) {

		const loaded = await new GetZone(context.commands.zones).execute({ zoneId: shape.id as ZoneId });
		if (!loaded.ok) return loaded;
		if (!loaded.value || loaded.value.entity.planId !== context.planId) return err(staleWriteRefusal());
		const { entity, version } = loaded.value;
		if (entity.name !== shape.name || JSON.stringify(entity.geometry.points) !== JSON.stringify(shape.points)) return err(staleWriteRefusal());
		return ok<RotationBaseline>({ shape: { ...shape, points: entity.geometry.points }, command: points => new ReversibleMoveZoneCommand({ execute: input => context.commands.moveObject.execute({ ...input, expected: input.expected ?? version }) }, ledger, entity.id, { points }, entity.geometry) });
	}
async function readElementBaseline(context: PlanEditorContext, project: Project, shape: NamedRotationShape, ledger: SessionWriteLedger) {
	const service = context.commands.renovation;
	if (!service) return err(staleWriteRefusal());
	const result = await service.read(context.planId as PlanId);
	if (!result.ok) return result;
	const element = result.value.geometry.document.structure?.elements?.find(item => item.id === shape.id), name = result.value.plan.entity.spatialElements?.find(item => item.id === shape.id)?.name;
	const current = projectedRotationTarget(project, shape.id, false);
	if (!element || !name || JSON.stringify({ ...element, name }) !== JSON.stringify(current) || element.kind !== shape.kind || JSON.stringify(element.points) !== JSON.stringify(shape.points)) return err(staleWriteRefusal());
	const baseline = result.value;
	return ok<RotationBaseline>({ shape: { ...element, name }, command: points => service.command(baseline, elementInput(baseline, { ...element, name, points }), ledger) });
}

export function readRotationBaseline(context: PlanEditorContext, project: Project, shape: NamedRotationShape, ledger: SessionWriteLedger) {
	return shape.kind === 'room' || shape.kind === 'area' ? readZoneBaseline(context, shape, ledger) : readElementBaseline(context, project, shape, ledger);
}


// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { groupEditor } from '../../helpers/groupEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import OutlinePointsForm from '../../../src/presentation/editor/resize/OutlinePointsForm.vue';
import StructureEditForm from '../../../src/presentation/editor/structure/StructureEditForm.vue';
import ObjectRotationForm from '../../../src/presentation/editor/elements/ObjectRotationForm.vue';
import { rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { defer } from '../../helpers/async';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
const arrow: NamedSpatialElement = { id: 'element-context', kind: 'arrow', name: 'Route', points: [{ x: 100, y: 100 }, { x: 1200, y: 100 }] };

it.each(['selection', 'cancel', 'peer', 'dispose'] as const)('rejects Arrow edit callbacks after %s retirement', async reason => {
	const rig = await renovationEditor(); mounted.push(rig);
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, arrow), rig.runtime.structureTask.ledger)));
	rig.selection.select([arrow.id as never]); await settle();
	const operation = rig.runtime.elementActions.edit(arrow.id);
	await settleUntil(() => rig.wrapper.findComponent(OutlinePointsForm).exists(), 'Arrow form');
	const form = rig.wrapper.getComponent(OutlinePointsForm), props = form.props();
	if (reason === 'selection') { rig.selection.clear(); rig.selection.select([arrow.id as never]); }
	else if (reason === 'cancel') { rig.dialogs.resolve('cancel'); await operation; }
	else if (reason === 'dispose') { rig.unmount(); mounted.pop(); }
	else rig.project.structure = { ...rig.project.structure, elements: [{ ...arrow, points: [{ x: 0, y: 0 }, { x: 2000, y: 0 }] }] };
	await settle(); expect(props.blocked.value).toBe(true); expect(expectDefined(props.inputBlocked, 'input refusal').value).toBe(true);
	const write = vi.spyOn(rig.geometry, 'write'), polygon = { points: [{ x: 50, y: 50 }, { x: 300, y: 50 }] };
	props.preview(polygon); expect(rig.runtime.elementActions.preview.value).toBeNull();
	expect((await props.dispatch(polygon, 'Old callback')).ok).toBe(false); expect(write).not.toHaveBeenCalled();
	rig.dialogs.resolve('cancel'); await operation;
});

it.each(['selection', 'cancel', 'peer', 'dispose'] as const)('rejects wall edit callbacks after %s retirement', async reason => {
	const rig = await renovationEditor(); mounted.push(rig); rig.selection.select(['wall-a' as never]); await settle();
	const operation = rig.runtime.structureActions.edit('wall-a');
	await settleUntil(() => rig.wrapper.findComponent(StructureEditForm).exists(), 'wall form');
	const form = rig.wrapper.getComponent(StructureEditForm), props = form.props();
	if (reason === 'selection') { rig.selection.clear(); rig.selection.select(['wall-a' as never]); }
	else if (reason === 'cancel') { rig.dialogs.resolve('cancel'); await operation; }
	else if (reason === 'dispose') { rig.unmount(); mounted.pop(); }
	else rig.project.structure = { ...rig.project.structure, walls: rig.project.structure.walls.map(wall => ({ ...wall, height: 2900 })) };
	await settle(); expect(props.blocked.value).toBe(true);
	const write = vi.spyOn(rig.geometry, 'write'), next = { ...props.structure, walls: props.structure.walls.map(wall => ({ ...wall, height: 2800 })) };
	props.preview(next); expect(rig.runtime.structureActions.preview.value).toBeNull();
	expect((await props.dispatch(next)).ok).toBe(false); expect(write).not.toHaveBeenCalled();
	rig.dialogs.resolve('cancel'); await operation;
});

it('retires a saved-group numeric callback when Cancel closes the form', async () => {
	const rig = await groupEditor(); mounted.push(rig);
	const target = expectDefined(rig.runtime.groupActions.target.value, 'group target'), operation = rig.runtime.groupActions.rotate(target.id);
	await settleUntil(() => rig.wrapper.findComponent(ObjectRotationForm).exists(), 'group rotation form');
	const props = rig.wrapper.getComponent(ObjectRotationForm).props(), points = expectDefined(rotationPoints(props.element, 30, props.pivot), 'group proposal');
	rig.dialogs.resolve('cancel'); await operation;
	const write = vi.spyOn(rig.geometry, 'write');
	expect(props.blocked.value).toBe(true); props.preview(points); expect(rig.runtime.groupActions.preview.value).toBeNull();
	expect((await props.dispatch(points)).ok).toBe(false); expect(write).not.toHaveBeenCalled();
});

it.each(['clear', 'round-trip', 'review-round-trip'] as const)('refuses a queued curve finish in the same turn as a context %s', async change => {
	const rig = await renovationEditor(); mounted.push(rig);
	rig.selection.select([rig.room.id]); await settle();
	await rig.runtime.curveTask.open(rig.room.id); rig.runtime.curveTask.input('depth', '0.2');
	const bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write');
	if (change === 'review-round-trip') { rig.session.perspective = 'review'; rig.session.perspective = 'plan'; }
	else { rig.selection.clear(); if (change === 'round-trip') rig.selection.select([rig.room.id]); }
	const finished = rig.runtime.curveTask.finish(); await finished; await settle();
	expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	expect(rig.runtime.curveTask.preview.value).toBeNull();
});

it('retires a loading curve baseline through a selection round trip before its read returns', async () => {
	const rig = await renovationEditor(); mounted.push(rig); rig.selection.select([rig.room.id]); await settle();
	const services = expectDefined(rig.deps.commands.groups, 'geometry service'), read = await services.read(rig.plan.id), release = defer<void>();
	vi.spyOn(services, 'read').mockImplementationOnce(async () => { await release.promise; return read; });
	const opening = rig.runtime.curveTask.open(rig.room.id), write = vi.spyOn(rig.geometry, 'write');
	rig.selection.clear(); rig.selection.select([rig.room.id]); release.resolve(); await opening; await settle();
	expect(rig.runtime.curveTask.target.value).toBeNull(); expect(rig.runtime.curveTask.state.loading).toBe(false);
	expect(rig.runtime.activeToolId.value).toBe('select'); expect(write).not.toHaveBeenCalled();
});

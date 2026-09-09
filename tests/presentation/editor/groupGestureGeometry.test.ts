import { expect, it, vi } from 'vitest';
import { captureGroup, groupRotationTarget } from '../../../src/presentation/editor/groups/groupSnapshot';
import { rotatedGroup, translatedGroup, adjustedNeighbours } from '../../../src/presentation/editor/groups/groupTransforms';
import { GroupMoveGesture, type GroupMoveDependencies } from '../../../src/presentation/editor/groups/GroupMoveGesture';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { expectDefined } from '../../helpers/domain';
import { pointerAt, toolContext } from '../../helpers/tool-context';
import { MarqueeSelection } from '../../../src/presentation/editor/selection/MarqueeSelection';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import type { PlanGeometryDocument } from '../../../src/application/ports/PlanGeometrySidecar';

const document: PlanGeometryDocument = { calibration: null, objects: [], structure: { ...EMPTY_STRUCTURE, elements: [
	{ id: 'line-a', kind: 'measurement', points: [{ x: 20, y: 10 }, { x: 20, y: 100 }] },
	{ id: 'line-b', kind: 'measurement', points: [{ x: 20, y: 300 }, { x: 20, y: 500 }] },
] } };
const ids = ['line-a', 'line-b'];
const expandFixture = (id: string, deep: boolean) => id === 'deleted' ? [] : id === 'visible' && !deep ? ['visible', 'hidden'] : [id];
it('rotates a zero-width multi-selection envelope without collapsing its ordered line geometry', () => {
	const snapshot = expectDefined(captureGroup(document, ids, 7), 'multi-selection'), target = expectDefined(groupRotationTarget(snapshot, true), 'target');
	const pivot = expectDefined(rotationPivot(target), 'pivot'); expect(pivot).toEqual({ x: 20, y: 255 });
	const points = expectDefined(rotationPoints(target, 90, pivot), 'envelope'), result = expectDefined(rotatedGroup(snapshot, points), 'rotated');
	expect(result.structure?.elements?.[0].points).toEqual([{ x: 265, y: 255 }, { x: 175, y: 255 }]);
	expect(result.structure?.elements?.[1].points).toEqual([{ x: -25, y: 255 }, { x: -225, y: 255 }]);
	expect(document.structure?.elements?.[0].points[0]).toEqual({ x: 20, y: 10 });
});
it('refuses missing identities and singleton grouping, while preserving metadata during a whole-selection translation', () => {
	expect(captureGroup(document, [], 0)).toBeNull(); expect(captureGroup(document, ['missing', 'line-a'], 0)).toBeNull();
	expect(captureGroup(document, ['line-a'], 0)).toBeNull();
	const snapshot = expectDefined(captureGroup(document, ids, 0), 'selection');
	const result = translatedGroup(snapshot, { dx: 100.25, dy: -70.5 });
	expect(result.structure?.elements?.map(element => element.id)).toEqual(ids);
	expect(result.structure?.elements?.[0].points[0]).toEqual({ x: 120.25, y: -60.5 });
	expect(adjustedNeighbours(snapshot, result)).toBe(0);
});
it('admits only finite unmodified primary group drags and ignores secondary release until the actual primary release', () => {
	const snapshot = expectDefined(captureGroup(document, ids, 0), 'selection'), commit = vi.fn<GroupMoveDependencies['commit']>(async () => {}), preview = vi.fn<GroupMoveDependencies['preview']>();
	const gesture = new GroupMoveGesture({ capture: () => snapshot, current: () => true, scale: () => 2, commit, preview });
	for (const modifiers of [{ shift: true, alt: false, ctrl: false }, { shift: false, alt: true, ctrl: false }, { shift: false, alt: false, ctrl: true }]) expect(gesture.start(ids, { ...pointerAt(0, 0), modifiers })).toBe(false);
	expect(gesture.start(ids, pointerAt(NaN, 0))).toBe(false);
	gesture.start(ids, pointerAt(0, 0)); gesture.move(pointerAt(20, 30)); gesture.finish({ ...pointerAt(20, 30), button: 'secondary' });
	expect(gesture.active).toBe(true); expect(commit).not.toHaveBeenCalled(); gesture.finish(pointerAt(50, 60));
	expect(commit).toHaveBeenCalledExactlyOnceWith(snapshot, { dx: 50, dy: 60 }); expect(preview).toHaveBeenLastCalledWith(null);
});
it('cancels stale or nonfinite movement and produces no ghost or write for a refused capture', () => {
	const snapshot = expectDefined(captureGroup(document, ids, 0), 'selection'), commit = vi.fn<GroupMoveDependencies['commit']>(async () => {}), preview = vi.fn<GroupMoveDependencies['preview']>();
	let current = true;
	const gesture = new GroupMoveGesture({ capture: () => snapshot, current: () => current, scale: () => 1, commit, preview });
	gesture.move(pointerAt(0, 0)); gesture.finish(pointerAt(0, 0)); gesture.start(ids, pointerAt(0, 0)); current = false;
	gesture.move(pointerAt(30, 30)); expect(gesture.active).toBe(false);
	current = true; gesture.start(ids, pointerAt(0, 0)); gesture.move(pointerAt(Infinity, 30)); expect(gesture.active).toBe(false);
	gesture.start(ids, pointerAt(0, 0)); gesture.finish(pointerAt(NaN, 30)); expect(commit).not.toHaveBeenCalled();
	const refused = new GroupMoveGesture({ capture: () => null, current: () => true, scale: () => 1, commit, preview });
	expect(refused.start(ids, pointerAt(0, 0))).toBe(false); expect(refused.active).toBe(false);
});
it('expands saved groups from visible marquee hits and retains hidden selected members in additive selection', () => {
	const context = toolContext().context, marquee = new MarqueeSelection();
	const visible = [{ id: 'visible', points: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }] }];
	marquee.start(context, pointerAt(0, 0)); marquee.finish(context, pointerAt(15, 15), visible, expandFixture);
	expect(context.selection.selectedIds).toEqual(['visible', 'hidden']);
	context.selection.select(['hidden' as never, 'deleted' as never]);
	const shifted = { ...pointerAt(0, 0), modifiers: { shift: true, alt: false, ctrl: false } };
	marquee.start(context, shifted); marquee.finish(context, pointerAt(15, 15), visible, expandFixture);
	expect(context.selection.selectedIds).toEqual(['hidden', 'visible']);
	marquee.start(context, { ...pointerAt(0, 0), modifiers: { shift: false, alt: true, ctrl: false } });
	marquee.finish(context, pointerAt(15, 15), visible, expandFixture); expect(context.selection.selectedIds).toEqual(['visible']);
});

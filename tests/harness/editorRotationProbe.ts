import Konva from 'konva';
import { expectDefined } from '../helpers/domain';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';
import { rotationPivot } from '../../src/presentation/editor/elements/objectRotation';
import { projectedRotationTarget } from '../../src/presentation/editor/elements/rotationBaseline';
import { structureCandidates } from '../../src/presentation/editor/structure/structureCandidates';

/** A coordinate on the real rendered entity, used only to start native pointer hover. */
export function editorRotationHoverPoint(id: string) {
	const project = useProjectStore(), target = expectDefined(projectedRotationTarget(project, id, true), 'hover target');
	const stage = expectDefined(Konva.stages.find(candidate => candidate.findOne('.' + (target.wall?.id ?? id))), 'entity stage');
	const shape = expectDefined(stage.findOne<Konva.Group>('.' + (target.wall?.id ?? id)), 'entity node');
	const point = structureCandidates(project.structure).find(candidate => candidate.id === id)?.points[0] ?? target.points[0];
	const screen = shape.getAbsoluteTransform().point(point), origin = stage.container().getBoundingClientRect();
	return { x: origin.left + screen.x, y: origin.top + screen.y };
}

/** Read renderer nodes and the same projected target as the facade. All interaction remains native. */
export function editorRotationScene(id: string) {
	const stage = expectDefined(Konva.stages.find(candidate => candidate.findOne('.object-rotation-handle')), 'rotation stage');
	const handle = expectDefined(stage.findOne<Konva.Group>('.object-rotation-handle'), 'rotation handle');
	const layer = expectDefined(handle.getParent(), 'rotation world parent');
	const target = expectDefined(projectedRotationTarget(useProjectStore(), id, true), 'rotation target');
	const pivot = handle.getAbsoluteTransform().point(expectDefined(rotationPivot(target), 'pivot'));
	const origin = stage.container().getBoundingClientRect();
	const control = expectDefined(handle.findOne<Konva.Rect>('.rotation-control-target'), 'labelled rectangular target').getClientRect();
	const room = target.kind === 'room' || target.kind === 'area';
	const preview = room ? stage.findOne<Konva.Line>('.geometry-preview') : undefined;
	const shape = expectDefined(stage.findOne<Konva.Group>('.' + (target.wall?.id ?? id)), 'target shape');
	const line = preview ?? expectDefined(shape.findOne<Konva.Line>('Line'), 'target outline');
	const raw = line.points(), inverse = handle.getAbsoluteTransform().copy().invert();
	const points = preview ? Array.from({ length: raw.length / 2 }, (_, index) => inverse.point({ x: raw[index * 2], y: raw[index * 2 + 1] })).flatMap(point => [point.x, point.y]) : raw;
	return {
		kind: target.kind,
		control: { x: origin.left + control.x, y: origin.top + control.y, width: control.width, height: control.height },
		handle: { x: origin.left + control.x + control.width / 2, y: origin.top + control.y + control.height / 2 },
		pivot: { x: origin.left + pivot.x, y: origin.top + pivot.y },
		camera: { x: layer.x(), y: layer.y(), zoom: layer.scaleX() },
		points,
		angle: handle.findOne<Konva.Text>('.rotation-angle-label')?.text() ?? null,
		label: handle.findOne<Konva.Text>('.rotation-control-label')?.text() ?? null,
		instructions: handle.findOne<Konva.Text>('.rotation-instruction-label')?.text() ?? null,
	};
}

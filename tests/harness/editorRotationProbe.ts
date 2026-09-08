import Konva from 'konva';
import { expectDefined } from '../helpers/domain';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';
import { rotationPivot } from '../../src/presentation/editor/elements/objectRotation';
import { projectedRotationTarget } from '../../src/presentation/editor/elements/rotationBaseline';

/** Read renderer nodes and the same projected target as the facade. All interaction remains native. */
export function editorRotationScene(id: string) {
	const stage = expectDefined(Konva.stages.find(candidate => candidate.findOne('.object-rotation-handle')), 'rotation stage');
	const handle = expectDefined(stage.findOne<Konva.Group>('.object-rotation-handle'), 'rotation handle');
	const circle = expectDefined(handle.findOne<Konva.Circle>('Circle'), 'painted rotation circle');
	const layer = expectDefined(handle.getParent(), 'rotation world parent');
	const target = expectDefined(projectedRotationTarget(useProjectStore(), id, true), 'rotation target');
	const pivot = handle.getAbsoluteTransform().point(expectDefined(rotationPivot(target), 'pivot'));
	const origin = stage.container().getBoundingClientRect(), bounds = circle.getClientRect();
	const control = expectDefined(handle.findOne<Konva.Rect>('.rotation-control-target'), 'labelled rectangular target').getClientRect();
	const label = expectDefined(handle.findOne<Konva.Text>('.rotation-control-label'), 'visible rotation label').getClientRect();
	const room = target.kind === 'room' || target.kind === 'area';
	const preview = room ? stage.findOne<Konva.Line>('.geometry-preview') : undefined;
	const shape = expectDefined(stage.findOne<Konva.Group>('.' + (target.wall?.id ?? id)), 'target shape');
	const line = preview ?? expectDefined(shape.findOne<Konva.Line>('Line'), 'target outline');
	const raw = line.points(), inverse = handle.getAbsoluteTransform().copy().invert();
	const points = preview ? Array.from({ length: raw.length / 2 }, (_, index) => inverse.point({ x: raw[index * 2], y: raw[index * 2 + 1] })).flatMap(point => [point.x, point.y]) : raw;
	return {
		kind: target.kind,
		control: { x: origin.left + control.x, y: origin.top + control.y, width: control.width, height: control.height },
		labelPoint: { x: origin.left + label.x + label.width / 2, y: origin.top + label.y + label.height / 2 },
		handle: { x: origin.left + bounds.x + bounds.width / 2, y: origin.top + bounds.y + bounds.height / 2 },
		pivot: { x: origin.left + pivot.x, y: origin.top + pivot.y },
		camera: { x: layer.x(), y: layer.y(), zoom: layer.scaleX() },
		points,
		angle: handle.findOne<Konva.Text>('.rotation-angle-label')?.text() ?? null,
		label: handle.findOne<Konva.Text>('.rotation-control-label')?.text() ?? null,
		instructions: handle.findOne<Konva.Text>('.rotation-instruction-label')?.text() ?? null,
	};
}

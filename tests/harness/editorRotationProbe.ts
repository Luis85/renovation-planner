import Konva from 'konva';
import { expectDefined } from '../helpers/domain';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';
import { rotationPivot } from '../../src/presentation/editor/elements/objectRotation';

/** Read-only scene probe for the single-Object browser journey; all input remains native. */
export function editorRotationScene(id: string) {
	const stage = expectDefined(Konva.stages.find(candidate => candidate.findOne('.object-rotation-handle')), 'rotation stage');
	const handle = expectDefined(stage.findOne<Konva.Group>('.object-rotation-handle'), 'rotation handle');
	const circle = expectDefined(handle.findOne<Konva.Circle>('Circle'), 'painted rotation circle');
	const layer = expectDefined(stage.findOne<Konva.Layer>('.architecture'), 'architecture layer');
	const element = expectDefined(useProjectStore().structure.elements?.find(item => item.id === id), 'saved Object');
	const pivot = handle.getAbsoluteTransform().point(expectDefined(rotationPivot(element), 'pivot'));
	const origin = stage.container().getBoundingClientRect(), bounds = circle.getClientRect();
	const shape = expectDefined(stage.findOne<Konva.Group>('.element-object'), 'single Object shape');
	return {
		handle: { x: origin.left + bounds.x + bounds.width / 2, y: origin.top + bounds.y + bounds.height / 2 },
		pivot: { x: origin.left + pivot.x, y: origin.top + pivot.y },
		camera: { x: layer.x(), y: layer.y(), zoom: layer.scaleX() },
		points: expectDefined(shape.findOne<Konva.Line>('Line'), 'Object outline').points(),
		angle: handle.findOne<Konva.Text>('Text')?.text() ?? null,
	};
}

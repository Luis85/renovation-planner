import Konva from 'konva';
import { expectDefined } from '../helpers/domain';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';
import { ANGLE_STEP_RADIANS } from '../../src/presentation/editor/snapping/editorSnapping';

function paintedElement(shape: Konva.Group | undefined, origin: { left: number; top: number }) {
	if (!shape) return { stair: null, arrow: null, endpoints: [] };
	const outline = shape.findOne<Konva.Line>('.stair-outline'), direction = shape.findOne<Konva.Arrow>('.stair-direction');
	const arrow = shape.findOne<Konva.Arrow>('.direction-arrow');
	return {
		stair: outline && direction ? { outline: outline.points(), treads: shape.find<Konva.Line>('.stair-tread').map(line => line.points()),
			direction: { type: direction.getClassName(), points: direction.points(), headPixels: direction.pointerLength() * direction.getAbsoluteScale().x } } : null,
		arrow: arrow ? { type: arrow.getClassName(), points: arrow.points(), headPixels: arrow.pointerLength() * arrow.getAbsoluteScale().x } : null,
		endpoints: shape.find<Konva.Circle>('.arrow-endpoint').map(circle => {
			const point = circle.getAbsolutePosition(); return { x: origin.left + point.x, y: origin.top + point.y };
		}),
	};
}

/** Read-only renderer/projection evidence. Native browser input owns every edit and camera change. */
export function editorElementScene(id: string | null = null) {
	const stage = expectDefined(Konva.stages.find(value => value.findOne('.architecture')), 'element stage');
	const layer = expectDefined(stage.findOne<Konva.Layer>('.architecture'), 'architecture layer');
	const project = useProjectStore(), element = project.structure.elements?.find(value => value.id === id);
	const shape = id ? layer.findOne<Konva.Group>('.' + id) : undefined;
	const origin = stage.container().getBoundingClientRect();
	const stored = element ? { id: element.id, kind: element.kind, name: project.plan?.spatialElements?.find(value => value.id === id)?.name,
		points: element.points, stair: element.stair ?? null } : null;
	return {
		stored: JSON.parse(JSON.stringify(stored)) as unknown,
		ids: project.structure.elements?.map(value => value.id) ?? [],
		origin: { x: origin.left, y: origin.top }, matrix: layer.getAbsoluteTransform().getMatrix(),
		referenceVisible: expectDefined(stage.findOne<Konva.Layer>('.background'), 'reference layer').visible(),
		drawingStepDegrees: ANGLE_STEP_RADIANS * 180 / Math.PI,
		...paintedElement(shape, origin),
	};
}

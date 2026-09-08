import Konva from 'konva';
import { expectDefined } from '../helpers/domain';

/** Read actual canvas bend controls and paint; this probe never edits the draft or persisted data. */
export function editorCurveScene(id: string) {
	const stage = expectDefined(Konva.stages.find(candidate => candidate.findOne('.' + id)), 'curve stage');
	const shape = expectDefined(stage.findOne<Konva.Group>('.' + id), 'curve shape');
	const origin = stage.container().getBoundingClientRect();
	const controls = stage.findOne<Konva.Group>('.curve-bend-handles');
	const handles = controls?.find<Konva.Circle>('Circle').map(circle => {
		const point = circle.getAbsolutePosition();
		return { name: circle.name(), x: origin.left + point.x, y: origin.top + point.y };
	}) ?? [];
	return { handles, points: expectDefined(shape.findOne<Konva.Line>('Line'), 'curve paint').points() };
}

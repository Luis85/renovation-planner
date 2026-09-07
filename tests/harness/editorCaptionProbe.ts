import Konva from 'konva';
import { expectDefined } from '../helpers/domain';

/** Read actual renderer nodes only; browser input remains responsible for every interaction. */
export function editorCaptionScene(roomId: string) {
	const stage = expectDefined(Konva.stages.find(candidate => candidate.findOne('.zone')), 'editor stage');
	const layer = expectDefined(stage.findOne<Konva.Layer>('.zone'), 'zone layer');
	const room = expectDefined(layer.findOne<Konva.Group>('.' + roomId), 'selected room group');
	const dimensions = expectDefined(document.querySelector<HTMLElement>('.rp-dimension-labels'), 'dimension overlay');
	const origin = stage.container().getBoundingClientRect();
	return {
		camera: { x: layer.x(), y: layer.y(), zoom: layer.scaleX() },
		size: { width: stage.width(), height: stage.height() },
		captions: room.find<Konva.Text>('Text').map(text => ({ text: text.text(), fontSize: text.fontSize(), bounds: text.getClientRect() })),
		points: room.find<Konva.Line>('Line').map(line => line.points()),
		pins: stage.find<Konva.Group>('.evidence-pin').map(pin => ({ position: pin.position(), bounds: expectDefined(pin.findOne('.evidence-pin-target'), 'pin target').getClientRect() })),
		controls: [...dimensions.querySelectorAll<HTMLElement>('.rp-dimension-anchor')].map(anchor => {
			const box = anchor.getBoundingClientRect();
			return { x: box.left - origin.left - 4, y: box.top - origin.top - 4, width: box.width + 8, height: box.height + 8 };
		}),
	};
}

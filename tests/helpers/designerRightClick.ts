import type { Point } from '../../src/core/geometry/Point';
import type { DesignerRig } from './designerRig';

/**
 * A real right-click at a world point: the secondary button's down and up, then the `contextmenu` event
 * the designer's menu listens for — Windows' order, where the menu event follows the release. Answers
 * the `contextmenu` event, so a caller can ask whether the menu claimed it. One definition for every
 * designer test that right-clicks: fallow reads no `*.test.ts` file, so a copy in each is invisible to it.
 */
export function rightClick(rig: DesignerRig, world: Point, target: Element = rig.canvasEl): MouseEvent {
	const at = rig.at(world);
	target.dispatchEvent(new PointerEvent('pointerdown', { button: 2, buttons: 2, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }));
	target.dispatchEvent(new PointerEvent('pointerup', { button: 2, buttons: 0, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }));
	const event = new MouseEvent('contextmenu', { button: 2, clientX: at.x, clientY: at.y, bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

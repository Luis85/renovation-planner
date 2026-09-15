import type { Opening, Wall } from '../../../domain/spatial/Structure';
import { openingSymbol } from '../../../domain/spatial/openingGeometry';
import { STAGE_PIXELS, worldToScreen, type Viewport } from '../viewport/Viewport';

/** Reserve the complete leaf/swing and the taskbar; forms scroll within the remaining rectangle. */
export function openingDirectLayout(opening: Opening, wall: Wall, viewport: Viewport, width: number, bottom: number) {
	const symbol = openingSymbol(opening, wall), points = [...symbol.cut, ...symbol.frame.flat(), ...symbol.leaf, ...symbol.arc].map(point => worldToScreen(point, viewport, STAGE_PIXELS));
	const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
	const minY = Math.min(...points.map(point => point.y)), maxY = Math.max(...points.map(point => point.y));
	const boxes = [
		{ x: 8, y: 8, width: width - 16, height: minY - 24 },
		{ x: 8, y: maxY + 16, width: width - 16, height: bottom - maxY - 24 },
		{ x: 8, y: 8, width: minX - 24, height: bottom - 16 },
		{ x: maxX + 16, y: 8, width: width - maxX - 24, height: bottom - 16 },
	].filter(box => box.width >= Math.min(260, width - 16) && box.height >= 44);
	const chosen = boxes.toSorted((a, b) => Math.min(360, b.width) * Math.min(480, b.height) - Math.min(360, a.width) * Math.min(480, a.height))[0];
	return chosen ? { left: chosen.x + 'px', top: chosen.y + 'px', width: Math.min(360, chosen.width) + 'px', maxHeight: chosen.height + 'px' } : { left: '8px', top: '8px', width: Math.max(0, width - 16) + 'px', maxHeight: Math.max(44, bottom - 16) + 'px' };
}

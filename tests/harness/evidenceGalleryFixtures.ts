import { expectDefined } from '../helpers/domain';

/** Browser test inputs only: the existing recovery fixture's real canvas/PNG technique. */
export function evidenceGalleryFixtures(): Readonly<Record<string, string>> {
	const sources: Record<string, string> = {};
	for (let index = 0; index < 6; index++) {
		const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1200;
		const context = expectDefined(canvas.getContext('2d'), 'synthetic evidence canvas');
		context.fillStyle = `hsl(${index * 35} 12% 78%)`; context.fillRect(0, 0, 1600, 1200);
		context.strokeStyle = '#767676'; context.lineWidth = 14;
		context.strokeRect(100 + index * 35, 280, 1100, 730);
		context.beginPath(); context.moveTo(100, 1000 - index * 50); context.lineTo(1450, 500 + index * 65); context.stroke();
		context.fillStyle = '#252525'; context.font = '60px sans-serif';
		context.fillText(`SYNTHETIC TEST IMAGE ${index + 1}`, 80, 150);
		sources[`gallery-${index + 1}.png`] = canvas.toDataURL('image/png');
		canvas.width = 0; canvas.height = 0;
	}
	return sources;
}

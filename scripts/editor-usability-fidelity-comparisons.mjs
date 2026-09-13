import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';

// Review boards only: scale entire accepted images without cropping/repainting source assets.
const base = 'docs/user-experience/editor-usability-increment';
const out = `${base}/astra-ui-fidelity/comparisons`;
await mkdir(out, { recursive: true });
const boards = [
	['modes', 'hybrid-01-modes', ['03-plan-selection', '04-renovate-selection']],
	['dark', 'ux10-dark', ['12-dark-plan', '13-dark-renovate']],
	['narrow', 'ux09-narrow-v2', ['07-narrow-canvas', '08-de-dark-draft', '11-de-renovate-canvas']],
];
for (const [name, reference, captures] of boards) {
	const proposed = await loadImage(`${base}/mockups/images/${reference}.png`);
	const actual = await Promise.all(captures.map(file => loadImage(`${base}/astra-ui-fidelity/after/${file}.png`)));
	const width = 1536, refHeight = Math.round(proposed.height * width / proposed.width), slot = width / actual.length;
	const actualHeight = Math.max(...actual.map(img => Math.round(img.height * slot / img.width)));
	const canvas = createCanvas(width, refHeight + actualHeight + 64), context = canvas.getContext('2d');
	context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
	context.drawImage(proposed, 0, 0, width, refHeight);
	context.fillStyle = '#222'; context.font = '22px sans-serif';
	context.fillText('Implemented synthetic fixture — hierarchy comparison, not a geometry or pixel match', 20, refHeight + 40);
	actual.forEach((img, index) => context.drawImage(img, index * slot, refHeight + 64, slot, img.height * slot / img.width));
	await writeFile(`${out}/${name}.png`, canvas.toBuffer('image/png'));
}

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdir, readdir, writeFile } from 'node:fs/promises';

// Contact sheets compare app-owned content; reference host chrome is cropped out.
const root = 'docs/user-experience/renovation-planner-editor-specs';
const evidence = `${root}/implementation/evidence/editor-visual-fidelity`;
const output = `${evidence}/comparisons`;
await mkdir(output, { recursive: true });
const references = await readdir(`${root}/images`);
const planning = 'materials-costs-evidence';
const renovation = 'renovation-workflow';
const pairs = [
	['M00', 'light-M00-room.png', 'editor-visual-overview/light-M00-connected-room.png'], ['M01', 'light-M01-floor.png', 'editor-visual-overview/light-M01-connected-floor.png'],
	['M02', 'light-M02-add.png', 'editor-visual-overview/light-M02-connected-add.png'], ['M03', 'light-M03-room-draft.png'],
	['M04', `${planning}/dark-closed-loop.png`], ['M05', 'light-M05-start.png'],
	['M06', 'reference-plan/light-measurement.png'], ['M07', `${planning}/light-wall-inspector.png`, 'editor-visual-overview/light-M07-connected-wall.png'],
	['M08', `${renovation}/dark-existing.png`], ['M09', `${renovation}/light-planned.png`],
	['M10', `${renovation}/dark-work.png`], ['M11', 'light-M11-multiple.png', 'editor-visual-overview/light-M11-connected-selection.png'],
	['M12', `${planning}/light-materials.png`], ['M13', `${planning}/dark-costs.png`],
	['M14', `${planning}/light-photos.png`], ['M15', 'light-M15-stale.png', 'planning-recovery/light-saved-refresh-needed.png'],
	['M16', `${planning}/german-constrained-materials.png`], ['M17', `${planning}/light-review.png`],
];
const manifest = [];
function label(ctx, text, x) {
	ctx.fillStyle = '#202020'; ctx.font = '20px Arial'; ctx.fillText(text, x + 16, 32);
}
function draw(ctx, source, crop, x, { width = 720, height = 500 } = {}) {
	const factor = Math.min(width / crop.width, height / crop.height);
	ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, x, 50, crop.width * factor, crop.height * factor);
}
for (const [screen, capture, finalCapture = capture] of pairs) {
	const referencePath = references.find(name => name.startsWith(screen));
	const reference = await loadImage(`${root}/images/${referencePath}`);
	const before = await loadImage(`${evidence}/before/${capture}`);
	const after = await loadImage(`${evidence}/after/${finalCapture}`);
	const board = createCanvas(2160, 550), ctx = board.getContext('2d');
	ctx.fillStyle = '#eeeeee'; ctx.fillRect(0, 0, board.width, board.height);
	label(ctx, `${screen} · locked reference (app crop)`, 0); label(ctx, 'Before · production harness', 720); label(ctx, 'After · production harness', 1440);
	// The reference family includes host chrome at left/top/bottom.
	const referenceCrop = { x: Math.round(reference.width * .037), y: Math.round(reference.height * .058), width: Math.round(reference.width * .958), height: Math.round(reference.height * .896) };
	if (screen === 'M16') referenceCrop.width = Math.round(reference.width * .642);
	draw(ctx, reference, referenceCrop, 0);
	draw(ctx, before, { x: 0, y: 0, width: before.width, height: before.height }, 720);
	draw(ctx, after, { x: 0, y: 0, width: after.width, height: after.height }, 1440);
	await writeFile(`${output}/${screen}-full.png`, board.toBuffer('image/png'));
	const detail = createCanvas(800, 1150), detailCtx = detail.getContext('2d');
	detailCtx.fillStyle = '#eeeeee'; detailCtx.fillRect(0, 0, detail.width, detail.height);
	label(detailCtx, `${screen} · reference detail`, 0); label(detailCtx, 'Production detail', 400);
	const referenceDetail = ['M02', 'M04', 'M05', 'M06', 'M15', 'M16'].includes(screen) ? referenceCrop : { x: Math.round(reference.width * .77), y: Math.round(reference.height * .123), width: Math.round(reference.width * .23), height: Math.round(reference.height * .783) };
	const afterDetail = ['M02', 'M04', 'M05', 'M06', 'M15', 'M16'].includes(screen) ? { x: 0, y: 0, width: after.width, height: after.height } : { x: after.width - 360, y: 52, width: 360, height: after.height - 88 };
	draw(detailCtx, reference, referenceDetail, 0, { width: 360, height: 1100 }); draw(detailCtx, after, afterDetail, 400, { width: 360, height: 1100 });
	await writeFile(`${output}/${screen}-detail.png`, detail.toBuffer('image/png'));
	manifest.push({ screen, reference: referencePath, capture, finalCapture, referenceSize: [reference.width, reference.height], beforeSize: [before.width, before.height], afterSize: [after.width, after.height], referenceCrop, referenceDetail, afterDetail });
}
await writeFile(`${output}/manifest.json`, JSON.stringify({ method: 'Aspect-preserving app crops in equal comparison cells; fixture geometry and content are not replaced to match the illustrations.', screens: manifest }, null, 2));

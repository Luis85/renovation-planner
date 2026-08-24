/**
 * Draws the PNG background fixture the manual smoke test sets on a plan
 * (`docs/tests/cases/Editor Walkthrough.md`, step 7).
 *
 * **Why a generator and not just a committed PNG.** `tests/helpers/backgroundFixtures.ts`
 * makes the case against checked-in binaries — "a file nobody can read in a diff and nobody
 * can adjust without a tool" — and it is right. But a walkthrough happens in a real vault,
 * so step 7 needs a real file on disk, exactly as step 8 needs a real PDF. Committing the
 * SCRIPT beside the PNG answers the objection: the picture is reviewable as code, anyone can
 * change what it says and re-run, and the binary is a build product that happens to be
 * tracked.
 *
 * **What the picture is FOR** decides everything on it. A plain photo would prove only that
 * something appeared; every mark here exists so a human can tell a correct render from a
 * plausible one:
 *
 * - A **100mm minor / 1000mm major grid with metre labels**, because a raster background is
 *   declared to be one world millimetre per source pixel until slice 7 calibrates it
 *   (`PLACEHOLDER_WORLD_SCALE`). The labels make that convention readable off the canvas:
 *   the status bar's world-millimetre readout should agree with the gridline under the
 *   pointer.
 * - An **origin marker**, because the top-left corner is pinned to world (0,0)
 *   (`WORLD_ORIGIN`). If the image is drawn centred, or offset by its own height, this is
 *   the mark that shows it.
 * - **Deliberate asymmetry** — a solid triangle near the top-left, an open circle at the
 *   bottom-right, a 3:2 aspect and text that reads only one way up. A mirrored or
 *   transposed draw is invisible on a symmetrical test image, and "it rendered" is exactly
 *   the assertion that misses it.
 * - **A room outline with a door arc**, so the sheet reads as a plan under the zones and so
 *   the raster carries a curve rather than only axis-aligned lines.
 *
 * The size is 3000x2000 px = 3.0m x 2.0m of world space, which is chosen against the sample
 * project's own geometry (`src/plugin/sampleProject.ts`): it sits inside the 4200x3000mm
 * Kitchen and its right and bottom edges fall INSIDE that zone rather than under a
 * neighbour. So the fixture is visible through the zone fill — 0.28 opacity, translucent on
 * purpose so a background shows through — and its edges are visible against it, which is
 * what makes "under the zones" checkable instead of assumed.
 */
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

/** World millimetres per source pixel — `PLACEHOLDER_WORLD_SCALE`, restated as a fact. */
const MM_PER_PIXEL = 1;

const WIDTH = 3000;
const HEIGHT = 2000;
const MINOR_GRID = 100;
const MAJOR_GRID = 1000;

/**
 * Paper-light with dark ink, and not a theme-aware pair, because a raster cannot be one.
 * A light sheet is what a floor plan looks like and it reads against either of Obsidian's
 * canvas backgrounds; the alternative — a mid-grey that offends neither — would be legible
 * in neither.
 */
const PAPER = '#f6f3ec';
const INK = '#1f2933';
const MINOR = '#d8d2c4';
const MAJOR = '#a8a093';
const ACCENT = '#b4562a';

const canvas = createCanvas(WIDTH, HEIGHT);
const context = canvas.getContext('2d');

context.fillStyle = PAPER;
context.fillRect(0, 0, WIDTH, HEIGHT);

/** One pass per grid step, coarse last, so a major line is never half-covered by a minor. */
function grid(step, colour, lineWidth) {
	context.strokeStyle = colour;
	context.lineWidth = lineWidth;
	context.beginPath();
	for (let x = 0; x <= WIDTH; x += step) {
		context.moveTo(x, 0);
		context.lineTo(x, HEIGHT);
	}
	for (let y = 0; y <= HEIGHT; y += step) {
		context.moveTo(0, y);
		context.lineTo(WIDTH, y);
	}
	context.stroke();
}

grid(MINOR_GRID, MINOR, 2);
grid(MAJOR_GRID, MAJOR, 6);

// A room, so the sheet reads as a plan rather than as graph paper — and a door ARC, so the
// raster carries a curve and not only the axis-aligned lines a grid already proves.
context.strokeStyle = INK;
context.lineWidth = 24;
context.beginPath();
context.moveTo(400, 1600);
context.lineTo(400, 400);
context.lineTo(2600, 400);
context.lineTo(2600, 1600);
context.lineTo(1500, 1600);
context.stroke();

context.lineWidth = 8;
context.beginPath();
context.arc(1100, 1600, 400, -Math.PI / 2, 0);
context.stroke();
context.beginPath();
context.moveTo(1100, 1600);
context.lineTo(1100, 1200);
context.stroke();

// The origin: world (0,0) is this corner, and nothing else on the sheet says so.
context.strokeStyle = ACCENT;
context.lineWidth = 16;
// INSET by half the stroke: drawn on the edge itself, half of every line falls outside the
// canvas and the corner reads as two stray ticks. Found by looking at the output, which is
// the only thing that can find it.
context.beginPath();
context.moveTo(12, 300);
context.lineTo(12, 12);
context.lineTo(300, 12);
context.stroke();

context.fillStyle = ACCENT;
// A solid triangle here and an open circle at the far corner: the pair is what makes a
// mirrored or transposed draw obvious, which a symmetrical sheet cannot show. Below the
// origin corner and left of the title block, so it collides with neither.
context.beginPath();
context.moveTo(150, 400);
context.lineTo(215, 520);
context.lineTo(85, 520);
context.closePath();
context.fill();

context.strokeStyle = ACCENT;
context.lineWidth = 12;
context.beginPath();
context.arc(WIDTH - 160, HEIGHT - 160, 70, 0, Math.PI * 2);
context.stroke();

// A metre scale bar with end ticks — the one mark that can be measured against the status
// bar's world readout rather than merely looked at.
// Below the room's bottom wall (y = 1600) rather than level with it: at `HEIGHT - 320` the
// label sat exactly on that wall and the wall struck the text through.
const barY = HEIGHT - 130;
context.strokeStyle = INK;
context.lineWidth = 10;
context.beginPath();
context.moveTo(400, barY);
context.lineTo(400 + MAJOR_GRID, barY);
context.moveTo(400, barY - 40);
context.lineTo(400, barY + 40);
context.moveTo(400 + MAJOR_GRID, barY - 40);
context.lineTo(400 + MAJOR_GRID, barY + 40);
context.stroke();

context.font = '600 64px sans-serif';
context.fillStyle = INK;
context.textBaseline = 'alphabetic';
context.fillText(`${MAJOR_GRID} mm`, 400, barY - 70);

// Text last, so nothing is drawn over it. It is also the third asymmetry: legible one way
// up and one way round only.
context.font = '700 84px sans-serif';
context.fillText('Plan editor smoke test', 400, 240);
context.font = '48px sans-serif';
context.fillText(`${WIDTH} x ${HEIGHT} px = ${WIDTH * MM_PER_PIXEL} x ${HEIGHT * MM_PER_PIXEL} mm at 1 px = 1 mm`, 400, 320);
context.fillText('top-left of this sheet is world (0, 0)', 400, 380);

// Metre labels along both axes, so the grid can be read rather than counted.
context.font = '600 52px sans-serif';
context.fillStyle = MAJOR;
for (let x = MAJOR_GRID; x < WIDTH; x += MAJOR_GRID) {
	context.fillText(`${x / 1000} m`, x + 16, 68);
}
for (let y = MAJOR_GRID; y < HEIGHT; y += MAJOR_GRID) {
	context.fillText(`${y / 1000} m`, 16, y - 16);
}

const out = 'docs/tests/fixtures/editor-background-png-test.png';
writeFileSync(out, canvas.encodeSync('png'));
console.log(`${out} — ${WIDTH}x${HEIGHT} px (${WIDTH * MM_PER_PIXEL}x${HEIGHT * MM_PER_PIXEL} mm at 1 px = 1 mm)`);

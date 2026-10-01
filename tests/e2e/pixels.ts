import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { expect } from 'vitest';
import type { NativeBrowser } from './session';

/**
 * What the pixel guards (AD18-R30) share: one element as the renderer painted it, and how much of
 * one such picture differs from another's. Both pictures are always taken in the SAME session and
 * compared to each other — never to a stored image, since a capture's size is in device pixels and
 * its antialiasing is the platform's (probe Q3: byte-identical within a session, untested across
 * sessions, machines or device pixel ratios).
 */

/**
 * The device pixel ratios every guard is read at, whatever the machine's own: this one's is 2, CI's
 * xvfb legs are EXPECTED to be 1 (each case's evidence records `nativeDevicePixelRatio`, which is
 * where to read it), and a thin line rasterises differently at each.
 */
export const RATIOS = [1, 2] as const;

/**
 * `read` with the page drawn at `ratio` device pixels per CSS pixel, through CDP's own
 * `Emulation.setDeviceMetricsOverride` (a width and height of 0 leave the window's size alone),
 * cleared in a `finally` so the override never outlives the read.
 */
export async function atPixelRatio<T>(browser: NativeBrowser, ratio: number, read: () => Promise<T>): Promise<T> {
	await browser.sendCommandAndGetResult('Emulation.setDeviceMetricsOverride', { width: 0, height: 0, deviceScaleFactor: ratio, mobile: false });
	try {
		await expect.poll(() => browser.execute(() => window.devicePixelRatio)).toBe(ratio);
		return await read();
	} finally {
		await browser.sendCommandAndGetResult('Emulation.clearDeviceMetricsOverride', {});
	}
}

/**
 * The element `selector` finds, STAGED and then photographed: a deep copy of it, at its own CSS
 * size, in a fixed box on an opaque `--background-primary` placed at WHOLE CSS pixels 8 px inside
 * its leaf's top-left corner, and appended to the element's own parent so every descendant
 * selector the shipped stylesheet draws it with still matches. Every picture a guard compares is
 * therefore drawn at the same spot and the same device-pixel phase — in its own row, a 1 px line
 * half a pixel off rasterises as two half-strength pixels where a copy one row down draws one full
 * one, which reads as a different drawing: a copy staged 0.5 px low read 8 px apart from its twin
 * at a ratio of 1, in a deliberate experiment. That is a MEASURED hazard, not one CI has hit — see
 * the next paragraph for what CI hit. So the picture is the shipped markup under the shipped
 * stylesheet, drawn at a fixed spot rather than in its row.
 *
 * The copy is taken only while the element matches `state`, checked in the same synchronous step
 * that clones it and retried until it does (10 s): what is photographed is a static snapshot of
 * that state, which nothing can re-render afterwards. Without it a mark the library re-reads at the
 * wrong moment is photographed as *not yet read*, and that is what BOTH of CI's red runs were (runs
 * 36345605529 and 36476196536, `[0, 26, 0]` each): the Reading chair's unscaled control copy
 * byte-identical to the case's own held pending capture, after every class had been polled correct.
 * Replaying it — a re-read held across that one capture — reads `[0, 32, 0]` with no `state` and
 * passes with it.
 *
 * What the stage does NOT carry, and why none of it can turn a mutation green: the host row's or
 * card's own background (the stage's is `--background-primary`), clipping by an ancestor's
 * `overflow`, and the half-pixel row position a ratio-1 display may actually draw the mark at. A
 * copy that is covered or clipped makes every picture alike, which reddens the pairs; a dropped
 * background can only remove a signal, never add one. What a mark looks like on a half-pixel row
 * is the human half of the clause.
 *
 * Captured through CDP's own `Page.captureScreenshot`, clipped to the box (CSS px in, device px
 * out), and written to the case's evidence folder as `<name>.png`; the copy is removed after.
 */
export async function capture(browser: NativeBrowser, selector: string, directory: string, name: string, state = '*'): Promise<string> {
	const staged = () => browser.execute((sel, wanted) => {
		const element = document.querySelector(sel);
		const leaf = element?.closest('.workspace-leaf-content');
		if (!element?.parentElement || !leaf || !element.matches(wanted)) return null;
		const { width, height } = element.getBoundingClientRect();
		const copy = element.cloneNode(true) as SVGElement | HTMLElement;
		// Property by property, so an inline style the shipped element carries reaches the copy too.
		copy.style.setProperty('display', 'block');
		copy.style.setProperty('margin', '0');
		copy.style.setProperty('width', `${String(width)}px`);
		copy.style.setProperty('height', `${String(height)}px`);
		const stage = document.createElement('div');
		stage.className = 'rp-e2e-stage';
		const [wide, tall] = [Math.ceil(width), Math.ceil(height)];
		stage.style.cssText = `position: fixed; z-index: 10000; margin: 0; padding: 0; border: 0; background: var(--background-primary); width: ${String(wide)}px; height: ${String(tall)}px;`;
		stage.append(copy);
		element.parentElement.append(stage);
		const corner = leaf.getBoundingClientRect();
		const target = { x: Math.round(corner.left) + 8, y: Math.round(corner.top) + 8 };
		// A fixed box is placed against the viewport unless an ancestor contains it; measured and
		// moved by what is left over, so the box lands on the target whichever it is.
		stage.style.left = `${String(target.x)}px`;
		stage.style.top = `${String(target.y)}px`;
		const placed = stage.getBoundingClientRect();
		stage.style.left = `${String(2 * target.x - placed.left)}px`;
		stage.style.top = `${String(2 * target.y - placed.top)}px`;
		const landed = stage.getBoundingClientRect();
		return { x: landed.left, y: landed.top, width: wide, height: tall, scale: 1 };
	}, selector, state);
	const deadline = Date.now() + 10_000;
	let clip = await staged();
	while (!clip && Date.now() < deadline) {
		await browser.pause(100);
		clip = await staged();
	}
	if (!clip) throw new Error(`Nothing matching ${state} to capture at ${selector}.`);
	try {
		if (!Number.isInteger(clip.x) || !Number.isInteger(clip.y)) throw new Error(`The stage landed off whole pixels, at ${String(clip.x)}, ${String(clip.y)}.`);
		const { data } = (await browser.sendCommandAndGetResult('Page.captureScreenshot', { format: 'png', clip })) as { data: string };
		await writeFile(path.join(directory, `${name}.png`), Buffer.from(data, 'base64'));
		return data;
	} finally {
		await browser.execute(() => { document.querySelectorAll('.rp-e2e-stage').forEach((stage) => { stage.remove(); }); });
	}
}

/**
 * The share of two pictures' inked pixels that must differ for a guard to call them different
 * drawings. STATED, not measured: two captures of one drawing differ in none (probe Q3), and two
 * pictures differing in under a tenth of their lines are pictures a person has to hunt over.
 */
export const DISTINCT = 0.1;

/** Two captures compared as DRAWINGS, and the counts the comparison rests on. */
export interface Difference {
	/** Each picture's width and height, device px. */
	readonly sizes: readonly [readonly [number, number], readonly [number, number]];
	/** Pixels each picture inks. */
	readonly inked: readonly [number, number];
	/** Pixels one picture inks and the other leaves blank. */
	readonly differing: number;
	/** `differing` over the pixels inked in either: 0 for the same drawing, 1 for two with nothing in common, NaN for two sizes. */
	readonly fraction: number;
}

/**
 * How much of two same-sized captures' DRAWING differs, decoded in the renderer (an `Image` and a
 * 2D canvas's `getImageData`, so no PNG library is needed). Each pixel's COVERAGE is its colour's
 * distance from the picture's own top-left pixel — its background — over the picture's farthest
 * pixel's, so each picture is read against its own background and its own ink: two drawings
 * differing only in colour, or drawn on a hovered and an unhovered row, compare as the same drawing.
 * A pixel is INKED at half coverage or more and BLANK under a quarter, and it DIFFERS only when one
 * picture inks it and the other leaves it blank — a partly covered edge pixel is neither, so the
 * same line drawn twice, which darkens its antialiased edges, is not counted as a different line.
 * A picture whose farthest pixel is within `FAINT` of its background inks nothing.
 */
export const difference = async (browser: NativeBrowser, one: string, other: string): Promise<Difference> =>
	await browser.execute(async (first, second) => {
		/** Out of about 441, the largest RGB distance: under this a picture is blank, not faint. */
		const FAINT = 16;
		const tonesOf = async (png: string) => {
			const image = new Image();
			image.src = `data:image/png;base64,${png}`;
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext('2d');
			if (!context) throw new Error('No 2D context to decode a capture in.');
			context.drawImage(image, 0, 0);
			const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
			const distance = (index: number) =>
				Math.hypot((data[index] ?? 0) - (data[0] ?? 0), (data[index + 1] ?? 0) - (data[1] ?? 0), (data[index + 2] ?? 0) - (data[2] ?? 0));
			const distances = Array.from({ length: width * height }, (_, pixel) => distance(pixel * 4));
			const farthest = distances.reduce((most, d) => Math.max(most, d), 0);
			// 1 inked (half coverage or more), 0 blank (under a quarter), ½ a partly covered edge.
			const tone = (d: number) => (farthest < FAINT || d < farthest / 4 ? 0 : d >= farthest / 2 ? 1 : 0.5);
			return { size: [width, height] as [number, number], tones: distances.map((d) => tone(d)) };
		};
		const [a, b] = [await tonesOf(first), await tonesOf(second)];
		const pixels = a.tones.map((mine, pixel) => [mine, b.tones[pixel] ?? 0] as const);
		const differing = pixels.filter(([x, y]) => Math.abs(x - y) === 1).length;
		const either = pixels.filter(([x, y]) => x === 1 || y === 1).length;
		return {
			sizes: [a.size, b.size],
			inked: [pixels.filter(([x]) => x === 1).length, pixels.filter(([, y]) => y === 1).length],
			differing,
			// Two sizes are not one grid to compare over: NaN, which the caller's size assertion names.
			fraction: a.size.join() !== b.size.join() ? Number.NaN : either === 0 ? 0 : differing / either,
		};
	}, one, other);

import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import type { NativeBrowser } from './session';

/**
 * What the pixel guards (AD18-R30) share: one element as the renderer painted it, and how much of
 * one such picture differs from another's. Both pictures are always taken in the SAME session and
 * compared to each other — never to a stored image, since a capture's size is in device pixels and
 * its antialiasing is the platform's (probe Q3: byte-identical within a session, untested across
 * sessions, machines or device pixel ratios).
 */

/**
 * The element `selector` finds, as the page paints it: CDP's own `Page.captureScreenshot` clipped
 * to its box (CSS px in, device px out), after it is scrolled into view. The PNG is also written to
 * the case's evidence folder as `<name>.png`, so the half of the clause a guard leaves to a person
 * can be looked at.
 */
export async function capture(browser: NativeBrowser, selector: string, directory: string, name: string): Promise<string> {
	const box = await browser.execute((sel) => {
		const element = document.querySelector(sel);
		element?.scrollIntoView({ block: 'nearest' });
		return element ? element.getBoundingClientRect().toJSON() as DOMRect : null;
	}, selector);
	if (!box) throw new Error(`Nothing to capture at ${selector}.`);
	const clip = { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 };
	const { data } = (await browser.sendCommandAndGetResult('Page.captureScreenshot', { format: 'png', clip })) as { data: string };
	await writeFile(path.join(directory, `${name}.png`), Buffer.from(data, 'base64'));
	return data;
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
	/** `differing` over the pixels inked in either: 0 for the same drawing, 1 for two with nothing in common. */
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
		if (a.size.join() !== b.size.join()) throw new Error(`Captures of different sizes: ${a.size.join('×')} and ${b.size.join('×')}.`);
		const pixels = a.tones.map((mine, pixel) => [mine, b.tones[pixel] ?? 0] as const);
		const differing = pixels.filter(([x, y]) => Math.abs(x - y) === 1).length;
		const either = pixels.filter(([x, y]) => x === 1 || y === 1).length;
		return {
			sizes: [a.size, b.size],
			inked: [pixels.filter(([x]) => x === 1).length, pixels.filter(([, y]) => y === 1).length],
			differing,
			fraction: either === 0 ? 0 : differing / either,
		};
	}, one, other);

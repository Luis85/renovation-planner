/**
 * @vitest-environment jsdom
 *
 * The two background files in `tests/fixtures/`, which exist for the manual smoke test
 * (`docs/tests/cases/Editor Walkthrough.md`, steps 7 and 8) and are checked here so the
 * walkthrough never starts from a fixture that has quietly stopped working.
 *
 * **Read from `tests/`, not from `docs/`, and that is the point of there being two copies.**
 * The walkthrough happens in the vault, so the files have to exist under `docs/` — which is
 * USER LAND: a folder someone is free to rename, move or reorganise while working in
 * Obsidian. A suite that read the vault copy would turn every documentation tidy-up into a
 * build failure, which is the same mistake as a test that depends on a folder it does not
 * own. `npm run background-fixture` writes the PNG to both, so neither copy is edited by
 * hand and "which one is current" is never a question; the PDF is a captured
 * printer-driver artifact with no generator, so it is simply tracked twice.
 *
 * These are DIFFERENT fixtures from `tests/helpers/backgroundFixtures.ts`, and both kinds
 * earn their place. The generated ones are four hand-written PDF objects and a canvas with
 * two rectangles: their contents are visible in the source, which is what lets a test assert
 * a pixel of a known colour at a known place. These two are real FILES — one from a printer
 * driver, one from a script — carrying compression, embedded fonts, an image and text, which
 * is the part a minimal fixture cannot exercise.
 *
 * What this file does NOT close is the gap `pdfRaster.ts` states: the suite runs the
 * `pdfjs-dist` devDependency and production runs Obsidian's own copy. A live vault is still
 * the only place the production path exists.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import {
	loadBackground,
	PLACEHOLDER_WORLD_SCALE,
	type BackgroundVault,
} from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { renderPdfPage } from '../../../src/presentation/editor/layers/background/pdfRaster';
import { backingCanvas, clearResources, installCanvas, registerResource } from '../../helpers/canvas';
import { installObsidianDom } from '../../helpers/dom';

installObsidianDom();
installCanvas();

const FIXTURES = 'tests/fixtures';
const PDF_PATH = `${FIXTURES}/editor-background-pdf-test.pdf`;
const PNG_PATH = `${FIXTURES}/editor-background-png-test.png`;

/** What `scripts/background-fixture.mjs` draws, restated so a resize fails here. */
const PNG_SIZE = { width: 3000, height: 2000 };

/** Paths resolve from the WORKING DIRECTORY, the way every script in this repo does. */
function fixtureBytes(path: string): Uint8Array {
	return new Uint8Array(readFileSync(path));
}

function fixtureBuffer(path: string): ArrayBuffer {
	const bytes = fixtureBytes(path);
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

afterEach(() => {
	clearResources();
});

describe('the PDF fixture a real tool produced', () => {
	it('renders page one at the sheet’s own physical size', async () => {
		const page = await renderPdfPage(fixtureBuffer(PDF_PATH), 1);

		// A4 in points is 595.28 × 841.89; Chrome rounds its own way, so this asserts the
		// SHAPE of the answer — a portrait sheet about 210mm × 297mm — rather than a byte
		// count that would break if the file were re-exported.
		// Measured: 1192 × 1686 raster pixels at 0.17639 mm each → 210.3mm × 297.4mm.
		const widthMm = page.width * page.worldScale;
		const heightMm = page.height * page.worldScale;
		expect(widthMm).toBeGreaterThan(200);
		expect(widthMm).toBeLessThan(220);
		expect(heightMm).toBeGreaterThan(287);
		expect(heightMm).toBeLessThan(307);
		// Portrait, and not accidentally square: the viewport is what carries orientation.
		expect(page.height).toBeGreaterThan(page.width);
	});

	/**
	 * On a PIXEL, not on "it did not throw" — the lesson slice 5 paid for when
	 * `PDFDocumentProxy.destroy` turned every successful render into `unavailable`. A page
	 * whose fonts or Flate streams pdf.js could not decode is a blank canvas that raises
	 * nothing at all.
	 */
	it('lays down ink, so its fonts and compressed streams decoded', async () => {
		const page = await renderPdfPage(fixtureBuffer(PDF_PATH), 1);
		const context = backingCanvas(page.canvas)?.getContext('2d');
		const data = context?.getImageData(0, 0, page.width, page.height).data ?? new Uint8ClampedArray();

		let opaque = 0;
		let nonWhite = 0;
		for (let index = 0; index < data.length; index += 4) {
			if (data[index + 3] === 0) continue;
			opaque += 1;
			if (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250) nonWhite += 1;
		}

		expect(opaque).toBeGreaterThan(0);
		// Measured: 10,311 non-white pixels of 2,009,712 — half a percent, which is what a
		// page of text looks like. The bar sits well under that on purpose: pinning the
		// measured figure would make this an assertion about the document's LAYOUT rather
		// than about whether the decoders ran.
		expect(nonWhite).toBeGreaterThan(1000);
	});

	it('refuses a page the document does not have', async () => {
		// pdf.js's own words, asserted rather than "it rejected": `getPage` refusing and the
		// LOADING TASK failing are different failures, and only one of them means the page
		// was out of range.
		await expect(renderPdfPage(fixtureBuffer(PDF_PATH), 99)).rejects.toThrow('Invalid page request.');
	});
});

/**
 * The PNG goes through `loadBackground` rather than through a decoder directly, because for
 * an image THAT is the pipeline: a resource URL from the vault, `new Image()`, `decode()`.
 * The bytes travel through the resource registry and never inside the URL, which is the
 * same shape §55's no-base64 rule requires of production.
 */
function vaultWith(path: string, bytes: Uint8Array): BackgroundVault {
	const url = `app://fixture/${path}`;
	registerResource(url, bytes);
	return {
		getAbstractFileByPath(candidate: string) {
			if (candidate !== path) return null;
			const file = new TFile();
			file.path = path;
			file.extension = path.split('.').at(-1) ?? '';
			return file as never;
		},
		getResourcePath: () => url,
		readBinary: () => Promise.reject(new Error('an image is decoded from its resource URL, never read as bytes')),
	} as unknown as BackgroundVault;
}

/** Red minus blue, which separates this sheet's three inks without naming their hexes. */
function maxRedBias(data: Uint8ClampedArray): number {
	let most = 0;
	for (let index = 0; index < data.length; index += 4) {
		const bias = data[index] - data[index + 2];
		if (bias > most) most = bias;
	}
	return most;
}

describe('the PNG fixture the smoke test sets as a background', () => {
	async function loadFixture() {
		const bytes = fixtureBytes(PNG_PATH);
		const model = await loadBackground({ path: PNG_PATH, kind: 'image' }, vaultWith(PNG_PATH, bytes));
		if (model.kind !== 'raster') throw new Error(`expected a raster, got ${model.kind}`);
		return model;
	}

	it('decodes at the size the generator draws, one pixel to the millimetre', async () => {
		const model = await loadFixture();

		expect({ width: model.width, height: model.height }).toEqual(PNG_SIZE);
		// The convention the whole sheet is annotated with, asserted rather than trusted:
		// a raster is one world millimetre per source pixel until slice 7 calibrates it.
		expect(model.worldScale).toBe(PLACEHOLDER_WORLD_SCALE);
		expect(model.width * model.worldScale).toBe(3000);
		expect(model.height * model.worldScale).toBe(2000);
		// Landscape 3:2, so a transposed decode is a failure here and not a puzzle later.
		expect(model.width).toBeGreaterThan(model.height);
		expect(model.worldOrigin).toEqual({ x: 0, y: 0 });
	});

	/**
	 * The sheet's whole purpose is that a human can tell a correct render from a plausible
	 * one, and the origin marker is the mark that does it. So this asserts the marker is
	 * WHERE it belongs: the accent ink is present in the origin corner and absent from the
	 * middle of the sheet. Both halves are needed — an image accent-coloured all over would
	 * pass the first on its own.
	 */
	it('carries its accent origin marker in the top-left corner and nowhere near the middle', async () => {
		const model = await loadFixture();
		const canvas = createEl('canvas');
		canvas.width = model.width;
		canvas.height = model.height;
		const context = canvas.getContext('2d');
		context?.drawImage(model.image, 0, 0);
		const backing = backingCanvas(canvas)?.getContext('2d');

		const corner = backing?.getImageData(0, 0, 320, 320).data ?? new Uint8ClampedArray();
		const middle = backing?.getImageData(1200, 700, 320, 320).data ?? new Uint8ClampedArray();

		expect(maxRedBias(corner)).toBeGreaterThan(80);
		expect(maxRedBias(middle)).toBeLessThan(80);
	});

	/** Paper AND ink: a sheet that decoded to a flat fill would pass every size assertion. */
	it('decodes to a drawn sheet rather than a flat fill', async () => {
		const model = await loadFixture();
		const canvas = createEl('canvas');
		canvas.width = model.width;
		canvas.height = model.height;
		canvas.getContext('2d')?.drawImage(model.image, 0, 0);
		const data = backingCanvas(canvas)?.getContext('2d').getImageData(0, 0, model.width, model.height).data
			?? new Uint8ClampedArray();

		let light = 0;
		let dark = 0;
		for (let index = 0; index < data.length; index += 4) {
			if (data[index] > 200) light += 1;
			else if (data[index] < 80) dark += 1;
		}

		// Mostly paper, with real line work on it — the shape of a plan sheet, and neither
		// figure pinned to what the generator currently happens to draw.
		expect(light).toBeGreaterThan(dark);
		expect(dark).toBeGreaterThan(10_000);
	});
});

/**
 * @vitest-environment jsdom
 *
 * The background pipeline (SDD §54–55): a Vault-relative path in, a decoded raster out,
 * for both source formats — and no base64 anywhere along the way.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import {
	loadBackground,
	PLACEHOLDER_WORLD_SCALE,
	type BackgroundVault,
} from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { backingCanvas, clearResources, installCanvas, registerResource } from '../../helpers/canvas';
import { installObsidianDom } from '../../helpers/dom';
import { pdfFixture, PDF_FIXTURE_POINTS, pngFixture } from '../../helpers/backgroundFixtures';

// Both: the canvas backing is what makes a raster real, and the PDF path builds its
// canvas with Obsidian's global `createEl` rather than `document.createElement`.
installObsidianDom();
installCanvas();

/**
 * The three `Vault` members `loadBackground` calls, and no more. `getResourcePath` answers
 * an opaque URL exactly as Obsidian's does — the bytes travel through the resource
 * registry, never inside the URL, because a fake that put them in the URL would be
 * modelling the base64 embedding §55 forbids.
 */
function fakeVault(files: Record<string, Uint8Array>): BackgroundVault {
	return {
		getAbstractFileByPath(path: string) {
			if (!(path in files)) return null;
			const file = new TFile();
			file.path = path;
			file.extension = path.split('.').at(-1) ?? '';
			return file as never;
		},
		getResourcePath(file: { path: string }) {
			return `app://fake/${file.path}`;
		},
		readBinary(file: { path: string }) {
			const bytes = files[file.path];
			return Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
		},
	} as unknown as BackgroundVault;
}

beforeEach(() => {
	clearResources();
});

describe('loading a plan background', () => {
	it('answers "none" for a plan that has no background', async () => {
		const model = await loadBackground(null, fakeVault({}));

		expect(model.kind).toBe('none');
	});

	it('renders a PNG at the placeholder scale of one world millimetre per pixel', async () => {
		const bytes = pngFixture(64, 32);
		registerResource('app://fake/Plans/ground.png', bytes);

		const model = await loadBackground(
			{ path: 'Plans/ground.png', kind: 'image' },
			fakeVault({ 'Plans/ground.png': bytes }),
		);

		if (model.kind !== 'raster') throw (globalThis as never as Record<string, unknown>).__bgErr;
		expect(model).toMatchObject({
			kind: 'raster',
			worldScale: PLACEHOLDER_WORLD_SCALE,
			width: 64,
			height: 32,
			worldOrigin: { x: 0, y: 0 },
		});
	});

	it('rasterizes a PDF page and scales it from the page size the PDF itself declares', async () => {
		const bytes = pdfFixture();

		const model = await loadBackground(
			{ path: 'Plans/ground.pdf', kind: 'pdf', page: 1 },
			fakeVault({ 'Plans/ground.pdf': bytes }),
		);

		expect(model.kind).toBe('raster');
		if (model.kind !== 'raster') return;
		// The fixture is 200x100 points; the raster is that at the module's own scale, and
		// worldScale is the millimetres one raster pixel covers. The product of the two is
		// the page's real width in millimetres, which is what actually has to be right.
		expect(model.width / PDF_FIXTURE_POINTS.width).toBe(model.height / PDF_FIXTURE_POINTS.height);
		expect(model.width * model.worldScale).toBeCloseTo(PDF_FIXTURE_POINTS.width * (25.4 / 72), 6);
	});

	it('actually paints the PDF page rather than handing back a blank canvas', async () => {
		const bytes = pdfFixture();

		const model = await loadBackground(
			{ path: 'Plans/ground.pdf', kind: 'pdf' },
			fakeVault({ 'Plans/ground.pdf': bytes }),
		);

		expect(model.kind).toBe('raster');
		if (model.kind !== 'raster') return;
		const pixels = backingCanvas(model.image as HTMLCanvasElement)?.getContext('2d');
		// The fixture's rectangle covers PDF (20,20)-(80,60). PDF y runs bottom-up on a
		// 100pt page, so its top edge is 40pt from the top; sampled at the raster scale the
		// model reports.
		const scale = model.width / PDF_FIXTURE_POINTS.width;
		const inside = pixels?.getImageData(Math.round(50 * scale), Math.round(50 * scale), 1, 1).data;
		const outside = pixels?.getImageData(1, 1, 1, 1).data;

		expect([inside?.[0], inside?.[1], inside?.[2], inside?.[3]]).toEqual([0, 0, 255, 255]);
		// Opaque white, which is the PAGE — an untouched backing canvas is transparent
		// black, so this half is what rules out 'the canvas was never drawn into'.
		expect([outside?.[0], outside?.[1], outside?.[2], outside?.[3]]).toEqual([255, 255, 255, 255]);
	});

	it('reports a background whose file is gone as missing, not as an error to throw', async () => {
		const model = await loadBackground({ path: 'Plans/gone.png', kind: 'image' }, fakeVault({}));

		expect(model).toEqual({ kind: 'unavailable', reason: 'missing' });
	});

	it('reports a file that will not decode as unreadable', async () => {
		const rubbish = new Uint8Array([1, 2, 3, 4]);
		// Registered, so the resource resolves and the DECODE is what fails — otherwise this
		// would be the missing-file case again under a different name.
		registerResource('app://fake/Plans/broken.png', rubbish);

		const model = await loadBackground(
			{ path: 'Plans/broken.png', kind: 'image' },
			fakeVault({ 'Plans/broken.png': rubbish }),
		);

		expect(model).toEqual({ kind: 'unavailable', reason: 'unreadable' });
	});

	it('reports a PDF page that does not exist as unreadable', async () => {
		const bytes = pdfFixture();

		const model = await loadBackground(
			{ path: 'Plans/ground.pdf', kind: 'pdf', page: 9 },
			fakeVault({ 'Plans/ground.pdf': bytes }),
		);

		expect(model).toEqual({ kind: 'unavailable', reason: 'unreadable' });
	});

	it('puts no base64 into the render model', async () => {
		const bytes = pngFixture(8, 8);
		registerResource('app://fake/Plans/ground.png', bytes);

		const model = await loadBackground(
			{ path: 'Plans/ground.png', kind: 'image' },
			fakeVault({ 'Plans/ground.png': bytes }),
		);

		expect(model.kind).toBe('raster');
		if (model.kind !== 'raster') return;
		// The raster travels as a live DOM handle. Everything else in the model — which is
		// everything a store could serialize — is plain numbers and a Point.
		const { image, ...serializable } = model;
		expect(image).toBeInstanceOf(HTMLImageElement);
		expect(JSON.stringify(serializable)).not.toMatch(/base64|data:/i);
	});
});

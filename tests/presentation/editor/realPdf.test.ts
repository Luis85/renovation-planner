/**
 * @vitest-environment jsdom
 *
 * The one PDF in this repository that a real tool produced.
 *
 * `pdfFixture()` is four hand-written objects: no compression, no fonts, no images, no
 * cross-reference stream. It is the right fixture for asserting the pipeline's arithmetic —
 * its page size is visible in the source — and it says nothing about whether pdf.js can
 * read what a printer driver emits. `docs/tests/editor-background-pdf-test.pdf` is Chrome's
 * "Print to PDF" output (`Producer (Skia/PDF m142)`), A4, with FlateDecode streams, fifteen
 * font references and an embedded image, so it covers the decoders a floor plan exported
 * from a real application actually needs.
 *
 * Committed as a test rather than left to the manual walkthrough because it is the half a
 * vault does NOT prove better: a live vault proves Obsidian's copy of pdf.js renders, and
 * this proves the FILE is one pdf.js reads at all. The gap that remains is the one
 * `pdfRaster.ts` states — the suite runs our `pdfjs-dist`, production runs Obsidian's, and
 * only a vault closes that.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderPdfPage } from '../../../src/presentation/editor/layers/background/pdfRaster';
import { backingCanvas, installCanvas } from '../../helpers/canvas';
import { installObsidianDom } from '../../helpers/dom';

installObsidianDom();
installCanvas();

const PDF_PATH = 'docs/tests/editor-background-pdf-test.pdf';

/** Resolved from the WORKING DIRECTORY, the way every script in this repository does. */
function realPdf(): ArrayBuffer {
	const bytes = readFileSync(PDF_PATH);
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('rasterizing a PDF a real tool produced', () => {
	it('renders page one at the sheet’s own physical size', async () => {
		const page = await renderPdfPage(realPdf(), 1);

		// A4 in points is 595.28 × 841.89; Chrome rounds its own way, so this asserts the
		// SHAPE of the answer — a portrait sheet about 210mm × 297mm — rather than a byte
		// count that would break if the file were re-exported.
		// Measured: 1192 x 1686 raster pixels at 0.17639 mm each -> 210.3mm x 297.4mm.
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
		const page = await renderPdfPage(realPdf(), 1);
		const context = backingCanvas(page.canvas).getContext('2d');
		const { data } = context.getImageData(0, 0, page.width, page.height);

		let opaque = 0;
		let nonWhite = 0;
		for (let index = 0; index < data.length; index += 4) {
			if (data[index + 3] === 0) continue;
			opaque += 1;
			if (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250) nonWhite += 1;
		}

		// Something was painted at all...
		expect(opaque).toBeGreaterThan(0);
		// ...and some of it is not the page's white background. Measured: 10,311 non-white
		// pixels of 2,009,712 — half a percent, which is what a page of text looks like. The
		// bar sits well under that on purpose: pinning the measured figure would make this an
		// assertion about the document's LAYOUT rather than about whether the decoders ran.
		expect(nonWhite).toBeGreaterThan(1000);
	});

	/** A one-page document asked for page two refuses rather than answering page one. */
	it('refuses a page the document does not have', async () => {
		// pdf.js's own words, asserted rather than "it rejected": `getPage` refusing and the
		// LOADING TASK failing are different failures, and only one of them means the page
		// was out of range.
		await expect(renderPdfPage(realPdf(), 99)).rejects.toThrow('Invalid page request.');
	});
});

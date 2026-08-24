import { loadPdfJs } from 'obsidian';

/**
 * One PDF page, rasterized (SDD §54): `PDF → PDF.js → rendered page → plan background`.
 *
 * Isolated in its own module so `BackgroundRenderModel` reads as the two-format pipeline
 * it is, and so everything peculiar to pdf.js — whose copy, which options, which scale —
 * is in one place with the reasons attached.
 *
 * **Obsidian's pdf.js, not a bundled one.** `loadPdfJs()` is `@public` in `obsidian.d.ts`,
 * and the `obsidian` devDependency is pinned to exactly the `minAppVersion` this plugin
 * declares (`tests/release/manifest.test.ts` holds that pairing) — so the compiler gate
 * already proves the API is promised at the floor. What it answers, measured in the
 * installed app's `resources/obsidian.asar` rather than assumed: a lazily injected
 * `/lib/pdfjs/pdf.min.mjs`, with `GlobalWorkerOptions.workerSrc` pointed at a real
 * `/lib/pdfjs/pdf.worker.min.mjs`, resolving `window.pdfjsLib`. Lazy and cached on
 * Obsidian's side, so awaiting it per render costs a promise rather than a load.
 *
 * Two things a bundled copy forced, both now gone: the `globalThis.pdfjsWorker`
 * single-bundle escape hatch and the main-thread parsing it forced (Obsidian's worker is a
 * real one, so a large PDF no longer blocks the UI), and 1728 KB of a 2216 KB plugin —
 * 78% of the bundle, parsed on every Obsidian start by every user whether they ever open a
 * PDF or not.
 *
 * **The residual gap, stated because nothing here can close it.** The suite runs the
 * `pdfjs-dist` devDependency, handed back by the module mock's `loadPdfJs`; production runs
 * Obsidian's. They are the same version today — 6.2.108 on both sides, verified against
 * the installed app — and nothing guarantees they stay that way. That is the same class of
 * gap as the pinned `obsidian` devDependency, and `npm run test-build` in a live vault is
 * the only thing that closes it.
 */

/**
 * The pdf.js surface this module actually calls, and no more.
 *
 * `loadPdfJs()` is typed `Promise<any>` — Obsidian promises the object, not its shape — so
 * something has to state what is being relied on. A narrow local interface, cast ONCE at
 * the boundary in `renderPdfPage`, is that statement: the `any` stops at one expression,
 * which is what leaves the type-aware `no-unsafe-*` rules nothing to bite. A fuller
 * declaration would be a hand-written copy of upstream's types with nothing to keep it
 * honest — the same reason the `pdf-worker.d.ts` this replaces declared exactly one export.
 */
interface PdfViewport {
	readonly width: number;
	readonly height: number;
}

interface PdfPage {
	getViewport(parameters: { scale: number }): PdfViewport;
	render(parameters: {
		canvas: HTMLCanvasElement;
		canvasContext: CanvasRenderingContext2D;
		viewport: PdfViewport;
	}): { readonly promise: Promise<void> };
}

interface PdfDocument {
	getPage(pageNumber: number): Promise<PdfPage>;
}

/** The loading TASK, which is what owns `destroy` — see the `finally` in `renderPdfPage`. */
interface PdfLoadingTask {
	readonly promise: Promise<PdfDocument>;
	destroy(): Promise<void>;
}

interface PdfJs {
	getDocument(parameters: { data: Uint8Array; useWasm: boolean }): PdfLoadingTask;
}

/**
 * How many raster pixels one PDF point becomes.
 *
 * A PDF is vector art with a real physical size, so unlike an image it does not HAVE a
 * native pixel count — a scale has to be chosen, and this is that choice: fine enough that
 * a floor plan's line work survives a moderate zoom, coarse enough that an A0 sheet does
 * not allocate a canvas measured in hundreds of megabytes.
 */
const RASTER_SCALE = 2;

/** Millimetres per PDF point — 72 points to the inch, 25.4 millimetres to the inch. */
const MM_PER_POINT = 25.4 / 72;

export interface RasterizedPage {
	readonly canvas: HTMLCanvasElement;
	/** World millimetres per raster pixel. */
	readonly worldScale: number;
	readonly width: number;
	readonly height: number;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
	// Obsidian's own global helper rather than `document.createElement`: the marketplace
	// ruleset requires it (`obsidianmd/prefer-create-el`), and with no parent argument it is
	// exactly a detached element. It is what `tests/helpers/dom.ts` installs for the suite.
	const canvas = createEl('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

/**
 * Unlike an image's placeholder scale, this one is REAL: a PDF carries its page size in
 * physical units, so the millimetres a raster pixel covers is arithmetic rather than a
 * guess. It is still superseded by slice 7 — calibration answers what the DRAWING's scale
 * is, which is a different question from how big the sheet is — but until then a PDF plan
 * opens at roughly life size instead of at an arbitrary one.
 */
export async function renderPdfPage(bytes: ArrayBuffer, pageNumber: number): Promise<RasterizedPage> {
	// The one cast, at the one boundary, for the reason `PdfJs` above states.
	const pdfjs = (await loadPdfJs()) as PdfJs;
	// A COPY of the caller's buffer: pdf.js transfers ownership of the array it is given
	// and detaches it, so handing over a buffer Obsidian may still hold — or one this code
	// might retry with — leaves a zero-length ArrayBuffer behind.
	//
	// `useWasm: false` survives the move to Obsidian's copy, but its REASON changed and the
	// comment has to say which. It used to be that a bundled plugin had no URL to fetch the
	// module from at all. Obsidian does ship the WebAssembly — `/lib/pdfjs/wasm/` is in
	// `obsidian.asar`, measured — but `wasmUrl` is a `getDocument` PARAMETER and Obsidian
	// sets it only in its own viewer's options, which do not reach this call. Passing it
	// here would mean hard-coding an internal asset path that no public API promises and
	// that would break silently the day it moves. pdf.js wants the module for JPEG 2000 and
	// a few other exotic codecs, which vector floor plans use none of; `wasmUrl` stays the
	// documented upgrade path if a real PDF ever needs one.
	const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), useWasm: false });
	const document_ = await task.promise;
	try {
		const page = await document_.getPage(pageNumber);
		const viewport = page.getViewport({ scale: RASTER_SCALE });
		const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
		const context = canvas.getContext('2d');
		if (context === null) {
			throw new Error('A 2D canvas context is required to render a PDF background.');
		}
		await page.render({ canvas, canvasContext: context, viewport }).promise;
		return {
			canvas,
			worldScale: MM_PER_POINT / RASTER_SCALE,
			width: canvas.width,
			height: canvas.height,
		};
	} finally {
		// Always, including on the throw above: the loading task holds the parsed document,
		// its transport, and the worker thread behind them, and nothing else ever collects
		// them. An unreleased one is a leak that survives the view being closed.
		//
		// The TASK's `destroy`, not the document proxy's: `PDFDocumentProxy` has no such
		// method in pdf.js 6, so `document_.destroy()` throws `is not a function` — which,
		// inside `loadBackground`'s catch, would have turned every successful PDF render
		// into `unavailable/unreadable`. Found by the test that asserts a PDF renders at
		// all, which is why that test asserts on a pixel rather than on "it did not throw".
		await task.destroy();
	}
}

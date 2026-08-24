import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

/**
 * One PDF page, rasterized (SDD §54): `PDF → PDF.js → rendered page → plan background`.
 *
 * Isolated in its own module so `BackgroundRenderModel` reads as the two-format pipeline
 * it is, and so everything peculiar to pdf.js — which build, which worker, which scale —
 * is in one place with the reasons attached.
 *
 * **The LEGACY build, on purpose.** `pdfjs-dist`'s standard build constructs a `DOMMatrix`
 * at module scope, so importing it under jsdom throws before a single line of this
 * plugin's code runs — the whole background suite would be untestable, and the failure
 * would be an import error rather than anything about a PDF. The legacy build carries
 * pdf.js's own Node polyfill hook, which is what lets ONE import path serve both the
 * suite and the plugin. In Obsidian the polyfill branch never executes: pdf.js's
 * `isNodeJS` is false inside an Electron renderer, where `DOMMatrix` is native.
 */

/**
 * pdf.js's documented single-bundle escape hatch.
 *
 * An Obsidian plugin ships ONE file, so there is no separate `pdf.worker.js` for
 * `GlobalWorkerOptions.workerSrc` to point at and no URL a fake-worker fallback could
 * fetch. pdf.js checks `globalThis.pdfjsWorker` FIRST and uses its `WorkerMessageHandler`
 * in-process when it finds one, which is exactly the shape a bundled plugin can offer.
 *
 * The cost, stated rather than discovered later: parsing runs on the main thread, so a
 * very large PDF blocks the UI while its page renders. §63 lists PDF rasterization among
 * the plausible future worker workloads, and this is the constraint that would motivate
 * it.
 *
 * Installed on the FIRST render rather than at module scope, and that is not a style
 * choice: a module-scope `window` reference makes merely IMPORTING anything that
 * transitively reaches this file throw `window is not defined` outside a DOM — which is
 * every node-environment test whose import graph touches a component, and which is how
 * this was found. Rendering a PDF already needs a document; importing the module that can
 * do so does not.
 *
 * Idempotent, and it has to be: reassigning between two concurrent loads would swap the
 * handler out from under one of them.
 *
 * On `window` and not `globalThis`: they are the same object in every environment this
 * runs in, and the obsidianmd ruleset refuses the second spelling outright. Its stated
 * reason is popout-window compatibility, which is about which DOCUMENT a call reaches and
 * is not what this does — but the rule is a marketplace gate the review bot runs with its
 * own configuration, so it is not a suggestion here.
 */
function installWorker(): void {
	const host = window as unknown as Record<string, unknown>;
	host.pdfjsWorker ??= { WorkerMessageHandler };
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
	installWorker();
	// A COPY of the caller's buffer: pdf.js transfers ownership of the array it is given
	// and detaches it, so handing over a buffer Obsidian may still hold — or one this code
	// might retry with — leaves a zero-length ArrayBuffer behind.
	//
	// `useWasm: false` because there is nowhere to fetch the module FROM. pdf.js 6 defaults
	// it on and loads its WebAssembly from a `wasmUrl`, and a plugin that ships one bundled
	// file has no URL to offer — the same reason `cMapUrl` and `standardFontDataUrl` are not
	// set either. The cost is decoding speed on image-heavy PDFs and a few exotic codecs;
	// vector floor plans, which is what this renders, use none of it. Shipping the `.wasm`,
	// the cmaps and the standard fonts as plugin assets is the upgrade path if a real PDF
	// ever needs them.
	const task = getDocument({ data: new Uint8Array(bytes.slice(0)), useWasm: false });
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
		// Always, including on the throw above: the loading task holds the parsed document
		// and its transport, and — with the worker running IN PROCESS, per the note at the
		// top of this file — nothing else ever collects them. An unreleased one is a leak
		// that survives the view being closed.
		//
		// The TASK's `destroy`, not the document proxy's: `PDFDocumentProxy` has no such
		// method in pdf.js 6, so `document_.destroy()` throws `is not a function` — which,
		// inside `loadBackground`'s catch, would have turned every successful PDF render
		// into `unavailable/unreadable`. Found by the test that asserts a PDF renders at
		// all, which is why that test asserts on a pixel rather than on "it did not throw".
		await task.destroy();
	}
}

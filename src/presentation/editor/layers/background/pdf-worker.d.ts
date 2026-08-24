/**
 * `pdfjs-dist` ships types for its main entry and for the legacy `pdf.mjs` beside it, but
 * none for the WORKER entry — which is reasonable, since nothing normally imports it: a
 * page points `GlobalWorkerOptions.workerSrc` at the file and the browser loads it.
 *
 * A bundled Obsidian plugin has no second file to point at, so `pdfRaster.ts` imports the
 * worker's `WorkerMessageHandler` and installs it as `globalThis.pdfjsWorker` — pdf.js's
 * own documented single-bundle path. This declaration is what makes that import typed
 * instead of an implicit `any` (`noImplicitAny` under `strict`).
 *
 * Deliberately narrow: ONE export, typed as the opaque thing it is. pdf.js hands this to
 * its fake-worker machinery and nothing in this plugin ever calls it, so a fuller
 * declaration would be describing an API this code does not use — and would be a
 * hand-written copy of upstream's shape with nothing to keep it honest.
 *
 * The trigger for deleting this file: the day `pdfjs-dist` ships `pdf.worker.d.mts`
 * alongside the other two.
 */
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
	export const WorkerMessageHandler: unknown;
}

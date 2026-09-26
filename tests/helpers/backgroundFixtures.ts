import { createCanvas } from '@napi-rs/canvas';

/**
 * Background fixtures, GENERATED rather than committed as binaries.
 *
 * A checked-in PNG is a file nobody can read in a diff and nobody can adjust without a
 * tool; these two are a few lines each and their contents are visible in the source, which
 * matters because the assertions are about what is inside them — a pixel of a known colour
 * at a known place is the difference between "a background rendered" and "something was
 * drawn".
 */

/** A PNG with a single filled rectangle in the top-left quadrant. */
export function pngFixture(width: number, height: number): Uint8Array {
	const canvas = createCanvas(width, height);
	const context = canvas.getContext('2d');
	context.fillStyle = '#ffffff';
	context.fillRect(0, 0, width, height);
	context.fillStyle = '#ff0000';
	context.fillRect(0, 0, Math.floor(width / 2), Math.floor(height / 2));
	// `encodeSync`, not `encode`: the async one answers a Promise, and a fixture helper
	// that handed one back would reach the decoder as an object rather than as bytes.
	return new Uint8Array(canvas.encodeSync('png'));
}

/** The fixture PDF's page size, in PDF points — what a scale assertion is derived from. */
export const PDF_FIXTURE_POINTS = { width: 200, height: 100 };

/**
 * Two pages that differ in both size and colour, so a decoded raster says which one it is:
 * page 1 is today's blue 200×100pt page, page 2 a red 300×150pt one.
 */
export const TWO_PAGE_PDF = [
	{ ...PDF_FIXTURE_POINTS, fill: '0 0 1' },
	{ width: 300, height: 150, fill: '1 0 0' },
] as const;

/** One page of `pdfFixture`: its MediaBox in points, and the `rg` fill of its rectangle. */
export interface PdfFixturePage {
	readonly width: number;
	readonly height: number;
	readonly fill: string;
}

/**
 * A PDF carrying one rectangle per page at PDF (20,20)-(80,60). With no argument it is one
 * 200×100pt page with a blue rectangle, byte for byte the file this helper always produced.
 * Written out by hand because the alternative is a PDF-writing dependency for a few objects —
 * and because the byte offsets in the cross-reference table have to be right, which is the
 * only part of a minimal PDF that is not obvious.
 *
 * `latin1` on the way out: a PDF is a byte format, and encoding this as UTF-8 would shift
 * every offset the moment the content stream contained a character above 0x7f.
 */
export function pdfFixture(pages: readonly PdfFixturePage[] = [TWO_PAGE_PDF[0]]): Uint8Array {
	// The page at index i is object 3+2i and its content stream 4+2i, so one page numbers exactly as before.
	const kids = pages.map((_, index) => `${3 + 2 * index} 0 R`).join(' ');
	const objects = [
		'<</Type/Catalog/Pages 2 0 R>>',
		`<</Type/Pages/Kids[${kids}]/Count ${pages.length}>>`,
		...pages.flatMap(({ width, height, fill }, index) => {
			const stream = `${fill} rg 20 20 60 40 re f\n`;
			return [
				`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${width} ${height}]/Contents ${4 + 2 * index} 0 R/Resources<<>>>>`,
				`<</Length ${stream.length}>>\nstream\n${stream}endstream`,
			];
		}),
	];

	let pdf = '%PDF-1.4\n';
	const offsets: number[] = [];
	objects.forEach((body, index) => {
		offsets.push(pdf.length);
		pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
	});

	const xref = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
	pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;

	return new Uint8Array(Buffer.from(pdf, 'latin1'));
}

/**
 * Invented sample content for the asset library mock, plus the one piece of arithmetic that
 * mock genuinely needs.
 *
 * **Every asset, price, supplier, SKU and project name below is made up**, per PRODUCT.md's
 * "Evidence on Hand": there is no real renovation project, no real quote and no real cost data
 * anywhere in this repository, and a mock that let invented prices read as gathered ones would
 * be the one lie these files cannot afford. They are authored at production fidelity — plausible
 * German-market renovation goods at plausible 2026 prices — because a library drawn with
 * `Asset 1 … Asset 17` cannot be judged for the thing it exists to be judged for, which is
 * whether a renovator can find what they already defined.
 *
 * A `.ts` beside the two `.vue` files rather than data inside either: `src/prototypes/` may hold
 * one (`tests/build/prototypes-one-way-door.test.ts` drives `.ts` and `.js` alongside `.vue`),
 * `max-lines` is 400 per file here as everywhere in `src/`, and this repository's own record of
 * `WorkPackages.vue` at 506 lines is what says to decide that before writing the screen rather
 * than after.
 *
 * **The counts are not written down.** Each shelf's count is `assets.length` for that category
 * and the status bar's total is the array's own length, because `docs/user-experience/concepts/`
 * already records what a hand-written number costs: four drawn zones whose displayed areas no
 * single calibration could have produced, invisible because nobody multiplies a polygon by hand.
 */

/*
 * `Point` is imported rather than declared. `tests/presentation/editor/declarations.test.ts`
 * holds it to ONE declaration in the whole of `src/` — a category check, so it reaches this
 * tree exactly as it reaches every other — and a second spelling here was refused on its first
 * run. Which is the better outcome anyway: a mock whose coordinates are the type the geometry
 * sidecar really hands back is a mock whose fitting arithmetic promotes unchanged.
 */

/**
 * What the row's leading mark can say. Four states because there are four things true of a
 * footprint, and three of them are not "there is one":
 *
 * - `measured` — an outline in real millimetres.
 * - `unscaled` — an outline traced before a scale existed. Its PROPORTIONS are real and its
 *   scale is not, which is why the mark still draws the shape and adds a slash rather than
 *   withholding it.
 * - `none` — no sidecar at all. Wall paint has no footprint and never will.
 * - `pending` — not read yet. An asset's shape lives in a sidecar whose path derives from a
 *   setting rather than from any index, so nothing can answer "does this have one" without a
 *   file read, and a row must never wait for its own mark.
 *
 * `pending` appears in this fixture on one asset deliberately, because a state that only exists
 * for 80ms in production is a state nobody ever looks at hard enough to notice it is
 * indistinguishable from `none`.
 */
import type { Point } from '../core/geometry/Point';

export type ShapeState = 'measured' | 'unscaled' | 'none' | 'pending';

export interface UsedIn {
	readonly project: string;
	readonly requirements: number;
}

export interface CatalogueAsset {
	readonly id: string;
	readonly name: string;
	readonly category: string;
	readonly unit: string;
	readonly unitCost: string;
	/** Fraction as it is shown, `null` where the default is zero and the slot draws nothing. */
	readonly waste: string | null;
	readonly supplier: string | null;
	readonly sku: string | null;
	readonly heightMm: number | null;
	readonly notes: string | null;
	readonly shape: ShapeState;
	readonly outline: readonly Point[] | null;
	readonly usedIn: readonly UsedIn[];
}

/** A regular polygon, so a round footprint is twelve points of arithmetic and not of typing. */
function regular(sides: number, radius: number): readonly Point[] {
	return Array.from({ length: sides }, (_, i): Point => {
		const angle = (i / sides) * Math.PI * 2;
		return { x: radius + radius * Math.cos(angle), y: radius + radius * Math.sin(angle) };
	});
}

const box = (w: number, d: number): readonly Point[] =>
	[{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d }];

const at = (x: number, y: number): Point => ({ x, y });

export const CATEGORIES = [
	'Material',
	'Furniture',
	'Fixture',
	'Plant',
	'Equipment',
	'Building element',
	'Custom',
] as const;

export const ASSETS: readonly CatalogueAsset[] = [
	{
		id: 'oak-plank-floor', name: 'Oak plank floor', category: 'Material', unit: 'm²',
		unitCost: '34.95', waste: '+8%', supplier: 'Holzhandel Nord', sku: 'EIC-1200-190',
		heightMm: 22, notes: 'Brushed, matt lacquered. Confirm batch before ordering.',
		shape: 'measured', outline: box(1200, 190),
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 3 }, { project: 'Garden studio', requirements: 1 }],
	},
	{
		id: 'wall-paint-white', name: 'Wall paint, white matt', category: 'Material',
		unitCost: '18.40', unit: 'm²', waste: '+5%', supplier: 'Farbwerk', sku: 'WM-2500',
		heightMm: null, notes: null, shape: 'none', outline: null,
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 6 }],
	},
	{
		id: 'porcelain-tile-600', name: 'Porcelain tile, 600 × 600', category: 'Material',
		unitCost: '42.50', unit: 'm²', waste: '+12%', supplier: 'Fliesen Kramer', sku: 'PT-600-GR',
		heightMm: 10, notes: null, shape: 'measured', outline: box(600, 600),
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 2 }],
	},
	{
		id: 'skirting-oak', name: 'Skirting board, oak', category: 'Material',
		unitCost: '9.80', unit: 'm', waste: '+10%', supplier: 'Holzhandel Nord', sku: 'SK-95',
		heightMm: 95, notes: null, shape: 'measured', outline: box(2400, 20), usedIn: [],
	},
	{
		id: 'tile-adhesive', name: 'Tile adhesive, flexible', category: 'Material',
		unitCost: '6.25', unit: 'm²', waste: '+15%', supplier: 'Fliesen Kramer', sku: 'TA-25KG',
		heightMm: null, notes: null, shape: 'none', outline: null,
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 2 }],
	},
	{
		id: 'base-cabinet-600', name: 'Base cabinet, 600', category: 'Furniture',
		unitCost: '245.00', unit: 'piece', waste: null, supplier: 'Küchenhaus Adler', sku: 'BC-600',
		heightMm: 720, notes: 'Traced from the supplier sheet before the sheet was calibrated.',
		shape: 'unscaled', outline: box(600, 580),
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 4 }],
	},
	{
		id: 'tall-cabinet-400', name: 'Tall cabinet, 400', category: 'Furniture',
		unitCost: '310.00', unit: 'piece', waste: null, supplier: 'Küchenhaus Adler', sku: 'TC-400',
		heightMm: 2000, notes: null, shape: 'pending', outline: null, usedIn: [],
	},
	{
		id: 'worktop-oak-40', name: 'Worktop, oak 40 mm', category: 'Furniture',
		unitCost: '118.00', unit: 'm', waste: '+6%', supplier: 'Holzhandel Nord', sku: 'WT-40-620',
		heightMm: 40, notes: null, shape: 'measured', outline: box(3000, 620),
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 1 }],
	},
	{
		id: 'radiator-600-1200', name: 'Radiator, panel 600 × 1200', category: 'Fixture',
		unitCost: '189.00', unit: 'piece', waste: null, supplier: 'Sanitär Reuter', sku: 'RP-600-1200',
		heightMm: 600, notes: null, shape: 'measured', outline: box(1200, 100),
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 5 }],
	},
	{
		id: 'basin-mixer', name: 'Basin mixer tap', category: 'Fixture',
		unitCost: '142.50', unit: 'piece', waste: null, supplier: 'Sanitär Reuter', sku: 'BM-CHR',
		heightMm: 310, notes: null, shape: 'measured', outline: regular(8, 27.5),
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 2 }],
	},
	{
		id: 'socket-double', name: 'Wall socket, double', category: 'Fixture',
		unitCost: '14.90', unit: 'piece', waste: null, supplier: 'Elektro Vogt', sku: 'WS-2-W',
		heightMm: 86, notes: null, shape: 'measured', outline: box(146, 86),
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 11 }, { project: 'Garden studio', requirements: 4 }],
	},
	{
		id: 'ceiling-light-flush', name: 'Ceiling light, flush', category: 'Fixture',
		unitCost: '68.00', unit: 'piece', waste: null, supplier: 'Elektro Vogt', sku: 'CL-300',
		heightMm: 90, notes: null, shape: 'measured', outline: regular(12, 150), usedIn: [],
	},
	{
		id: 'scaffold-tower', name: 'Scaffold tower, hire', category: 'Equipment',
		unitCost: '48.00', unit: 'day', waste: null, supplier: 'Gerüstbau Timm', sku: null,
		heightMm: 4000, notes: null, shape: 'measured', outline: box(1800, 720), usedIn: [],
	},
	{
		id: 'floor-sander', name: 'Floor sander, hire', category: 'Equipment',
		unitCost: '65.00', unit: 'day', waste: null, supplier: 'Mietpark Süd', sku: null,
		heightMm: null, notes: null, shape: 'measured',
		outline: [at(0, 0), at(500, 0), at(500, 180), at(260, 180), at(260, 300), at(0, 300)],
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 1 }],
	},
	{
		id: 'internal-door-oak', name: 'Internal door, oak veneer', category: 'Building element',
		unitCost: '228.00', unit: 'piece', waste: null, supplier: 'Türen Brandt', sku: 'ID-838',
		heightMm: 1981, notes: null, shape: 'measured', outline: box(838, 44),
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 4 }],
	},
	{
		id: 'stud-partition', name: 'Stud partition wall', category: 'Building element',
		unitCost: '86.40', unit: 'm²', waste: '+7%', supplier: null, sku: null,
		heightMm: null, notes: null, shape: 'measured', outline: box(2400, 100),
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 1 }],
	},
	{
		id: 'site-skip-8yd', name: 'Site skip, 8 yd', category: 'Custom',
		unitCost: '320.00', unit: 'fixed', waste: null, supplier: 'Entsorgung Kley', sku: null,
		heightMm: 1220, notes: null, shape: 'measured',
		outline: [at(0, 0), at(3660, 0), at(3300, 1680), at(360, 1680)],
		usedIn: [{ project: 'Flat renovation, Hamburg', requirements: 1 }],
	},
];

/**
 * An outline fitted to the mark's box, as an SVG path.
 *
 * The fit preserves ASPECT RATIO, which is the whole reason the mark is worth drawing: a
 * radiator is 1200 × 100 and must read as the long thin thing it is, where a shape stretched
 * to fill its box would make every asset in the catalogue the same square. A promoted component
 * runs this same function over the sidecar's own coordinates.
 *
 * A degenerate extent — every point on one line, which `validatePolygonPoints` permits since a
 * zero-area polygon is only refused at `createPolygon` — would divide by zero and emit `NaN`
 * into the path, so the zero axis is dropped from the fit rather than trusted.
 */
export function markPath(outline: readonly Point[], size: number, inset: number): string {
	const xs = outline.map((point) => point.x);
	const ys = outline.map((point) => point.y);
	const minX = Math.min(...xs);
	const minY = Math.min(...ys);
	const width = Math.max(...xs) - minX;
	const depth = Math.max(...ys) - minY;
	const span = size - inset * 2;
	const scales = [width > 0 ? span / width : Infinity, depth > 0 ? span / depth : Infinity];
	const scale = Math.min(...scales);
	if (!Number.isFinite(scale)) return '';
	const left = inset + (span - width * scale) / 2;
	const top = inset + (span - depth * scale) / 2;
	const place = (point: Point): string =>
		`${(left + (point.x - minX) * scale).toFixed(2)} ${(top + (point.y - minY) * scale).toFixed(2)}`;
	return `M${outline.map((point) => place(point)).join(' L')} Z`;
}

import { ok } from '../../src/core/result/Result';
import { currencyOf, type Currency } from '../../src/core/money/Money';
import type { AssetId } from '../../src/domain/asset/AssetId';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import type { RequirementId } from '../../src/domain/requirement/RequirementId';
import type { MeasurementUnit } from '../../src/core/units/MeasurementUnit';
import type { Point } from '../../src/core/geometry/Point';
import type {
	CatalogueEntryDto,
	UnreadableEntry,
} from '../../src/application/queries/ListCatalogueEntries';
import type { AssetOutline } from '../../src/application/queries/ListAssetOutlines';
import type { AssetDesignDto } from '../../src/application/queries/GetAssetDesign';
import type { ReferencingGroup } from '../../src/application/queries/ListRequirementsReferencing';
import type { ObservationToken } from '../../src/application/ports/versioning';
import type { AssetLibraryDeps } from '../../src/presentation/library/AssetLibraryDeps';
import type { AssetLibraryQueryServices } from '../../src/presentation/read-models/assetLibraryQueries';
import { AssetLibraryView } from '../../src/presentation/library/AssetLibraryView';
import { defaultAssetLibraryDeps } from '../helpers/makeAssetLibraryView';
import { installObsidianDom } from '../helpers/dom';
import { FakeLeaf } from '../helpers/workspace';

/**
 * The REAL Asset library view, mounted outside Obsidian for LOOKING at — `npm run harness`
 * with `?view=asset-library`, and every `asset-library-*` shot in `scripts/harness-shot.mjs`'s
 * own `SHOTS` array. `planEditor.ts` and `assetDesigner.ts`'s shape for the plugin's fourth
 * workspace view, and the same limit: it draws, it asserts nothing.
 *
 * **NO COUNT, and that is a correction rather than a style.** This sentence said *five fixed
 * captures* over seven for one commit — written when the list was five and not re-read after the
 * actions and narrow-resting shots were added — in the same commit that fixed three other stale
 * counts and whose own brief made the class a standing target. The number was never the useful
 * part of the sentence: what a reader needs is WHICH shots, and the array's name prefix answers
 * that without anything to keep in step. `grep -oE "name: 'asset-library[a-z-]*'"
 * scripts/harness-shot.mjs` is the census if one is ever wanted, and
 * `tests/build/harness-shot.test.ts` is what fails when the array and the pin disagree.
 *
 * **This surface reached Task 17 with no picture of it anywhere.** Sixteen tasks built the
 * queries, the shelves, the rows, the marks, the inspector, the stylesheet, the keyboard, the
 * narrow composition and the deletion flow, and every rendering question any of them raised was
 * deferred here, on the understanding that no browser could be reached. So this fixture is
 * built to make each of those questions VISIBLE in a resting capture rather than to be minimal:
 * seven declared shelves plus one undeclared category, an unreadable note so §5.1a's repair
 * strip draws, prices in two currencies, a waste factor that is zero on some rows and not on
 * others, and a selection whose inspector fills all four of §3.5's sections.
 *
 * **Every WRITE refuses with `settings.unrecovered`** — `defaultAssetLibraryDeps`' own bundle,
 * which is `assetDesigner.ts`'s honest stand-in rather than a pretence: the controls render and
 * a gesture fails like any other failed write rather than appearing to persist against a vault
 * this page does not have.
 *
 * **`listOutlines` REACHES THE ROWS since Task 17b, and it did not when this fixture was
 * written — the account is kept rather than deleted, because the captures taken against it are
 * what found the defect.** What Task 17's shots showed was 17 marks under one class: the chain
 * broke in two places, one hop apart, and the precise version matters because the loose one
 * ("nothing calls it") was falsifiable in a second. `viewportMarks.ts` DID call
 * `queries.listOutlines`; what had no caller was `ViewportMarks`' own entry point, since
 * `AssetLibraryStore.setVisibleMarks` was reached from nothing outside the store. And one hop
 * further out, `AssetLibraryBody.vue` mounted `<AssetShelves>` with no `outline-for` prop —
 * OPTIONAL, so omitting it was legal — and `AssetMark` drew §3.4's *not yet read* for the whole
 * catalogue, permanently.
 *
 * Both halves are wired now: that prop is REQUIRED and bound to `store.markFor`, and
 * `AssetLibraryBody.drawnAssetIds` hands the store every row an open shelf draws. So the
 * outlines below — supplied from the start, deliberately, because a harness that refused a
 * query the composed root answers would be a fake HARSHER than the real thing — are what the
 * `asset-library-*` shots now actually draw.
 */

const money = (amount: string, currency: string): Pick<CatalogueEntryDto, 'unitCostAmount' | 'currency'> => ({
	unitCostAmount: amount,
	currency: currencyOf(currency),
});

const box = (width: number, depth: number): readonly Point[] => [
	{ x: 0, y: 0 },
	{ x: width, y: 0 },
	{ x: width, y: depth },
	{ x: 0, y: depth },
];

/**
 * A regular polygon, so at least one mark in the capture is not a rectangle — §3.4's fitting
 * arithmetic keeps a shape's true aspect ratio, and four boxes in a column cannot show that.
 */
const regular = (sides: number, radius: number): readonly Point[] =>
	Array.from({ length: sides }, (_, index): Point => {
		const angle = (index / sides) * Math.PI * 2;
		return { x: radius + radius * Math.cos(angle), y: radius + radius * Math.sin(angle) };
	});

interface Seed {
	readonly id: string;
	readonly name: string;
	readonly category: string;
	readonly unit: MeasurementUnit;
	readonly unitCostAmount: string;
	readonly currency: Currency;
	readonly waste: string;
	readonly supplier: string | null;
	readonly sku: string | null;
	readonly height: number | null;
	readonly notes: string | null;
	readonly outline: AssetOutline;
	/**
	 * §3.5's spec-sheet row reads the CATALOGUE entry's background and never the design's, which
	 * is a distinction only a capture found: the first version of this fixture put a sheet on the
	 * design alone and the Shape section drew a footprint, a clearance and no spec sheet at all.
	 */
	readonly background?: CatalogueEntryDto['background'];
}

const measured = (width: number, depth: number, points = box(width, depth)): AssetOutline => ({
	kind: 'measured',
	points,
	extent: { width, depth },
});

/**
 * Seventeen assets across the seven declared categories plus one undeclared one, which is the
 * prototype's own fixture size and spread — §12 records why it is that big: a category
 * vocabulary the shelves DERIVE (§3.2) cannot be looked at with three assets in one bucket, and
 * the one asset carrying `category: insulation` is what draws the eighth shelf §1a asks to be
 * preserved as written.
 *
 * **Some rows leave a slot EMPTY on purpose, and the mix is the point rather than any one row.**
 * Two seeds carry neither a supplier nor an SKU (`Skirting board, oak` and `Site management`)
 * and ten carry a zero waste factor, which `AssetRow.wasteLabel` renders as nothing at all — so
 * a shelf holds rows with four slots filled beside rows with five. An empty slot in a five-slot
 * row is where *"a child whose width follows CONTENT decides where its siblings start"* shows
 * itself, which is a defect this repository has shipped on three surfaces and which no gate here
 * can see. (Stated as a mix rather than as *the only row*: the first version of this sentence
 * named one seed for each property and both were wrong, which a `grep -c` in the same edit
 * answered in a second.)
 */
const SEEDS: readonly Seed[] = [
	{
		id: 'oak-plank-floor', name: 'Oak plank floor', category: 'material', unit: 'm2',
		...money('34.95', 'EUR'), waste: '0.08', supplier: 'Holzhandel Nord', sku: 'EIC-1200-190',
		height: 22, notes: 'Brushed, matt lacquered. Confirm the batch before ordering.',
		outline: measured(1200, 190),
		background: { path: 'Renovation/Library/Sheets/eiche-diele-1200.pdf', kind: 'pdf', page: 2 },
	},
	{
		id: 'wall-paint-white', name: 'Wall paint, white matt', category: 'material', unit: 'm2',
		...money('18.40', 'EUR'), waste: '0', supplier: 'Farbwerk', sku: 'WM-2500',
		height: null, notes: null, outline: { kind: 'none' },
	},
	{
		id: 'porcelain-tile-600', name: 'Porcelain tile, 600 × 600', category: 'material', unit: 'm2',
		...money('42.50', 'EUR'), waste: '0.12', supplier: 'Fliesen Kramer', sku: 'PT-600-GR',
		height: 10, notes: null, outline: measured(600, 600),
	},
	{
		id: 'skirting-oak', name: 'Skirting board, oak', category: 'material', unit: 'm',
		...money('9.80', 'EUR'), waste: '0.1', supplier: null, sku: null,
		height: 95, notes: null, outline: measured(2400, 20),
	},
	{
		id: 'tile-adhesive', name: 'Tile adhesive, flexible', category: 'material', unit: 'm2',
		...money('6.25', 'EUR'), waste: '0.15', supplier: 'Fliesen Kramer', sku: 'TA-25KG',
		height: null, notes: null, outline: { kind: 'refused', code: 'asset-geometry.unreadable', sidecarPath: 'Renovation/Library/Geometry/tile-adhesive.rpgeo' },
	},
	{
		id: 'base-cabinet-600', name: 'Base cabinet, 600', category: 'furniture', unit: 'piece',
		...money('245.00', 'EUR'), waste: '0', supplier: 'Küchenhaus Adler', sku: 'BC-600',
		height: 720, notes: 'Traced from the supplier sheet before the sheet was calibrated.',
		outline: { kind: 'unscaled', points: box(600, 580), extent: { width: 600, depth: 580 } },
		background: { path: 'Renovation/Library/Sheets/adler-bc-600.png', kind: 'image', page: null },
	},
	{
		id: 'tall-cabinet-400', name: 'Tall cabinet, 400', category: 'furniture', unit: 'piece',
		...money('310.00', 'CHF'), waste: '0', supplier: 'Küchenhaus Adler', sku: 'TC-400',
		height: 2000, notes: null, outline: { kind: 'none' },
	},
	{
		id: 'worktop-oak-40', name: 'Worktop, oak 40 mm', category: 'furniture', unit: 'm',
		...money('118.00', 'EUR'), waste: '0.06', supplier: 'Holzhandel Nord', sku: 'WT-40-620',
		height: 40, notes: null, outline: measured(3000, 620),
	},
	{
		id: 'radiator-600-1200', name: 'Radiator, panel 600 × 1200', category: 'fixture', unit: 'piece',
		...money('189.00', 'EUR'), waste: '0', supplier: 'Sanitär Reuter', sku: 'RP-600-1200',
		height: 600, notes: null, outline: measured(1200, 100),
	},
	{
		id: 'basin-mixer', name: 'Basin mixer tap', category: 'fixture', unit: 'piece',
		...money('142.50', 'EUR'), waste: '0', supplier: 'Sanitär Reuter', sku: 'BM-CHR',
		height: 310, notes: null, outline: measured(55, 55, regular(8, 27.5)),
	},
	{
		id: 'downlight-led', name: 'Downlight, LED 8 W', category: 'fixture', unit: 'piece',
		...money('27.90', 'EUR'), waste: '0', supplier: 'Elektro Timm', sku: 'DL-8W-WW',
		height: 60, notes: null, outline: measured(85, 85, regular(16, 42.5)),
	},
	{
		id: 'boxwood-hedge', name: 'Boxwood hedge, 40 cm', category: 'plant', unit: 'm',
		...money('31.00', 'EUR'), waste: '0.05', supplier: 'Baumschule Rehder', sku: 'BX-40',
		height: 400, notes: null, outline: { kind: 'none' },
	},
	{
		id: 'scaffold-tower', name: 'Scaffold tower, 4 m', category: 'equipment', unit: 'day',
		...money('64.00', 'EUR'), waste: '0', supplier: 'Mietpark Elbe', sku: 'ST-4000',
		height: 4000, notes: null, outline: measured(1350, 700),
	},
	{
		id: 'floor-sander', name: 'Floor sander, belt', category: 'equipment', unit: 'day',
		...money('89.00', 'EUR'), waste: '0', supplier: 'Mietpark Elbe', sku: 'FS-BELT',
		height: null, notes: null, outline: { kind: 'none' },
	},
	{
		id: 'internal-door-oak', name: 'Internal door, oak veneer', category: 'building-element', unit: 'piece',
		...money('268.00', 'EUR'), waste: '0', supplier: 'Türenwerk Süd', sku: 'ID-860-OAK',
		height: 2010, notes: null, outline: measured(860, 40),
	},
	{
		id: 'site-management', name: 'Site management', category: 'custom', unit: 'hour',
		...money('72.00', 'EUR'), waste: '0', supplier: null, sku: null,
		height: null, notes: 'Charged against the whole project rather than a room.',
		outline: { kind: 'none' },
	},
	{
		id: 'mineral-wool-100', name: 'Mineral wool, 100 mm', category: 'insulation', unit: 'm2',
		...money('14.60', 'EUR'), waste: '0.07', supplier: 'Dämmstoffe Kiel', sku: 'MW-100',
		height: 100, notes: null, outline: { kind: 'none' },
	},
];

const HARNESS_ENTRIES: readonly CatalogueEntryDto[] = SEEDS.map((seed) => ({
	version: { revision: 4, observed: 'harness-asset-library' as ObservationToken },
	assetId: seed.id as AssetId,
	name: seed.name,
	category: seed.category,
	unit: seed.unit,
	unitCostAmount: seed.unitCostAmount,
	currency: seed.currency,
	wasteFactorDefault: seed.waste,
	supplier: seed.supplier,
	sku: seed.sku,
	height: seed.height,
	notes: seed.notes,
	background: seed.background ?? null,
}));

const HARNESS_OUTLINES: ReadonlyMap<AssetId, AssetOutline> = new Map(
	SEEDS.map((seed) => [seed.id as AssetId, seed.outline]),
);

/**
 * §5.1a's repair strip, drawn at rest so that it is looked at rather than assumed. Two rows and
 * not one, because the strip's own contract is that `Open note` appears beside the rows a note
 * edit can repair and NOT beside the rest — the `no-id` note carries the action, the
 * future-schema refusal deliberately carries none, and one row of either kind alone would draw
 * a strip in which both rules look the same.
 */
const HARNESS_UNREADABLE: readonly UnreadableEntry[] = [
	{ assetId: null, path: 'Renovation/Library/Mystery note.md', reason: 'no-id', code: null },
	{
		assetId: 'from-a-newer-build' as AssetId,
		path: 'Renovation/Library/Underfloor manifold.md',
		reason: 'read-failed',
		code: 'asset.schema-version-unsupported',
	},
];

const HARNESS_VERSION = { revision: 4, observed: 'harness-asset-library' as ObservationToken };

/**
 * The design behind ONE seeded asset, which is what makes §3.5's Shape section draw a footprint,
 * a clearance and a spec sheet rather than three loading lines. Every other id answers a design
 * with no shape at all — the ordinary starting state of an asset nobody has drawn.
 */
const DESIGNED = 'base-cabinet-600';

function designFor(assetId: AssetId): AssetDesignDto {
	const named = SEEDS.find((seed) => seed.id === assetId);
	const designed = assetId === (DESIGNED as AssetId);
	return {
		assetId,
		name: named?.name ?? '',
		height: named?.height ?? null,
		background: named?.background ?? null,
		calibration: null,
		shape: designed
			? {
					footprint: { points: box(600, 580) },
					footprintOrigin: 'traced',
					footprintPending: true,
					clearancePending: true,
					anchorPending: false,
					clearance: { points: box(600, 1180) },
					anchor: { x: 300, y: 290 },
					facing: 0,
				}
			: null,
		dimensions: designed ? { width: 600, depth: 580 } : null,
		clearanceExtent: designed ? { width: 600, depth: 1180 } : null,
		dimensionsUnscaled: designed,
		noteVersion: HARNESS_VERSION,
		geometryVersion: HARNESS_VERSION,
	};
}

/**
 * Two projects sharing a name, which is the case `ListRequirementsReferencing.
 * withPathsWhereAmbiguous` sets `projectPath` for — §12 records the *Used in* list drawing two
 * identical rows for the two things a user is being asked to tell apart, immediately before a
 * deletion. A fixture with three distinct names would photograph the row and not the rule.
 */
const USED_IN: readonly ReferencingGroup[] = [
	{
		projectId: 'prj-hamburg-a' as ProjectId,
		projectName: 'Flat renovation',
		projectPath: 'Renovation/Hamburg/Flat renovation',
		requirementIds: ['req-1', 'req-2', 'req-3'] as RequirementId[],
	},
	{
		projectId: 'prj-hamburg-b' as ProjectId,
		projectName: 'Flat renovation',
		projectPath: 'Renovation/Kiel/Flat renovation',
		requirementIds: ['req-4'] as RequirementId[],
	},
	{
		projectId: 'prj-studio' as ProjectId,
		projectName: 'Garden studio',
		requirementIds: ['req-5', 'req-6'] as RequirementId[],
	},
];

/** One of the three, so §11 item 6's override mark is drawn beside two rows without one. */
const OVERRIDING: readonly ProjectId[] = ['prj-hamburg-b' as ProjectId];

function harnessQueries(empty: boolean): AssetLibraryQueryServices {
	return {
		// A fresh listing per call, never the module constant: `planEditor.ts`'s `getPlan` carries
		// the rule — the real query builds its answer from notes it has just read, and handing back
		// the module object lets a mutation through Pinia's reactive state edit the fixture.
		listCatalogue: () =>
			Promise.resolve(
				ok({ entries: empty ? [] : structuredClone(HARNESS_ENTRIES), unreadable: empty ? [] : structuredClone(HARNESS_UNREADABLE) }),
			),
		listOutlines: (assetIds) =>
			Promise.resolve(
				new Map(
					assetIds.map((assetId) => [
						assetId,
						HARNESS_OUTLINES.get(assetId) ?? ({ kind: 'none' } as AssetOutline),
					]),
				),
			),
		getDesign: (assetId) => Promise.resolve(ok(designFor(assetId))),
		listReferencing: () => Promise.resolve(ok(USED_IN)),
		listOverridingProjects: () => Promise.resolve(ok(OVERRIDING)),
		// Nothing on this page can reach a reassignment: every write refuses before the flow gets
		// that far. An empty list is what a catalogue with no other area-kind asset answers.
		listReassignmentTargets: () => Promise.resolve(ok([])),
	};
}

/**
 * The two shelves the resting capture opens, and the pair is chosen rather than defaulted:
 * `material` holds the four-slot rows and the one row with neither supplier nor SKU, and
 * `furniture` holds the CHF price. Every other shelf stays collapsed, which is also worth
 * photographing — §3.2's *empty shelf reads as room rather than as clutter* is a claim only a
 * picture settles.
 */
const HARNESS_EXPANDED: readonly string[] = ['material', 'furniture'];

function assetLibraryHarnessDeps(empty: boolean): AssetLibraryDeps {
	return defaultAssetLibraryDeps({ queries: harnessQueries(empty) });
}

export interface MountedAssetLibrary {
	leafEl: HTMLElement;
	view: AssetLibraryView;
}

/**
 * `assetId` is `null` for the resting pane and an id for §7's selected compositions — the same
 * `''`-means-nothing-selected sentinel `AssetLibraryView.getState` writes, translated here at
 * the one place a URL meets it.
 */
export function mountAssetLibraryHarness(root: HTMLElement, assetId: string | null, empty = false): MountedAssetLibrary {
	// Obsidian's DOM prototype extensions. Installed first, because the mount below uses them.
	installObsidianDom();
	root.empty();

	const leafEl = root.createDiv('rp-harness-leaf');
	const leaf = new FakeLeaf();
	const view = new AssetLibraryView(leaf as never, assetLibraryHarnessDeps(empty));
	// So that `publishViewState`'s round trip through `leaf.setViewState` reaches this view's own
	// `setState` the way Obsidian's does, rather than being recorded and dropped. The selection
	// works either way — `publishViewState` writes the refs before it publishes — but a page for
	// looking at should exercise the mechanism rather than the shortcut past it.
	leaf.view = view;
	leafEl.appendChild(view.containerEl);

	// State first, then open — the restored-leaf order `mountPlanEditorHarness` and
	// `mountAssetDesignerHarness` both use. `void` rather than awaited: the page entry cannot
	// await, and both do their work synchronously before resolving.
	void view.setState({ assetId: assetId ?? '', expanded: HARNESS_EXPANDED }, {} as never);
	void view.onOpen();

	return { leafEl, view };
}

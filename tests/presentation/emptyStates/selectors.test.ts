import type { ObservationToken } from '../../../src/application/ports/versioning';
/**
 * The empty-state selectors: the full input/output table from the slice's Design §3.
 *
 * Node, not jsdom, and that is the return on keeping them pure — a rule about which empty
 * state applies is asked of a function, never of a screen.
 */
import { describe, expect, it } from 'vitest';
import {
	selectAssetDesignerEmptyState,
	selectAssetLibraryEmptyState,
	selectPlanEditorEmptyState,
	selectRenovationProjectEmptyState,
} from '../../../src/presentation/emptyStates/selectors';
import type { PlanDto, ProjectSummaryDto, ZoneDto } from '../../../src/presentation/read-models/PlanDto';
import type { CatalogueEntryDto } from '../../../src/application/queries/ListCatalogueEntries';
import { assetDesign } from '../../helpers/assetDesign';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { currencyOf } from '../../../src/core/money/Money';

const anEntry = (): CatalogueEntryDto => ({
	version: { revision: 1, observed: 'fixture' as ObservationToken },
	assetId: createAssetId(),
	name: 'Oak plank floor',
	category: 'material',
	unit: 'm2',
	unitCostAmount: '34.95',
	currency: currencyOf('EUR'),
	wasteFactorDefault: '0.08',
	supplier: null,
	sku: null,
	height: null,
	notes: null,
	background: null,
});

const PLAN: PlanDto = {
	id: 'plan-1',
	projectId: 'project-1',
	name: 'Ground floor',
	background: null,
	calibration: null,
	layers: [],
};

const ZONE: ZoneDto = {
	id: 'zone-1',
	planId: 'plan-1',
	name: 'Kitchen',
	zoneType: 'Room',
	status: 'Planned',
	points: [
		{ x: 0, y: 0 },
		{ x: 1000, y: 0 },
		{ x: 1000, y: 1000 },
	],
};

const withBackground = (): PlanDto => ({
	...PLAN,
	background: { path: 'Plans/ground.png', kind: 'image' },
});

describe('selectPlanEditorEmptyState', () => {
	/**
	 * Both conditions hold for this input (`background: null` and `zones: []`), which is what
	 * makes it the one a plain reorder of the two `if`s reddens: swapping which check runs
	 * first decides the answer only when both would otherwise fire, and this is the only case
	 * in the describe block where that is true. Measured, not assumed.
	 */
	it('asks for a background first, even though such a plan also has no zones', () => {
		expect(selectPlanEditorEmptyState(PLAN, [], 0)).toBe('noBackground');
	});

	/**
	 * The precedence is a FIXED order over PRD §93's onboarding sequence, not a re-derived
	 * "which is more missing" — and this case is the one that proves the order does not rest
	 * on the premise two comments used to state, that a background-less plan has no zones.
	 * It does have zones here, and it does in `create-sample-project` and in the browser
	 * harness, which are the two scenes this project ships. This is the arm a user meets
	 * first, and it reddens under the mutation that false premise actually licenses: drop the
	 * `noBackground` arm on the reasoning "such a plan has no zones anyway, so `noZones`
	 * covers it" — measured, watched red, `zones` here being non-empty means nothing is left
	 * to catch it. A plain reorder of the two `if`s does NOT redden this case; reordering only
	 * changes the outcome for an input where both conditions hold at once, and this one's
	 * `zones` array is non-empty on purpose. The reorder instead reddens its sibling above,
	 * where `zones` is `[]`.
	 */
	it('still asks for a background when the plan already has zones', () => {
		expect(selectPlanEditorEmptyState(PLAN, [ZONE], 0)).toBe('noBackground');
	});

	it('asks for a zone once the background is set', () => {
		expect(selectPlanEditorEmptyState(withBackground(), [], 0)).toBe('noZones');
	});

	it('asks for nothing when the plan has both', () => {
		expect(selectPlanEditorEmptyState(withBackground(), [ZONE], 0)).toBeNull();
	});

	/**
	 * `null` is a BROKEN REFERENCE — the leaf's persisted plan id no longer resolves — not
	 * "no plan yet". Rendering `noBackground` here would tell a user they never imported a
	 * plan when they may have imported one that then vanished. Slice 17 owns what this
	 * renders as; this function's job is to return no key for it.
	 */
	it('returns no key for a plan that does not resolve at all', () => {
		expect(selectPlanEditorEmptyState(null, [], 0)).toBeNull();
	});

	/**
	 * The arm that makes this a THREE-argument function, and the last of the three selectors
	 * to get it. An empty zone list with a refusal behind it is not "no zones yet": `noZones`
	 * carries an "Add a room" button, so the canvas would offer the user an action beside a
	 * strip telling them three of their zones could not be read — two answers to "why is this
	 * canvas empty", and the actionable one is the wrong one.
	 */
	it('asks for nothing when the zones are empty only because notes refused', () => {
		expect(selectPlanEditorEmptyState(withBackground(), [], 3)).toBeNull();
	});

	/**
	 * And the refusal does NOT outrank the background, which is the ordering half. A plan with
	 * no background has not reached the step where its zones matter, so PRD §93's sequence
	 * still asks for the background first — the same short-circuit the two cases at the top of
	 * this block are about. Hoisting the `unreadable` guard above it reddens exactly this case.
	 */
	it('still asks for a background first when notes also refused', () => {
		expect(selectPlanEditorEmptyState(PLAN, [], 3)).toBe('noBackground');
	});
});

describe('selectRenovationProjectEmptyState', () => {
	it('asks for a project when the vault has none', () => {
		expect(selectRenovationProjectEmptyState([], 0)).toBe('noProjects');
	});

	it('asks for nothing once there is one', () => {
		const project: ProjectSummaryDto = { id: 'project-1', name: 'Kitchen refit', status: 'Planning', currency: 'EUR', libraryOverlap: false, planCount: 0, lastWorked: null };

		expect(selectRenovationProjectEmptyState([project], 0)).toBeNull();
	});

	/**
	 * The arm that makes this a two-argument function. An empty list with a refusal behind it
	 * is NOT "no projects yet": the vault may hold five this build cannot parse, and
	 * onboarding copy inviting the user to create their first one would be wrong AND
	 * unactionable. The view renders the refusal notice for this case.
	 */
	it('asks for nothing when the list is empty only because notes refused', () => {
		expect(selectRenovationProjectEmptyState([], 3)).toBeNull();
	});

	/**
	 * A partial read still shows what loaded. The notice is additive, not a replacement —
	 * suppressing the whole surface because one note refused would hide four readable
	 * projects to report the fifth.
	 */
	it('asks for nothing when some projects loaded and others refused', () => {
		const project: ProjectSummaryDto = { id: 'project-1', name: 'Kitchen refit', status: 'Planning', currency: 'EUR', libraryOverlap: false, planCount: 0, lastWorked: null };

		expect(selectRenovationProjectEmptyState([project], 1)).toBeNull();
	});
});

/**
 * Design slice B3's third selector, widened in Task B7 to answer the entry that used to be
 * registered content nothing selected.
 *
 * `EMPTY_STATE_CONTENT.assetDesigner` declares two entries and this function now answers
 * both: `AssetDesignDto` gained `background` in Task B7, which is also where the picker that
 * acts on it is built. The fixture's own `background` default is non-null for exactly this
 * reason — every case below that touches only `shape` continues to mean what it always did,
 * and a case has to say `background: null` explicitly to reach the new arm.
 */
describe('which empty state the asset designer is in', () => {
	it('asks for a footprint when the asset has no shape at all, and already has a background', () => {
		expect(selectAssetDesignerEmptyState(assetDesign({ shape: null }))).toBe('noShape');
	});

	/**
	 * The canvas has something to draw, so nothing overlays it. Slice 14's rule read from the
	 * other end: an empty state over a footprint would be telling the user a region is empty
	 * while the region shows the very thing they drew.
	 */
	it('asks for nothing once a shape exists', () => {
		expect(selectAssetDesignerEmptyState(assetDesign())).toBeNull();
	});

	/**
	 * **A shape suppresses the background nag too**, which is the half of the ordering an
	 * unqualified "shape wins" reading would miss: an asset typed from dimensions never needed
	 * a background at all (`AssetShape.footprintOrigin` can be `'typed'`), so an asset with a
	 * shape and no spec sheet is not a gap this selector treats as one.
	 */
	it('asks for nothing once a shape exists, even with no background at all', () => {
		expect(selectAssetDesignerEmptyState(assetDesign({ background: null }))).toBeNull();
	});

	/**
	 * `dimensions` is DERIVED from the footprint and is `null` exactly when the shape is, so a
	 * selector reading it would be a second answer to one question. This pins that it reads the
	 * shape: a design carrying a shape but a `null` measurement — which `GetAssetDesign` cannot
	 * currently produce, and which a future extent refusal could — still has something to draw.
	 */
	it('reads the shape rather than the derived dimensions', () => {
		expect(selectAssetDesignerEmptyState(assetDesign({ dimensions: null }))).toBeNull();
	});

	/**
	 * **`noBackground` outranks `noShape`** — the "first missing step" ordering
	 * `selectPlanEditorEmptyState` states for its own pair, asked of an asset with neither.
	 */
	it('asks for a background before a footprint, when the asset has neither', () => {
		expect(selectAssetDesignerEmptyState(assetDesign({ shape: null, background: null }))).toBe('noBackground');
	});
});

/**
 * Design "Asset library overview" §4's fourth selector. Unlike its three siblings, `entries`
 * is never an `Err` to guard against — `ListCatalogueEntries` has already succeeded by the
 * time this is asked, and a failed read is `ViewFailure`'s state, not this registry's.
 *
 * `searching` is the third, independent input this file's header argues for: an empty result
 * says nothing about whether a query is running, and the two answers this function gives for
 * an empty list are opposite states with opposite hand-offs. `unreadable` sits second, matching
 * the order its two list-shaped siblings above already take theirs in.
 */
describe('which empty state the asset library is in', () => {
	it('asks for nothing when the library has entries, even while searching', () => {
		expect(selectAssetLibraryEmptyState([anEntry()], 0, true)).toBeNull();
	});

	it('asks for nothing when the library has entries and no search is running', () => {
		expect(selectAssetLibraryEmptyState([anEntry()], 0, false)).toBeNull();
	});

	it('asks for noAssets on an empty library with no search running', () => {
		expect(selectAssetLibraryEmptyState([], 0, false)).toBe('noAssets');
	});

	/**
	 * The case that discriminates this selector from a plain `entries.length === 0` check: the
	 * SAME empty list answers `noMatches` here rather than `noAssets`, because a search is
	 * running. Mutating the two branches into one (`entries.length === 0 ? 'noAssets' : null`,
	 * dropping `searching` entirely) reddens this case at its assertion while leaving the two
	 * above it green — which is what makes it the one worth keeping when the others are cut.
	 */
	it('asks for noMatches on an empty library while a search is running', () => {
		expect(selectAssetLibraryEmptyState([], 0, true)).toBe('noMatches');
	});

	/**
	 * The guard is UNCONDITIONAL — refused whatever `searching` is — per the ruling on the
	 * finding that this selector originally omitted it entirely: a library whose notes all
	 * refused is not "no assets at all" (§4's own row for that vault is *Some unreadable*,
	 * whose shelves still draw), and narrowing the guard to the `noAssets` arm alone would give
	 * this selector two different policies for `unreadable` to reconcile. Both arms are pinned
	 * here rather than one, because a guard tested only on the arm somebody was thinking about
	 * is this repository's oldest recurring defect — and `searching: true` is the arm a version
	 * of this fix that special-cased `noAssets` alone would still get wrong.
	 */
	it('refuses to answer noAssets when the library has unreadable notes', () => {
		expect(selectAssetLibraryEmptyState([], 1, false)).toBeNull();
	});

	it('refuses to answer noMatches too, when the library has unreadable notes', () => {
		expect(selectAssetLibraryEmptyState([], 1, true)).toBeNull();
	});
});

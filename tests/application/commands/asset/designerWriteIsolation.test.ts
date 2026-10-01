/**
 * A GRAPHIC write moves no catalogue figure and no requirement figure (AD15 T40).
 *
 * `setAssetHeight.test.ts` already proves this for the one design field that lives in the NOTE,
 * and the gap it leaves is the other direction: nothing took a geometry, a detail, a group or a
 * repeat write and asked whether the unit cost, the waste factor, the unit or a Requirement's own
 * figures had moved underneath it.
 *
 * **The four kinds share ONE application write path, which is why this file has five rows rather
 * than four near-identical ones.** Measured rather than assumed: `detailEdits.ts`, `groupEdits.ts`
 * and `arrangeDetails.ts` export PURE `AssetShape -> AssetShape` functions with no port in sight,
 * and the designer hands each of them to `createEditShape`, whose `write` is the one dispatcher
 * `guardedServices.ts` builds over `SetAssetShapeCommand` — `grep -rn "SetAssetShapeCommand" src/`
 * prints five lines: the class declaration, an import and a construction in `guardedServices.ts`,
 * and two prose mentions, so no second command takes a whole `AssetShape`. Detail, group and
 * repeat are three inputs to one command, and the two rows beside them are the writers that reach
 * the sidecar by a DIFFERENT route.
 *
 * Read both of those rows narrowly, because the obvious wider sentence is false either way.
 * `SetAssetFootprintCommand` is one of FIVE commands that hand `updateAssetShape` their own
 * `ShapeChange` and their own `unchanged` — `grep -rn "updateAssetShape(" src/` prints seven
 * lines, the definition plus six call sites, and the five are the two footprint commands, the
 * clearance, the anchor and the facing (the sixth is `SetAssetShape` itself). And
 * `CalibrateAssetCommand` is not the only sidecar writer outside `updateAssetShape`, it is the
 * FIRST — the claim `updateAssetShape.ts`'s own docblock makes. `grep -rn "sidecar\.write" src/`
 * prints seven calls in five modules: this pair, plus `DuplicateAsset.ts`,
 * `SetAssetBackground.ts` (twice) and `ReversibleAssetDesignCommands.ts` (twice). None of those
 * three is a geometry, detail, group or repeat write, which is why the card loses nothing by
 * their absence here — but the sentence may not read as if they did not exist.
 *
 * **Each row asserts the write LANDED in the same case that asserts nothing else moved.** A
 * figure that did not change is what a refused write, a `no-write` and a fixture with nothing in
 * it all look like, so `landed` reads the stored document back and names the thing the edit was
 * about, POSITIVELY — a `not.toEqual` over `document.shape?.…` also passes when the shape is gone
 * and the expression is `undefined`, which is the one way this file could certify a vanished
 * design. Without `landed` the strongest claim here would be that nothing happened at all.
 *
 * **The recalculation cascade is REGISTERED on the fixture's own bus, and what that buys is
 * narrower than it looks.** A build announcing `AssetUpdated` from a graphic write would drive
 * `onAssetUpdated` for real, and that is what the published-event whitelist catches. It would NOT
 * move the figures this file re-reads: `onAssetUpdated` filters through
 * `assetMatchesCalculatedFrom`, which compares `unitCost` and `unit` only, so a graphic write
 * moves neither, `changed` comes out empty and `runRecalculationCascade` is handed `[]`. Measured
 * as a mutation, not reasoned: publishing `assetUpdated` from both write paths reddened the event
 * whitelist and left all three requirement assertions green.
 *
 * Two consequences worth stating rather than leaving to be rediscovered. `after.version.revision`
 * is the load-bearing requirement assertion — a cascade that RAN writes a revision even when it
 * recalculates to the same numbers. `quantity` and `estimatedCost` are a narrower net than they
 * read as, because a recalculation from unchanged inputs produces identical figures; they catch
 * the day an input changes, not the day the cascade merely fires. So this file is weak evidence
 * today and strong evidence the day somebody makes a graphic fact an input to a figure — the
 * same shape `setAssetHeight.test.ts` states about a height.
 */
import { describe, expect, it } from 'vitest';
import { CalibrateAssetCommand } from '../../../../src/application/commands/asset/CalibrateAsset';
import { SetAssetFootprintCommand } from '../../../../src/application/commands/asset/SetAssetFootprint';
import { SetAssetShapeCommand } from '../../../../src/application/commands/asset/SetAssetShape';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import { registerOnAssetUpdated } from '../../../../src/application/event-handlers/requirement/onAssetUpdated';
import type { AssetGeometryDocument } from '../../../../src/application/ports/AssetGeometrySidecar';
import type { ValidationError } from '../../../../src/core/errors/AppError';
import type { Result } from '../../../../src/core/result/Result';
import { repeatDetails } from '../../../../src/domain/asset/arrangeDetails';
import { shapeFromDimensions, type AssetShape } from '../../../../src/domain/asset/AssetShape';
import { addDetail } from '../../../../src/domain/asset/detailEdits';
import { groupDetails } from '../../../../src/domain/asset/groupEdits';
import { InMemoryAssetGeometrySidecar } from '../../../helpers/asset-geometry-sidecar';
import { expectFound, expectOk } from '../../../helpers/domain';
import { recorder } from '../../../helpers/logger';
import { assignedRequirementFixture, noopCascadeNotify } from '../../../helpers/slice10';

/** A 400 x 700 symbol with two graphics in it, so a group has two members to take. */
const SEED: AssetShape = {
	...expectOk(shapeFromDimensions(400, 700)),
	details: [
		{
			id: 'detail-1',
			name: 'bowl',
			line: 'solid',
			pending: false,
			outline: { points: [{ x: -150, y: -300 }, { x: 150, y: -300 }, { x: 150, y: -100 }, { x: -150, y: -100 }] },
		},
		{
			id: 'detail-2',
			name: 'tank',
			line: 'solid',
			pending: false,
			outline: { points: [{ x: -150, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 300 }, { x: -150, y: 300 }] },
		},
	],
};

/** A wider outline than the seed's, so a footprint write is visible in the stored points. */
const WIDER = [{ x: -300, y: -450 }, { x: 300, y: -450 }, { x: 300, y: 450 }, { x: -300, y: 450 }];

async function seeded() {
	// A Requirement already linking a 10 m² zone to the asset, priced at 45.00/m² with a 10% waste
	// factor — every figure this file claims is untouched is one this fixture actually carries, so
	// no assertion here can pass by comparing an absent value against an absent value.
	const fixture = await assignedRequirementFixture();
	registerOnAssetUpdated(fixture.events, {
		notify: noopCascadeNotify,
		requirements: fixture.requirements,
		assets: fixture.assets,
		overrides: fixture.overrides,
		events: fixture.events,
		logger: recorder,
		recalculate: (input) => fixture.recalculate.execute({ requirementId: input.requirementId as never }),
	});
	const sidecar = new InMemoryAssetGeometrySidecar();
	expectOk(await sidecar.write(fixture.assetId, { calibration: null, shape: SEED }));
	const deps = { sidecar, assets: fixture.assets, events: fixture.events, locks: fixture.locks };

	return {
		fixture,
		assetId: fixture.assetId,
		setShape: new SetAssetShapeCommand(deps),
		setFootprint: new SetAssetFootprintCommand(deps),
		calibrate: new CalibrateAssetCommand(deps),
		async document(): Promise<AssetGeometryDocument> {
			return expectOk(await sidecar.read(fixture.assetId)).document;
		},
	};
}

type Harness = Awaited<ReturnType<typeof seeded>>;

interface GraphicWrite {
	readonly name: string;
	readonly write: (h: Harness) => Promise<DispatchResult>;
	/** What the stored document has to say for this write to count as having happened. */
	readonly landed: (document: AssetGeometryDocument) => void;
}

/** The three kinds that share `SetAssetShapeCommand`, each as the pure edit the designer hands it. */
function viaShape(edit: (shape: AssetShape) => Result<AssetShape, ValidationError>) {
	return async (h: Harness): Promise<DispatchResult> => {
		const { shape } = await h.document();
		if (shape === null) throw new Error('the seeded shape is missing');
		return await h.setShape.execute({ assetId: h.assetId, shape: expectOk(edit(shape)) });
	};
}

const WRITES: readonly GraphicWrite[] = [
	{
		name: 'a geometry write (SetAssetFootprint)',
		write: (h) => h.setFootprint.execute({ assetId: h.assetId, points: WIDER, measured: true }),
		landed: (document) => {
			expect(document.shape?.footprint.points).toEqual(WIDER);
		},
	},
	{
		name: 'a detail write (addDetail via SetAssetShape)',
		write: viaShape((shape) =>
			addDetail(shape, {
				name: 'shelf',
				line: 'dashed',
				pending: false,
				outline: { points: [{ x: -100, y: -50 }, { x: 100, y: -50 }, { x: 100, y: 0 }, { x: -100, y: 0 }] },
			}),
		),
		landed: (document) => {
			expect(document.shape?.details.map((detail) => detail.name)).toEqual(['bowl', 'tank', 'shelf']);
		},
	},
	{
		name: 'a group write (groupDetails via SetAssetShape)',
		write: viaShape((shape) => groupDetails(shape, ['detail-1', 'detail-2'])),
		landed: (document) => {
			expect(document.shape?.groups?.map((group) => group.members)).toEqual([['detail-1', 'detail-2']]);
		},
	},
	{
		name: 'a repeat write (repeatDetails via SetAssetShape)',
		write: viaShape((shape) =>
			repeatDetails(shape, { ids: ['detail-1'], count: 2, axis: 'x', spacing: 500, mode: 'centres' }),
		),
		landed: (document) => {
			expect(document.shape?.details).toHaveLength(4);
		},
	},
	{
		name: 'a calibration write (CalibrateAsset, which takes no updateAssetShape)',
		write: (h) =>
			h.calibrate.execute({ assetId: h.assetId, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 }),
		landed: (document) => {
			expect(document.calibration?.knownDistance).toBe(200);
		},
	},
];

describe('a graphic write is read by nothing that calculates', () => {
	it.each(WRITES)(
		'$name changes no unit cost, no waste factor, no unit and no requirement figure',
		async (row) => {
			const h = await seeded();
			const assetBefore = expectFound(await h.fixture.assets.getById(h.assetId));
			const before = expectFound(await h.fixture.requirements.getById(h.fixture.requirementId));
			// From here on, every event on this bus is one this write published.
			h.fixture.events.clear();

			expect(expectOk(await row.write(h))).toBe('wrote');

			row.landed(await h.document());
			const assetAfter = expectFound(await h.fixture.assets.getById(h.assetId));
			expect(assetAfter.entity.unitCost).toEqual(assetBefore.entity.unitCost);
			expect(assetAfter.entity.wasteFactorDefault.toString()).toBe(assetBefore.entity.wasteFactorDefault.toString());
			expect(assetAfter.entity.unit).toBe(assetBefore.entity.unit);
			expect(assetAfter.version.revision).toBe(assetBefore.version.revision);

			const after = expectFound(await h.fixture.requirements.getById(h.fixture.requirementId));
			expect(after.entity.quantity.calculated.value.toString()).toBe(before.entity.quantity.calculated.value.toString());
			expect(after.entity.estimatedCost.calculated.amount).toBe(before.entity.estimatedCost.calculated.amount);
			expect(after.version.revision).toBe(before.version.revision);
			expect(h.fixture.events.published.map((event) => event.type)).toEqual(['AssetDesignChanged']);
		},
	);
});

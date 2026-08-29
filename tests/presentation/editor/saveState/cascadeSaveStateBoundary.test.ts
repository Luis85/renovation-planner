import { describe, expect, it, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { createPinia, setActivePinia } from 'pinia';
import { MoveSpatialObjectCommand } from '../../../../src/application/commands/zone/MoveSpatialObject';
import { registerOnZoneGeometryChanged } from '../../../../src/application/event-handlers/requirement/onZoneGeometryChanged';
import { SessionWriteLedger } from '../../../../src/application/editor/WriteLedger';
import { CommandHistory } from '../../../../src/presentation/editor/tools/command-history';
import { ReversibleMoveZoneCommand } from '../../../../src/presentation/editor/tools/reversible-move-zone-command';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';
import { withSaveStateTracking } from '../../../../src/presentation/editor/save-state/with-save-state-tracking';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { expectOk, expectErr } from '../../../helpers/domain';
import { makeAsset, makeZone, squareAt } from '../../../helpers/entities';
import { recorder } from '../../../helpers/logger';
import { requirementFixture, TEN_SQUARE_METERS } from '../../../helpers/slice10';
import type { RequirementRepository } from '../../../../src/application/ports/RequirementRepository';

/**
 * **Where a background cascade failure is allowed to reach, and where it deliberately is
 * not.** Moving a zone publishes `ZoneGeometryChanged`; slice 10's cascade marks every
 * referencing Requirement stale and recalculates it. `MoveSpatialObjectCommand` AWAITS that
 * publication, so the cascade runs inside the dispatch the save indicator is timing — which
 * makes "does a cascade failure flip the indicator" a real question with two defensible
 * answers, and until this file existed the answer was implicit across three modules and
 * pinned by nothing.
 *
 * The answer is NO, on the reasoning `affectsSaveState` is already built on. The user's
 * gesture DID persist — the zone's geometry is in the vault at a new revision — and
 * `save-error` is STICKY, since only a successful write clears it. A cascade failure
 * flipping it would leave a permanent "Save error" standing over data that is correct, which
 * is the false badge four measurements of that predicate went to avoid. `DispatchOutcome`'s
 * own header scopes the value the same way: it says whether a dispatch reached the vault,
 * "not how much it wrote or which entities moved".
 *
 * **The second assertion is what makes the first one honest, and it is not optional.** "The
 * indicator stays `saved`" is equally true of a build where the cascade failure reaches
 * NOBODY — and under that reading, flipping the indicator WOULD be the right fix. So each
 * case also asserts the failure arrived at the channel that owns it: `notify`, which
 * `composition-root.ts` binds to `notifyWarning` — a notice with no auto-dismiss. Asserted
 * together, or the pair proves nothing.
 */

/** Every `markStale` refuses — the cascade's own `staleMarkerFailed` fixture. */
function failingStaleMarkers(inner: RequirementRepository): RequirementRepository {
	return Object.assign(Object.create(Object.getPrototypeOf(inner) as object), inner, {
		markStale: () =>
			Promise.resolve({
				ok: false,
				error: { category: 'Persistence', code: 'test.injected', message: 'injected' },
			} as never),
	}) as RequirementRepository;
}

/** Every `listByZone` refuses — the cascade's other loud branch, `cascadeAborted`. */
function failingListByZone(inner: RequirementRepository): RequirementRepository {
	return Object.assign(Object.create(Object.getPrototypeOf(inner) as object), inner, {
		listByZone: () =>
			Promise.resolve({
				ok: false,
				error: { category: 'Persistence', code: 'test.injected', message: 'injected' },
			} as never),
	}) as RequirementRepository;
}

async function wired(wrap: (inner: RequirementRepository) => RequirementRepository) {
	const zones = new InMemoryZoneRepository();
	const w = await requirementFixture(undefined, zones);

	const zone = expectOk(
		await zones.save(
			expectOk(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id })
					.withGeometry({ points: TEN_SQUARE_METERS }),
			),
			'absent',
		),
	);
	const asset = expectOk(
		await w.assets.save(
			makeAsset({ projectId: w.project.entity.id, wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	// A real referencing Requirement, so the cascade has a target to fail on rather than an
	// empty list that would make every assertion below vacuous.
	const assigned = await w.assign.execute({ zoneId: zone.entity.id, assetId: asset.entity.id });
	if (!assigned.ok) throw new Error('fixture failed to assign');

	const notices: string[] = [];
	registerOnZoneGeometryChanged(w.events, {
		requirements: wrap(w.requirements),
		events: w.events,
		logger: recorder,
		recalculate: (input) => w.recalculate.execute({ requirementId: input.requirementId as never }),
		notify: {
			cascadeAborted: (id: string) => notices.push(`aborted:${id}`),
			staleMarkerFailed: (id: string) => notices.push(`stale:${id}`),
		},
	});

	const saveState = useSaveStateStore();
	const history = withSaveStateTracking(new CommandHistory(), saveState);
	const command = new ReversibleMoveZoneCommand(
		new MoveSpatialObjectCommand(zones, w.events),
		new SessionWriteLedger(),
		zone.entity.id,
		squareAt(500, 500),
		zone.entity.geometry,
	);

	return { zones, zone, history, saveState, notices, command, events: w.events };
}

describe('a cascade failure and the save indicator', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('leaves the indicator SAVED when the stale marker cannot be written, and warns instead', async () => {
		const w = await wired(failingStaleMarkers);

		expect(expectOk(await w.history.run(w.command))).toBe('wrote');

		// The gesture's own write really did land — the claim the indicator is making.
		expect(expectOk(await w.zones.getById(w.zone.entity.id))?.entity.geometry.points)
			.toEqual(squareAt(500, 500).points);
		expect(w.saveState.state).toBe('saved');
		// ...and the cascade failure reached the channel that owns it.
		expect(w.notices).toHaveLength(1);
		expect(w.notices[0]).toMatch(/^stale:/);
	});

	it('leaves the indicator SAVED when the cascade cannot even list the referents', async () => {
		const w = await wired(failingListByZone);

		expect(expectOk(await w.history.run(w.command))).toBe('wrote');

		expect(w.saveState.state).toBe('saved');
		expect(w.notices).toEqual([`aborted:${w.zone.entity.id}`]);
	});

	/**
	 * The contrast case, so neither of the two above can pass on an indicator that is simply
	 * stuck on `saved`. A failure of the gesture's OWN write is what it exists to report.
	 *
	 * **It has to be the WRITE that refuses, which the first draft of this case got wrong and
	 * is worth keeping.** Moving a zone that is not there refuses with `zone.zone-not-found`,
	 * a `Reference` code — genuinely pre-write, so the indicator correctly stays `saved` and
	 * the case failed. That is `affectsSaveState` doing its job, not a hole: a contrast case
	 * needs a `Persistence` refusal, which is what a repository whose `save` fails produces.
	 */
	it('still reports a save error when the zone write itself refuses', async () => {
		const w = await wired(failingStaleMarkers);
		const refusingZones = Object.assign(
			Object.create(Object.getPrototypeOf(w.zones) as object) as InMemoryZoneRepository,
			w.zones,
			{
				save: () =>
					Promise.resolve({
						ok: false,
						error: { category: 'Persistence', code: 'test.injected', message: 'injected' },
					} as never),
			},
		) as InMemoryZoneRepository;
		const refused = new ReversibleMoveZoneCommand(
			new MoveSpatialObjectCommand(refusingZones, w.events),
			new SessionWriteLedger(),
			w.zone.entity.id,
			squareAt(1, 1),
			squareAt(2, 2),
		);

		expectErr(await w.history.run(refused));

		expect(w.saveState.state).toBe('save-error');
	});
});

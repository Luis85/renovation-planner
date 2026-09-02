// @vitest-environment jsdom
/**
 * **A mounted Inspector hearing that its unit-cost figures moved.**
 *
 * The block the row draws has THREE inputs — the shared library's price, this project's own,
 * and the provenance `calculatedFrom.unitCost` records — and each moves through a different
 * event. `PLAN_CHANGE_EVENTS` carries none of them and `onCatalogueChanged` reloaded only the
 * assign picker's options, so a price set in another leaf rewrote the requirement while an open
 * Plan Editor went on rendering the figures it read at mount.
 *
 * Two of those events also fire BEFORE the figure they move: `EventBus.publish` delivers to
 * every handler without ordering them, so a refresh bound to the price or the catalogue event
 * is a SIBLING of the recalculation cascade rather than something that follows it. That is why
 * there are three subscriptions rather than two, and why the third one exists at all.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { err, ok, type Result } from '../../../src/core/result/Result';
import { of as moneyOf, type Money } from '../../../src/core/money/Money';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import type { RequirementInspectorDTO } from '../../../src/application/queries/GetRequirementsForZone';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import type { EntityId } from '../../../src/core/identity/EntityId';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { fakeQueries, mountPlanEditor, settle, settleUntil as until } from '../../helpers/editor';
import { FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';

type Rows = Result<readonly RequirementInspectorDTO[], RepositoryError>;

const KITCHEN = 'zone-kitchen';
const TERRACE = 'zone-terrace';

/** A row whose only interesting field is the unit-cost group this task renders. */
function row(
	requirementId: string,
	unitCost: { catalogue: Money; projectOverride: Money | null; effective: Money },
): RequirementInspectorDTO {
	return {
		requirementId: requirementId as RequirementId,
		assetId: 'a1',
		assetName: 'Oak flooring',
		missingTarget: null,
		unit: 'm2',
		wasteFactor: new Decimal('0.10'),
		recalculationStatus: 'current',
		quantity: { effective: new Decimal(12), calculated: new Decimal(12), override: null },
		cost: {
			effective: moneyOf('100.00', 'EUR'),
			calculated: moneyOf('100.00', 'EUR'),
			override: null,
		},
		unitCost,
	};
}

const LIBRARY_ONLY = row('r1', {
	catalogue: moneyOf('24.00', 'EUR'),
	projectOverride: null,
	effective: moneyOf('24.00', 'EUR'),
});

/** The price has moved and the cascade has NOT caught up: three figures, provenance included. */
const PRICED_NOT_RECALCULATED = row('r1', {
	catalogue: moneyOf('24.00', 'EUR'),
	projectOverride: moneyOf('19.50', 'EUR'),
	effective: moneyOf('24.00', 'EUR'),
});

/** The same override, after the recalculation: two figures, no provenance to show. */
const PRICED_AND_RECALCULATED = row('r1', {
	catalogue: moneyOf('24.00', 'EUR'),
	projectOverride: moneyOf('19.50', 'EUR'),
	effective: moneyOf('19.50', 'EUR'),
});

/** The library price moved; no project override anywhere in sight. */
const RELISTED = row('r1', {
	catalogue: moneyOf('31.00', 'EUR'),
	projectOverride: null,
	effective: moneyOf('31.00', 'EUR'),
});

const B_STALE = row('r2', {
	catalogue: moneyOf('40.00', 'EUR'),
	projectOverride: moneyOf('35.00', 'EUR'),
	effective: moneyOf('40.00', 'EUR'),
});
const B_RECALCULATED = row('r2', {
	catalogue: moneyOf('40.00', 'EUR'),
	projectOverride: moneyOf('35.00', 'EUR'),
	effective: moneyOf('35.00', 'EUR'),
});

/**
 * The requirements query, with its ANSWER captured at CALL time and its resolution optionally
 * held open.
 *
 * Captured at call rather than at resolve, which is the property several cases below rest on:
 * a read that went out before an event and one that went out after it must be able to answer
 * differently, or a case cannot tell a build that scheduled a trailing read from one that did
 * not. Held open because the whole of the hydration-window question is what happens to an event
 * that lands while a read is in flight.
 */
function requirementReads() {
	let answer: Rows = ok([]);
	let blocking = false;
	const zones: string[] = [];
	const held: (() => void)[] = [];

	return {
		/** Every zone id this query was asked about, in order — the read COUNT, discriminated. */
		zones,
		set: (next: Rows): void => {
			answer = next;
		},
		block: (): void => {
			blocking = true;
		},
		/** Release the oldest held read, resolving it with the answer it captured. */
		release: (): void => {
			held.shift()?.();
		},
		unblock: (): void => {
			blocking = false;
			for (const settleOne of held.splice(0)) settleOne();
		},
		getRequirementsForZone: (zoneId: string): Promise<Rows> => {
			zones.push(zoneId);
			const captured = answer;
			if (!blocking) return Promise.resolve(captured);
			return new Promise<Rows>((resolve) => {
				held.push(() => resolve(captured));
			});
		},
	};
}

/**
 * A mounted editor whose Inspector can actually draw a zone.
 *
 * `zoneInspector` is answered rather than refused, and that is load-bearing rather than
 * convenience: `InspectorPanel` renders the requirements section only for a `zone` DTO, and
 * `InspectorStore.refresh` returns EARLY on a failed zone read — so a refusing stand-in would
 * make every case here green for the wrong reason, by never reaching the rows at all.
 */
async function mountWith(reads: ReturnType<typeof requirementReads>) {
	const harness = await mountPlanEditor({
		queries: {
			...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
			getRequirementsForZone: reads.getRequirementsForZone,
		},
		commands: {
			...unavailablePlanEditorCommands(),
			zoneInspector: {
				execute: ({ zoneId }) =>
					Promise.resolve(ok({ id: zoneId, name: String(zoneId), areaMm2: 12_000_000 })),
			},
		},
	});
	return harness;
}

function select(harness: Awaited<ReturnType<typeof mountWith>>, zoneId: string): void {
	useSelectionStore(harness.pinia).select([zoneId as unknown as EntityId<string>]);
}

/** The unit-cost figures on screen, keyed by which of the three each is. */
function figures(harness: Awaited<ReturnType<typeof mountWith>>): Record<string, string> {
	return Object.fromEntries(
		harness.wrapper
			.findAll('[data-price]')
			.map((cell) => [cell.attributes('data-price') ?? '', cell.text()]),
	);
}

const refusal: RepositoryError = {
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: 'developer english',
};

describe('the Inspector unit-cost figures, once something moves them', () => {
	it('rehydrates the inspector rows when a project price changes in another leaf', async () => {
		const reads = requirementReads();
		reads.set(ok([LIBRARY_ONLY]));
		const harness = await mountWith(reads);

		select(harness, KITCHEN);
		await until(() => figures(harness)['library'] !== undefined, 'the unit-cost block is drawn');
		expect(figures(harness)['project']).toBeUndefined();

		// The price is set in the project pane, in another leaf. Nothing in this leaf dispatched
		// it, so the post-command refresh funnel never runs here.
		reads.set(ok([PRICED_AND_RECALCULATED]));
		harness.changeProjectPrices();

		await until(() => figures(harness)['project'] !== undefined, 'the project price appears');
		expect(figures(harness)['project']).toContain('19.5 EUR');

		harness.unmount();
	});

	it('rehydrates the inspector rows when the catalogue price changes', async () => {
		const reads = requirementReads();
		reads.set(ok([LIBRARY_ONLY]));
		const harness = await mountWith(reads);

		select(harness, KITCHEN);
		await until(() => figures(harness)['library'] !== undefined, 'the unit-cost block is drawn');
		expect(figures(harness)['library']).toContain('24 EUR');

		// The OTHER half. Wiring only the price door would leave this block showing a stale
		// library price beside a fresh project one, which is a worse picture than two stale
		// numbers.
		reads.set(ok([RELISTED]));
		harness.changeCatalogue();

		await until(() => figures(harness)['library']?.includes('31 EUR') === true, 'the library price moves');

		harness.unmount();
	});

	/**
	 * The ORDERING case, and the reason there is a third subscription rather than two.
	 *
	 * The price event and the recalculation that follows it are two separate moments. A refresh
	 * bound to the price event alone settles on the read taken between them — the new
	 * `projectOverride` beside the OLD `calculatedFrom.unitCost`, which the row draws as a
	 * third `derived from` figure — and nothing corrects it, because the editor subscribes to
	 * no recalculation event at all.
	 */
	it('shows the recalculated provenance, not the new price beside the old one', async () => {
		const reads = requirementReads();
		reads.set(ok([LIBRARY_ONLY]));
		const harness = await mountWith(reads);

		select(harness, KITCHEN);
		await until(() => figures(harness)['library'] !== undefined, 'the unit-cost block is drawn');

		// The price landed; the cascade has not rewritten the requirement yet.
		reads.set(ok([PRICED_NOT_RECALCULATED]));
		harness.changeProjectPrices();
		await until(() => figures(harness)['derived'] !== undefined, 'the out-of-date provenance is drawn');
		expect(figures(harness)['derived']).toContain('24 EUR');

		// …and now it has. This is the event NEITHER price nor catalogue door carries.
		reads.set(ok([PRICED_AND_RECALCULATED]));
		harness.changeRequirementFigures('r1');

		await until(() => figures(harness)['derived'] === undefined, 'the provenance catches up and the row drops it');
		expect(figures(harness)['project']).toContain('19.5 EUR');

		harness.unmount();
	});

	/**
	 * The hydration window. `hydrateFrom` records the selection and then awaits two queries, so
	 * `requirements` is empty for the whole of the first read — and a figure event landing there
	 * names a requirement that read will RETURN but the store does not yet hold. Filtered on the
	 * committed rows unconditionally, it is dropped, the hydration settles with the old
	 * provenance, and the stale row stands for the life of the selection.
	 */
	it('does not drop a figure event that arrives during the first hydration', async () => {
		const reads = requirementReads();
		reads.set(ok([PRICED_NOT_RECALCULATED]));
		reads.block();
		const harness = await mountWith(reads);

		select(harness, KITCHEN);
		await settle();

		// The cascade finishes while that first read is still in flight.
		reads.set(ok([PRICED_AND_RECALCULATED]));
		harness.changeRequirementFigures('r1');
		await settle();

		reads.unblock();
		await until(
			() => figures(harness)['project'] !== undefined && figures(harness)['derived'] === undefined,
			'the row settles on the recalculated provenance',
		);
		// The whole block, so a build that merely stopped drawing the provenance would fail here
		// rather than pass the condition above.
		expect(figures(harness)).toEqual({
			library: expect.stringContaining('24 EUR'),
			project: expect.stringContaining('19.5 EUR'),
		});

		harness.unmount();
	});

	/**
	 * A project-wide cascade publishes one pair of events per requirement, and the request
	 * ticket does NOT collapse that burst: `queryZone` and the rows query both run to
	 * completion before `refresh` consults the ticket, so ten events would buy ten pairs of
	 * vault reads and nine discarded answers. The ticket's job is ordering and it was never a
	 * rate limit; what collapses a burst is the single-flight loader.
	 *
	 * Counted from the loader's OWN reads — the mount and the selection each issue one that the
	 * loader did not — so the number asserted is exactly what the coalescing is responsible for.
	 */
	it('answers a burst of recalculations with one trailing read, not one read each', async () => {
		const reads = requirementReads();
		reads.set(ok([LIBRARY_ONLY]));
		const harness = await mountWith(reads);

		select(harness, KITCHEN);
		await until(() => figures(harness)['library'] !== undefined, 'the unit-cost block is drawn');

		const before = reads.zones.length;
		reads.block();

		// The first event starts a read; the next ten arrive while it is running.
		for (let index = 0; index < 11; index += 1) harness.changeRequirementFigures('r1');
		await settle();
		expect(reads.zones.length - before).toBe(1);

		reads.release();
		await settle();
		expect(reads.zones.length - before).toBe(2);

		reads.release();
		await settle();
		expect(reads.zones.length - before).toBe(2);

		reads.unblock();
		harness.unmount();
	});

	/**
	 * **The SKIP direction, and it is the ONLY justification for carrying a `requirementId`
	 * through five hops of the context chain.** Every other case here asserts that an event is
	 * ADMITTED; replace the filter with an unconditional `reloadInspector()` and all of them
	 * still pass, because a superfluous read answers identically — measured, 67 green across
	 * four files. What the narrowing buys is invisible to any assertion about what is on screen,
	 * so it has to be asserted on the READ COUNT: a recalculation somewhere else in the vault
	 * moves nothing this leaf draws, and must therefore cost nothing.
	 *
	 * This is CLAUDE.md's own rule paying out — *"when a fix is a REFUSAL, write the WIDENED
	 * mutation and run it, because a refusal that is too broad is silent in a way a missing
	 * refusal is not"* — against a refusal that shipped with the widened mutation unwritten.
	 *
	 * The snapshot has to be NON-EMPTY for this to mean anything, which is why the case settles
	 * the panel first: an empty one fails open by design, and the assertion would then be
	 * pinning the fail-open arm a second time rather than the filter.
	 */
	it('performs no read at all for a requirement this leaf does not draw', async () => {
		const reads = requirementReads();
		reads.set(ok([LIBRARY_ONLY]));
		const harness = await mountWith(reads);

		select(harness, KITCHEN);
		await until(() => figures(harness)['library'] !== undefined, 'the unit-cost block is drawn');

		const before = reads.zones.length;
		// `r-elsewhere` is a requirement of some other zone in some other project — exactly what
		// a project-wide cascade publishes one of per requirement.
		harness.changeRequirementFigures('r-elsewhere');
		await settle();

		expect(reads.zones.length).toBe(before);
		// And the panel is untouched, which is the other half: a filter that skipped by blanking
		// the rows would satisfy the count and be worse than no filter.
		expect(figures(harness)).toEqual({ library: expect.stringContaining('24 EUR') });

		harness.unmount();
	});

	/**
	 * **Rule 1 — a refresh that cannot confirm a change is not evidence of one.**
	 * `InspectorStore.refresh` keeps the previous `dto` when the zone read fails and blanked the
	 * rows beside it for the same class of failure. One rule, two fields.
	 *
	 * The observable claim is the PANEL, not the admission: a build without the fix blanks the
	 * rows, and the id filter's empty-snapshot arm would then admit the next event anyway — so
	 * asserting admission alone cannot tell the two apart. What it can tell apart is whether a
	 * transient vault failure wipes a panel the user is reading.
	 */
	it('keeps the rows on screen when a refresh read fails, and still hears the next event', async () => {
		const reads = requirementReads();
		reads.set(ok([LIBRARY_ONLY]));
		const harness = await mountWith(reads);

		select(harness, KITCHEN);
		await until(() => figures(harness)['library'] !== undefined, 'the unit-cost block is drawn');

		reads.set(err(refusal));
		harness.changeRequirementFigures('r1');
		await settle();
		// Asserted as the WHOLE block rather than as one lookup, so a build that blanked the rows
		// reports the empty panel it drew instead of an unhelpful `undefined`.
		expect(figures(harness)).toEqual({ library: expect.stringContaining('24 EUR') });

		// The vault comes back, and the row catches up.
		reads.set(ok([PRICED_AND_RECALCULATED]));
		harness.changeRequirementFigures('r1');
		await until(() => figures(harness)['project'] !== undefined, 'the recovered read reaches the row');

		harness.unmount();
	});

	/**
	 * **Rule 2 — an empty snapshot admits.** Preserving the previous rows does not cover a FIRST
	 * hydrate whose rows query failed: there is nothing to preserve, so `[]` is legitimately
	 * INCOMPLETE rather than legitimately empty, and no flag tells the two apart. A filter exists
	 * to skip work, so the safe direction under uncertainty is to do the work.
	 */
	it('admits a figure event after a first rows read that failed', async () => {
		const reads = requirementReads();
		reads.set(err(refusal));
		const harness = await mountWith(reads);

		select(harness, KITCHEN);
		await settle();
		expect(figures(harness)['library']).toBeUndefined();

		reads.set(ok([PRICED_AND_RECALCULATED]));
		harness.changeRequirementFigures('r1');

		await until(() => figures(harness)['library'] !== undefined, 'the row arrives on the trailing read');

		harness.unmount();
	});

	/**
	 * **Rules 2 and 3 together, and the case the first-hydration one cannot reach.** There the
	 * snapshot is empty for a different reason; here it is NON-empty and about the wrong zone —
	 * `hydrateFrom` used to record the new selection and leave zone A's rows standing across
	 * both awaits, so an event for one of B's requirements failed the membership test against A's
	 * rows and was dropped. Clearing at the top of that branch turns the whole window into the
	 * empty snapshot rule 2 already answers.
	 */
	it('admits a figure event for the newly selected zone while its first read is in flight', async () => {
		const reads = requirementReads();
		reads.set(ok([LIBRARY_ONLY]));
		const harness = await mountWith(reads);

		select(harness, KITCHEN);
		await until(() => figures(harness)['library'] !== undefined, 'zone A is drawn');

		// Zone B's read goes out and is held open. Its answer is captured now: the stale one.
		reads.set(ok([B_STALE]));
		reads.block();
		select(harness, TERRACE);
		await settle();

		// B's own requirement finishes recalculating inside that window.
		reads.set(ok([B_RECALCULATED]));
		harness.changeRequirementFigures('r2');
		await settle();

		reads.unblock();
		await until(
			() => figures(harness)['derived'] === undefined && figures(harness)['project']?.includes('35 EUR') === true,
			'zone B settles on its recalculated provenance',
		);
		expect(figures(harness)).toEqual({
			library: expect.stringContaining('40 EUR'),
			project: expect.stringContaining('35 EUR'),
		});

		harness.unmount();
	});
});

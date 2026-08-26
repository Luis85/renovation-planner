import type { DiagnosticsLedger } from '../../../src/application/ports/diagnostics';
import type { AppError } from '../../../src/core/errors/AppError';
import { createZoneId } from '../../../src/domain/zone/ZoneId';

/**
 * Design slice 11's Definition of Done item 6 — the snapshot "demonstrably contains zero
 * project content" — turned into a check, and it is a COMPILE-TIME one because no fixture
 * can carry the claim.
 *
 * The audit's ruling, which this file exists to satisfy: "contains zero project content" is
 * a claim about a shape that CAN carry content, so building a content-free ledger and
 * asserting the snapshot is content-free proves only that the query adds nothing. The
 * forbidden thing is a CALLER putting content in, and the only place that can be refused is
 * the parameter list. `record` used to take three free strings; each argument is now
 * something a name, a path or a note body will not type-check into.
 *
 * `vue-tsc --noEmit` in `npm run build` is the whole mechanism: this file is in
 * `tsconfig.json`'s `include` for that reason, and an unsatisfied `@ts-expect-error` is
 * itself an error — so a `record` widened back to strings fails the build at the directive
 * that no longer has anything to suppress, rather than going quietly green.
 */

declare const ledger: DiagnosticsLedger;
declare const error: AppError;

const zoneId = createZoneId();

// The shape a repository actually records: a kind, a generated id, and the whole error.
ledger.record('zone', zoneId, error);

// @ts-expect-error a Zone's NAME is not an entity id — `entityId` is branded, so no plain string reaches it
ledger.record('zone', 'Kitchen', error);

// @ts-expect-error a note PATH is not an entity id either, and this is the spelling the audit named
ledger.record('zone', 'Renovation/Zones/Kitchen.md', error);

// @ts-expect-error there is no free-text parameter left: the failure arrives as an AppError, never as a sentence
ledger.record('zone', zoneId, 'Kitchen refused to load');

// @ts-expect-error the entity KIND is a closed union, so it is not a third place to put a name
ledger.record('Kitchen', zoneId, error);

// @ts-expect-error the old three-string call shape, pinned as gone rather than merely unused
ledger.record({ entityType: 'zone', entityId: 'Kitchen', issue: 'Kitchen refused to load' });

/**
 * The other direction, and it is not a formality. An `AppError`'s `message` and `cause` DO
 * hold content — a migration refusal quotes the frontmatter value it read — and they are
 * accepted deliberately: the ledger is the one module allowed to decide what diagnostics
 * hold, and it keeps `code` alone. A `record` narrowed to "code only" would push that
 * decision back out to every call site.
 * `tests/application/queries/getDiagnosticsSnapshot.test.ts` is where the dropping is
 * asserted at runtime; this line is what says the content is allowed to be OFFERED.
 */
ledger.record('zone', zoneId, {
	category: 'Validation',
	code: 'zone.frontmatter-invalid',
	message: 'The zone "Kitchen" at Renovation/Zones/Kitchen.md is invalid.',
	cause: new Error('Kitchen'),
});

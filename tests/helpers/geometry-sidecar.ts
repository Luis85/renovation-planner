import type {
	PlanGeometryDocument,
	PlanGeometrySidecar,
	PlanGeometrySnapshot,
} from '../../src/application/ports/PlanGeometrySidecar';
import type { EntityVersion } from '../../src/application/ports/versioning';
import { externalModification, revisionConflict } from '../../src/application/ports/versioning';
import { err, ok, type Result } from '../../src/core/result/Result';
import type { PersistenceError, ValidationError } from '../../src/core/errors/AppError';
import type { PlanId } from '../../src/domain/plan/PlanId';
import { injectedPersistenceError, type observationToken } from './domain';

/**
 * An HONEST in-memory sidecar: the version contract is enforced, not decorated. `poke`
 * models another plugin writer (revision moves), `scratch` a hand edit that left the
 * revision alone (only the content digest moves) — the two refusals an undo must tell
 * apart, per slice 6's snapshot-inverse rule.
 *
 * Shared rather than per-file because calibration is no longer the only caller: since
 * the plan repository stopped writing the sidecar's `calibration` field, this port is
 * the ONLY writer of it, so every test that needs a calibrated plan without a vault
 * needs this fake — including `domain-loop.test.ts`, whose whole point is in-memory
 * repositories and zero Obsidian surface.
 */
export class InMemoryPlanGeometrySidecar implements PlanGeometrySidecar {
	private readonly plans = new Map<
		string,
		{ document: PlanGeometryDocument; version: EntityVersion }
	>();
	failNextWrite = false;

	private digest(document: PlanGeometryDocument): ReturnType<typeof observationToken> {
		return JSON.stringify(document) as never;
	}

	seed(planId: PlanId, document: PlanGeometryDocument): void {
		this.plans.set(planId, {
			document,
			version: { revision: 1, observed: this.digest(document) },
		});
	}

	/** What the port answers a reader — the same shape a caller would get from `read`. */
	peek(planId: PlanId): PlanGeometryDocument | null {
		return this.plans.get(planId)?.document ?? null;
	}

	poke(planId: PlanId): void {
		const entry = this.plans.get(planId);
		if (!entry) throw new Error(`nothing seeded under ${planId}`);
		entry.version = { revision: entry.version.revision + 1, observed: this.digest(entry.document) };
	}

	scratch(planId: PlanId): void {
		const entry = this.plans.get(planId);
		if (!entry) throw new Error(`nothing seeded under ${planId}`);
		const document = structuredClone(entry.document);
		const first = document.objects[0];
		if (first) {
			document.objects = [{ ...first, points: [{ x: 999, y: 999 }, ...first.points.slice(1)] }];
		}
		entry.document = document;
	}

	read(planId: PlanId): Promise<Result<PlanGeometrySnapshot, PersistenceError | ValidationError>> {
		const entry = this.plans.get(planId);
		if (!entry) return Promise.resolve(err(injectedPersistenceError()));
		return Promise.resolve(ok({ document: structuredClone(entry.document), version: entry.version }));
	}

	write(
		planId: PlanId,
		document: PlanGeometryDocument,
		expected?: EntityVersion,
	): Promise<Result<EntityVersion, PersistenceError | ValidationError>> {
		return Promise.resolve(this.writeSync(planId, document, expected));
	}

	private writeSync(
		planId: PlanId,
		document: PlanGeometryDocument,
		expected?: EntityVersion,
	): Result<EntityVersion, PersistenceError | ValidationError> {
		const entry = this.plans.get(planId);
		if (!entry) return err(injectedPersistenceError());
		if (this.failNextWrite) {
			this.failNextWrite = false;
			return err(injectedPersistenceError());
		}
		if (expected) {
			if (expected.revision !== entry.version.revision) {
				return err(revisionConflict('plan-geometry', String(planId)));
			}
			// Like the real store: the digest is recomputed from what the bytes hold NOW,
			// never replayed from a stored token.
			if (expected.observed !== this.digest(entry.document)) {
				return err(externalModification('plan-geometry', String(planId)));
			}
		}
		const version: EntityVersion = {
			revision: entry.version.revision + 1,
			observed: this.digest(document),
		};
		entry.document = structuredClone(document);
		entry.version = version;
		return ok(version);
	}
}

/**
 * Extends the honest fake with one interleaving hook: `intercene` runs when the
 * command's WRITE begins — strictly after its READ — which is how a concurrent writer
 * landing between the two lock acquisitions is simulated. The base fake cannot catch
 * that race even in principle: it is synchronous and cannot interleave.
 */
export class InterleavingPlanGeometrySidecar extends InMemoryPlanGeometrySidecar {
	intercene: (() => void) | null = null;

	override write(
		planId: PlanId,
		document: PlanGeometryDocument,
		expected?: EntityVersion,
	): Promise<Result<EntityVersion, PersistenceError | ValidationError>> {
		this.intercene?.();
		return super.write(planId, document, expected);
	}
}

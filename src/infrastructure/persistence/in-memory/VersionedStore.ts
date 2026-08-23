import { err, ok, type Result } from '../../../core/result/Result';
import type { ValidationError } from '../../../core/errors/AppError';
import { checkExpected } from './checkExpected';
import type { EntityVersion, Expected, Loaded, ObservationToken } from '../../../application/ports/versioning';

/**
 * The Map-backed conditional-write store under EVERY InMemory*Repository — one copy of
 * the compare-and-write machinery (the comparison itself lives in `checkExpected`),
 * keyed by plain string because a branded entity id IS a string. Each typed repository
 * wraps this with its port's signatures; none of them re-implements a write path, so
 * there is no second chance to get the contract wrong.
 */
export class VersionedStore<T> {
	private readonly entries = new Map<string, Loaded<T>>();
	private nextToken = 0;

	mint(): ObservationToken {
		this.nextToken += 1;
		return String(this.nextToken) as ObservationToken;
	}

	/** Advances the observed token WITHOUT bumping the revision — the stand-in hand edit. */
	poke(id: string): void {
		const current = this.entries.get(id);
		if (current) {
			this.entries.set(id, {
				entity: current.entity,
				version: { revision: current.version.revision, observed: this.mint() },
			});
		}
	}

	get(id: string): Loaded<T> | null {
		return this.entries.get(id) ?? null;
	}

	save(
		id: string,
		entity: T,
		expected: Expected,
		label: string,
	): Result<Loaded<T>, ValidationError> {
		const current = this.entries.get(id);
		const conflict = checkExpected(label, id, current, expected);
		if (conflict) {
			return err(conflict);
		}
		const written: Loaded<T> = {
			entity,
			version: { revision: (current?.version.revision ?? 0) + 1, observed: this.mint() },
		};
		this.entries.set(id, written);
		return ok(written);
	}

	remove(id: string, expected: EntityVersion, label: string): Result<void, ValidationError> {
		const conflict = checkExpected(label, id, this.entries.get(id), expected);
		if (conflict) {
			return err(conflict);
		}
		this.entries.delete(id);
		return ok(undefined);
	}

	values(): Loaded<T>[] {
		return [...this.entries.values()];
	}
}

import { monotonicFactory } from 'ulid';
import type { EntityId } from './EntityId';

/**
 * Generates `<prefix>-<ULID>` (SDD §82): Crockford-base32, timestamp-prefixed,
 * lexicographically sortable. Sortability is the property the project index (§47) and
 * vault change detection ordering (§46) build on.
 *
 * Monotonic rather than plain `ulid()`: within one millisecond the plain form draws fresh
 * random bits, so two IDs created in the same tick sort in RANDOM order — exactly the
 * guarantee §47 leans on, broken at the most common moment (a bulk import). The factory
 * increments instead, so IDs generated in sequence ALWAYS sort in generation order.
 */
const nextUlid = monotonicFactory();

export function createEntityId<TBrand extends string>(prefix: TBrand): EntityId<TBrand> {
	return `${prefix}-${nextUlid()}` as EntityId<TBrand>;
}

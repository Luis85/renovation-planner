/**
 * An opaque, branded entity identifier (SDD §82): a string carrying the brand at the type
 * level only — there is no runtime representation to preserve, so persistence serializes
 * it verbatim and reads it back with an assertion at the boundary.
 *
 * Concrete IDs (`ZoneId`, `ProjectId`, …) are defined beside their owning entity in
 * `domain/`, per §78. This module is deliberately the one piece of identity machinery
 * with zero domain vocabulary.
 */
export type EntityId<TBrand extends string> = string & {
	readonly __entityBrand: TBrand;
};

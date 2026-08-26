/**
 * The calculated-versus-overridden wrapper (SDD §52). Every pipeline value a user could
 * plausibly want to hand-adjust — Purchase Quantity, Unit Price, Estimated Cost — is
 * produced wrapped in this, never as a bare value: the output must carry BOTH sides so a
 * UI can visibly distinguish the calculated figure from a manual override.
 *
 * The engine only ever populates `calculated`; an `override` is a user action, captured
 * and persisted by later feature work. When a `DerivedValue` feeds a later pipeline
 * stage, that stage consumes `effectiveValue(dv)` — never `calculated` directly — so one
 * override flows forward through every downstream stage without the engine knowing an
 * override happened.
 *
 * Generic and cost-agnostic on purpose: schedule estimates and quote comparisons are
 * expected to reuse it.
 */
export interface DerivedValue<T> {
	readonly calculated: T;
	readonly override?: T;
}

export function effectiveValue<T>(dv: DerivedValue<T>): T {
	return dv.override ?? dv.calculated;
}

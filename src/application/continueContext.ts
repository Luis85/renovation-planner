/**
 * What the Home surface remembers about where the user was (design spec §7's Continue).
 *
 * **In `application/` rather than `presentation/`, which is where the plan that specified this
 * module first put it — corrected here because the layer bans make that placement uncompilable
 * rather than merely inelegant.** The store that persists this (see
 * `infrastructure/obsidian/plugin-data/continueContextStore.ts`) has to parse a stored value
 * back into this shape, and `infrastructure/` may not import `presentation/` (SDD §8: `infrastructure
 * → application (its ports) → domain → core`). `presentation/` MAY import `application/`, so this
 * is the one place both the view's context (`RenovationProjectContext.ts`) and the store can
 * reach it without inverting a layer boundary — the same reason `SequenceMarker` lives in
 * `application/reference/deleteResolution.ts` rather than beside either of ITS two readers.
 *
 * **No leaf identity is stored, and that is what settles the design spec's own open question.**
 * §14 asks whether Continue survives an Obsidian restart, on the grounds that "the stored leaf
 * state is durable; the leaf is not". It does, because there is no leaf here to be wrong about:
 * Continue navigates THIS leaf through the doors a row already uses (`navigate` for a project,
 * `openPlan` for a plan), so restoring into a leaf Obsidian has already restored differently
 * cannot arise.
 */
export interface ContinueContext {
	readonly projectId: string;
	/** The plan the user was in, or `null` when they were on the project's detail state. */
	readonly planId: string | null;
}

/**
 * A stored context, or ABSENT — §13's own parse-and-fall-back-to-absent rule.
 *
 * Absent rather than an error, at every failure: the value this parses comes from a plugin-local
 * store a user could tamper with, and a malformed context is neither something they can act on
 * nor a state worth a notice. The Continue group simply does not render, which is a picture the
 * surface already draws for a fresh vault.
 *
 * A bad `planId` costs the PLAN half only, not the whole context, because Continue on a project
 * is a real gesture and refusing it over a field the user never sees would be the harsher answer.
 */
export function parseContinueContext(raw: unknown): ContinueContext | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const projectId = (raw as { projectId?: unknown }).projectId;
	if (typeof projectId !== 'string' || projectId.length === 0) return null;
	const planId = (raw as { planId?: unknown }).planId;
	return { projectId, planId: typeof planId === 'string' && planId.length > 0 ? planId : null };
}

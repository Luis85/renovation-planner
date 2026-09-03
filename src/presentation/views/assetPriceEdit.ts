import type { Money } from '../../core/money/Money';
import type { PriceRowExpectation } from '../../application/commands/asset-price/priceRowExpectation';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';

/**
 * One row's submitted gesture. A UNION rather than an optional `unitCost`, so "clear" cannot be
 * spelled as a set with the price left off — the two dispatch different commands and a shape
 * that admits both in one branch is a shape the state has to re-derive the intent from.
 *
 * **`expected` travels with the edit**, frozen at the moment the field went dirty, because the
 * state builds the command at dispatch time and by then the props may be a different pair at a
 * different version. That is the whole point of `projectPricesChangeSource`, and it is why this
 * is not `{ assetId, unitCost }` with the state looking the expectation up.
 *
 * **`projectId` is deliberately ABSENT.** The component has none and must not: it renders the
 * rows of whichever project the detail state is already on, so a project id in the edit would
 * be a second answer to a question `ProjectDetailState` already owns — and the two could
 * disagree across a navigation.
 *
 * **`assetId` is a plain `string` and `expected` carries a BRANDED id, which is not an
 * inconsistency.** `assetId` is passed through, so the state brands it when it mints the command
 * input, the same seam every other id crosses on this surface. `expected` is not passed through:
 * it is a `PriceRowExpectation` the component CONSTRUCTS from its frozen snapshot, so it must be
 * branded here or the type is a lie with a cast in it. `AssetPriceRowDto.overrideId` is therefore
 * `AssetPriceOverrideId | null` — `RequirementInspectorDTO`'s own split, where the id the row acts
 * on is branded and the ids it displays are not.
 *
 * It lives in its own module rather than in `AssetPriceList.vue` because `<script setup>` cannot
 * export a binding, and the state on the other side of the seam has to name the type.
 */
export type AssetPriceEdit =
	| {
			readonly kind: 'set';
			readonly assetId: string;
			readonly expected: PriceRowExpectation;
			readonly unitCost: Money;
	  }
	| {
			readonly kind: 'clear';
			readonly assetId: string;
			readonly expected: PriceRowExpectation;
	  };

/**
 * What the state hands back for one submitted gesture, and it carries MORE than a
 * `DispatchResult` because it has to.
 *
 * `DispatchResult` is `Result<DispatchOutcome, AppError>` and `DispatchOutcome` is
 * `'wrote' | 'no-write'` — no entity at all, deliberately, because slice 13 minted it to answer
 * one question. So the rule that a successful command replaces the row's frozen expectation with
 * its own result is unimplementable through that type: the row would have nothing to write.
 *
 * `settled` is what the command actually established about the pair — `{ id, version }` from
 * `SetAssetPriceOverrideResult`, `'absent'` after a clear, and `null` when the command REFUSED,
 * so a refusal leaves the snapshot exactly where it was.
 *
 * Without it the pending-clear gesture cannot work at all: the queued clear is built before the
 * dirty field can adopt refreshed props, so with no channel from the set's own result it would
 * submit `'absent'` against a pair the set had just created, and the clear would refuse — the
 * user's cancellation failing for the second time in one gesture.
 *
 * The row still hands `useFieldCommit` a plain `DispatchResult`: its `history` adapter calls
 * `commit(edit)`, writes `settled` into the snapshot when it is not null, and returns
 * `dispatch`. **`useFieldCommit` is not widened**, which is the point of putting the seam here —
 * it is a composable eight other fields already use, and the one thing this surface needs that
 * the others do not is a fact about a pair.
 */
export interface AssetPriceCommitResult {
	readonly dispatch: DispatchResult;
	readonly settled: PriceRowExpectation | null;
}

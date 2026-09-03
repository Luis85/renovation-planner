/**
 * The specification for Task 11's reversible-write-path census, shared between the
 * behavioural rows (`tests/application/events/reversibleWritePathCensus.test.ts`) and the
 * static cross-check (`reversibleWritePathDiscovery.test.ts`).
 *
 * Lives here rather than being exported from one of those two `.test.ts` files: vitest
 * executes a test file's top-level `describe`/`it` calls on IMPORT, so a cross-file import of
 * one `.test.ts` from another would register that file's whole suite a second time under the
 * importer — silently doubling every one of its assertions in the same run. A plain module
 * carries no such side effect.
 *
 * One entry per (module, direction) the plan's own table names — folded to the two directions
 * a `rows:` disposition can claim, with per-variant detail (first vs redo, created vs found)
 * carried in `mustPublish` rather than in a third direction, since the discovery file's
 * cross-check only asks "does this module have an EXECUTE row" / "an UNDO row", never how many
 * variants back it.
 *
 * One row is CORRECTED from the plan's own table, per its own instruction to read the last
 * four groups from the tree rather than from the table — reported in Task 11's own report:
 *
 * - `ReversibleSetPlanBackground` / execute is NOT part of the "nothing" carve-out. Its
 *   `execute()` delegates entirely to the wrapped `SetPlanBackgroundCommand`, which has always
 *   published `PlanBackgroundChanged` on every successful write — pre-existing, untouched by
 *   this increment. The carve-out is `undo()` alone: it restores straight through
 *   `PlanRepository.save`, past the command, and — by design decision, not by oversight — no
 *   publish was added there, unlike its eight reversible-asset-design siblings. The table's
 *   single "execute, undo | nothing" row conflated the two.
 *
 * The override adapters' `execute` rows are an ADDITION over the plan's own table, made in
 * Task 11's fix round: the plan's table named only `undo` for both, and `execute()` — which
 * neither concrete adapter declares, inheriting it from `ReversibleOverrideBase`, whose
 * `execute` calls the subclass's own `run` hook and so reaches the plain wrapped command's
 * `executeWithVersion` — was enumerated nowhere, invisible to the discovery cross-check
 * because that check only verifies directions a disposition already NAMES. Same shape as the
 * plan-background correction: pre-existing behaviour, via the wrapped command, untouched by
 * this increment. (Addressed by NAME rather than by line number, which an earlier draft used
 * and which is correct only until the next insertion above it.)
 *
 * **What a row is, and what it is NOT.** `module` and `direction` are load-bearing: the
 * discovery file's last assertion demands an entry here for every `(module, direction)` a
 * `rows(...)` disposition names, so deleting a row from this table reddens that assertion.
 * `mustPublish` is NOT — it is read by no code anywhere, in this table's own file or outside
 * it, and no mechanism compares it against what a direction really published. It is the
 * human-readable specification a reviewer holds the census file's `it()`s up against, and
 * editing it changes nothing any gate can see. Written down because the field's name is an
 * obligation and reads as an enforced one; every direction here does have a real behavioural
 * `it()` today, so this is an over-claim in the naming rather than a gap in the proof.
 */
export type CensusDirection = 'execute' | 'undo';

export interface CensusRow {
	readonly module: string;
	readonly direction: CensusDirection;
	readonly mustPublish: string;
}

export const CENSUS_TABLE: readonly CensusRow[] = [
	{
		module: 'reversible-create-zone-command',
		direction: 'execute',
		mustPublish:
			'ZoneCreated (first execute); ZoneCreated + per-referent RequirementInvalidated, or ' +
			'ProjectIndexRebuilt on a refused/faulted reverse lookup (redo)',
	},
	{ module: 'reversible-create-zone-command', direction: 'undo', mustPublish: 'ZoneDeleted' },
	{ module: 'reversible-delete-zone-command', direction: 'execute', mustPublish: 'ZoneDeleted (first and redo)' },
	{
		module: 'reversible-delete-zone-command',
		direction: 'undo',
		mustPublish: 'ZoneCreated + RequirementRestored/RequirementCreated per restored referent',
	},
	{ module: 'reversible-assign-asset-command', direction: 'execute', mustPublish: 'RequirementCreated (first and redo)' },
	{
		module: 'reversible-assign-asset-command',
		direction: 'undo',
		mustPublish: 'RequirementDeleted when execute created; nothing when execute found an existing link',
	},
	{
		module: 'reversible-override-commands (quantity)',
		direction: 'execute',
		mustPublish: 'CostEstimateChanged when the figure moves, via the wrapped plain command (pre-existing)',
	},
	{
		module: 'reversible-override-commands (quantity)',
		direction: 'undo',
		mustPublish: 'CostEstimateChanged when the figure moves',
	},
	{
		module: 'reversible-override-commands (cost)',
		direction: 'execute',
		mustPublish: 'CostEstimateChanged when the figure moves, via the wrapped plain command (pre-existing)',
	},
	{
		module: 'reversible-override-commands (cost)',
		direction: 'undo',
		mustPublish: 'CostEstimateChanged when the figure moves',
	},
	{
		module: 'ReversibleCalibratePlan',
		direction: 'execute',
		mustPublish: 'PlanCalibrated + one ZoneGeometryChanged per rescaled object',
	},
	{
		module: 'ReversibleCalibratePlan',
		direction: 'undo',
		mustPublish: 'the same cascade: PlanCalibrated + one ZoneGeometryChanged per rescaled object',
	},
	{ module: 'MoveSpatialObject', direction: 'execute', mustPublish: 'ZoneGeometryChanged' },
	{ module: 'MoveSpatialObject', direction: 'undo', mustPublish: 'ZoneGeometryChanged' },
	{ module: 'ReversibleAssetGeometryEdit', direction: 'execute', mustPublish: 'AssetDesignChanged' },
	{ module: 'ReversibleAssetGeometryEdit', direction: 'undo', mustPublish: 'AssetDesignChanged' },
	{ module: 'ReversibleAssetNoteEdit', direction: 'execute', mustPublish: 'AssetDesignChanged' },
	{ module: 'ReversibleAssetNoteEdit', direction: 'undo', mustPublish: 'AssetDesignChanged' },
	{ module: 'ReversibleAssetBackgroundEdit', direction: 'execute', mustPublish: 'AssetDesignChanged' },
	{ module: 'ReversibleAssetBackgroundEdit', direction: 'undo', mustPublish: 'AssetDesignChanged' },
	{
		module: 'ReversibleSetPlanBackground',
		direction: 'execute',
		mustPublish: 'PlanBackgroundChanged — pre-existing, via the wrapped plain command (CORRECTED, see header)',
	},
	{ module: 'ReversibleSetPlanBackground', direction: 'undo', mustPublish: 'nothing — the carve-out' },
];

import { ok, type Result } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import type { DispatchOutcome, DispatchResult } from '../../application/commands/DispatchOutcome';
import type { SessionWriteLedger } from '../../application/editor/WriteLedger';
import { ReversibleDeleteZoneCommand } from '../../application/commands/zone/reversible-delete-zone-command';
import { ReversibleAssignAssetCommand } from '../../application/commands/requirement/reversible-assign-asset-command';
import {
	ReversibleSetRequirementCostOverrideCommand,
	ReversibleSetRequirementQuantityOverrideCommand,
} from '../../application/commands/requirement/reversible-override-commands';
import { createInspectorStoreDefinition, type InspectorEdit } from './inspector/inspector-store';
import type { UndoableCommand } from './tools/undoable-command';
import type { PlanEditorContext } from './PlanEditorContext';

/**
 * SDD §59's last arrow — Edit to Command — and the binder that makes a per-transaction
 * adapter fit `CommandHistory`'s door.
 *
 * **Split out of `runtime.ts` rather than authored here**, which that file's own note
 * predicted: it sat at exactly its 400-line `max-lines` cap, so the next change adding a line
 * of CODE was always going to force an extraction, and design slice 13's review pass — giving
 * every dispatch an outcome to report — is the change that did it. This is a coherent seam
 * rather than a convenient one: everything here is about turning one Inspector edit into one
 * undoable command, and nothing else in `runtime.ts` is.
 */

/**
 * Binds a per-transaction adapter to one edit, so it is structurally an `UndoableCommand` at
 * `CommandHistory`'s door.
 *
 * **`outcomeOf` is a parameter rather than a default, and that is the repair.** This function
 * used to reduce every success to `ok(undefined)` under a docblock saying the history "reads
 * only whether the write succeeded, never what it wrote" — the same sentence `UndoableCommand`
 * carried, and it was the FIFTH place erasing the one bit design slice 13's indicator needs.
 * The adapters answer differently shaped payloads (the assign adapter reports a requirement id
 * beside its outcome; the override adapters report the outcome alone), so there is nothing to
 * default to: each call site says how to read it, and the compiler will not let a new one
 * through without saying.
 */
function asDispatchCommand<TInput, TValue>(
	adapter: {
		execute(input?: TInput): Promise<Result<TValue, AppError>>;
		undo(): Promise<DispatchResult>;
	},
	outcomeOf: (value: TValue) => DispatchOutcome,
	input?: TInput,
): UndoableCommand {
	const execute = input === undefined
		? (): Promise<Result<TValue, AppError>> => adapter.execute()
		: (): Promise<Result<TValue, AppError>> => adapter.execute(input);
	return {
		execute: async () => {
			const ran = await execute();
			return ran.ok ? ok(outcomeOf(ran.value)) : ran;
		},
		undo: () => adapter.undo(),
	};
}

/**
 * The Inspector store, pointed at the query and at a dispatcher slot filled in later —
 * the store needs the dispatcher and the dispatcher needs the store, so the cycle is
 * broken with one indirection here rather than by reordering an impossible construction.
 */
export function createInspector(
	context: PlanEditorContext,
	// The shape rather than `Pick<EditorRuntime['dispatcher'], 'run'>`: `EditorRuntime` is
	// declared in `runtime.ts`, which imports THIS module, and naming it here would close a
	// cycle for a type that is one method wide.
	dispatcher: { run(command: UndoableCommand): Promise<DispatchResult> },
	ledger: SessionWriteLedger,
) {
	return createInspectorStoreDefinition({
		query: { execute: ({ zoneId }) => context.commands.zoneInspector.execute({ zoneId }) },
		requirementsQuery: {
			execute: ({ zoneId }) => context.queries.getRequirementsForZone(String(zoneId)),
		},
		dispatcher,
		// Edit → Command (SDD §59's last arrow). The delete is routed here — the Inspector's
		// ONE dispatch path — so its refresh and history entry are the shared ones.
		//
		// A `switch` over `InspectorEdit`'s discriminant and no fallback: the compiler proves
		// totality from the union itself, so the NEXT member added to it fails to build HERE
		// rather than throwing out of a click handler at runtime, which is what the previous
		// shape-testing version did.
		//
		// This comment read "the union has one member" until the pass that extracted this
		// module out of `runtime.ts`. That was true when slice 6 wrote it and has been false
		// since slice 10 gave `InspectorEdit` its fourth: a count is a fact about the union
		// that goes stale in the file that owns the union, while "the compiler proves it" is
		// the property this `switch` actually rests on and cannot.
		toCommand: (edit: InspectorEdit) => {
			switch (edit.kind) {
				case 'delete':
					return new ReversibleDeleteZoneCommand(
						context.commands.deleteZone,
						context.commands.zones,
						ledger,
						{
							zoneId: edit.zoneId,
							resolution: edit.resolution,
							reassignTo: edit.reassignTo,
							resolvedReferents: edit.resolvedReferents,
						},
						// Slice 10's undo half: the resolution may have deleted or repointed
						// Requirements, and restoring the Zone alone would not be an inverse of that.
						{
							requirements: context.commands.requirementEdits.requirements,
							locks: context.commands.requirementEdits.locks,
							logger: context.commands.logger,
							events: context.commands.events,
						},
					);
				case 'assign': {
					// One adapter PER EDIT — it remembers whether its own execute created the
					// link, which is exactly the per-transaction state history requires. The
					// adapters answer their own richer payloads; `asDispatchCommand` is what
					// makes them structurally an `UndoableCommand` at the history's door.
					const adapter = new ReversibleAssignAssetCommand(
						context.commands.requirementEdits.assignAsset,
						{
							requirements: context.commands.requirementEdits.requirements,
							zones: context.commands.zones,
							assets: context.commands.requirementEdits.assets,
							locks: context.commands.requirementEdits.locks,
							events: context.commands.events,
						},
						{ zoneId: edit.zoneId, assetId: edit.assetId },
					);
					// `created` decided under both endpoint locks; an already-linked pair writes nothing.
					return asDispatchCommand(adapter, (value) => value.outcome);
				}
				case 'quantity-override': {
					// The override adapters take their input on execute(); history calls it
					// with none, so the edit is bound here — one adapter per edit, like assign.
					const adapter = new ReversibleSetRequirementQuantityOverrideCommand(
						context.commands.requirementEdits.setQuantityOverride,
						context.commands.requirementEdits.requirements,
					);
					return asDispatchCommand(
						adapter,
						(outcome) => outcome,
						{ requirementId: edit.requirementId, quantity: edit.quantity },
					);
				}
				case 'cost-override': {
					const adapter = new ReversibleSetRequirementCostOverrideCommand(
						context.commands.requirementEdits.setCostOverride,
						context.commands.requirementEdits.requirements,
					);
					return asDispatchCommand(
						adapter,
						(outcome) => outcome,
						{ requirementId: edit.requirementId, cost: edit.cost },
					);
				}
			}
		},
	})();
}

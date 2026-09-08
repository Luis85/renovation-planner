import type { PlanEditorContext } from '../PlanEditorContext';
import { createStructureTask } from './structureTask';
import { createStructureActions } from './structureActions';
import { createOpeningMove } from './openingMove';

/** Compose structural edits around one ledger and shared transient structure preview. */
export function createStructureEditing(context: PlanEditorContext, runtime: Parameters<typeof createStructureTask>[1] & Parameters<typeof createStructureActions>[1] & Parameters<typeof createOpeningMove>[1]) {
	const structureTask = createStructureTask(context, runtime);
	const structureActions = createStructureActions(context, runtime, structureTask.ledger);
	const openingMove = createOpeningMove(context, runtime, structureTask.ledger, structureActions);
	return { structureTask, structureActions, openingMove };
}
export type StructureEditing = ReturnType<typeof createStructureEditing>;

import type { PlanEditorContext } from '../PlanEditorContext';
import type { RefreshedHistory } from './with-state-refresh';
import { notifyIfRefused, reportDispatchFault } from '../report-failure';
const DISPATCH_FAULT_EVENT = 'editor.dispatch.faulted';

export function createHistoryActions(context: PlanEditorContext, wrappedDispatcher: RefreshedHistory) {
	async function undo(): Promise<void> {
		await notifyIfRefused(reportDispatchFault(context.commands.logger, DISPATCH_FAULT_EVENT, wrappedDispatcher.undo()));
	}
	async function redo(): Promise<void> {
		await notifyIfRefused(reportDispatchFault(context.commands.logger, DISPATCH_FAULT_EVENT, wrappedDispatcher.redo()));
	}

	return { undo, redo };
}

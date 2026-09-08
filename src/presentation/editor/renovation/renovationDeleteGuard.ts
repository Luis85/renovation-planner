import { onBeforeUnmount } from 'vue';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { useDialogStore } from '../../dialogs/dialog-store';
import { renovationReferents } from '../../../domain/renovation/renovationTargets';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { notifyOperationFailure } from '../../notices/notify';
import { tr } from '../../i18n/strings';

export function createRenovationDeletionGuard(context: PlanEditorContext, dialogs: ReturnType<typeof useDialogStore>) {
	let alive = true;
	onBeforeUnmount(() => { alive = false; });
	return async (id: string, title: string): Promise<boolean> => {
		const read = await context.commands.renovation?.read(context.planId as PlanId);
		if (!alive) return false;
		if (read && !read.ok) { notifyOperationFailure(read.error); return false; }
		const references = renovationReferents(read?.value.plan.entity.renovation ?? EMPTY_RENOVATION, id);
		if (!references.length) return true;
		await dialogs.openDialog({ kind: 'confirm', title, message: tr('renovation.links', { names: references.join(', ') }) });
		return false;
	};
}

import { onBeforeUnmount } from 'vue';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { useDialogStore } from '../../dialogs/dialog-store';
import { renovationReferents } from '../../../domain/renovation/renovationTargets';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { notifyOperationFailure } from '../../notices/notify';
import { tr } from '../../i18n/strings';

/**
 * A Room's delete stops here only for its RENOVATION records (work, subjects, decisions, costs,
 * evidence, procurement), which BR-DATA-004's resolution flow cannot resolve. Its Requirements are not counted:
 * every one a Room carries is in `listByZone`, which the Reassign/Detach dialog after this guard
 * offers to resolve (owner ruling 61; `deleteZoneWithReferences.test.ts` drives each door). For a
 * CONTEXTUAL material only Remove references completes: `Requirement.repointedTo` refuses its
 * Reassign, and the store's `planningReferentialGuard` refuses its Delete anyway, which compensates.
 * So that dialog offers only Remove references for such a zone (owner rulings 62, 64, 69), and
 * `deleteShortcut.test.ts` pins both refusals at the command, the path a script still takes.
 */
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

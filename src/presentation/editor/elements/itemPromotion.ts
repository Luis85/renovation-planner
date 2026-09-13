import { ref } from 'vue';
import type { Ref } from 'vue';
import { placementPoints } from '../../../domain/spatial/assetPlacement';
import { samePoint } from '../../../domain/spatial/Structure';
import { useDialogStore } from '../../dialogs/dialog-store';
import { tr } from '../../i18n/strings';
import { notifyWarning } from '../../notices/notify';
import { useRenovationSession } from '../renovation/renovationSession';
import { useProjectStore } from '../../stores/ProjectStore';
import { openNewAssetDialog } from '../../views/newAssetDialog';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { createAssetPlacementTask } from './assetPlacementTask';
import { centredFootprint } from './objectShape';

/**
 * "Add to asset library" on a plain item (2026-09-13 item modes spec §B). The New asset dialog opens prefilled with
 * the item's name and its outline centred as a measured footprint; then ONE reversible write turns the item into a
 * placement of that asset — same id and name, anchored at the outline's centre and facing +x, so the placed outline
 * is the drawn one. Undo restores the item; the asset stays in the library, as a catalogue entry does everywhere.
 *
 * `assetCreation` is read per call rather than captured, so the menu asks what this leaf can do when it is drawn.
 * Every refusal of the replacing write gets the one warning: what the user needs is where the asset went.
 *
 * The item is looked up again once the dialog closes: it stayed open while a cost was typed, and a sync, another
 * leaf or an undo may have removed, moved or renamed it meanwhile. Writing the placement then would resurrect or
 * revert it, since the write reads a fresh baseline and appends a missing id, so a changed item is refused the same
 * way. An item with no label is not promotable: the placement could not be written with an empty name.
 *
 * `promote` also refuses on its own, before opening the dialog, while writes are blocked, an element action is
 * active, or the perspective is Review (spec §B excludes only Review, not Renovate) — the same sources
 * `useCanvasMenuActions.ts`'s `promoteActions` greys or hides the entry from: `gate.writesBlocked`/
 * `gate.elementActionsActive` are the identical `runtime.writesBlocked`/`runtime.elementActions.active` refs the
 * menu's `disabled` expression reads, and `session.perspective` is the identical `useRenovationSession()` store the
 * menu's `review` early return reads — not a second notion of any of the three. That closes only the one door this
 * check can see: a direct call (or a future command) opening the dialog under a condition the menu already refuses
 * or hides it for. It says nothing about the OTHER way the replacing write can still be refused once the dialog IS
 * open — a floor that turns stale, or the item itself changing, while a cost is being typed — which is what the
 * paragraph above and its one warning are for.
 */
export function createItemPromotion(
	context: PlanEditorContext,
	assets: Pick<ReturnType<typeof createAssetPlacementTask>, 'write'>,
	gate: { readonly writesBlocked: Readonly<Ref<boolean>>; readonly elementActionsActive: Readonly<Ref<boolean>> },
) {
	const project = useProjectStore(), dialogs = useDialogStore(), session = useRenovationSession(), busy = ref(false);
	const available = (): boolean => context.commands.assetCreation !== undefined;
	function promotable(elementId: string) {
		const item = project.structure.elements?.find(element => element.id === elementId);
		const name = project.plan?.spatialElements?.find(label => label.id === elementId)?.name;
		return item?.kind === 'object' && name ? { points: item.points, name } : null;
	}
	async function promote(elementId: string): Promise<void> {
		const creation = context.commands.assetCreation, before = promotable(elementId);
		if (!creation || !before || dialogs.current !== null || gate.writesBlocked.value || gate.elementActionsActive.value || session.perspective === 'review') return;
		const { name } = before, { centre, footprint } = centredFootprint(before.points);
		const outcome = await openNewAssetDialog({
			dialogs, busy, logger: context.commands.logger, commands: creation,
			prefill: { name, outline: { points: footprint, write: input => creation.setAssetFootprint.execute(input) } },
		});
		if (outcome === null) return;
		const after = promotable(elementId);
		// By value, per vertex: a projection refresh replaces the points array (and could reorder keys) without moving a point.
		const unchanged = after?.name === name && after.points.length === before.points.length && after.points.every((point, index) => samePoint(point, before.points[index]));
		if (!unchanged || !(await assets.write({ id: elementId, kind: 'asset', assetId: outcome.assetId, points: placementPoints(centre, 0), name }))) notifyWarning(tr('editor.asset.promote-unplaced'));
	}
	return { available, promote };
}

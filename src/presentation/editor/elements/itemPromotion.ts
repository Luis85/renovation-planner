import { ref } from 'vue';
import { placementPoints } from '../../../domain/spatial/assetPlacement';
import { useDialogStore } from '../../dialogs/dialog-store';
import { tr } from '../../i18n/strings';
import { notifyWarning } from '../../notices/notify';
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
 */
export function createItemPromotion(context: PlanEditorContext, assets: Pick<ReturnType<typeof createAssetPlacementTask>, 'write'>) {
	const project = useProjectStore(), dialogs = useDialogStore(), busy = ref(false);
	const available = (): boolean => context.commands.assetCreation !== undefined;
	async function promote(elementId: string): Promise<void> {
		const creation = context.commands.assetCreation;
		const item = project.structure.elements?.find(element => element.id === elementId);
		if (!creation || item?.kind !== 'object' || dialogs.current !== null) return;
		const name = project.plan?.spatialElements?.find(label => label.id === elementId)?.name ?? '';
		const { centre, footprint } = centredFootprint(item.points);
		const outcome = await openNewAssetDialog({
			dialogs, busy, logger: context.commands.logger, commands: creation,
			prefill: { name, outline: { points: footprint, write: input => creation.setAssetFootprint.execute(input) } },
		});
		if (outcome === null) return;
		const placed = await assets.write({ id: item.id, kind: 'asset', assetId: outcome.assetId, points: placementPoints(centre, 0), name });
		if (!placed) notifyWarning(tr('editor.asset.promote-unplaced'));
	}
	return { available, promote };
}

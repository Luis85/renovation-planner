import { FuzzySuggestModal, type App } from 'obsidian';
import type { Asset } from '../../domain/asset/Asset';
import { tr } from '../i18n/strings';

/**
 * Pick which Asset to open the designer for — what makes the designer reachable at all
 * (Task B9), the same argument `PlanSuggestModal` and `ProjectSuggestModal` already make for
 * their own entities: a `checkCallback` requiring some precondition kept `open-plan-editor`
 * out of the palette in every vault that had nothing to satisfy it, and a picker has none.
 *
 * The candidate list is passed IN, exactly as both siblings take theirs: this class's whole
 * job is the three methods Obsidian calls, and a modal that also decided which catalogue
 * entries to offer would be a second answer to a question `ListAssets` already owns.
 *
 * Unlike its two siblings, the candidates here are `Asset` entities rather than
 * `ProjectIndexEntry` rows — since design slice 19 the catalogue is vault-wide and carries no
 * path an index entry would give it, so the row label is the asset's own NAME. Two assets
 * sharing a name is the ordinary case a fuzzy match already tolerates, the same way two plans
 * called "Ground floor" is for `PlanSuggestModal`.
 */
export class AssetSuggestModal extends FuzzySuggestModal<Asset> {
	constructor(
		app: App,
		private readonly assets: readonly Asset[],
		private readonly choose: (asset: Asset) => void,
	) {
		super(app);
		this.setPlaceholder(tr('command.open-asset-designer'));
	}

	getItems(): Asset[] {
		return [...this.assets];
	}

	getItemText(asset: Asset): string {
		return asset.name;
	}

	onChooseItem(asset: Asset): void {
		this.choose(asset);
	}
}

/**
 * The asset picker's three overrides — Obsidian owns the rendering and the fuzzy matching,
 * and a subclass supplies exactly these, so this file is the whole of the class's contract.
 *
 * Its sibling in every respect: `ProjectSuggestModal` gets the identical four cases in
 * `projectSuggestModal.test.ts`, and `PlanSuggestModal`/`PlanBackgroundSuggestModal` get
 * them in `tests/presentation/editor/units.test.ts`. This is what makes ADR-0015's designer
 * reachable at all (Task B9), the same argument `PlanSuggestModal`'s own header makes for
 * `open-plan-editor`.
 */
import { describe, expect, it } from 'vitest';
import { AssetSuggestModal } from '../../../src/presentation/modals/AssetSuggestModal';
import { t } from '../../../src/presentation/i18n/strings';
import { makeAsset } from '../../helpers/entities';

/**
 * `placeholder` is the OBSIDIAN MOCK's own member — it records what `setPlaceholder` was
 * given — and `AssetSuggestModal extends FuzzySuggestModal` resolves against the REAL
 * `obsidian` package's types outside vitest, where the class declares only the setter. One
 * cast, named for what it is, rather than an `as never` at the call site.
 */
function placeholderOf(modal: AssetSuggestModal): string {
	return (modal as unknown as { placeholder: string }).placeholder;
}

const assets = [
	makeAsset({ name: 'Porcelain Terrace Tile' }),
	makeAsset({ name: 'Oak Worktop' }),
];

describe('the asset picker', () => {
	it('offers exactly the assets it was given, and not the array itself', () => {
		const picker = new AssetSuggestModal({} as never, assets, () => undefined);

		expect(picker.getItems()).toEqual(assets);
		// A COPY: Obsidian holds this list while the picker is open, and a shared reference
		// would let a later catalogue change rewrite what the user is looking at.
		expect(picker.getItems()).not.toBe(assets);
	});

	/** Since design slice 19 the catalogue carries no path — the row label is the NAME. */
	it('labels a row with the asset name', () => {
		const picker = new AssetSuggestModal({} as never, assets, () => undefined);

		expect(picker.getItemText(assets[1])).toBe('Oak Worktop');
	});

	it('hands the chosen asset to its caller and decides nothing itself', () => {
		const chosen: (typeof assets)[number][] = [];
		const picker = new AssetSuggestModal({} as never, assets, (one) => chosen.push(one));

		picker.onChooseItem(assets[0]);

		expect(chosen).toEqual([assets[0]]);
	});

	it('names itself from the string table', () => {
		const picker = new AssetSuggestModal({} as never, assets, () => undefined);

		expect(placeholderOf(picker)).toBe(t('en', 'command.open-asset-designer'));
	});
});

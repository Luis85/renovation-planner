/**
 * @vitest-environment jsdom
 *
 * AD18-R22: a SELECTED part the canvas does not draw — the clearance while `Show clearance` is off, a
 * graphic hidden in Parts (`drawnSelection`, AD18-R20) — is acted on by no selection key and no context
 * menu, on the canvas and on its Parts row alike, and every one acts again once the part is shown. The
 * Inspector's own buttons still act: they sit beside a named part. `designerHiddenSelection.test.ts` is
 * the drawing half of the same rule.
 *
 * Driven through `designerRig`, the real write path: selection by Parts row, hiding by the two real
 * controls, and every assertion read back off the sidecar as written. A key that would do nothing is
 * also CLAIMED by nothing (`designerShortcut`'s rule), so a refused chord keeps its default for the host.
 */
import { describe, expect, it } from 'vitest';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { editableShape } from '../../helpers/assetShapes';
import { selecting, type DesignerRig } from '../../helpers/designerRig';
import { settle } from '../../helpers/editor';

const BOWL = 'detail:detail-2';
const TOP = 'detail:detail-1';
const GROUPED = { groups: [{ id: 'group-1', members: ['detail-1', 'detail-2'] }] };

const row = (rig: DesignerRig, name: string) => rig.wrapper.element.querySelector(`.rp-designer-part-row[name="${name}"]`) as HTMLButtonElement;
const menu = (rig: DesignerRig) => rig.wrapper.element.querySelector('.rp-canvas-context-menu');
const menuItem = (rig: DesignerRig, id: string) => rig.wrapper.element.querySelector(`.rp-canvas-context-menu [data-rp-context-action="${id}"]`);
const shape = async (rig: DesignerRig): Promise<AssetShape | null> => (await rig.document()).shape;

async function press(rig: DesignerRig, name: string, init: MouseEventInit = {}): Promise<void> {
	row(rig, name).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
	await settle();
}

/** A keydown on `target`, settled; answers the event so a case can ask whether anything claimed it. */
async function key(target: Element, init: KeyboardEventInit): Promise<KeyboardEvent> {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	await settle();
	return event;
}

async function contextMenuOn(target: Element): Promise<MouseEvent> {
	const event = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	await settle();
	return event;
}

async function showClearance(rig: DesignerRig, on: boolean): Promise<void> {
	await rig.wrapper.get('[name="show-clearance"]').setValue(on);
	await settle();
}

/** A graphic's own Hide / Show control, which its SELECTED row draws — scoped to that row, since a set draws one per member. */
async function toggleHidden(rig: DesignerRig, name: string): Promise<void> {
	(rig.wrapper.element.querySelector(`[data-key="${name}"] [name="toggle-hidden"]`) as HTMLButtonElement).click();
	await settle();
}

interface Hider {
	readonly row: string;
	/** What the part's removal leaves on the shape, so Delete's effect is read back off the sidecar. */
	readonly gone: (shape: AssetShape | null) => boolean;
	hide(rig: DesignerRig): Promise<void>;
	show(rig: DesignerRig): Promise<void>;
}

const HIDERS: ReadonlyArray<readonly [string, Hider]> = [
	[
		'the clearance, behind Show clearance',
		{ row: 'clearance', gone: (after) => after?.clearance === null, hide: (rig) => showClearance(rig, false), show: (rig) => showClearance(rig, true) },
	],
	[
		'a graphic, hidden in the Parts panel',
		{
			row: BOWL,
			gone: (after) => after?.details.some((detail) => detail.id === 'detail-2') === false,
			hide: (rig) => toggleHidden(rig, BOWL),
			show: (rig) => toggleHidden(rig, BOWL),
		},
	],
];

/** A rig with `hider`'s part selected by its row and then hidden. */
async function hiddenSelection(hider: Hider, shapeOverrides: Partial<AssetShape> = {}): Promise<DesignerRig> {
	const rig = await selecting(editableShape(shapeOverrides));
	await press(rig, hider.row);
	await hider.hide(rig);
	return rig;
}

describe.each(HIDERS)('a selected part that is not drawn: %s', (_label, hider) => {
	it('moves nothing under an arrow key, and moves once shown', async () => {
		const rig = await hiddenSelection(hider);
		try {
			const before = await shape(rig);
			await key(rig.canvasEl, { key: 'ArrowRight' });
			expect(await shape(rig)).toEqual(before);

			await hider.show(rig);
			await key(rig.canvasEl, { key: 'ArrowRight' });
			expect(await shape(rig)).not.toEqual(before);
		} finally {
			rig.unmount();
		}
	});

	it('deletes nothing under Delete on the canvas or Backspace on its row, and deletes once shown', async () => {
		const rig = await hiddenSelection(hider);
		try {
			const before = await shape(rig);
			await key(rig.canvasEl, { key: 'Delete' });
			expect(await shape(rig)).toEqual(before);
			await key(row(rig, hider.row), { key: 'Backspace' });
			expect(await shape(rig)).toEqual(before);

			await hider.show(rig);
			await key(rig.canvasEl, { key: 'Delete' });
			expect(hider.gone(await shape(rig))).toBe(true);
		} finally {
			rig.unmount();
		}
	});

	it('opens no menu on its row or by Shift+F10 on the canvas, leaving both events to the browser, and opens once shown', async () => {
		const rig = await hiddenSelection(hider);
		try {
			expect((await contextMenuOn(row(rig, hider.row))).defaultPrevented).toBe(false);
			expect(menu(rig)).toBeNull();
			expect((await key(rig.canvasEl, { key: 'F10', shiftKey: true })).defaultPrevented).toBe(false);
			expect(menu(rig)).toBeNull();

			await hider.show(rig);
			expect((await key(rig.canvasEl, { key: 'F10', shiftKey: true })).defaultPrevented).toBe(true);
			expect(menuItem(rig, 'delete')?.getAttribute('aria-disabled')).not.toBe('true');
		} finally {
			rig.unmount();
		}
	});

	it('is still deleted by the Inspector’s own Delete, which sits beside the named part', async () => {
		const rig = await hiddenSelection(hider);
		try {
			(rig.wrapper.element.querySelector('.rp-designer-selection-actions [name="delete"]') as HTMLButtonElement).click();
			await settle();
			expect(hider.gone(await shape(rig))).toBe(true);
		} finally {
			rig.unmount();
		}
	});
});

/** The chords a hidden CLEARANCE never had — it cannot be duplicated or grouped — so these are a graphic's alone. */
describe('a hidden graphic’s chords', () => {
	it('duplicates nothing under Ctrl+D on the canvas or its row, claims neither, and duplicates once shown', async () => {
		const rig = await hiddenSelection(HIDERS[1][1]);
		try {
			const before = await shape(rig);
			expect((await key(rig.canvasEl, { key: 'd', ctrlKey: true })).defaultPrevented).toBe(false);
			expect((await key(row(rig, BOWL), { key: 'd', ctrlKey: true })).defaultPrevented).toBe(false);
			expect(await shape(rig)).toEqual(before);

			await toggleHidden(rig, BOWL);
			expect((await key(rig.canvasEl, { key: 'd', ctrlKey: true })).defaultPrevented).toBe(true);
			expect((await shape(rig))?.details).toHaveLength(3);
		} finally {
			rig.unmount();
		}
	});

	it('ungroups nothing under Ctrl+Shift+G, claims it not, and ungroups once shown', async () => {
		const rig = await hiddenSelection(HIDERS[1][1], GROUPED);
		try {
			expect((await key(rig.canvasEl, { key: 'G', ctrlKey: true, shiftKey: true })).defaultPrevented).toBe(false);
			expect((await key(row(rig, BOWL), { key: 'G', ctrlKey: true, shiftKey: true })).defaultPrevented).toBe(false);
			expect((await shape(rig))?.groups).toEqual(GROUPED.groups);

			await toggleHidden(rig, BOWL);
			await key(rig.canvasEl, { key: 'G', ctrlKey: true, shiftKey: true });
			expect((await shape(rig))?.groups).toEqual([]);
		} finally {
			rig.unmount();
		}
	});
});

/**
 * A SET, where each action is asked about the parts it would write (`selectionAbilities`): Group
 * writes every member, so one member not drawn refuses it wherever it sits in the set; Delete writes the
 * focused member alone, so a drawn focused member is deleted while another is hidden, and a hidden
 * focused one is not.
 */
describe('a set with a member that is not drawn', () => {
	async function pair(): Promise<DesignerRig> {
		const rig = await selecting(editableShape());
		await press(rig, TOP);
		await press(rig, BOWL, { shiftKey: true });
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-2' });
		return rig;
	}

	it.each([
		['the focused member', BOWL],
		['a member that is not focused', TOP],
	])('groups nothing under Ctrl+G, on the canvas or either row, while %s is hidden, and groups once shown', async (_label, hidden) => {
		const rig = await pair();
		try {
			await toggleHidden(rig, hidden);
			expect((await key(rig.canvasEl, { key: 'g', ctrlKey: true })).defaultPrevented).toBe(false);
			expect((await key(row(rig, BOWL), { key: 'g', ctrlKey: true })).defaultPrevented).toBe(false);
			expect((await key(row(rig, TOP), { key: 'g', ctrlKey: true })).defaultPrevented).toBe(false);
			expect((await shape(rig))?.groups).toEqual([]);

			await toggleHidden(rig, hidden);
			await key(rig.canvasEl, { key: 'g', ctrlKey: true });
			expect((await shape(rig))?.groups).toEqual(GROUPED.groups);
		} finally {
			rig.unmount();
		}
	});

	it('greys Group in the menu while a member is hidden, and still deletes the drawn focused member', async () => {
		const rig = await pair();
		try {
			await toggleHidden(rig, TOP);
			await key(rig.canvasEl, { key: 'F10', shiftKey: true });
			expect(menuItem(rig, 'group')?.getAttribute('aria-disabled')).toBe('true');
			expect(menuItem(rig, 'delete')?.getAttribute('aria-disabled')).not.toBe('true');
			// Closed from inside the menu: an Escape on the canvas itself would clear the selection.
			await key(menuItem(rig, 'delete') as Element, { key: 'Escape' });
			expect(menu(rig)).toBeNull();

			await key(rig.canvasEl, { key: 'Delete' });
			expect((await shape(rig))?.details.map((detail) => detail.id)).toEqual(['detail-1']);
		} finally {
			rig.unmount();
		}
	});
});

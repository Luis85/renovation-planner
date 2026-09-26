// @vitest-environment jsdom
/**
 * AD18 Task 8, take.md step 22's D clause: "the menu offers it under the plans group" —
 * `assetHandoffMore.e2e.ts`'s *opens the designer from the canvas menu...* only reads the menu
 * item's TEXT, never its group. The case's own audit table already names this untested and adds
 * that it need not stay that way: `useCanvasMenuActions.ts`'s `designerActions()` returns
 * `{ group: 'plans', ... }` in code, and the composed list is re-sorted by `GROUP_ORDER` (`'plans'`
 * is first), so a plain selection-and-read test settles both "which group" and "sits under it" —
 * meaning first among the rendered items — with no right-click and no Obsidian.
 *
 * Driven through `CanvasMenuList`'s own `items` prop, exactly as `wallThickness.test.ts`'s
 * *exposes Plan-only menu entry...* reads it (that file is owned by a different task this round;
 * this is a NEW file), over a real placed asset element so `designerActions` has an `assetId` to
 * answer for.
 */
import { afterEach, expect, it, vi } from 'vitest';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { settle } from '../../helpers/editor';
import { useAssetShapeStore } from '../../../src/presentation/stores/AssetShapeStore';
import CanvasMenuList from '../../../src/presentation/editor/selection/CanvasMenuList.vue';
import { isSubmenu } from '../../../src/presentation/editor/selection/useCanvasMenuActions';

type Rig = Awaited<ReturnType<typeof assetPlacementRig>>;
const mounted: Rig[] = [];
afterEach(() => {
	vi.restoreAllMocks();
	for (const rig of mounted.splice(0)) rig.unmount();
});

it('lists "Open in designer" first among the canvas menu\'s items, under the plans group', async () => {
	const asset = vi.fn<(assetId: string) => Promise<void>>(async () => {});
	const rig = await assetPlacementRig({ project: async () => {}, library: () => {}, asset });
	mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1500, y: 1500 });
	// The same wait `assetPlacementInspector.test.ts` uses before selecting a fresh placement:
	// `designerActions` reads the asset-shape store, and a `'missing'` answer (never reached
	// here, since the asset really is designed) is the one thing that would hide the item.
	await settle();
	await settle();
	expect(useAssetShapeStore(rig.pinia).answerFor(radiator.id)).not.toBeUndefined();
	rig.selection.select([id as never]);
	await settle();

	if (rig.canvasEl === null) throw new Error('no canvas element to raise the context menu on');
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }));
	await settle();

	const items = rig.wrapper.getComponent(CanvasMenuList).props('items');
	expect(items.length).toBeGreaterThan(0);
	const first = items[0];
	if (first === undefined || isSubmenu(first)) throw new Error('the first canvas-menu item is missing or is a submenu');
	expect(first.id).toBe('open-asset-designer');
	expect(first.group).toBe('plans');
});

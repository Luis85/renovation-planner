/**
 * @vitest-environment jsdom
 *
 * AD18 Task 8, take.md step 21's D clause: "a designer leaf opens on `Oven` with its footprint
 * drawn". `assetHandoff.e2e.ts`'s *opens the designer from a placed asset...* only asserts the
 * leaf's `assetId` state (`designer.leafStates(DESIGNER)`) — never that the canvas actually drew
 * a shape rather than an empty stage, which is a real gap: a build that opened the right leaf
 * over an asset whose shape read had regressed would still pass every existing assertion.
 *
 * Mounts the real `AssetDesignerView` — the same Obsidian lifecycle
 * `tests/presentation/designer/assetDesignerView.test.ts` drives (that file is owned by a
 * different task this round; this is a NEW file rather than an edit to it) — with a real Konva
 * stage (`installCanvas`/`installResizeObserver`, since jsdom draws neither), and reads the real
 * Konva scene graph for the footprint's own node name, `footprintLayer.ts`'s
 * `'asset-footprint-outline'` — the identical selector
 * `tests/presentation/designer/layers.test.ts` uses to pin the same node when it mounts
 * `AssetDesignerRoot` directly.
 */
import { afterEach, expect, it } from 'vitest';
import Konva from 'konva';
import { ok } from '../../src/core/result/Result';
import { createAssetId } from '../../src/domain/asset/AssetId';
import { AssetDesignerView } from '../../src/presentation/designer/AssetDesignerView';
import type { AssetDesignerDeps } from '../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerCommands } from '../../src/presentation/designer/designerCommands';
import { assetDesign } from '../helpers/assetDesign';
import { unwiredPlanUsage } from '../helpers/designerQueries';
import { emptyBackgroundVault } from '../helpers/background';
import { installObsidianDom } from '../helpers/dom';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver } from '../helpers/layout';
import { settle } from '../helpers/async';
import { FakeLeaf } from '../helpers/workspace';
import { recorder } from '../helpers/logger';

installObsidianDom();
installCanvas();
installResizeObserver();

const ASSET_ID = createAssetId();

const openViews: AssetDesignerView[] = [];
afterEach(async () => {
	for (const view of openViews.splice(0)) await view.onClose();
	await settle();
});

it('draws the asset\'s footprint on the canvas the hand-off\'s designer leaf opens', async () => {
	const deps: AssetDesignerDeps = {
		queries: {
			getAssetDesign: () => Promise.resolve(ok(assetDesign({ assetId: ASSET_ID }))),
			listPlansUsingAsset: unwiredPlanUsage,
		},
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		onThemeChange: () => () => undefined,
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
	};
	const view = new AssetDesignerView(new FakeLeaf() as never, deps);
	openViews.push(view);

	// The same two calls `revealAssetDesigner`'s activation makes on a leaf it created: set the
	// state the workspace would carry, then open it.
	await view.setState({ assetId: ASSET_ID }, {} as never);
	await view.onOpen();
	await settle();

	expect(view.contentEl.querySelector('.rp-designer-canvas .rp-plan-canvas canvas')).not.toBeNull();
	const stage = Konva.stages.at(-1);
	expect(stage?.findOne('.asset-footprint-outline')).toBeDefined();
});

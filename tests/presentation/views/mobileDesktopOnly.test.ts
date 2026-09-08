/**
 * @vitest-environment jsdom
 *
 * The two surfaces mobile is refused OUTRIGHT (extension 2a of
 * `docs/requirements/Bound the mobile surface to what it can actually do.md`): the Plan Editor
 * and the Asset Designer. Both are canvases, and "a canvas that cannot be drawn on" is exactly
 * what the requirement says not to draw.
 *
 * Both directions in one file because the claim is a PAIR — a guard that refuses everywhere
 * reads identically to a correct one from the mobile side alone, and it is the desktop half that
 * the whole plugin's behaviour rests on.
 *
 * `Platform` is a plain mutable object in the `obsidian` mock, so `isMobile` is assigned here and
 * RESET in `afterEach`: it is module state shared by every later file in this worker, which is
 * the debt CLAUDE.md's Testing section records `Platform.isMacOS` already owing.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Platform } from 'obsidian';
import { PlanEditorView } from '../../../src/presentation/views/PlanEditorView';
import { AssetDesignerView } from '../../../src/presentation/designer/AssetDesignerView';
import type { AssetDesignerDeps } from '../../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerQueries } from '../../../src/presentation/read-models/assetDesignerQueries';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { emptyBackgroundVault } from '../../helpers/background';
import { recorder } from '../../helpers/logger';
import { installEditorEnvironment, settle } from '../../helpers/editor';
import { harnessDeps, HARNESS_PLAN } from '../../harness/planEditor';
import { t } from '../../../src/presentation/i18n/strings';
import { FakeLeaf } from '../../helpers/workspace';

installEditorEnvironment();

const ASSET_ID = 'asset-01JABC';

function designerDeps(): AssetDesignerDeps {
	return {
		queries: unavailableAssetDesignerQueries(),
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		onThemeChange: () => () => undefined,
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
	};
}

const opened: { onClose: () => Promise<void> }[] = [];

afterEach(async () => {
	for (const view of opened.splice(0)) await view.onClose();
	Platform.isMobile = false;
	await settle();
});

async function planEditor(): Promise<PlanEditorView> {
	const view = new PlanEditorView(new FakeLeaf() as never, harnessDeps());
	opened.push(view);
	await view.setState({ planId: HARNESS_PLAN.id }, {} as never);
	await view.onOpen();
	await settle();
	return view;
}

async function designer(): Promise<AssetDesignerView> {
	const view = new AssetDesignerView(new FakeLeaf() as never, designerDeps());
	opened.push(view);
	await view.setState({ assetId: ASSET_ID }, {} as never);
	await view.onOpen();
	await settle();
	return view;
}

describe('a desktop-only surface reached on mobile', () => {
	it('refuses the Plan Editor in a sentence and mounts no canvas', async () => {
		Platform.isMobile = true;

		const view = await planEditor();

		expect(view.contentEl.querySelector('.rp-view-message')?.textContent).toBe(t('en', 'view.mobile.desktop-only'));
		expect(view.contentEl.querySelector('.renovation-plan-editor-view')).toBeNull();
	});

	it('refuses the Asset Designer the same way', async () => {
		Platform.isMobile = true;

		const view = await designer();

		expect(view.contentEl.querySelector('.rp-view-message')?.textContent).toBe(t('en', 'view.mobile.desktop-only'));
		expect(view.contentEl.querySelector('.renovation-asset-designer-view')).toBeNull();
	});

	/**
	 * `onClose` unmounts an app that was never mounted, which is the one thing a refusal that
	 * skips `mount()` can break — and it breaks on the CLOSE, one gesture after the mistake.
	 */
	it('closes a refused leaf without faulting', async () => {
		Platform.isMobile = true;
		const view = await designer();

		await expect(view.onClose()).resolves.toBeUndefined();

		expect(view.contentEl.childElementCount).toBe(0);
	});
});

describe('the same two surfaces on desktop', () => {
	it('mounts the Plan Editor and says nothing about mobile', async () => {
		const view = await planEditor();

		expect(view.contentEl.querySelector('.renovation-plan-editor-view')).not.toBeNull();
		expect(view.contentEl.textContent).not.toContain(t('en', 'view.mobile.desktop-only'));
	});

	it('mounts the Asset Designer and says nothing about mobile', async () => {
		const view = await designer();

		expect(view.contentEl.querySelector('.renovation-asset-designer-view')).not.toBeNull();
		expect(view.contentEl.textContent).not.toContain(t('en', 'view.mobile.desktop-only'));
	});
});

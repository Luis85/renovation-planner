/**
 * @vitest-environment jsdom
 *
 * The designer's palette, kept current as the user changes theme.
 *
 * A canvas cannot read a CSS variable — `fill: var(--text-normal)` means nothing to a 2D
 * context — so `resolveThemeTokens` is the bridge, exactly as it is for the plan editor. What
 * the designer lacked was the plan editor's `onThemeChange`: it resolved ONCE at setup, so a
 * user who switched theme or toggled dark mode with a designer open kept a light-theme stroke
 * on a dark ground until the leaf was reopened. That was a stated limitation in
 * `DesignerCanvas`'s own header for two tasks; this file is what replaced the sentence.
 *
 * Asserted on the DRAWN stroke rather than on the token object, because the token object is
 * equally refreshed by a build that never hands the new value to a layer.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import Konva from 'konva';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { ok } from '../../../src/core/result/Result';
import { assetDesign } from '../../helpers/assetDesign';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installObsidianDom } from '../../helpers/dom';
import { installResizeObserver, placeAt, resizeTo } from '../../helpers/layout';
import { recorder } from '../../helpers/logger';
import { settle } from '../../helpers/editor';

const ZONE_STROKE = '--text-normal';

/** The listeners a real `css-change` subscription would hold, so a case can fire one. */
const themeListeners = new Set<() => void>();

function context(): AssetDesignerContext {
	const design = assetDesign();
	return {
		assetId: String(design.assetId),
		queries: { getAssetDesign: () => Promise.resolve(ok(design)) },
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		indexScanCompleted: () => true,
		// Not the dangling state's suite: `assetDesignerRoot.test.ts` is where the tree is asked
		// whether it CALLS this, and `assetDesignerView.test.ts` whether calling it detaches the
		// leaf. Present rather than omitted because the member is required precisely so no surface
		// can forget to answer the question.
		closeLeaf: () => undefined,
		onThemeChange: (listener: () => void) => {
			themeListeners.add(listener);
			return () => themeListeners.delete(listener);
		},
	};
}

let wrapper: ReturnType<typeof mount> | null = null;

beforeEach(() => {
	installObsidianDom();
	installCanvas();
	installResizeObserver();
	themeListeners.clear();
	document.documentElement.style.setProperty(ZONE_STROKE, 'rgb(1, 2, 3)');
});

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	document.documentElement.style.removeProperty(ZONE_STROKE);
});

async function mountDesigner(): Promise<Konva.Stage | null> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	wrapper = mount(AssetDesignerRoot, {
		attachTo: host,
		global: {
			plugins: [createPinia(), VueKonva],
			provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context() },
		},
	});
	await flushPromises();
	const canvas = wrapper.find('.rp-designer-canvas .rp-plan-canvas');
	if (canvas.exists()) {
		placeAt(canvas.element as HTMLElement, 0, 0, 800, 600);
		resizeTo(canvas.element as HTMLElement, 800, 600);
		await settle();
	}
	return Konva.stages[0] ?? null;
}

const footprintStroke = (stage: Konva.Stage | null): string | undefined =>
	stage?.findOne<Konva.Layer>('.asset-footprint')?.findOne<Konva.Line>('Line')?.stroke() as string | undefined;

describe('the designer palette and a theme change', () => {
	it('re-resolves the drawn stroke when Obsidian reports a css-change', async () => {
		const stage = await mountDesigner();
		expect(footprintStroke(stage)).toBe('rgb(1, 2, 3)');

		document.documentElement.style.setProperty(ZONE_STROKE, 'rgb(9, 8, 7)');
		for (const listener of themeListeners) listener();
		await settle();

		expect(footprintStroke(stage)).toBe('rgb(9, 8, 7)');
	});

	/**
	 * A listener outliving its view would re-resolve against a detached element for the rest of
	 * the session, and the next open would add a second one — the leak `useThemeTokens` states
	 * at its own registration and which this surface now inherits rather than restates.
	 */
	it('unsubscribes with the view', async () => {
		await mountDesigner();
		expect(themeListeners.size).toBe(1);

		wrapper?.unmount();
		wrapper = null;

		expect(themeListeners.size).toBe(0);
	});
});

/**
 * @vitest-environment jsdom
 *
 * Step 32 of `Calibrate a sheet and reserve space`: the review notice's button is reachable by Tab
 * and ANNOUNCED as "Mark clearance as reviewed".
 *
 * `designerClearanceReview.test.ts` reads the button's `text()` and the e2e finds it with
 * WebdriverIO's `button=`, which also matches visible text — and axe's `button-name` only asks that
 * SOME name exists. A review mutation adding `aria-label="Dismiss"` left both green. So the name here
 * is the one axe-core COMPUTES, and the tab stop is axe's own focusability rule plus a non-negative
 * `tabIndex`, asked in the real inspector on its default Object tab, where the block is drawn.
 */
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DesignerInspector from '../../../src/presentation/designer/inspector/DesignerInspector.vue';
import { ok } from '../../../src/core/result/Result';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { validateAssetShape } from '../../../src/domain/asset/AssetShape';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import { assetDesign } from '../../helpers/assetDesign';
import { expectOk } from '../../helpers/domain';
import { recorder } from '../../helpers/logger';

/** A measured boundary around the fixture's footprint, flagged the way a resize flags it. */
const BOUNDARY = { points: [{ x: -900, y: -700 }, { x: 900, y: -700 }, { x: 900, y: 700 }, { x: -900, y: 700 }] };

function mountFlagged() {
	const base = assetDesign();
	if (base.shape === null) throw new Error('the fixture carries a shape');
	const shape = expectOk(validateAssetShape({ ...base.shape, clearance: BOUNDARY, clearanceNeedsReview: true }));
	return mount(DesignerInspector, {
		attachTo: document.body,
		props: {
			design: assetDesign({ shape, clearanceExtent: { width: 1800, depth: 1400 } }),
			setHeight: vi.fn<(height: number | null) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote')),
			editDimensions: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
			activateAnchorTool: vi.fn<() => void>(),
			removeBackground: async (): Promise<void> => {},
			logger: recorder,
			selection: null,
			lockedGraphics: new Set<string>(),
			editShape: vi.fn<() => Promise<DispatchResult>>().mockResolvedValue(ok('no-write')),
			select: vi.fn<(next: DesignerSelection | null) => void>(),
			selected: [],
		},
	});
}

describe('the clearance review button', () => {
	it('is a tab stop in the real inspector, and its computed name is exactly Mark clearance as reviewed', () => {
		const wrapper = mountFlagged();
		axe.setup(document);
		try {
			const button = wrapper.get<HTMLButtonElement>('[data-rp-action="clearance-reviewed"]').element;
			expect(axe.commons.dom.isFocusable(button)).toBe(true);
			expect(button.tabIndex).toBeGreaterThanOrEqual(0);
			// The literal the case names, not a key read back: a reworded locale string is this clause failing.
			expect(axe.commons.text.accessibleText(button)).toBe('Mark clearance as reviewed');
		} finally {
			axe.teardown();
			wrapper.unmount();
		}
	});
});

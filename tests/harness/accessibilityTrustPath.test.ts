/**
 * @vitest-environment jsdom
 *
 * **The trust-path half of `accessibility.test.ts`, split out for `max-lines` and not for a
 * change of subject.** Read that file's header first: its CEILING paragraphs — what an axe scan
 * in jsdom can and cannot settle, why `contentEl`/the wrapper's own element rather than the whole
 * `document`, and why every case here asserts PRESENCE before scanning rather than trusting
 * `results.violations` to discriminate a scan of real markup from a scan of nothing — are the
 * contract this file runs under too. Restating them here would be the second copy of a claim
 * that then disagrees with itself the moment one of the two is edited and the other is not
 * (CLAUDE.md's own recurring lesson about a docblock naming "the only place X").
 *
 * The split is a SIZE artefact rather than a design: design spec §2.3/§2.4/§2.8/§2.9's trust
 * path — the stale warning row's two actions, and `runtime.writesBlocked`'s pause pattern over
 * every write control, both new since `accessibility.test.ts` was last measured against its
 * 450-line `max-lines` cap — pushed the sum over it. `runOptions` is imported from `./axeOptions`
 * rather than redeclared, exactly as `accessibilityAssetLibrary.test.ts` already does, because the
 * alternative to sharing it is a second copy of the list naming the rules neither file can
 * honestly grade.
 */
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { runOptions } from './axeOptions';
import { mountPlanEditor, settle, type EditorHarness } from '../helpers/editor';
import { resizeTo } from '../helpers/layout';
import { useSelectionStore } from '../../src/presentation/editor/selection/selection-store';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('axe against the plan editor trust path', () => {
	/**
	 * Task 9's stale warning row, WITH its two actions — the trust path's own addition to
	 * `PersistentWarningStrip.vue`, never scanned by `accessibility.test.ts`'s own Plan Editor
	 * cases (every one of them mounts `mountPlanEditor()` with a fresh `ProjectStore`, whose
	 * `stale` defaults to `false`, so the whole strip renders zero rows). `role="status"` on the
	 * container plus a `<button>` per action is new ARIA no scan in that file reached: Retry and
	 * Open source note, each `aria-disabled` following `ProjectStore.refreshing` rather than the
	 * row's own `stale`.
	 *
	 * The presence assertion is the load-bearing half, for this suite's usual reason: `violations`
	 * is `[]` on a subtree containing nothing at all — `editorWarnings` returns no `stale` row
	 * unless `input.stale` is true — so proving the row and both of its buttons are really in the
	 * DOM this scan ran against is what makes green mean something. Watched red once: mounting
	 * with the default, non-stale store (dropping `stale = true`) fails this exact
	 * `toHaveLength(2)` at zero buttons found.
	 */
	it('reports no semantic violations on the stale strip with its two actions', async () => {
		let mounted: EditorHarness | null = null;
		try {
			mounted = await mountPlanEditor();
			useProjectStore(mounted.pinia).stale = true;
			await settle();

			expect(mounted.wrapper.findAll('[data-rp-warning="stale"] button')).toHaveLength(2);

			const results = await axe.run(mounted.wrapper.element as HTMLElement, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			mounted?.unmount();
		}
	});

	/**
	 * Task 9's own trust-path rule applied to the ROOM INSPECTOR — design spec §2.9: every write
	 * control pauses while `ProjectStore.stale` holds, `aria-disabled` rather than `:disabled` so
	 * a paused control stays focusable and its reason (`runtime.pausedReasonId`, a hidden sentence
	 * every paused control's `aria-describedby` names) can still be read.
	 * `accessibility.test.ts`'s own "Room Inspector in the full layout with a room selected" case
	 * scans this same panel with nothing paused; this is the identical markup with every write
	 * control's `aria-disabled`/`aria-describedby` pair actually driven, which is new ARIA neither
	 * file has scanned — the hidden reason element in particular, since a scan that never paused
	 * anything would never render it.
	 *
	 * The presence assertion is the load-bearing half: `violations` is `[]` on a subtree
	 * containing nothing at all, so proving the Delete button is really paused in the DOM this
	 * scan ran against is what makes green mean something. Watched red once: mounting without
	 * setting `stale` leaves the button's `aria-disabled` `undefined`, failing this exact
	 * `toBe('true')`.
	 */
	it('reports no semantic violations on the Room Inspector with every write control paused', async () => {
		let mounted: EditorHarness | null = null;
		try {
			mounted = await mountPlanEditor();
			useSelectionStore().select(['zone-kitchen' as never]);
			useProjectStore(mounted.pinia).stale = true;
			await settle();

			expect(mounted.wrapper.find('.rp-editor-inspector-delete').attributes('aria-disabled')).toBe('true');

			const results = await axe.run(mounted.wrapper.element as HTMLElement, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			mounted?.unmount();
		}
	});

	/**
	 * The paused Room Inspector again, drawn through the `constrained` layout's Inspector drawer
	 * rather than the `full` layout's persistent column — the same door
	 * `accessibility.test.ts`'s own "constrained Inspector drawer open and a room selected" case
	 * uses, with `ProjectStore.stale` driven true afterward. Neither that case nor the two paused
	 * cases above scan this combination: a paused control drawn INSIDE `InspectorDrawer`'s own
	 * `tabindex="-1"` container and close button, which is markup the `full`-layout paused case
	 * never mounts.
	 *
	 * The two presence assertions are the load-bearing half: `violations` is `[]` on a subtree
	 * containing nothing at all, so proving the drawer is genuinely open AND the control inside it
	 * is genuinely paused is what makes green mean something. Watched red once: leaving `stale`
	 * unset (mounting the drawer with a fresh, non-stale store) leaves `aria-disabled` `undefined`,
	 * failing the second assertion while the first still passes — which is what shows the two are
	 * independent rather than one standing in for the other.
	 */
	it('reports no semantic violations on the constrained Inspector drawer while paused', async () => {
		let mounted: EditorHarness | null = null;
		try {
			mounted = await mountPlanEditor();
			useSelectionStore().select(['zone-kitchen' as never]);
			await settle();
			resizeTo(mounted.rootEl, 460, 800);
			await settle();
			await mounted.wrapper.find('[data-rp-rail="details"]').trigger('click');
			await settle();
			useProjectStore(mounted.pinia).stale = true;
			await settle();

			expect(mounted.wrapper.find('.rp-inspector-drawer .rp-room-inspector').exists()).toBe(true);
			expect(mounted.wrapper.find('.rp-editor-inspector-delete').attributes('aria-disabled')).toBe('true');

			const results = await axe.run(mounted.wrapper.element as HTMLElement, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			mounted?.unmount();
		}
	});
});

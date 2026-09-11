/**
 * @vitest-environment jsdom
 *
 * The two knobs that make a detail plan and a locked zone capturable (detail-plan polish,
 * 2026-09-11). The harness composed no hierarchy query before, so the parent-zone guide could
 * not be drawn outside a vault at all.
 */
import { beforeEach, expect, it } from 'vitest';
import { mountPlanEditorHarness } from './planEditor';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';

beforeEach(() => {
	document.body.innerHTML = '';
});

it('?detail draws an empty plan with the parent-zone guide and its ancestry', async () => {
	installCanvas();
	installResizeObserver();
	const { leafEl, view } = mountPlanEditorHarness(document.body, { detail: true });
	sizedShellRoot(leafEl);
	await settleUntil(() => leafEl.querySelector('.rp-property-tree')?.textContent?.includes('Site plan') === true, 'the ?detail ancestry');
	// Scoped to the Floor Inspector's own list (`.rp-floor-inspector`, `FLOOR_STATE` in
	// `scripts/harness-shot.mjs`): `PropertyLayerPanel`'s Layers rail renders every spatial
	// record too, in its OWN `.rp-room-list__row`s, so an unscoped query double-counts.
	expect(leafEl.querySelectorAll('.rp-floor-inspector .rp-room-list__row')).toHaveLength(0);
	// The title claims the guide, not only the ancestry: `.rp-floor-inspector__guide` is the
	// floor Inspector's explainer, which draws only once the hierarchy read has landed
	// (`FloorInspector.vue`) — the same moment the guide itself is on the canvas.
	expect(leafEl.querySelector('.rp-floor-inspector__guide')).not.toBeNull();
	// `plan-editor-detail-narrow-de`'s own third selector (`DETAIL_ANCESTRY_CRUMB` in
	// `scripts/harness-shot.mjs`): the context bar's ancestry crumb is the only marker that
	// proves the hierarchy read landed at 460px, where the Inspector above is hidden. The
	// harness supplies no `navigation`, so `EditorContextCrumb.vue` never renders its
	// `data-rp-open-plan` button branch here — every crumb is a plain, attribute-less `<span>` —
	// so the selector keys on POSITION: the second crumb, carrying no `aria-current` (that
	// belongs to the current plan's own crumb, always last).
	const crumb = leafEl.querySelector('.rp-context-bar__crumbs > .rp-context-bar__crumb:nth-child(2):not([aria-current])');
	expect(crumb).not.toBeNull();
	expect(crumb?.textContent).toBe('Site plan');
	await view.onClose();
});

it('?locked locks the named seeded zones and no others', async () => {
	installCanvas();
	installResizeObserver();
	const { leafEl, view } = mountPlanEditorHarness(document.body, { locked: 'harness-terrace' });
	sizedShellRoot(leafEl);
	await settleUntil(() => leafEl.querySelector('.rp-floor-inspector .rp-room-list__row') !== null, 'the seeded rows');
	// The lock toggle is `ZoneLockToggle`'s own `.rp-editor-inspector-lock` button — a SIBLING of
	// `.rp-room-list__row` under `RoomSummaryList`'s `<li>`, not a descendant of the row, and
	// present (unlocked) on every row rather than only the locked ones (ADR-0027). So the marker
	// is the closest item's toggle read as PRESSED, not the toggle's bare presence.
	const locked = [...leafEl.querySelectorAll('.rp-floor-inspector .rp-room-list__row')].filter(
		(row) => row.closest('.rp-room-list__item')?.querySelector('.rp-editor-inspector-lock[aria-pressed="true"]') !== null,
	);
	expect(locked.map((row) => row.getAttribute('data-rp-id'))).toEqual(['harness-terrace']);
	await view.onClose();
});

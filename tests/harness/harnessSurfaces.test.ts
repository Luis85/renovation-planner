/**
 * @vitest-environment jsdom
 *
 * The two EDITOR surfaces of the browser harness — `npm run harness` with `?view=plan-editor`
 * and with `?view=asset-designer`. Same job as `harness.test.ts` and the same limit: this
 * asserts the FRAME and the plumbing, never appearance, because a browser is where a layered
 * scene is actually looked at.
 *
 * Split out of `harness.test.ts` when a merge put that file over its 450-line cap — neither
 * branch alone did, which is the shape CLAUDE.md records for a count that goes wrong by MERGE.
 * The seam is the SUBJECT: `harness.test.ts` holds the project surface and the page-level
 * closure and stylesheet checks, which read SOURCE; this file mounts the two surfaces that
 * construct a real Konva stage, which is why every case here installs the canvas backing and
 * the resize observer that jsdom lacks and a browser has natively.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountPlanEditorHarness } from '../harness/planEditor';
import { mountAssetDesignerHarness } from '../harness/assetDesigner';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';
import { drawSchemeToggle } from '../harness/theme';

beforeEach(() => {
	document.body.innerHTML = '';
	document.body.className = '';
	document.head.innerHTML = '';
});
/**
 * The Plan Editor half of the page — `npm run harness` with `?view=plan-editor`. Same job
 * as the block above and the same limit: this asserts the FRAME and the plumbing, never
 * appearance, because a browser is where the layered scene is actually looked at.
 *
 * The canvas backing and the resize observer are installed because a real Konva stage is
 * constructed here; a browser has both natively, and jsdom has neither.
 */
describe('the browser harness, plan editor', () => {
	it('mounts the real plan editor inside the same leaf frame', () => {
		installCanvas();
		installResizeObserver();

		const { leafEl, view } = mountPlanEditorHarness(document.body);

		expect(leafEl.classList.contains('rp-harness-leaf')).toBe(true);
		expect(view.containerEl.parentElement).toBe(leafEl);
		// Its own first draw ran: the mount point the stylesheet keys off is there.
		expect(view.contentEl.querySelector('.renovation-plan-editor-view')).not.toBeNull();
	});

	/**
	 * The scheme toggle has to reach the CANVAS, not just the DOM chrome. A Konva shape
	 * cannot read a CSS variable, so the editor re-resolves its palette on a theme event —
	 * and without the toggle firing one, switching scheme here would relight the panels and
	 * leave the zones drawn in the other theme.
	 */
	it('fires a theme event the editor can re-resolve its palette on', () => {
		installCanvas();
		installResizeObserver();
		mountPlanEditorHarness(document.body);
		drawSchemeToggle();
		let fired = 0;
		window.addEventListener('rp-harness-theme', () => {
			fired += 1;
		});

		document.body.querySelector<HTMLElement>('.rp-harness-scheme')?.click();

		expect(fired).toBe(1);
	});

	/**
	 * The `?select=<zoneId>` knob (Task 21) — the only way this harness reaches a zone's Room
	 * Inspector without a real click, and it takes one anyway: `mountPlanEditorHarness` waits
	 * for the floor summary's room list to exist and then clicks the row whose TEXT matches
	 * the zone's name, through `RoomSummaryList`'s own `@click="runtime.selectAndFrame(...)"`
	 * — the real door, not the runtime or the store reached into directly.
	 *
	 * **The shell root has to be SIZED first**, the same way `entries.test.ts`'s `observe()`
	 * sizes it after Task 19: `ResponsiveEditorShell` measures `root.clientWidth` in
	 * `onMounted`, jsdom answers 0 for it, and `layoutModeFor(0)` is `unsupported` — a mode
	 * that renders neither the room list nor the inspector column at all, so the knob's own
	 * `settleUntil` would time out waiting for a row that can never appear. Sizing runs
	 * synchronously, right after the mount call and before anything is awaited, which is what
	 * puts it ahead of the knob's own first (asynchronous) check of its condition.
	 */
	it('drives the ?select knob to the seeded Kitchen in the Room Inspector', async () => {
		installCanvas();
		installResizeObserver();

		const { leafEl } = mountPlanEditorHarness(document.body, { select: 'harness-kitchen' });
		sizedShellRoot(leafEl);

		await settleUntil(
			() => leafEl.querySelector('.rp-room-inspector[data-rp-id="harness-kitchen"]') !== null,
			'the ?select knob to open the Kitchen in the Room Inspector',
		);

		expect(leafEl.querySelector('.rp-room-inspector[data-rp-id="harness-kitchen"]')).not.toBeNull();
	});
});

/**
 * The asset designer half of the page — `npm run harness` with `?view=asset-designer` (Task
 * B10). Same job as the block above and the same limit: this asserts the FRAME and the
 * plumbing, never appearance — a browser is where the shell is actually looked at.
 *
 * The canvas backing and the resize observer are installed for the identical reason: a real
 * Konva stage is constructed inside `DesignerCanvas`, which a browser has natively and jsdom
 * has neither of. There is no theme-event case to mirror the Plan Editor's: `DesignerCanvas.vue`
 * 's own docblock records that `AssetDesignerDeps` carries no theme subscription, so this
 * surface has nothing to fire yet.
 */
describe('the browser harness, asset designer', () => {
	it('mounts the real asset designer inside the same leaf frame', async () => {
		installCanvas();
		installResizeObserver();

		const { leafEl, view } = mountAssetDesignerHarness(document.body);
		// The designer's own hydration settles a tick after the synchronous mount, same as
		// every other view this file and `accessibility.test.ts` mount.
		await flushPromises();

		expect(leafEl.classList.contains('rp-harness-leaf')).toBe(true);
		expect(view.containerEl.parentElement).toBe(leafEl);
		// Its own first draw ran: the mount point the stylesheet keys off is there.
		expect(view.contentEl.querySelector('.renovation-asset-designer-view')).not.toBeNull();
	});
});

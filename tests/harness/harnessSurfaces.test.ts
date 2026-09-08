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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountPlanEditorHarness, parseRoomKnob } from '../harness/planEditor';
import { mountAssetDesignerHarness } from '../harness/assetDesigner';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, resizeTo } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';
import { drawSchemeToggle } from '../harness/theme';
import { t } from '../../src/presentation/i18n/strings';

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
	it.each([1280, 460])('drives M11 through list controls at %i px', async (width) => {
		installCanvas();
		installResizeObserver();
		const { leafEl, view } = mountPlanEditorHarness(document.body, { select: 'harness-terrace,harness-kitchen' });
		const root = sizedShellRoot(leafEl);
		resizeTo(root, width, 700);
		await settleUntil(() => leafEl.querySelector('.rp-multi-selection') !== null, 'M11 through the selection controls');
		const rows = [...leafEl.querySelectorAll('.rp-multi-selection .rp-room-list__row')];
		expect(rows.map((row) => row.getAttribute('data-rp-id'))).toEqual(['harness-terrace', 'harness-kitchen']);
		expect(rows.map((row) => row.textContent?.trim())).toEqual(['1. Terrace', '2. Kitchen']);
		await view.onClose();
	});
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

	/**
	 * The `?room=<w>x<d>` knob (Task 14) — the only way this harness reaches the room task with
	 * a sized rectangle on the canvas, and like `?select` it gets there by pressing what a user
	 * presses: the floating Add button, the catalogue's Room item, and then the two length
	 * fields, each committed with the same `blur` the form itself listens for. Nothing here
	 * writes `RoomDraftStore` directly, which is what makes the capture a picture of the route
	 * rather than of a state assembled beside it.
	 *
	 * The assertion is the SETTLED SENTENCE rather than the form's mere presence: `.rp-new-room`
	 * appears the moment the tool activates, so a knob that opened the menu and typed nothing
	 * would satisfy it. `.rp-new-room__settled` holds text only once `commitDimension` has
	 * placed a rect from both sides, which is the whole of what this knob claims to do.
	 *
	 * The shell root is sized for the reason the `?select` case above gives at length: jsdom
	 * answers 0 for `clientWidth`, and `unsupported` renders no inspector column for the form
	 * to be in.
	 */
	it('drives the ?room knob through Add, the Room item and both length fields', async () => {
		installCanvas();
		installResizeObserver();

		const { leafEl } = mountPlanEditorHarness(document.body, { room: { widthMm: 4200, depthMm: 3800 } });
		sizedShellRoot(leafEl);

		await settleUntil(
			() => leafEl.querySelector('.rp-new-room__settled:not(:empty)') !== null,
			'the ?room knob to settle a 4.2 x 3.8 rectangle',
		);

		expect(leafEl.querySelector<HTMLInputElement>('input[name="width"]')?.value).toBe('4.2');
		expect(leafEl.querySelector<HTMLInputElement>('input[name="depth"]')?.value).toBe('3.8');
		expect(leafEl.querySelector('.rp-new-room__settled')?.textContent).toContain('4.2');
	});

	/**
	 * The same knob at an Obsidian SIDEBAR's width, where the form is not a column of the shell
	 * but the contents of a drawer the rail opens — so the knob has two more doors to press and
	 * this case is what says it presses them. It asserts the END STATE rather than the route: a
	 * placed rectangle (the draft's own `origin`, readable here through the settled sentence
	 * being written at all) with the drawer CLOSED behind it, which is the picture
	 * `plan-editor-add-room-narrow` exists to take. Leave the drawer open and the shot is 80% of
	 * a pane of form over the canvas it is supposed to show.
	 *
	 * `resizeTo(…, 460, …)` is what makes it the constrained layout at all — `sizedShellRoot`
	 * takes no width and sizes to 1280 — and without it this is the case above with two extra
	 * doors that never appear.
	 */
	it('opens the drawer, types, and closes it again when the pane is a sidebar wide', async () => {
		installCanvas();
		installResizeObserver();

		const { leafEl } = mountPlanEditorHarness(document.body, { room: { widthMm: 4200, depthMm: 3800 } });
		resizeTo(sizedShellRoot(leafEl, { skipResize: true }), 460, 800);

		// `aria-disabled="false"` is what says the two sides were actually typed: `canCreateRoom`
		// reads `RoomDraftStore.valid`, which needs a PLACED rect, and the rect is placed only by
		// `commitDimension` once both sides are known. Waiting on the banner alone would pass
		// against a knob that opened the menu, pressed Room and stopped — and at this width the
		// form it would have failed to type into is not on screen to contradict it.
		await settleUntil(
			() => leafEl.querySelector('.rp-task-banner__finish')?.getAttribute('aria-disabled') === 'false',
			'the ?room knob to size the room through the drawer at 460px',
		);

		expect(leafEl.querySelector('.rp-editor-shell')?.getAttribute('data-layout')).toBe('constrained');
		expect(leafEl.querySelector('.rp-panel-rail')).not.toBeNull();
		// The knob's own last press: the drawer it opened to type in is shut behind it, so the
		// capture shows the canvas and the banner rather than 80% of a pane of form.
		expect(leafEl.querySelector('.rp-inspector-drawer')).toBeNull();
		expect(leafEl.querySelector('.rp-new-room')).toBeNull();
	});

	/**
	 * The `?stale` knob (Task 14) — the one knob whose landing was checked by a manually read
	 * PNG alone (`plan-editor-stale.png`/`plan-editor-stale-narrow.png`) and nothing else.
	 * `driveStaleKnobOnceReady` selects and deletes a sacrificial zone
	 * (`STALE_TRIGGER_ZONE_ID`) through the Inspector's own Delete button — a REAL zero-referent
	 * deletion, dispatched through a fixture `Zone.create` snapshot and a real
	 * `ReversibleDeleteZoneCommand` — and only once that write's own post-command read-back has
	 * failed (`harnessDeps`'s own knob) does it select `?select`'s zone. This case drives the
	 * same route the two PNGs were taken from and asserts three facts a PNG read had to
	 * establish by eye: the warning row carries both its actions, Kitchen's own Inspector is
	 * still the one showing (not swallowed by the sacrifice zone's), and the save-state label
	 * reads the derived "Saved · refresh needed" copy — SDD companion §2.5's own qualifier on a
	 * write that landed, not a save error.
	 *
	 * Watched red first: mounting with `stale: false` (`select` alone) never renders
	 * `[data-rp-warning="stale"]` at all, so `settleUntil` times out at its own named error
	 * rather than at a wrong assertion — the shape this file's sibling knob cases already use to
	 * prove a case actually exercises its knob rather than passing on an accident.
	 */
	it('drives the ?stale knob through a real zero-referent delete to the stale-projection warning', async () => {
		installCanvas();
		installResizeObserver();

		const { leafEl } = mountPlanEditorHarness(document.body, { stale: true, select: 'harness-kitchen' });
		sizedShellRoot(leafEl);

		// BOTH conditions, not the warning alone: `driveStaleKnobOnceReady` selects Kitchen only
		// AFTER its own internal `settleUntil` on the same warning resolves, so polling for the
		// warning by itself can observe it a tick before the knob's own continuation has selected
		// anything — measured, not assumed: the narrower wait below failed at the Kitchen
		// assertion on its first run, with the warning already present and nothing selected yet.
		await settleUntil(
			() =>
				leafEl.querySelector('[data-rp-warning="stale"] button') !== null &&
				leafEl.querySelector('.rp-room-inspector[data-rp-id="harness-kitchen"]') !== null,
			'the ?stale knob to land the stale-projection warning and select the Kitchen',
		);

		// Both actions the row is meant to carry (design spec §2.4), not merely one of them.
		expect(leafEl.querySelectorAll('[data-rp-warning="stale"] button')).toHaveLength(2);
		// The sacrifice zone's own selection does not outlive the write it triggered: `?select`
		// is applied AFTER the knob's internal delete-and-clear, so Kitchen — never the deleted
		// `harness-garden` — is what the Inspector still shows.
		expect(leafEl.querySelector('.rp-room-inspector[data-rp-id="harness-kitchen"]')).not.toBeNull();
		// The write really did land (`state === 'saved'`); `stale` is read as a qualifier on top
		// of it, never as a save error of its own.
		expect(leafEl.querySelector('.rp-save-state-label')?.textContent).toBe(
			t('en', 'save-state.saved-refresh-needed'),
		);
	});

	/**
	 * The one knob of the four with something to get wrong before the DOM is ever involved, and
	 * both arms of it — the accepting one, and the refusal that names the value it could not
	 * read rather than letting `?room=4200X3800` (a capital X, the typo that reads as working)
	 * mount an editor with no room task in it and nothing said anywhere. `?select`, `?add` and
	 * `?stale` all take either no value or an id copied verbatim, so `?room` stays the one with
	 * a shape to parse.
	 *
	 * The spy is asserted in BOTH directions: `not.toHaveBeenCalled()` after the two legitimate
	 * inputs is what stops a version that logged unconditionally from passing on the count alone.
	 */
	it('parses the ?room knob and refuses a value that is not two whole millimetre sides', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		expect(parseRoomKnob('4200x3800')).toEqual({ widthMm: 4200, depthMm: 3800 });
		expect(parseRoomKnob(null)).toBeUndefined();
		expect(spy).not.toHaveBeenCalled();

		expect(parseRoomKnob('4200X3800')).toBeUndefined();
		expect(parseRoomKnob('4.2x3.8')).toBeUndefined();
		expect(parseRoomKnob('big')).toBeUndefined();
		expect(spy).toHaveBeenCalledTimes(3);

		spy.mockRestore();
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

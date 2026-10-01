/**
 * @vitest-environment jsdom
 *
 * The asset designer RENDERED at a leaf's width — AD15 row T42, whose gap was that the
 * designer's compact behaviour existed only as stylesheet declarations
 * (`designerStyles.test.ts` reads `designer-narrow.css` and nothing mounts anything at a
 * width). Nothing here reads a stylesheet; that file stays the authority for what the
 * `@container rp-designer (width < 35rem)` block DECLARES, and this one is about what the
 * mounted tree still offers a user at 520, 900 and 1400 px.
 *
 * **What "reachable" means in this file, and the whole of it.** For a control: it is in the
 * document, it is enabled (neither `disabled` nor `aria-disabled="true"`), it carries an
 * accessible name, and it takes focus when asked. For a non-focusable status region: it is in
 * the document, it keeps its role, and it says what it is supposed to say. `reachable()` below
 * is the definition and there is no other.
 *
 * **What it does NOT mean, and the sentence is narrow because the check is.** jsdom lays
 * nothing out, computes no used width and applies no `@media` or `@container` query, so no case
 * here can say a control is VISIBLE, on screen, unclipped, of a usable hit size, or legible
 * against what is behind it. `tests/harness/accessibility*.test.ts`'s own header records the
 * same three limits for the same reason, and `npm run harness-shot -- --width=460` is the only
 * instrument in this repository that measures a rendered layout at all. Read a green run here
 * as "the compact layout removes nothing", never as "the compact layout looks right".
 *
 * **Why the widths are nevertheless a real axis rather than decoration.** No module the
 * designer MOUNTS decides anything from a width. The instrument for that is an import-graph
 * walk from `AssetDesignerView.ts` (`tests/helpers/importGraph.ts`, which throws on a relative
 * specifier it cannot resolve rather than dropping it), not a grep: a grep scoped to
 * `src/presentation/designer/` prints nothing, and it is scoped narrower than the claim, so a
 * reader who widens it tree-wide will get hits and think this sentence broken. Walked, the
 * reached set names exactly two: `EditorSurface.vue`'s `ResizeObserver`, which measures its OWN
 * container to size the Konva stage and decides no region and no control from it, and
 * `followPixelRatio.ts`'s `matchMedia('(resolution: Ndppx)')`, which is a device-pixel-ratio
 * query and not a width at all.
 *
 * So the designer's compact layout is CSS only, and the guarantee worth pinning is INVARIANCE:
 * the primary actions and the error survive every width because no width-driven branch exists
 * to drop them. **Today that means the three widths produce an identical tree, and the case
 * below would pass against a component that ignored width entirely** — which is the honest way
 * to read a green run, and is not the same as the case being unable to fail. The two channels
 * such a branch would read a width through are both supplied here — `clientWidthFor` gives the
 * shell root a width BEFORE `onMounted`, and `resizeTo` gives it one and tells every observer
 * watching it afterwards — which is `tests/presentation/editor/shell/responsiveShell.test.ts`'s
 * arrangement for the plan editor, the surface that really does read one. Both were watched
 * red against a temporary width branch on the root before this file was believed.
 *
 * A width taken from `window.innerWidth`, from `matchMedia` or from `getBoundingClientRect`
 * would be invisible to both, and so would a control hidden by a `display: none` under the
 * container query. **That second blind spot is EMPTY today, and saying so is what makes the
 * invariance claim hold in a real browser as well as in jsdom**: the whole of
 * `designer-narrow.css`'s narrow block declares `flex-direction`, `flex`, `width`,
 * `border-top`, `border-right`, `border-bottom` and `border-left`, and the file contains no
 * `display`, `visibility` or `content-visibility` at all. It stays named because it is a blind
 * spot about the FUTURE — the day a rule hides something there, nothing in this file notices.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { err } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import type { AssetDesignerQueryServices } from '../../../src/presentation/read-models/assetDesignerQueries';
import { designerRig, type DesignerRig, type DesignerRigOptions } from '../../helpers/designerRig';
import { unwiredPlanUsage } from '../../helpers/designerQueries';
import { clientWidthFor, resizeTo } from '../../helpers/layout';
import { settle } from '../../helpers/settle';

/**
 * 520 is below the 35rem threshold `designer-narrow.css` keys its container query on — 560 px
 * at Obsidian's 16 px root. It is NOT the sidebar leaf's width: that is **460**, which
 * `designer-narrow.css`'s own header names and which `npm run harness-shot -- --width=460`
 * captures, and it is the width this repository records as having already hidden a layout
 * defect the default 1280 could not show. 520 is the AD15 matrix row's number, nothing more.
 * Not testing at 460 as well costs nothing here and the reason is worth stating rather than
 * assuming: both sit below the same threshold, and jsdom applies no container query, so the
 * two are the same tree in this environment. 900 and 1400 are above it, one a split pane and
 * one a full tab. Three widths rather than two because the row asks for three, and because a
 * branch keyed on a band rather than a threshold would be right at two of them.
 */
const WIDTHS = [520, 900, 1400] as const;

/** A height nothing here reads: the container query is `inline-size` only. */
const HEIGHT = 800;

/** A read that refuses with a vault fault — retryable, so it draws a failure WITH its action. */
const REFUSING: AssetDesignerQueryServices = {
	getAssetDesign: () =>
		Promise.resolve(err({ category: 'Persistence' as const, code: 'vault.unexpected-failure', message: 'x' })),
	listPlansUsingAsset: unwiredPlanUsage,
};

let open: DesignerRig | null = null;

afterEach(() => {
	open?.unmount();
	open = null;
});

/** The shell root — the element `designer-narrow.css` names as the query's container. */
function rootOf(rig: DesignerRig): HTMLElement {
	return rig.wrapper.element as HTMLElement;
}

/**
 * The designer mounted with its root ALREADY reporting `width`, and still reporting it after.
 *
 * Both halves, because a width-driven branch can be decided in either place: `clientWidthFor`
 * answers for the root while `onMounted` runs, and `resizeTo` answers for it — and notifies
 * every observer — from then on. The override answers 0 for every other element, which is what
 * jsdom answers anyway, and the rig's own `resizeTo(canvasEl, 800, 600)` runs inside
 * `designerRig()` and defines an OWN property that shadows it, so the Konva stage is sized
 * exactly as every other designer suite sizes it.
 */
async function designerAt(width: number, options: DesignerRigOptions = {}): Promise<DesignerRig> {
	const restore = clientWidthFor((element) => (element.classList.contains('renovation-asset-designer') ? width : 0));
	let rig: DesignerRig;
	try {
		rig = await designerRig(options);
	} finally {
		restore();
	}
	open = rig;
	resizeTo(rootOf(rig), width, HEIGHT);
	await settle();
	return rig;
}

/** One element by selector, throwing rather than answering `null` — an absence is the finding. */
function one(rig: DesignerRig, selector: string): HTMLElement {
	const found = rootOf(rig).querySelector<HTMLElement>(selector);
	if (found === null) throw new Error(`no ${selector} in the mounted designer`);
	return found;
}

/**
 * The four questions this file is allowed to ask of a control, answered as one object so a
 * failure names WHICH of them broke rather than printing `false`.
 */
function reachable(element: HTMLElement): Record<string, boolean> {
	element.focus();
	return {
		connected: element.isConnected,
		enabled: !(element instanceof HTMLButtonElement && element.disabled) && element.getAttribute('aria-disabled') !== 'true',
		named: ((element.textContent ?? '') + (element.getAttribute('aria-label') ?? '')).trim() !== '',
		focusable: document.activeElement === element,
	};
}

const REACHABLE = { connected: true, enabled: true, named: true, focusable: true };

/** Every reachable button under the shell, by its accessible name — the set a width may not change. */
function reachableButtons(rig: DesignerRig): string[] {
	return [...rootOf(rig).querySelectorAll<HTMLButtonElement>('button')]
		.filter((button) => reachable(button).enabled)
		.map((button) => ((button.textContent ?? '').trim() || button.getAttribute('aria-label') || button.className))
		.toSorted();
}

describe('the asset designer rendered at a leaf’s width', () => {
	/**
	 * The designer's front door: a shapeless asset draws `DesignerEntryPaths` into the empty
	 * state's `#actions` slot. They are the way into a design FROM THE EMPTY STATE, not the only
	 * way into one at all — `DesignerAddPanel.vue` renders the same `designer.inspector.start-preset`
	 * door on `.rp-designer-start-preset`, which is what `grep -rn "start-preset"
	 * src/presentation/designer/` prints beside this one; a first draft of this docblock said
	 * "only" and was wrong. **That second door was the INSPECTOR's until AD18-R6 moved it into the
	 * `Add` rail** — the grep prints one standing copy either way, so the sentence's shape survives
	 * the move and only the file name changes.
	 *
	 * **The LABELS are pinned, not the mere presence of something.** A first version asserted
	 * `actions.length > 0` under a sentence claiming it asserted every path, which deleting
	 * either control left green — exactly the hole the sentence named. This rig gives no picker
	 * and no background, so the state is `noBackground` and the overlay's own `actionLabel` is
	 * withheld (`AssetDesignerRoot`'s `overlay`, slice 14's Amendment 1); the two controls left
	 * are both `DesignerEntryPaths`', in DOM order.
	 */
	it.each(WIDTHS)('keeps every entry path on the no-shape state reachable at %ipx', async (width) => {
		const rig = await designerAt(width, { shape: null });

		const actions = [...rootOf(rig).querySelectorAll<HTMLElement>('.rp-empty-state__action')];
		expect(actions.map((action) => (action.textContent ?? '').trim())).toEqual([
			t('en', 'empty.asset.no-shape.action'),
			t('en', 'designer.inspector.start-preset'),
		]);
		for (const action of actions) expect(reachable(action)).toEqual(REACHABLE);
	});

	/**
	 * An error and the action that answers it, at each width. The failure panel lives INSIDE
	 * `.rp-designer-canvas`, which is the region the narrow layout re-shares as a fixed flex
	 * share — so "the read refused and the user can still retry" is exactly the claim a compact
	 * layout could break, and exactly the one nothing rendered AT A WIDTH until this file. The
	 * RENDERING of it is not new: `assetDesignerRoot.test.ts` already mounts this failure, finds
	 * the same action, clicks it and asserts the re-read. The width is what is new here, and the
	 * first draft of this sentence claimed more than that.
	 */
	it.each(WIDTHS)('keeps a refused read’s failure and its retry reachable at %ipx', async (width) => {
		const rig = await designerAt(width);

		await useAssetDesignStore(rig.pinia).hydrate(REFUSING, rig.assetId, { indexScanCompleted: true });
		await settle();

		expect(one(rig, '.rp-view-failure').textContent).toContain(t('en', 'designer.asset-failed.headline'));
		const retry = one(rig, '.rp-view-failure__action');
		expect(retry.textContent?.trim()).toBe(t('en', 'view.failure.retry'));
		expect(reachable(retry)).toEqual(REACHABLE);
	});

	/**
	 * The ADDITIVE error, which is a different shape and therefore a different question: a
	 * keep-on-failure refresh leaves a real design on the canvas and reports the stale read in a
	 * `role="status"` strip that is a sibling of every region rather than inside one. It is not
	 * focusable, so "reachable" here is presence, role and sentence — the three things a reader
	 * needs and the three this environment can honestly answer.
	 */
	it.each(WIDTHS)('keeps the stale-refresh notice reachable at %ipx', async (width) => {
		const rig = await designerAt(width);

		await useAssetDesignStore(rig.pinia).hydrate(REFUSING, rig.assetId, {
			indexScanCompleted: true,
			keepPreviousOnFailure: true,
		});
		await settle();

		const notice = one(rig, '.rp-designer-notice');
		expect(notice.isConnected).toBe(true);
		expect(notice.getAttribute('role')).toBe('status');
		expect(notice.textContent?.trim()).toBe(t('en', 'designer.refresh-failed'));
		// The design it is stale ABOUT is still drawn: a build that replaced the canvas with a
		// failure panel would satisfy the strip's presence just as well.
		expect(rootOf(rig).querySelector('.rp-view-failure')).toBeNull();
	});

	/**
	 * The case with the teeth, and the reason the three above are a width test rather than the
	 * same test run three times: ONE mounted tree walked across the threshold in both
	 * directions, asserting that the set of enabled, named buttons does not change. Against the
	 * component as it stands the four readings are identical because nothing reads a width at
	 * all — the header says so outright, and this is a POLICY PIN in the sense
	 * `responsiveShell.test.ts`'s own R3 case uses the phrase. A branch
	 * that dropped a control below 35rem fails here by naming the control it dropped, and the
	 * return to 520 catches the other half — a transition that rebuilt the shell and did not
	 * restore it.
	 *
	 * The empty state is up, so the set under comparison includes the entry paths, the toolbar
	 * and the inspector's own controls at once.
	 */
	it('offers the same controls at every width, and across the threshold in both directions', async () => {
		const rig = await designerAt(1400, { shape: null });
		const atFullWidth = reachableButtons(rig);
		expect(atFullWidth.length).toBeGreaterThan(0);

		// The return to 520 is its own STEP rather than a repeated key: a record keyed by width
		// would have the second reading overwrite the first and the round trip would go unasked.
		const walk = [520, 900, 1400, 520];
		const seen: Record<string, string[]> = {};
		for (const [step, width] of walk.entries()) {
			resizeTo(rootOf(rig), width, HEIGHT);
			await settle();
			seen[`step ${step}: ${width}px`] = reachableButtons(rig);
		}

		expect(seen).toEqual(Object.fromEntries(walk.map((width, step) => [`step ${step}: ${width}px`, atFullWidth])));
	});
});

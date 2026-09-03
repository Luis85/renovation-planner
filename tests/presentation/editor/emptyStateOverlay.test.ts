/**
 * @vitest-environment jsdom
 *
 * The Plan Editor's empty states, as OVERLAYS over a canvas that never unmounts.
 *
 * The load-bearing assertion in this file is the first one: `.rp-plan-canvas` exists in every
 * case. `create-sample-project` seeds a plan with no background and five zones and then opens
 * the editor on it, and `tests/harness/planEditor.ts` refuses a background outright on SDD
 * §55 grounds — so an empty state that REPLACED the region would make both of them draw an
 * empty state where the scene should be. Neither is reachable from this suite, which is
 * exactly why the claim is pinned here.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../../../src/presentation/i18n/strings';
import { mountPlanEditor, runtimeOf, settle, type EditorHarness } from '../../helpers/editor';
import { FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';

let harness: EditorHarness | null = null;

afterEach(() => {
	harness?.unmount();
	harness = null;
});

const WITH_BACKGROUND = {
	...FIXTURE_PLAN,
	background: { path: 'Plans/ground.png', kind: 'image' as const },
};

const overlay = (mounted: EditorHarness) => mounted.wrapper.find('.rp-empty-state');

/** One pointer event, spelled out so a press and its release are visibly the same gesture. */
/**
 * One primary-button event, with `buttons` derived the way a device sets it: the primary bit
 * while the button is down, nothing once it is released. A move that reports no button held
 * is a released button, and the canvas reads exactly that to end a drag whose `pointerup`
 * went to another element or arrived inside a chord — so a helper leaving `buttons` at
 * jsdom's zero would end every drag it tried to make.
 */
function press(element: HTMLElement, type: string, x: number, y: number): void {
	element.dispatchEvent(
		new PointerEvent(type, {
			button: 0,
			buttons: type === 'pointerup' ? 0 : 1,
			pointerId: 1,
			clientX: x,
			clientY: y,
			bubbles: true,
		}),
	);
}

describe('the plan editor empty states', () => {
	it('keeps the canvas mounted while an empty state is showing', async () => {
		harness = await mountPlanEditor({ plan: FIXTURE_PLAN, zones: [] });

		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
		expect(overlay(harness).exists()).toBe(true);
	});

	it('renders the overlay INSIDE the canvas, so it positions against it', async () => {
		harness = await mountPlanEditor({ plan: FIXTURE_PLAN, zones: [] });

		expect(harness.wrapper.find('.rp-plan-canvas .rp-empty-state').exists()).toBe(true);
		expect(overlay(harness).classes()).toContain('rp-empty-state--overlay');
	});

	it('asks for a background when the plan has none, even with zones drawn', async () => {
		harness = await mountPlanEditor({ plan: FIXTURE_PLAN, zones: FIXTURE_ZONES });

		expect(overlay(harness).find('h2').text()).toBe(t('en', 'empty.plan.no-background.headline'));
	});

	it('asks for a zone once the background is set', async () => {
		harness = await mountPlanEditor({ plan: WITH_BACKGROUND, zones: [] });

		expect(overlay(harness).find('h2').text()).toBe(t('en', 'empty.plan.no-zones.headline'));
	});

	it('shows nothing when the plan has a background and zones', async () => {
		harness = await mountPlanEditor({ plan: WITH_BACKGROUND, zones: FIXTURE_ZONES });

		expect(overlay(harness).exists()).toBe(false);
	});

	/**
	 * Amendment 3, and the reason the noZones action is usable at all: its own button
	 * activates `draw-polygon`, and a panel still sitting over the canvas afterwards would
	 * leave the user in a mode they cannot reach the stage in. One rule for both keys, so
	 * `noBackground` yields to an active tool too — a plan with no background still has a
	 * coordinate system, which is precisely what the sample project draws five zones in.
	 */
	it('yields to an active tool', async () => {
		harness = await mountPlanEditor({ plan: WITH_BACKGROUND, zones: [] });
		expect(overlay(harness).exists()).toBe(true);

		useEditorStore(harness.pinia).activeToolId = 'draw-polygon';
		await settle();

		expect(overlay(harness).exists()).toBe(false);
		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
	});

	it('activates the draw tool when the noZones action is pressed', async () => {
		harness = await mountPlanEditor({ plan: WITH_BACKGROUND, zones: [] });

		await overlay(harness).find('button.rp-empty-state__action').trigger('click');
		await settle();

		expect(useEditorStore(harness.pinia).activeToolId).toBe('draw-polygon');
	});

	it('leaves the Space key to the noZones action button, rather than arming the camera', async () => {
		// The canvas listens for keys on itself, and the empty state is an OVERLAY INSIDE it —
		// so a `keydown` from the focused button bubbles straight to that handler. It called
		// `preventDefault()` to stop the pane paging down under a space-held pan, which also
		// suppresses a button's own native Space activation: the canvas's only keyboard-
		// reachable control stopped working under the standard gesture for pressing it.
		harness = await mountPlanEditor({ plan: WITH_BACKGROUND, zones: [] });
		const button = overlay(harness).find('button.rp-empty-state__action').element as HTMLButtonElement;
		button.focus();

		const pressed = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
		button.dispatchEvent(pressed);
		await settle();

		expect(pressed.defaultPrevented).toBe(false);
		// And the camera did not arm behind it, which is the other half of the same mistake.
		expect(harness.wrapper.find('.rp-plan-canvas').classes()).not.toContain('rp-plan-canvas-armed');
	});

	it('leaves a PRESS on the noZones action to the button, rather than panning the camera', async () => {
		// The pointer twin of the case above, and it outlived it by a round: the keyboard half
		// was fixed with `isCanvasKey` while presses went on bubbling. `.rp-empty-state__action`
		// re-enables `pointer-events` against the overlay's own `none`, so it is a real pointer
		// target sitting over the stage — a press on it reached the canvas and began a camera
		// pan under a user who was only clicking the button. Measured before the fix: the drag
		// below moved `pan` from -480 to -1280.
		harness = await mountPlanEditor({ plan: WITH_BACKGROUND, zones: [] });
		const camera = useEditorStore(harness.pinia);
		const button = overlay(harness).find('button.rp-empty-state__action').element as HTMLButtonElement;
		const before = { ...camera.viewport.pan };

		press(button, 'pointerdown', 100, 100);
		press(button, 'pointermove', 180, 180);
		press(button, 'pointerup', 180, 180);
		await settle();

		expect(camera.viewport.pan).toEqual(before);
	});

	it('still ends a gesture the STAGE started, so swallowing the press costs no release', async () => {
		// The other half of "a swallowed press owes a swallowed release", from the opposite
		// direction: the overlay must not swallow the end of a gesture it never began. A real
		// browser retargets a captured pointer to the stage, so this cannot arise there — which
		// is a reason for the routing to be right anyway, not a reason to leave it untested.
		harness = await mountPlanEditor({ plan: WITH_BACKGROUND, zones: [] });
		const camera = useEditorStore(harness.pinia);
		const canvas = harness.wrapper.find('.rp-plan-canvas').element as HTMLElement;

		// Task 10 made Select — not camera mode — the tool armed once the plan is ready, so a
		// bare primary drag needs an explicit return to camera mode to mean what this case is
		// actually about: the STAGE's own drag, rather than a Select drag over empty canvas.
		// Task 13 retired the toolbar's own Pan button; the runtime is asked directly.
		runtimeOf(harness).setTool(null);
		await settle();

		press(canvas, 'pointerdown', 100, 100);
		press(canvas, 'pointermove', 140, 140);
		press(canvas, 'pointerup', 140, 140);
		await settle();

		// The drag committed and nothing is still holding the camera.
		expect(camera.dragState).toBeNull();
		expect(camera.viewport.pan).not.toEqual({ x: -480, y: -480 });
	});

	/**
	 * A failed read is NOT an empty state (DoD 6). `mountPlanEditor` with a plan of `null`
	 * drives `status === 'missing'`, which mounts no canvas, so it can carry no overlay.
	 * Slice 17 owns what that renders as; this asserts only that it is not downgraded into
	 * cheerful onboarding copy.
	 */
	it('renders no empty state for a plan that does not resolve', async () => {
		harness = await mountPlanEditor({ plan: null, zones: [] });

		expect(overlay(harness).exists()).toBe(false);
		// Slice 17 replaced this region with the shared `ViewFailure` for the two states that have
		// a reason; the loading line keeps `.rp-editor-canvas-message`.
		expect(harness.wrapper.find('.rp-view-failure').exists()).toBe(true);
	});
});

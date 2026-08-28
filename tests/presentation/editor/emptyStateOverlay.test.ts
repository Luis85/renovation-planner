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
import { mountPlanEditor, settle, type EditorHarness } from '../../helpers/editor';
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

	/**
	 * A failed read is NOT an empty state (DoD 6). `mountPlanEditor` with a plan of `null`
	 * drives `status === 'missing'`, which mounts no canvas, so it can carry no overlay.
	 * Slice 17 owns what that renders as; this asserts only that it is not downgraded into
	 * cheerful onboarding copy.
	 */
	it('renders no empty state for a plan that does not resolve', async () => {
		harness = await mountPlanEditor({ plan: null, zones: [] });

		expect(overlay(harness).exists()).toBe(false);
		expect(harness.wrapper.find('.rp-editor-canvas-message').exists()).toBe(true);
	});
});

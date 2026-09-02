/**
 * @vitest-environment jsdom
 *
 * The Plan Editor's Obsidian lifecycle: one isolated Vue app per leaf, keyed to a Plan
 * that travels in the leaf's own view state.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Konva from 'konva';
import { ok } from '../../../src/core/result/Result';
import {
	PLAN_EDITOR_ICON,
	PLAN_EDITOR_VIEW,
	PlanEditorView,
	type PlanEditorDeps,
} from '../../../src/presentation/views/PlanEditorView';
import { t } from '../../../src/presentation/i18n/strings';
import type { BackgroundVault } from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import { installEditorEnvironment, settle } from '../../helpers/editor';
import { FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';
import { FakeLeaf } from '../../helpers/workspace';

installEditorEnvironment();

let themeListeners = 0;
let planListeners = 0;
let catalogueListeners = 0;
let priceListeners = 0;
let figureListeners = 0;

function deps(plan: typeof FIXTURE_PLAN | null = FIXTURE_PLAN): PlanEditorDeps {
	return {
		queries: {
			getPlan: () => Promise.resolve(ok(plan)),
			getRequirementsForZone: () => Promise.resolve(ok([])),
			listAssets: () => Promise.resolve(ok([])),
			// The two the contract requires and this fixture omitted until `tests/**` was
			// type-checked. A fixture thinner than its own annotation is the shape this
			// repository keeps recording: the view can reach these, and here they answered
			// `undefined`.
			listRequirementsReferencing: () => Promise.resolve(ok([])),
			listReassignmentTargets: () => Promise.resolve(ok([])),
			findZonesByPlan: () => Promise.resolve(ok({ zones: FIXTURE_ZONES, unreadable: 0 })),
		},
		// The lifecycle tests here dispatch nothing; the refusal commands keep that honest.
		commands: unavailablePlanEditorCommands(),
		vault: {
			getAbstractFileByPath: () => null,
			getResourcePath: () => '',
			readBinary: () => Promise.resolve(new ArrayBuffer(0)),
		} as unknown as BackgroundVault,
		onThemeChange: () => {
			themeListeners += 1;
			return () => {
				themeListeners -= 1;
			};
		},
		onPlanChanged: () => {
			planListeners += 1;
			return () => {
				planListeners -= 1;
			};
		},
		onCatalogueChanged: () => {
			catalogueListeners += 1;
			return () => {
				catalogueListeners -= 1;
			};
		},
		onProjectPricesChanged: () => {
			priceListeners += 1;
			return () => {
				priceListeners -= 1;
			};
		},
		onRequirementFiguresChanged: () => {
			figureListeners += 1;
			return () => {
				figureListeners -= 1;
			};
		},
	};
}

/**
 * Every view a test opened, closed automatically afterwards.
 *
 * Not tidiness: `Konva.stages` is process-global, so ONE test that forgets to close leaves
 * a stage behind and every later assertion counting stages is measuring the wrong thing —
 * which is how the first version of this file reported four failures that were all the
 * same missing `onClose`.
 */
const openViews: PlanEditorView[] = [];

function makeView(
	leaf: FakeLeaf = new FakeLeaf(),
	plan: typeof FIXTURE_PLAN | null = FIXTURE_PLAN,
): PlanEditorView {
	const view = new PlanEditorView(leaf as never, deps(plan));
	openViews.push(view);
	return view;
}

/** Opening a view that already knows which Plan it shows — the restored-leaf path. */
async function opened(planId = FIXTURE_PLAN.id): Promise<PlanEditorView> {
	const view = makeView();
	await view.setState({ planId }, {} as never);
	await view.onOpen();
	await settle();
	return view;
}

beforeEach(() => {
	themeListeners = 0;
	planListeners = 0;
	catalogueListeners = 0;
	priceListeners = 0;
	figureListeners = 0;
});

afterEach(async () => {
	for (const view of openViews.splice(0)) await view.onClose();
	await settle();
});

describe('what the view tells Obsidian about itself', () => {
	/**
	 * The view type is DATA: Obsidian persists it in the workspace layout, so renaming it
	 * orphans every Plan Editor leaf a user has open. The display name beside it is text.
	 */
	it('answers its persisted type, its icon, and a translated display name', () => {
		const view = makeView();

		expect(view.getViewType()).toBe(PLAN_EDITOR_VIEW);
		expect(view.getIcon()).toBe(PLAN_EDITOR_ICON);
		expect(view.getDisplayText()).toBe(t('en', 'view.plan-editor.name'));
	});

	/**
	 * The pairing between the persisted type and the stylesheet selector keyed on it.
	 * Renaming the type without the sheet leaves a rule matching nothing, which no other
	 * check here can see — jsdom applies no stylesheet and the harness draws one view.
	 */
	it('is the view type styles/chrome.css keys its rule on', () => {
		// Relative to the working directory, like every other path in this suite: under jsdom
		// `import.meta.url` is an http URL and `new URL(…)` resolves to a scheme node:fs refuses.
		const chrome = readFileSync('styles/chrome.css', 'utf8');

		expect(chrome).toContain(`.workspace-leaf-content[data-type="${PLAN_EDITOR_VIEW}"]`);
	});
});

describe('the plan a leaf is showing', () => {
	it('round-trips the plan id through the leaf view state', async () => {
		const view = await opened('plan-first-floor');

		expect(view.getState()).toEqual({ planId: 'plan-first-floor' });
	});

	/**
	 * The workspace layout is a file a user can edit and an older version of this plugin
	 * wrote — the same trust boundary `settingsFrom` draws around `data.json`. A state with
	 * no usable plan id leaves the view showing its loading message rather than hydrating a
	 * plan called `undefined`.
	 */
	it.each([
		['no state at all', null],
		['a state with no plan id', {}],
		['a plan id that is not a string', { planId: 7 }],
		['an empty plan id', { planId: '' }],
	])('mounts nothing for %s', async (_name, state) => {
		const view = makeView();

		await view.setState(state, {} as never);
		await view.onOpen();
		await settle();

		expect(Konva.stages).toHaveLength(0);
		expect(view.getState()).toEqual({ planId: '' });
		await view.onClose();
	});

	/**
	 * Obsidian calls `onOpen` and `setState` in an order a plugin does not get to assume,
	 * so both route through one place that mounts when there is something to mount. Driven
	 * in the OTHER order from `opened()` above, which is the whole point.
	 */
	it('mounts when the plan arrives after the view is already open', async () => {
		const view = makeView();

		await view.onOpen();
		expect(Konva.stages).toHaveLength(0);

		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
		await settle();

		expect(Konva.stages).toHaveLength(1);
		await view.onClose();
	});

	it('does not remount when told the same plan twice', async () => {
		const view = await opened();
		const stage = Konva.stages[0];

		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
		await settle();

		expect(Konva.stages[0]).toBe(stage);
		await view.onClose();
	});
});

describe('mount and unmount', () => {
	it('mounts one Vue app with a Konva stage into contentEl', async () => {
		const view = await opened();

		expect(Konva.stages).toHaveLength(1);
		expect(view.contentEl.querySelector('.renovation-plan-editor-view')).not.toBeNull();
		await view.onClose();
	});

	/**
	 * Obsidian keeps the leaf and reuses the view, so an app left mounted would keep a
	 * `ResizeObserver`, a `css-change` listener and a Konva stage alive against a detached
	 * tree — and the next open would stack a second of each.
	 */
	it('leaves no app, stage, listener or markup behind on close', async () => {
		const view = await opened();
		expect(themeListeners).toBe(1);
		// ONE of each, and the split is the assertion. `PlanEditorRoot` subscribes `hydrate` to
		// the plan door; `runtime.ts` subscribes the assign picker to the CATALOGUE door. This
		// read TWO plan listeners and zero catalogue ones until the picker stopped borrowing
		// `onPlanChanged` — right for the one event it needed there and wasteful for the five
		// it did not, so a zone gesture re-read every asset note in the vault.
		//
		// Both numbers are asserted rather than loosened to "at least one" because that is the
		// half this case exists for: a count going UP is a subscription added without a
		// disposal, which is exactly the leak the assertions below measure. And asserting the
		// PAIR is what stops a build that merges the two doors back together from passing —
		// one that subscribed both to `onPlanChanged` would read 2 and 0 again.
		expect(planListeners).toBe(1);
		expect(catalogueListeners).toBe(1);
		// The two doors the unit-cost block added. Counted for the same reason and asserted the
		// same way: each is a subscription the runtime takes once and must give back once.
		expect(priceListeners).toBe(1);
		expect(figureListeners).toBe(1);

		await view.onClose();
		await settle();

		expect(Konva.stages).toHaveLength(0);
		expect(themeListeners).toBe(0);
		expect(planListeners).toBe(0);
		expect(catalogueListeners).toBe(0);
		expect(priceListeners).toBe(0);
		expect(figureListeners).toBe(0);
		expect(view.contentEl.childElementCount).toBe(0);
	});

	it('stacks nothing across repeated open and close cycles on one view', async () => {
		const view = makeView();
		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);

		for (let cycle = 0; cycle < 3; cycle += 1) {
			await view.onOpen();
			await settle();
			expect(Konva.stages).toHaveLength(1);
			await view.onClose();
			await settle();
			expect(Konva.stages).toHaveLength(0);
		}

		expect(themeListeners).toBe(0);
	});

	/**
	 * ADR-004: an isolated app per `ItemView`. Two Plan Editors are the premise of this view
	 * existing at all, so two leaves must produce two independent stages rather than one
	 * shared anything.
	 */
	it('gives two leaves two independent stages', async () => {
		const first = await opened('plan-ground');
		const second = await opened('plan-first');

		expect(Konva.stages).toHaveLength(2);
		expect(Konva.stages[0]).not.toBe(Konva.stages[1]);

		await first.onClose();
		await settle();

		// Closing one leaves the other alive: nothing about the first was shared.
		expect(Konva.stages).toHaveLength(1);
		await second.onClose();
	});

	it('adds the container class the stylesheet resets pane padding through', async () => {
		const view = await opened();

		expect(view.containerEl.classList.contains('renovation-planner-container')).toBe(true);
		await view.onClose();
	});

	/**
	 * `PlanEditorContext.closeLeaf`, at the seam that supplies it.
	 *
	 * The tree gets a narrow callback and the VIEW is what holds the `WorkspaceLeaf` — the same
	 * shape `onPlanChanged` already had, and the reason `onThemeChange` gives for not handing
	 * the `Workspace` down. This is the only place that binding is observable: `PlanEditorRoot`
	 * can be asked whether it CALLED `closeLeaf`, and only here can it be asked whether calling
	 * it closes anything.
	 */
	it('closes its own leaf when the dangling-plan action is pressed', async () => {
		// Driven through the RENDERED button rather than by reaching for the provided context:
		// the binding is only worth anything if the whole chain works, and this is the one place
		// the far end of it — an actual `WorkspaceLeaf` — exists to be checked.
		// `planEditorFailure.test.ts` covers which of the two meanings the button carries.
		const leaf = new FakeLeaf();
		const view = makeView(leaf, null);
		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
		await view.onOpen();
		await settle();

		const action = view.contentEl.querySelector<HTMLButtonElement>('.rp-view-failure__action');
		expect(action).not.toBeNull();
		expect(leaf.detached).toBe(0);

		action?.click();
		await settle();

		expect(leaf.detached).toBe(1);
	});
});

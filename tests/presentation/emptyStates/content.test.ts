/**
 * The registry, and the two claims about it a compiler cannot make.
 *
 * The compiler already guarantees that every value here is a `StringKey`, so a key with no
 * `en.ts` entry fails the build rather than this suite. What it cannot check is that the two
 * Plan Editor entries resolve to DIFFERENT copy: a registry mapping both to one key would
 * type-check perfectly and tell a user with a background and no zones to import a plan.
 */
import { describe, expect, it } from 'vitest';
import { EMPTY_STATE_CONTENT } from '../../../src/presentation/emptyStates/content';
import { t } from '../../../src/presentation/i18n/strings';

const LANGUAGES = ['en', 'de'] as const;

describe('the empty-state content registry', () => {
	/**
	 * Design slice 21 added the fourth entry, `renovationProject.noPlans`. Only the ROLL CALL
	 * moves here: the assertion that its action label is present, and the axe scan that grades
	 * the button, are Task 10's — this case exists so that an entry cannot arrive without any
	 * test naming it at all.
	 */
	it('holds exactly the six entries the slices name', () => {
		expect(Object.keys(EMPTY_STATE_CONTENT.renovationProject)).toEqual(['noProjects', 'noPlans']);
		expect(Object.keys(EMPTY_STATE_CONTENT.planEditor)).toEqual(['noBackground', 'noZones']);
		// Design slice B3's third group. `assetDesigner` and not `designer`: the surface is one
		// of three now, and a group named for the room rather than for the subject reads as the
		// only one there is.
		expect(Object.keys(EMPTY_STATE_CONTENT.assetDesigner)).toEqual(['noShape', 'noBackground']);
	});

	/**
	 * **BOTH designer entries ship buttonless, and the two absences have different owners.**
	 *
	 * The increment plan's Task B3 says only `noBackground` is buttonless — "`assetDesigner.
	 * noShape` carries an action that opens the dimensions form". Nothing in this plugin opens
	 * one for the asset ALREADY OPEN: `NewAssetForm` creates a different asset, and Task B8's
	 * own Step 1a says in as many words that the dimensions dialog is built there and that
	 * "nothing in this plan built one until this step". So a button here today would be exactly
	 * the live control that does nothing slice 14's Amendment 1 refuses.
	 *
	 * Asked with `in` rather than by reading the property, for the reason the `planEditor`
	 * case below gives: the entries are literals with no `actionLabel`, so their TYPE has no
	 * such key and the read does not compile. The type is the stronger guarantee; this keeps
	 * the runtime assertion so that B7 (`noBackground`) and B8 (`noShape`) each flip a real
	 * test rather than closing a gap quietly.
	 */
	it.each(['noShape', 'noBackground'] as const)(
		'gives the designer\u2019s %s state no action, because what it hands off to is not built yet',
		(key) => {
			expect('actionLabel' in EMPTY_STATE_CONTENT.assetDesigner[key]).toBe(false);
		},
	);

	/**
	 * The same distinctness claim the two `planEditor` entries carry, and for a sharper reason
	 * here: an asset with no shape and no spec sheet is one click from both states, so a
	 * registry pointing them at one key would type-check perfectly and tell a user reaching for
	 * a background that they have no footprint.
	 */
	it.each(LANGUAGES)('resolves the two asset-designer entries to distinct copy in %s', (language) => {
		const { noShape, noBackground } = EMPTY_STATE_CONTENT.assetDesigner;

		expect(t(language, noShape.headline)).not.toBe(t(language, noBackground.headline));
		expect(t(language, noShape.body)).not.toBe(t(language, noBackground.body));
	});

	/**
	 * Amendment 1 held while `noProjects` had no hand-off. Design slice 16 built one —
	 * `ViewRoot` opens `NewProjectForm` in slice 15's `FormDialog` — so this is now the
	 * opposite assertion, updated rather than deleted: adding a label was always meant to be
	 * a deliberate, tested change, and this is that change.
	 */
	it('gives the no-projects state an action, because slice 16 built what it hands off to', () => {
		const content = EMPTY_STATE_CONTENT.renovationProject.noProjects;

		expect(content.actionLabel).toBeDefined();
		// Non-empty resolved copy, not just a declared key: `''` would render a nameless
		// button, which is both a control that says nothing and an axe `button-name` failure.
		expect(t('en', content.actionLabel)).not.toBe('');
	});

	/**
	 * The same assertion for design slice 21's entry, and it is the same SHAPE rather than the
	 * same story: `noProjects` grew its button a slice after it shipped, while `noPlans` carried
	 * one from its first commit — `ProjectDetail` hands `EmptyState`'s `action` straight to
	 * `ProjectDetailState.onCreatePlan`, which opens `NewPlanForm` and dispatches the real
	 * `CreatePlanCommand`. So this is not a flip of an earlier absence; it is the assertion that
	 * REMOVING the label has to face, since slice 14's Amendment 1 makes a button here a
	 * deliberate, tested decision in either direction.
	 */
	it('gives the no-plans state an action, because slice 21 built what it hands off to', () => {
		const content = EMPTY_STATE_CONTENT.renovationProject.noPlans;

		expect(content.actionLabel).toBeDefined();
		// Non-empty resolved copy, not just a declared key: `''` would render a nameless button,
		// which is both a control that says nothing and an axe `button-name` failure — the exact
		// rule `tests/harness/accessibility.test.ts` grades this button against.
		expect(t('en', content.actionLabel)).not.toBe('');
	});

	/**
	 * Amendment 1 covers `noBackground` too, unchanged from slice 14: its hand-off is slice
	 * 5's `set-plan-background` plugin command, which is not a member of
	 * `PlanEditorCommandServices` — the editor's Vue tree cannot reach it without either
	 * widening `PlanEditorContext` or reaching for the global `app`, both refused. `noZones`
	 * is the only entry left with a button, because its hand-off
	 * (`activeToolId = 'draw-polygon'`) already exists and is reachable from here.
	 */
	it('gives noBackground no action label, since its hand-off is unreachable from the editor tree', () => {
		// Asked with `in` rather than by reading the property: the registry entry is a literal
		// with no `actionLabel`, so its TYPE has no such key and the read does not compile. That
		// the type already forbids it is the stronger guarantee; this keeps the runtime assertion
		// so that widening the entry still has to face a red test rather than closing quietly.
		expect('actionLabel' in EMPTY_STATE_CONTENT.planEditor.noBackground).toBe(false);
	});

	it('gives noZones an action label, since its hand-off already exists', () => {
		expect(EMPTY_STATE_CONTENT.planEditor.noZones.actionLabel).toBeDefined();
	});

	it.each(LANGUAGES)('resolves the two plan-editor entries to distinct copy in %s', (language) => {
		const { noBackground, noZones } = EMPTY_STATE_CONTENT.planEditor;

		expect(t(language, noBackground.headline)).not.toBe(t(language, noZones.headline));
		expect(t(language, noBackground.body)).not.toBe(t(language, noZones.body));
	});

	it.each(LANGUAGES)('resolves every declared key to a non-empty string in %s', (language) => {
		const entries = [
			EMPTY_STATE_CONTENT.renovationProject.noProjects,
			// Design slice 21. Listed here rather than left to the roll call above, which counts
			// KEYS: an entry can be named there and still point at a locale key `de.ts` renders
			// as `''`, and `strings.test.ts`'s completeness check reads the key SET rather than
			// the values it resolves to.
			EMPTY_STATE_CONTENT.renovationProject.noPlans,
			EMPTY_STATE_CONTENT.planEditor.noBackground,
			EMPTY_STATE_CONTENT.planEditor.noZones,
			// Design slice B3. `noBackground` is here even though nothing SELECTS it yet
			// (`selectAssetDesignerEmptyState` cannot, until Task B7 gives `AssetDesignDto` a
			// background field): the copy ships now, so B7 adds a selector arm and an action
			// label rather than a whole entry and four locale keys.
			EMPTY_STATE_CONTENT.assetDesigner.noShape,
			EMPTY_STATE_CONTENT.assetDesigner.noBackground,
		];

		for (const entry of entries) {
			expect(t(language, entry.headline).length).toBeGreaterThan(0);
			expect(t(language, entry.body).length).toBeGreaterThan(0);
		}

		// The three entries whose `actionLabel` is present in the literal type (not optional), so
		// these are unconditional rather than a re-check of the branch above. `noPlans` is here
		// as well as in its own case above, because that one asks `en` alone — a German action
		// label resolving to `''` would draw a nameless button for exactly the users this plugin
		// ships a `de.ts` for.
		expect(t(language, EMPTY_STATE_CONTENT.planEditor.noZones.actionLabel).length).toBeGreaterThan(0);
		expect(t(language, EMPTY_STATE_CONTENT.renovationProject.noProjects.actionLabel).length).toBeGreaterThan(0);
		expect(t(language, EMPTY_STATE_CONTENT.renovationProject.noPlans.actionLabel).length).toBeGreaterThan(0);
	});
});

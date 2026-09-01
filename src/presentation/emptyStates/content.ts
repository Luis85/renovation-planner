import type { StringKey } from '../i18n/locales/en';

/**
 * What an empty state SAYS, as i18n keys rather than copy.
 *
 * Typing these `StringKey` rather than `string` is the whole mechanism: a key with no entry
 * in `en.ts` fails to compile, so "the registry and the locale tables agree" is a compiler
 * guarantee rather than a review item. PRD §94's requirement is stated for "every central
 * view", and `docs/requirements/Multilanguage.md` applies to every user-facing string, so an
 * English literal here would be the one surface in the plugin that could not answer either.
 *
 * A registry, not a switch statement in two components: a fourth entry (a future Budget or
 * Schedule view) is one object literal, never a new `if` chain in a template.
 */
export interface EmptyStateContent {
	readonly headline: StringKey;
	readonly body: StringKey;
	/**
	 * Absent means NO BUTTON, and `planEditor.noBackground` is now the only reason the field
	 * is optional rather than the exception to it. Its hand-off is slice 5's
	 * `set-plan-background` plugin command, which is not a member of
	 * `PlanEditorCommandServices`: the editor's Vue tree cannot reach it without either
	 * widening `PlanEditorContext` (slice 5's surface) or reaching for the global `app`, both
	 * refused. `renovationProject.noProjects` is NOT an example of this any more — design
	 * slice 16 built the form it hands off to, so it keeps the field like `planEditor.noZones`
	 * does, whose hand-off (`activeToolId = 'draw-polygon'`) already existed and was reachable
	 * from here. Design slice 21's `renovationProject.noPlans` is the third entry that carries
	 * one, and it carried one from its first commit: `ProjectDetailState.onCreatePlan` opens
	 * `NewPlanForm` in slice 15's `FormDialog` and dispatches the real `CreatePlanCommand`, so its button was
	 * never the dead control slice 14's Amendment 1 refuses. Design slice B3's two `assetDesigner`
	 * entries both ship WITHOUT one, for two different unbuilt hand-offs — a dimensions form
	 * for the open asset (Task B8) and a background picker (Task B7) — so the count is now
	 * THREE entries with a label and THREE without. This sentence is that list, so an entry
	 * added without appearing in it is the stale-comment defect this repository keeps paying
	 * for.
	 */
	readonly actionLabel?: StringKey;
}

export const EMPTY_STATE_CONTENT = {
	renovationProject: {
		/**
		 * The action arrived with design slice 16: `ViewRoot` opens `NewProjectForm` in
		 * slice 15's `FormDialog`. Until then this entry had no button on purpose, because
		 * the form it hands off to did not exist and slice 14's Amendment 1 refuses a live
		 * control that does nothing.
		 */
		noProjects: {
			headline: 'empty.project.no-projects.headline',
			body: 'empty.project.no-projects.body',
			actionLabel: 'empty.project.no-projects.action',
		},
		/**
		 * Design slice 21, and the entry that arrives WITH its action rather than growing one a
		 * slice later: `ProjectDetailState.onCreatePlan` opens `NewPlanForm` in slice 15's `FormDialog` and
		 * dispatches the real `CreatePlanCommand`, so the button is a live control from the first
		 * commit rather than the dead one slice 14's Amendment 1 refuses.
		 *
		 * It is drawn INSIDE `ProjectDetail`'s plans region rather than in place of the detail
		 * state, which is what lets it carry an action at all without taking the Back and Open note
		 * controls away with it — slice 14's own rule that an empty state replacing a region hides
		 * the thing the region exists to show.
		 */
		noPlans: {
			headline: 'empty.project.no-plans.headline',
			body: 'empty.project.no-plans.body',
			actionLabel: 'empty.project.no-plans.action',
		},
	},
	planEditor: {
		/**
		 * Checked BEFORE `noZones`, and the reason is PRD §93's onboarding order alone
		 * (Create Project -> Choose Folder -> Import First Plan -> Calibrate): the user is
		 * asked to do the first missing step rather than told about the second.
		 *
		 * Not because such a plan has no zones — it usually does here, since
		 * `create-sample-project` seeds five on a background-less plan. `selectors.ts`
		 * carries the full account; this comment used to repeat the same false premise, so
		 * fixing one site and not the other would have left it standing.
		 */
		noBackground: {
			headline: 'empty.plan.no-background.headline',
			body: 'empty.plan.no-background.body',
		},
		/**
		 * Deliberately distinct copy from `noBackground` — a plan WITH a background and no
		 * zones is a different, later stage of the same onboarding flow, not a variant
		 * wording of "nothing here yet". `content.test.ts` asserts the distinctness, because
		 * a registry pointing both at one key would type-check perfectly.
		 */
		noZones: {
			headline: 'empty.plan.no-zones.headline',
			body: 'empty.plan.no-zones.body',
			actionLabel: 'empty.plan.no-zones.action',
		},
	},
	/**
	 * Design slice B3 (ADR-0015), and the first group where BOTH entries ship buttonless.
	 *
	 * That is two separate deferrals rather than one rule, which is why they are written out
	 * here instead of counted. `noShape` hands off to a dimensions form for the asset ALREADY
	 * OPEN, and no such form exists: `NewAssetForm` creates a different asset, and Task B8's own
	 * step that builds one says "nothing in this plan built one until this step". `noBackground`
	 * hands off to Task B7's `BackgroundPicker` port, which is not written either. Slice 14's
	 * Amendment 1 refuses a live control that does nothing, so neither carries a label and
	 * `content.test.ts` asserts both absences by name.
	 *
	 * **`noBackground` is also the one entry in this whole registry that nothing SELECTS.**
	 * `selectAssetDesignerEmptyState` cannot reach it: `AssetDesignDto` has no background field
	 * until Task B7 adds it. The copy ships now so that B7 is a selector arm and an action label
	 * rather than a whole entry plus four locale keys; `selectors.test.ts` pins the gap with its
	 * reason attached, so it cannot be read as an oversight.
	 */
	assetDesigner: {
		noShape: {
			headline: 'empty.asset.no-shape.headline',
			body: 'empty.asset.no-shape.body',
		},
		noBackground: {
			headline: 'empty.asset.no-background.headline',
			body: 'empty.asset.no-background.body',
		},
	},
} as const satisfies Record<string, Record<string, EmptyStateContent>>;

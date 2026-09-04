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
	 * does, whose hand-off already existed and was reachable from here. That hand-off is
	 * `activateCreationEntry('room', runtime)` since the Add Room increment (2026-09-04) —
	 * `PlanEditorRoot.onEmptyStateAction`, the ONE door the Add menu's own Room item takes,
	 * which arms `'draw-room'`. It said `activeToolId = 'draw-polygon'` here until that
	 * increment, which had been true and named a tool no control in the Plan Editor reaches
	 * any more. Design slice 21's `renovationProject.noPlans` is the third entry that carries
	 * one, and it carried one from its first commit: `ProjectDetailState.onCreatePlan` opens
	 * `NewPlanForm` in slice 15's `FormDialog` and dispatches the real `CreatePlanCommand`, so its button was
	 * never the dead control slice 14's Amendment 1 refuses. Task B7 gave `assetDesigner.noBackground`
	 * its own action — the `BackgroundPicker` port it hands off to — and Task B8 has now given
	 * `assetDesigner.noShape` its own too, the `asset-dimensions` dialog `AssetDesignerRoot`'s
	 * `editDimensions` opens. Design "Asset library overview" §4 then added a THIRD group,
	 * `assetLibrary`, and both of ITS entries carry one from their first commit too —
	 * `noAssets` hands off to the toolbar's own `New asset`, `noMatches` to clearing the search
	 * field. So the count is SEVEN entries with a label and ONE without: `planEditor.noBackground`,
	 * for the reason above. This sentence is that list, so an entry added without appearing in
	 * it is the stale-comment defect this repository keeps paying for — and the seven and the
	 * one were RE-DERIVED from `EMPTY_STATE_CONTENT` below rather than carried forward, on
	 * 2026-09-05, in the edit that corrected `noZones`'s hand-off above
	 * (`grep -c "actionLabel: '"` prints 7 against `grep -c "headline: '"`'s 8). A count read off
	 * the record is the only kind this paragraph is entitled to state.
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
	 * Design slice B3 (ADR-0015). `noShape` shipped buttonless through Task B7: it hands off to
	 * a dimensions form for the asset ALREADY OPEN, and no such form existed yet — `NewAssetForm`
	 * creates a DIFFERENT asset. **Task B8 built one and this now carries its action** — the
	 * `asset-dimensions` dialog `AssetDesignerRoot.editDimensions` opens — which is the flip
	 * `content.test.ts` makes a real assertion rather than closing quietly, per slice 14's
	 * Amendment 1: a label is added only once something can act on it.
	 *
	 * **`noBackground` carries its action since Task B7**, whose `BackgroundPicker` port is what
	 * the button now opens — `selectAssetDesignerEmptyState` gained the arm that selects this
	 * entry in the same task, so this is not a label added ahead of anything that can act on it.
	 */
	assetDesigner: {
		noShape: {
			headline: 'empty.asset.no-shape.headline',
			body: 'empty.asset.no-shape.body',
			actionLabel: 'empty.asset.no-shape.action',
		},
		noBackground: {
			headline: 'empty.asset.no-background.headline',
			body: 'empty.asset.no-background.body',
			actionLabel: 'empty.asset.no-background.action',
		},
	},
	/**
	 * Design "Asset library overview" §4. Both entries carry an action, and the two differ in
	 * KIND rather than merely in wording: `noAssets`'s action CREATES something (`New asset`,
	 * the same toolbar gesture the surface already has), while `noMatches`'s action RESTORES
	 * the previous view by clearing the search field — a create action offered from a
	 * no-matches state would be the wrong gesture, per §4's own table.
	 *
	 * Replaces the shelves region alone (§4: "Replaces the shelves region, not the shell: the
	 * toolbar and status bar stay"), which is this registry's `renovationProject`/`planEditor`
	 * pattern applied a third time — the region an empty state replaces is a rendering decision
	 * the component makes, never a fact this record carries.
	 */
	assetLibrary: {
		noAssets: {
			headline: 'empty.asset-library.no-assets.headline',
			body: 'empty.asset-library.no-assets.body',
			actionLabel: 'empty.asset-library.no-assets.action',
		},
		noMatches: {
			headline: 'empty.asset-library.no-matches.headline',
			body: 'empty.asset-library.no-matches.body',
			actionLabel: 'empty.asset-library.no-matches.action',
		},
	},
} as const satisfies Record<string, Record<string, EmptyStateContent>>;

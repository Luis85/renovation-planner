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
	 * from here.
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
} as const satisfies Record<string, Record<string, EmptyStateContent>>;

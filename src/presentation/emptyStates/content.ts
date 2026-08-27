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
	 * Absent means NO BUTTON, and `renovationProject.noProjects` and `planEditor.noBackground`
	 * are why the field is optional rather than the exception to it. `noProjects`'s hand-off is
	 * slice 16's project-creation form, which depends on slice 11 — so a button here would
	 * either do nothing or be a second, independently-decided way to create a project.
	 * `noBackground`'s hand-off is slice 5's `set-plan-background` plugin command, which is not
	 * a member of `PlanEditorCommandServices`: the editor's Vue tree cannot reach it without
	 * either widening `PlanEditorContext` (slice 5's surface) or reaching for the global `app`,
	 * both refused. `planEditor.noZones` is the only entry that keeps this field, because its
	 * hand-off (`activeToolId = 'draw-polygon'`) already exists and is reachable from here.
	 */
	readonly actionLabel?: StringKey;
}

export const EMPTY_STATE_CONTENT = {
	renovationProject: {
		noProjects: {
			headline: 'empty.project.no-projects.headline',
			body: 'empty.project.no-projects.body',
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

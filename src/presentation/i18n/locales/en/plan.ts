export const planEn = {
	'plan.none': 'This vault has no renovation plans yet.',
	// Design slice 21's New plan form, keyed by the exact code `Plan.create` raises — minted
	// through `planError`'s `plan.${code}` template (`src/domain/plan/Plan.errors.ts`), so a
	// grep for the whole string finds nothing. A missing entry here does not degrade to
	// silence, it degrades to the generic Validation sentence under a field the user can see.
	//
	// `plan.project-not-found` gets no entry and needs none: `NewPlanForm` never routes it to
	// a field or to a banner — the project is gone, so the form emits `projectGone` and the
	// view notifies and navigates. The three background codes `Plan.create` also mints have no
	// entry for the plainer reason: that form sends no background.
	'plan.empty-name': 'A plan needs a name.',
	'plan.background-not-found': 'That file is no longer in the vault. Choose another plan document.',
	// CreatePlanCommand's detail-plan parent guard (ADR-0028): the zone's own plan, project or
	// zone raced away between the zone context menu opening and New detail plan being
	// dispatched. "Room or area" rather than "zone", per ADR-0016's homeowner split.
	'plan.parent-plan-not-found': 'The room or area this plan would detail no longer has a plan of its own.',
	'plan.parent-project-mismatch': 'That plan belongs to a different project.',
	'plan.parent-zone-not-found': 'That room or area is no longer on its plan.',
	'plan.nothing-to-undo': 'Nothing to undo yet.',
	// Design slice 21's plan rows grew a Delete. `delete-plan-label` is the icon-only button's
	// whole accessible name, so it NAMES the plan; the three refusal codes below are
	// `DeletePlanCommand`'s, and `{names}` is filled from `namedReferenceError`'s own field.
	'plan.rooms-exist': 'This plan still holds rooms: {names}. Delete them in the plan editor first.',
	'plan.detail-plans-exist': 'This plan is the parent of detail plans: {names}. Delete those first.',
	'plan.referents-unreadable':
		'Some notes under this plan could not be read, so it cannot be confirmed empty. Fix or remove them first.',
	'view.project.delete-plan-label': 'Delete plan {name}',
	'view.project.delete-plan-title': 'Delete plan?',
	'view.project.delete-plan-body': '{name} and its note will be deleted. This cannot be undone.',
	'view.project.delete-plan-confirm': 'Delete plan',
	'view.project.delete-plan-cancel': 'Keep plan',
};

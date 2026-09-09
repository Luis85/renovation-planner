export const enProjectNavigation = {
	'view.project.guidance-title': 'What would you like to do next?',
	'view.project.guidance-start-title': 'What would you like to start with?',
	'view.project.guidance-optional-plan': 'You can start with a note. A floor plan is optional.',
	'view.project.guidance-hide': 'Hide getting-started guidance',
	'view.project.guidance-show': 'Show getting-started guidance',
	'view.project.entry-note-title': 'Describe your renovation',
	'view.project.entry-note-body': 'Record what should change and which questions remain.',
	'view.project.entry-note-action': 'Open project note',
	'view.project.entry-plan-start-title': 'Start with a plan',
	'view.project.entry-plan-start-body': 'Draw a floor plan or use an available reference.',
	'view.project.entry-plan-create': 'Create first plan',
	'view.project.entry-plan-continue-title': 'Continue with a plan',
	'view.project.entry-plan-continue-body': 'Pick up where you left off, or open any plan below.',
	'view.project.entry-plan-open': 'Open {planName}',
	'view.project.entry-plan-choose': 'Choose a plan',
	'view.project.entry-prices-title': 'Set project prices',
	'view.project.entry-prices-body': 'Add your own prices when you know them.',
	'view.project.prices-open': 'View prices',
	'view.project.prices-back': 'Back to project',

	// The keys below live HERE rather than beside their siblings in `en.ts` for one mechanical
	// reason: that file is AT its 400-line `max-lines` budget, and `StringKey` derives from the
	// spread either way, so a caller cannot tell which file answered.

	// The launcher's total-refusal banner, the counterpart of `view.project.some-unreadable`:
	// every project note refused, so the list has no rows to draw beside the notice.
	'view.project.all-unreadable': 'Projects could not be read.',
	// The detail state's counterpart of `view.project.some-plans-unreadable`, same relationship.
	'view.project.all-plans-unreadable': 'Plans could not be read.',
	// The detail state's in-flight line, distinct from `view.project.loading`, which is the
	// LAUNCHER's ("Loading projects…"): one names what it is reading, the other is already
	// inside a project and has its name on screen.
	'view.project.detail-loading': 'Loading…',
	// The recovery screen a resume lands on when the plan it named is gone — the way on that
	// `view.project.resume-missing-plan` stopped carrying.
	'view.project.recovery-title': 'Choose another plan',
	'view.project.recovery-body': 'You can continue with one of the existing plans, or create a new one.',
	// The price row's three read-only labels and its edit action. `Used price` is the value
	// actually applied — the override where one is set, the catalogue price otherwise — which is
	// the figure neither `price-catalogue` nor `price-yours` states on its own.
	'view.project.price-used': 'Used price',
	'view.project.price-unsaved': 'Unsaved',
	'view.project.price-saved': 'Saved',
	'view.project.price-edit': 'Edit',
	// The plans section's heading. `view.project.plans-title` is the bare noun; this is the
	// counted form, so the region states how many without a second line to say it.
	'view.project.plans-count': 'Plans ({count})',
	// P00's wide-width column headings, drawn only where the pane is wide enough for a table.
	// P04's price table: the heading over the asset NAME column, and the resting label a row
	// with no override carries beside its `Set project price` action. Both are in the P04
	// mockup and in no row of `ui-copy.md`, which is why they arrive here rather than there.
	'view.project.column-asset': 'Asset',
	'view.project.price-none': 'No project price',
	'view.project.column-project': 'Project',
	'view.project.column-plans': 'Plans',
	'view.project.column-currency': 'Currency',
	'view.project.column-status': 'Status',
	'view.project.column-last-worked': 'Last worked',
} as const;

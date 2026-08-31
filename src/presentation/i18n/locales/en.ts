/**
 * The English table is the COMPLETE one: a key exists because this file answers it, and
 * `StringKey` derives from here, so the compiler demands English before a caller can
 * name a key. The file is named `en.ts` because that is the filename the obsidianmd
 * ruleset's locale rules match — sentence case in this table is linted, not reviewed.
 */
export const en = {
	'command.open-project': 'Open renovation project',
	'command.open-project-detail': 'Go to renovation project',
	'view.project.name': 'Renovation project',
	'settings.units.name': 'Units',
	'settings.units.desc': 'Measurement system for quantities and dimensions.',
	'settings.units.metric': 'Metric',
	'settings.units.imperial': 'Imperial',
	'settings.project-folder.name': 'Default projects folder',
	'settings.project-folder.desc':
		'Vault folder where a new project’s folder is created. An existing project keeps the folder it is already in.',
	'settings.library-folder.name': 'Library folder',
	'settings.library-folder.current': 'Currently {folder}. Changing this moves the notes.',
	'settings.library-folder.move.name': 'Move the library',
	'settings.library-folder.move.desc': 'Choose a new folder and move the catalogue into it.',
	'settings.default-currency.name': 'Default currency',
	'settings.default-currency.desc':
		'The currency a new project is priced in. A project that has not recorded one follows this setting.',
	'settings.verbose-logging.name': 'Verbose logging',
	'settings.verbose-logging.desc': 'Show debug-level messages in the developer console. Everything stays on this device.',
	'view.geometry.name': 'Geometry sidecar',
	'settings.unrecovered': 'Settings could not be read. Fix or remove data.json in the plugin folder, then reload the app.',
	'view.plan-editor.name': 'Plan editor',
	'command.open-plan-editor': 'Open plan editor',
	'command.set-plan-background': 'Set plan background',
	'command.create-sample-project': 'Create sample renovation project',
	'plan.none': 'This vault has no renovation plans yet.',
	'sample.project.name': 'Sample renovation',
	'sample.plan.name': 'Ground floor',
	'sample.zone.kitchen': 'Kitchen',
	'sample.zone.bathroom': 'Bathroom',
	'sample.zone.living-room': 'Living room',
	'sample.zone.terrace': 'Terrace',
	'sample.zone.garden': 'Garden',
	'editor.toolbar': 'Editor tools',
	'editor.layers': 'Layers',
	'editor.toolbar.pan': 'Pan',
	'editor.toolbar.select': 'Select',
	'editor.toolbar.draw-zone': 'Draw zone',
	'editor.toolbar.undo': 'Undo',
	'editor.toolbar.redo': 'Redo',
	'editor.toolbar.calibrate': 'Calibrate',
	'editor.inspector': 'Inspector',
	'editor.inspector.empty': 'Nothing selected.',
	'editor.inspector.multiple': 'Multiple objects selected.',
	'editor.inspector.name': 'Name',
	'editor.inspector.area': 'Area',
	'editor.inspector.delete-zone': 'Delete zone',
	'editor.inspector.requirements': 'Requirements',
	'editor.inspector.requirements.empty': 'No requirements reference this zone yet.',
	'editor.inspector.requirement.asset': 'Asset',
	'editor.inspector.requirement.quantity': 'Quantity',
	'editor.inspector.requirement.cost': 'Cost',
	'editor.inspector.requirement.overridden': 'Overridden',
	'editor.inspector.requirement.stale': 'Figures are out of date; recalculate this requirement.',
	'editor.inspector.requirement.missing-asset': 'Asset missing from the catalog.',
	'editor.inspector.assign.label': 'Assign asset',
	'editor.inspector.assign.button': 'Assign',
	'editor.inspector.quantity-override.label': 'Override quantity for',
	'editor.inspector.cost-override.label': 'Override cost for',
	'editor.inspector.override.reset': 'Reset to calculated',
	'editor.inspector.delete-zone.reassign-title': 'Move these requirements to which zone?',
	'sequence.marker-clear-failed': 'The delete was saved, but its recovery record could not be cleared from the vault. It is cleared the next time this vault opens.',
	'cascade.stale-marker-failed': 'A requirement could not be marked out of date. Its figures may be wrong until it is recalculated.',
	'cascade.aborted': 'Requirements linked to this change could not be updated. Their figures may be out of date.',
	'editor.zone.default-name': 'Zone',
	'editor.canvas': 'Plan canvas',
	'editor.status': 'Status',
	'editor.measurements': 'Measurements',
	'editor.save-state': 'Save state',
	'editor.zoom': 'Zoom',
	/**
	 * The angle constraint, announced because a modifier nothing mentions is a feature only
	 * its author knows about — the one real cost of the modifier-driven convention every
	 * drawing tool uses, and the reason the status bar carries this while a drawing tool is
	 * active. Deliberately not a numeric angle readout, which is what CAD shows beside its
	 * tracking line: `t()` takes no parameters, so the first interpolated string in this
	 * plugin is a piece of work of its own.
	 *
	 * Phrased with the key first because the marketplace's sentence-case rule
	 * (`obsidianmd/ui/sentence-case-locale-module`) refuses a capitalised `Shift` mid-sentence
	 * — measured, it fails the build — and lowercasing the name of a key is worse copy than
	 * leading with it.
	 */
	'editor.hint.constrain-angle': 'Shift constrains the angle',
	'editor.loading': 'Loading plan…',
	'editor.background-missing': 'The background file for this plan is missing.',
	'editor.background-failed': 'The background for this plan could not be rendered.',
	'editor.layer.background': 'Background',
	'editor.layer.architecture': 'Architecture',
	'editor.layer.zone': 'Zones',
	'editor.layer.construction': 'Construction',
	'editor.layer.asset': 'Assets',
	'editor.layer.annotation': 'Annotations',
	'editor.layer.interaction': 'Interaction',
	'editor.calibrate.distance.title': 'Set the real-world distance',
	'editor.calibrate.distance.label': 'Distance in millimetres',
	'editor.calibrate.distance.measured': 'Measured on the plan:',
	'editor.calibrate.recalibrate.title': 'Rescale the zones on this plan?',
	'editor.calibrate.recalibrate.message': 'This plan already has zones drawn on it. Setting the scale rescales every one of them. You can undo it.',
	'background.no-plan-open': 'Open a plan editor first.',
	'background.unsupported': 'Only PNG, JPEG and PDF files can be a plan background.',
	'zone.status.planned': 'Planned',
	'zone.status.in-progress': 'In progress',
	'zone.status.complete': 'Complete',
	'zone.status.unknown': 'Unknown status',
	// Error copy (slice 11). Keyed by `AppError.code`, by a closed set of dynamic-code
	// suffixes, and by category — never by the error's own `message`, which is log text.
	'vault.unexpected-failure': 'Reading or writing the vault failed unexpectedly. Try again.',
	'migration.chain-gap': 'This note uses a format this plugin cannot read.',
	// Design slice 10's reference-integrity and requirement refusals. Each earns an entry
	// because its CATEGORY sentence is wrong or unactionable for it: the two Reference
	// refusals below are about an entry that emphatically still exists, and every
	// Validation one would otherwise read 'This data is not in the expected form.' about a
	// decision the user just made. Fixed sentences, no interpolation and no count — the
	// delete dialog enumerates the referents; the notice is the refusal.
	//
	// EVERY KEY HERE MUST EQUAL A MINTED `AppError.code` EXACTLY, and only half of that
	// paragraph is checkable, so only half is claimed. `StringKey` is `keyof typeof en`,
	// which admits any key at all: a misspelt one is translated in `de.ts`, satisfies
	// `tests/presentation/i18n/strings.test.ts`, and then never resolves — the user is
	// back on the category sentence, silently, which is the exact defect these entries
	// were added to remove. `tests/presentation/i18n/toUserMessage.test.ts` drives all
	// nine from a table copied off the RAISE SITES and asserts each resolves to its own
	// copy rather than to its category's. What no test can settle is the judgement in the
	// first sentence — that the category sentence is *wrong* for a given code — and that
	// stays a matter for review.
	'reference.referents-exist': 'Other entries still reference this. Remove or reassign them first.',
	'reference.set-changed': 'The references to this changed while you were deciding. Check them and confirm again.',
	'reference.resolution-required': 'This is still referenced. Decide what happens to those references before deleting it.',
	'reference.no-reassignment-target': 'There is no other zone in this project to reassign these requirements to.',
	'reference.self-reassign': 'References cannot be reassigned to the entry being deleted. Pick a different one.',
	'reference.cross-project-reassign': 'References can only be reassigned within the same project.',
	// The delete dialog's reference rows (slice 15 item 6), one row per project. TWO keys
	// rather than one plus a hand-built separator: word order and the punctuation around an
	// interpolated name are the translator's to choose ([[Multilanguage]]). The path form is
	// used only for a group whose project name `ListRequirementsReferencing` found ambiguous
	// among the groups it answered, and only when that project could be placed.
	'reference.row.project': '{name}',
	'reference.row.project-at-path': '{name} — {path}',
	'requirement.unit-not-area': 'This asset is not measured by area, so a zone area cannot drive its quantity.',
	'requirement.negative-quantity': 'A quantity cannot be negative.',
	// The row's own parse guard (design slice 16), not an `AppError` code: `Number('abc')`
	// and a malformed money literal never reach a dispatch, so there is no raised code for
	// `routeError` to place. Keyed by the field rather than by any code for that reason.
	'error.requirement.quantity.unparseable': 'Enter a number, or reset to the calculated figure.',
	'error.requirement.cost.unparseable': 'Enter an amount, or reset to the calculated figure.',
	'error.suffix.schema-version-unsupported':
		'This note was written by a newer version of this plugin. Update the plugin to open it.',
	'error.suffix.revision-conflict': 'This entry changed elsewhere in the meantime. Reload and try again.',
	'error.suffix.external-modification': 'This entry was edited outside the plugin. Reload and try again.',
	'error.suffix.migration-failed': 'This note could not be converted to the current format.',
	'error.category.domain': 'Something about the project data is invalid.',
	'error.category.validation': 'This data is not in the expected form.',
	'error.category.persistence': 'The vault could not be read or written.',
	'error.category.geometry': 'A geometry value is invalid.',
	'error.category.import': 'Importing failed.',
	'error.category.migration': 'This note cannot be read with this version of the plugin.',
	'error.category.reference': 'That entry no longer exists.',
	'error.category.calculation': 'A quantity could not be calculated.',
	'dialog.confirm': 'Confirm',
	'dialog.cancel': 'Cancel',
	'dialog.delete-reference.referenced-by': 'Referenced by',
	'dialog.delete-reference.remove-references': 'Remove references',
	'dialog.delete-reference.reassign': 'Reassign',
	'dialog.delete-reference.delete-anyway': 'Delete anyway',
	'dialog.entity-picker.empty': 'Nothing to choose from.',
	'dialog.form.submit': 'Save',
	'notice.severity.success': 'Success',
	'notice.severity.info': 'Information',
	'notice.severity.warning': 'Warning',
	'notice.severity.error': 'Error',
	'notice.dismiss': 'Dismiss',
	'empty.project.no-projects.headline': 'No renovation projects yet',
	'empty.project.no-projects.body': 'A renovation project holds your plans, zones, assets and costs. Create one to get started.',
	'empty.plan.no-background.headline': 'No plan document yet',
	'empty.plan.no-background.body': 'Set a floor plan, site plan, sketch or garden plan as this plan\u2019s background, then calibrate it so areas come out in real units.',
	'empty.plan.no-zones.headline': 'No zones yet',
	'empty.plan.no-zones.body': 'Draw the first zone on this plan. Its area is measured from the outline and drives the quantities and costs of anything you assign to it.',
	'empty.plan.no-zones.action': 'Draw a zone',
	// Design slice 17's in-place failure states. The BODY of each is `trError(error)` — the
	// mapped sentence for that error's own code — so unrecovered settings and a vault fault say
	// different things; only the headline and the action label are fixed copy here.
	'view.failure.retry': 'Try again',
	'view.project.failed.headline': 'Projects could not be loaded',
	'editor.plan-failed.headline': 'This plan could not be loaded',
	// The dangling-reference state: not an error at all, so it carries its own body rather than
	// a mapped one. `GetPlan` succeeded and correctly reported that no plan resolves.
	'editor.refresh-failed': 'This plan could not be re-read after the last change; what you see may be out of date.',
	'editor.plan-missing.headline': 'This plan no longer exists',
	'editor.plan-missing.body': 'This tab points at a plan that is not in the vault any more.',
	'editor.plan-missing.action': 'Close this tab',
	// The bootstrap failure, which takes NO action: nothing that reads a configured location was
	// composed, so there is nothing to re-run, and slice 1 already refused a repair UI. What to
	// fix lives in the settings tab.
	'view.session-failure.headline': 'Renovation planner could not start',
	'view.project.loading': 'Loading projects…',
	// No second sentence pointing at a diagnostics report: `GetDiagnosticsSnapshotQuery` is
	// composed and consumed by nobody — no command, no settings entry, no view — so "open the
	// diagnostics report" was an instruction the user cannot follow. Slice 14's Amendment 1
	// refuses a button that does nothing; a sentence that does nothing is the same defect.
	'view.project.some-unreadable': 'Some projects could not be read from the vault.',
	'form.new-project.title': 'New renovation project',
	'form.new-project.name': 'Name',
	'form.new-project.status': 'Status',
	'form.new-project.description': 'Description',
	'form.new-project.start': 'Start',
	'form.new-project.target-completion': 'Target completion',
	// One label per `ProjectStatus` (PRD §35's Renovation Lifecycle), so the status control
	// shows real copy rather than the raw enum member — `PROJECT_STATUS_LABELS`
	// (`src/presentation/views/projectStatusLabels.ts`) is the binding, and
	// `projectStatusLabels.test.ts` requires every member of `PROJECT_STATUSES` to resolve
	// one of these. Ordinary UI labels, not `AppError` codes — the "a key must equal a
	// minted code" rule below applies to the error block alone.
	'form.new-project.status.idea': 'Idea',
	'form.new-project.status.survey': 'Survey',
	'form.new-project.status.design': 'Design',
	'form.new-project.status.estimate': 'Estimate',
	'form.new-project.status.procurement': 'Procurement',
	'form.new-project.status.ready': 'Ready',
	'form.new-project.status.execution': 'Execution',
	'form.new-project.status.inspection': 'Inspection',
	'form.new-project.status.complete': 'Complete',
	'form.new-project.status.as-built': 'As built',
	'empty.project.no-projects.action': 'Create a project',
	'view.project.list-title': 'Renovation projects',
	'view.project.create': 'New project',
	// Design slice 21's detail state. `Back to projects` names its DESTINATION rather than
	// saying `Back`: this pane has one other state and a label that says which one it returns to
	// is what stops the control reading as browser history. `Open note` is the secondary action —
	// the row itself navigates now, and `Project.md` stays reachable because nothing else routes
	// to a project's own metadata.
	'view.project.back': 'Back to projects',
	'view.project.open-note': 'Open note',
	'view.project.plans-title': 'Plans',
	'view.project.create-plan': 'New plan',
	// Design slice 21's creation form. One field, so one label — `background` and `layers` are
	// both optional on `CreatePlanInput` and this form sends neither: slice 5's background is
	// its own command, and a plan without one is a state the editor already draws.
	'form.new-plan.title': 'New plan',
	'form.new-plan.name': 'Name',
	// Design slice 21's detail state, its one empty state and its one refusal that reaches the
	// user as a notice rather than as a banner. `No plans yet` is deliberately distinct copy from
	// `empty.project.no-projects.*`: a project with no plans is a later stage of the same
	// onboarding than a vault with no projects. **Nothing checks that distinctness**, and an
	// earlier draft of this comment said `content.test.ts` did: its only distinctness case is
	// scoped to the two `planEditor` entries, and Task 10 as planned adds none for these two.
	// A registry pointing both at one key would type-check perfectly and no gate would notice.
	'empty.project.no-plans.headline': 'No plans yet',
	'empty.project.no-plans.body': 'Add a plan to start drawing zones and working out quantities.',
	// The same words as `view.project.create-plan`, and the same gesture: the plans region draws
	// exactly one of the two controls, so a user never sees both at once.
	'empty.project.no-plans.action': 'New plan',
	// The HEADLINE of the screen a project that is not there draws — reached from a read that
	// missed once the index scan has run, from `CreatePlanCommand`'s `plan.project-not-found`
	// while its New plan form was open, and from a back-arrow restore of a project since
	// deleted. It was ALSO a notice on the second of those, back when that path redirected to
	// the list and a banner had nowhere to live; the redirect is retired and the notice with
	// it, since the two resolved this same key and would have said one sentence twice at once.
	'view.project.gone': 'This project no longer exists.',
	// The BODY beneath that headline. It exists because a `'gone'` status used to render the
	// loading line — a false sentence with no Back and no retry, recoverable only by closing
	// the leaf — which is what the screen replaced.
	'view.project.gone-body': 'It may have been deleted or moved out of this vault. Go back to the project list.',
	// PRD §83's third enforcement site, and the only one with no door to refuse at: a
	// project's folder is DERIVED from where its own note sits (ADR-0013), so a user moves
	// it by dragging in Obsidian's file explorer and no command is dispatched. This row is
	// the whole of what they are told, so it states the FACT rather than an instruction —
	// the remedy is to move one of the two folders, and which one is theirs to decide.
	'view.project.library-overlap': 'Overlaps the library folder',
	// Design slice 16's creation form. Keyed by the exact `AppError.code` `Project.create`
	// raises (`src/domain/project/Project.ts`) — never `error.project.<name>` — for the same
	// reason the slice 10 block above states: `toUserMessage`'s exact-match lookup is
	// `error.code in en`, so a differently-spelled key would silently fall through to the
	// Validation category sentence for all four. `project.negative-amount` has no entry: this
	// form has no Money field, and the code is unroutable as things stand (shared by `budget`
	// and `contingency`, with the field named only in the developer-English `message`).
	//
	// `project.invalid-date` DOES get one, and the difference from `negative-amount` is worth
	// stating rather than looking like an inconsistency. That code can never be about anything
	// this form renders; this one is about two fields it does render, and is merely improbable
	// from them — Chromium sanitizes an `<input type="date">` to `''` or a valid date, so today
	// only another caller of `CreateProjectCommand` can raise it. "No field to attach it to" is
	// a property of the form; "no browser currently produces one" is a property of the host, and
	// a missing entry does not degrade to silence, it degrades to the generic Validation
	// sentence under a field the user can see.
	'project.empty-name': 'A project needs a name.',
	'project.unknown-status': 'Choose a status from the list.',
	'project.target-before-start': 'Target completion must be on or after the start date.',
	'project.invalid-date': 'Enter a real calendar date.',
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
	// Slice 19's coded refusals. Keyed by the exact `AppError.code`, for the reason the slice
	// 16 block above states: `toUserMessage`'s lookup is `error.code in en`, so an
	// `error.`-prefixed key would never resolve and each of these would silently fall through
	// to its category's generic sentence — which for the four below is "reading or writing the
	// vault failed unexpectedly", false about a refusal that knows exactly what is wrong.
	//
	// The persist-failure sentence names the REMEDY rather than the fault, because its recovery
	// is not the obvious one: the notes are already at the destination, so re-running the move
	// moves nothing, and pointing the setting at where they now are is the fix.
	'settings.library-folder-empty': 'A library folder cannot be empty.',
	'settings.library-overlaps-project': 'That folder is inside a project folder, or contains one.',
	'settings.library-overlaps-source': 'That folder overlaps the current library folder.',
	'settings.library-source-case-mismatch':
		'The library folder does not exist at the spelling this setting names, though a similarly named folder does. Rename that folder to match before moving.',
	// The REFRESH failure is step 0's, and its sentence is the only one in this group that
	// says nothing moved. Sharing the rebuild sentence below would have opened with "The
	// catalogue moved" about a migration that had not started, and its remedy differs: a
	// retry is exactly what may work here.
	'settings.library-refresh-failed':
		'The app could not catch up with the vault, so nothing was moved and the setting was not changed. Try again, or reload Obsidian.',
	'settings.library-move-failed': 'The library could not be moved, so the setting was not changed.',
	'settings.library-rebuild-failed':
		'The catalogue moved, but the app could not catch up with the change. Reload Obsidian, then set the library folder to the new location.',
	'settings.library-persist-failed':
		'The catalogue moved, but the setting could not be saved. Set the library folder to the new location.',
	'project.folder-overlaps-library': 'That project folder would overlap the library folder.',
	'save-state.saved': 'Saved',
	'save-state.saving': 'Saving',
	'save-state.unsaved-changes': 'Unsaved changes',
	'save-state.save-error': 'Save error',
} as const;

export type StringKey = keyof typeof en;

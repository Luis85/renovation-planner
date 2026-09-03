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
	'command.open-asset-designer': 'Open asset designer',
	'command.create-sample-project': 'Create sample renovation project',
	'plan.none': 'This vault has no renovation plans yet.',
	'asset.none': 'This vault has no assets yet.',
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
	// §89's "beside what it replaced" at the INPUT level: the shared library's unit price, this
	// project's own, and the price the row's figures were actually derived from. `price-in-force`
	// is the §85 non-colour channel — a WORD beside the figure, so a screen reader reads it and a
	// user who cannot tell the two colours apart still knows which figure is being used.
	//
	// `editor.inspector.*`, with this surface's other twenty keys. The task brief spelled these
	// four `view.inspector.*`; `view.*` everywhere else in this file means the Renovation Project
	// view, so that prefix would have named the wrong surface. Ruled on rather than assumed.
	'editor.inspector.price-library': 'Library price',
	'editor.inspector.price-project': 'Project price',
	'editor.inspector.price-in-force': 'In force',
	'editor.inspector.price-derived-from': 'Derived from',
	'editor.inspector.assign.label': 'Assign asset',
	'editor.inspector.assign.button': 'Assign',
	'editor.inspector.quantity-override.label': 'Override quantity for',
	'editor.inspector.cost-override.label': 'Override cost for',
	'editor.inspector.override.reset': 'Reset to calculated',
	'editor.inspector.delete-zone.reassign-title': 'Move these requirements to which zone?',
	'sequence.marker-clear-failed': 'The delete was saved, but its recovery record could not be cleared from the vault. It is cleared the next time this vault opens.',
	'asset-price.cleanup-failed': 'The asset was deleted, but a price note for it could not be removed from the vault. Delete it by hand if you find it.',
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
	// 'Measured on the plan:' until Task B6, when `KnownDistanceForm` gained a second caller:
	// the asset designer measures on an asset's reference image, and the background is the one
	// noun true of both surfaces. The key keeps its `editor.` prefix because the FORM lives in
	// `presentation/editor/shell/` and a key rename orphans nothing but reads as a move.
	'editor.calibrate.distance.measured': 'Measured on the background:',
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
	// The currency invariant (design increment "the currency the pipeline is told"): the copy
	// names the RELATIONSHIP rather than the two currencies, because `toUserMessage` takes no
	// params — the developer message in the raised error is where GBP and EUR actually appear.
	'cost.currency-mismatch':
		"This asset's price is not in this project's currency, so no estimate can be produced. Open the asset's note and price it in this project's currency.",
	'requirement.project-not-found': 'That zone belongs to a project that is no longer there.',
	'requirement.project-gone': 'That requirement belongs to a project that is no longer there.',
	// The two calibration refusals a user can actually PRODUCE, on either surface. Both are
	// `Calculation`, whose category sentence ("A quantity could not be calculated.") says
	// nothing about points, nothing about a distance, and nothing a user could act on — and
	// calibrating is a gesture whose whole failure mode is that the two clicks or the typed
	// number were wrong.
	//
	// Subject-agnostic wording on purpose: `CalibrateTool` is one tool serving a plan's
	// background and an asset's spec sheet since Task B6, so neither sentence may name a plan.
	//
	// `calibration.invalid-distance` is deliberately absent, and slice 17 is where that was
	// decided: `KnownDistanceForm` disables its submit unless the value parses positive and
	// finite, so no user can raise it. `calibration.degenerate-scale` has TWO raise sites —
	// a derived scale that collapsed, and a rescale whose product overflowed — and one
	// sentence covers both, because from the user's side they are the same event: the two
	// points and the distance do not describe a usable scale.
	'calibration.coincident-points':
		'Those two points are in the same place. Pick two points with a real distance between them.',
	'calibration.degenerate-scale':
		'Those two points and that distance do not produce a usable scale. Pick two points further apart, or check the distance you entered.',
	// The row's own parse guard (design slice 16), not an `AppError` code: `Number('abc')`
	// and a malformed money literal never reach a dispatch, so there is no raised code for
	// `routeError` to place. Keyed by the field rather than by any code for that reason.
	'error.requirement.quantity.unparseable': 'Enter a number, or reset to the calculated figure.',
	'error.requirement.cost.unparseable': 'Enter an amount, or reset to the calculated figure.',
	'error.suffix.schema-version-unsupported':
		'This note was written by a newer version of this plugin. Update the plugin to open it.',
	'error.suffix.revision-conflict': 'This entry changed elsewhere in the meantime. Reload and try again.',
	'error.suffix.external-modification': 'This entry was edited outside the plugin. Reload and try again.',
	// The price section's own refusals, keyed by the exact `AppError.code` their RAISE SITES
	// mint. `toUserMessage` asks `hasLocaleKey(error.code)` FIRST and only then walks
	// `CODE_SUFFIX_KEYS`, so a code listed here beats a suffix that also matches it — which is
	// deliberate for two of them and stated where each sits.
	//
	// Three `asset-price.*` codes get NO entry, and that absence is a decision rather than an
	// omission, exactly as `project.negative-amount` already is: `asset-price.duplicate-pair` is
	// a logger warning, `asset-price.orphaned-by-asset-delete` has its own notice, and
	// `asset-price.pre-write-invalid` has no user-facing door at all.
	'asset-price.currency-mismatch': "A price has to be in the project's own currency.",
	// OVERRIDES `error.suffix.revision-conflict`, which says "Reload and try again". There is
	// nothing to reload on this surface, and the row's expectation is FROZEN for exactly as long
	// as the draft is — so a refresh cannot help and the DISCARD is the gesture that unsticks the
	// field. Say so where the entry is, or the next reader deletes it as a duplicate of the
	// suffix.
	'asset-price.revision-conflict':
		'This price was changed elsewhere. Discard your entry to see the current one.',
	// OVERRIDES `error.suffix.external-modification` for the same reason, one cause along: the
	// suffix names a reload this surface does not have.
	'asset-price.external-modification':
		'This price was edited outside the plugin. Discard your entry to see the current one.',
	'asset-price.project-not-found': 'That project is no longer there.',
	'asset-price.asset-not-found': 'That asset is no longer there.',
	'asset-price.write-failed': 'The price could not be saved.',
	'asset-price.delete-failed': 'The price could not be removed.',
	'asset-price.entity-invalid': 'That price note could not be read.',
	'asset-price.frontmatter-invalid': 'That price note could not be read.',
	// Unreachable while the field validator holds — the row refuses a negative draft before it
	// dispatches — and localized anyway. That is a different kind of unreachability from
	// `project.negative-amount`'s, which no caller can set at all: a code held out of reach by a
	// GUARD degrades to the wrong sentence the day the guard moves, and this costs two strings.
	'asset-price.negative-unit-cost': 'A price cannot be negative.',
	'error.suffix.migration-failed': 'This note could not be converted to the current format.',
	// TWO more suffixes, and the instrument that found them is
	// `grep -rno '\${spec\.kind}\.[a-z-]*\|\${kind}\.[a-z-]*' src/infrastructure/`, which
	// reports FOUR shared raise sites: `migration-failed` and `schema-version-unsupported`
	// above, and these two. With them the class is closed, which is a claim that grep can be
	// re-run against.
	//
	// Both are SUFFIXES rather than per-kind entries because each is raised from ONE site
	// parameterised by kind, so a direct `asset-price.` entry would answer it for one kind and
	// leave `plan.`, `zone.` and the rest on the generic category sentence — which is where they
	// were until this row: measured, `schema-version-malformed` appeared nowhere in this file.
	// PRE-EXISTING, and one row fixes it for every kind.
	'error.suffix.schema-version-malformed':
		"This note's version could not be read, so it was not opened.",
	'error.suffix.project-folder-unresolved':
		'This note could not be saved, because the folder of the project it belongs to could not be found.',
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
	// The canvas's counted strip. `{count}` rather than "some", because the number is the whole
	// point: one bad note now costs one zone, and a user who cannot see the count cannot tell
	// that from a plan that lost everything.
	'editor.some-zones-unreadable':
		'{count} zone(s) in this plan could not be read and are not drawn. Open the diagnostics report to see which notes refused.',
	'editor.plan-missing.headline': 'This plan no longer exists',
	'editor.plan-missing.body': 'This tab points at a plan that is not in the vault any more.',
	'editor.plan-missing.action': 'Close this tab',
	// The bootstrap failure, which takes NO action: nothing that reads a configured location was
	// composed, so there is nothing to re-run, and slice 1 already refused a repair UI. What to
	// fix lives in the settings tab.
	'view.session-failure.headline': 'Renovation planner could not start',
	'view.project.loading': 'Loading projects…',
	// No second sentence pointing at a diagnostics report, and the REASON changed under this
	// key rather than the decision. It used to be that `GetDiagnosticsSnapshotQuery` was
	// composed and consumed by nobody — no command, no settings entry, no view — so "open the
	// diagnostics report" was an instruction the user could not follow. There is a command and
	// a settings row now, and the two sibling strips below both end with that instruction.
	//
	// What keeps it off THIS key is that this sentence is count-free while both of those carry
	// a number: it says "some projects" because `ListProjects` counted its refusals before an
	// interpolating `t()` existed to spend the count on. Adding the report clause here without
	// the count would point a user at a report holding rows this sentence cannot corroborate.
	// Both halves belong to this key's own surface, and neither is this increment's to change.
	'view.project.some-unreadable': 'Some projects could not be read from the vault.',
	// The detail state's own strip, one level down. COUNTED where the sentence above says
	// "some", and the difference is not an inconsistency to tidy: `ListProjects` has counted
	// its refusals since slice 16 and this key predates the interpolating `t()` that slice 19
	// built, so the count above is available and simply not yet spent. Widening it is a change
	// to that sentence's own surface, not to this one.
	'view.project.some-plans-unreadable':
		'{count} plan(s) in this project could not be read. Open the diagnostics report to see which notes refused.',
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
	'view.project.currency': 'Priced in {currency}',
	'view.project.plans-title': 'Plans',
	'view.project.create-plan': 'New plan',
	// The project's own price section (the per-project price override increment). An override is
	// per-(project, asset), so `price-scope` is the DISCLOSURE that justifies this affordance
	// living on the project surface rather than on the Inspector's requirement row: one edit here
	// moves every requirement in the project on that asset. It renders ONCE, with the section —
	// repeated per row it would read as a per-row consequence, which is the opposite of what it
	// says. Nothing but the rendering case in `assetPriceList.test.ts` can see that it is
	// rendered at all: `I18N_LITERAL_BAN` fires at a literal, never at an absent one.
	'view.project.prices-title': 'Asset prices',
	'view.project.price-catalogue': 'Library price',
	'view.project.price-yours': 'This project',
	'view.project.price-set': 'Set a price',
	'view.project.price-clear': 'Use the library price',
	'view.project.no-assets': 'The library has no assets yet',
	// The VALIDATOR's message, and it needs a key of its own: `useFieldCommit.validate` returns a
	// resolved string, so the alternatives were a literal (which `I18N_LITERAL_BAN` refuses) or
	// the requirement row's parse key, which tells the user to reset to a calculated figure this
	// control does not have. `money.invalid-amount` is not the answer either — it has no locale
	// entry, so it falls back to the generic Validation sentence. The copy SHOWS the shape rather
	// than describing it, because "a valid monetary amount" does not tell a user that `.5` and
	// `1e3` are among the forms `createMoney` refuses.
	'view.project.price-invalid': 'Enter a price like 19.50',
	'view.project.price-negative': 'A price cannot be negative.',
	'view.project.price-scope':
		'A price set here applies to every requirement in this project that uses the asset',
	// TWO sentences for two states `AssetPriceRowDto` deliberately keeps apart, and they must not
	// share a key: `assetStatus: 'orphan'` and `assetStatus: 'unreadable'` both carry a null
	// `assetName` and a null `catalogue`, so a component branching on nullness alone would tell a
	// user their asset is GONE when its note merely would not parse today. One names a deletion,
	// the other names a read that failed, and the two commit to opposite remedies.
	'view.project.price-orphan': 'This asset is no longer in the library',
	'view.project.price-unreadable':
		"This asset's note could not be read, so its price can't be changed here. "
		+ 'Fix the note to set a price again.',
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
	// Design slice A10's creation form, and the asset designer's whole refusal vocabulary
	// behind it. Keyed by the exact `AppError.code`, for the reason the slice 16 block above
	// states: `toUserMessage`'s lookup is `error.code in en`, so an `error.`-prefixed key
	// would never resolve and every one of these would fall through to the generic Validation
	// sentence — under a field the user can see, for the nine this form routes.
	//
	// **This list is copied from the RAISE SITES rather than from the form's own error map,
	// and the two are deliberately different sizes.** The map routes nine codes to fields;
	// this block gives copy to every code `assetError` and `assetNotFound` mint
	// (`src/domain/asset/Asset.errors.ts`, `Asset.ts`, `AssetShape.ts`,
	// `application/commands/asset/updateAssetShape.ts`), because absence from the MAP means
	// "not about a field" and routes to the banner, while absence from HERE means the banner
	// says "the information given is not valid" about a refusal that knows exactly what is
	// wrong. The eleven with no field are the designer's own — clearance, anchor, facing and
	// the two pending-flag invariants — plus height, which is `SetAssetHeightCommand`'s.
	//
	// The two pending-flag entries look like programmer errors and are reachable by a user:
	// `validateAssetShape` runs on every READ of a stored sidecar, and a `.rpgeo` a user has
	// hand-edited is exactly the document that can carry a typed footprint marked pending.
	'asset.empty-name': 'An asset needs a name.',
	'asset.unknown-category': 'Choose a category from the list.',
	'asset.negative-unit-cost': 'A unit cost cannot be negative.',
	'asset.invalid-height': 'Enter a height as a number of millimetres.',
	'asset.negative-height': 'A height cannot be negative.',
	'asset.non-positive-dimension': 'A width and a depth must each be greater than zero.',
	'asset.dimension-underflow': 'Those dimensions are too small to describe a rectangle.',
	'asset.invalid-footprint': 'That outline is not a shape this plugin can store.',
	'asset.degenerate-footprint': 'That outline encloses no area.',
	'asset.invalid-clearance': 'That clearance is not a shape this plugin can store.',
	'asset.degenerate-clearance': 'That clearance encloses no area.',
	'asset.invalid-anchor': 'An anchor must have finite coordinates.',
	'asset.invalid-facing': 'A facing must be a finite angle.',
	// Raised by `SetFacingTool` before it builds anything, so no save indicator is carrying it
	// and this sentence is the only account the user gets of a click that set nothing.
	'asset.facing-without-direction': 'Drag in the direction the object faces; a click alone names none.',
	'asset.typed-footprint-cannot-be-pending':
		'A typed footprint is already in millimetres, so it cannot be waiting for a scale.',
	'asset.absent-clearance-cannot-be-pending': 'There is no clearance to wait for a scale.',
	'asset.no-footprint':
		'Give this asset a footprint first; a clearance, an anchor and a facing are each relative to one.',
	'asset.not-found': 'That asset no longer exists.',
	// The one background refusal a USER can reach, on either surface: both pickers snapshot the
	// vault's candidates and the user picks out of that snapshot, so a file deleted or renamed in
	// between arrives at the command as a well-formed path naming nothing. Without these two the
	// `Reference` category sentence answered — "That entry no longer exists." — which names the
	// asset or the plan rather than the FILE, and neither of those has gone anywhere. The two
	// sentences differ in the noun they send the user back to, which is the only thing they can
	// usefully say: `toUserMessage` takes no params, so neither can name the path.
	//
	// The two SIBLING codes each command also mints stay absent, and the reason is reachability
	// rather than oversight: `asset.unsupported-background` and `asset.invalid-background-page`
	// need a picker that returns an unsupported kind or a page below one, and both pickers narrow
	// those before they answer.
	'asset.background-not-found': 'That file is no longer in the vault. Choose another spec sheet.',
	'plan.background-not-found': 'That file is no longer in the vault. Choose another plan document.',
	// The one code the FORM mints rather than routes: a rectangle needs both halves, and
	// nothing downstream refuses one given without the other because nothing downstream is
	// asked. `NewAssetForm.dimensionsIncomplete` is the raise site.
	'asset.dimensions-incomplete': 'A rectangle needs both a width and a depth.',
	// `createMoney`'s two refusals (`src/core/money/Money.ts`), which this form runs as a
	// pre-check because `CreateAssetCommand` reaches `Money.of` first and `of` THROWS on
	// either — so without the pre-check both of these would reach the user as
	// `vault.unexpected-failure`, about a vault nothing had opened.
	'money.invalid-amount': 'Enter an amount as a plain decimal number, such as 45.00.',
	'money.invalid-currency': 'Enter a three-letter currency code in capitals.',
	// Design slice A10's creation form. Seven controls, because five of them are exactly the
	// fields `CreateAssetInput` REQUIRES — a defaulted currency would price an asset in one
	// nobody chose — and the last two are the optional pair that becomes its footprint.
	'form.new-asset.title': 'New asset',
	'form.new-asset.name': 'Name',
	'form.new-asset.category': 'Category',
	'form.new-asset.unit': 'Unit',
	'form.new-asset.unit-cost': 'Unit cost',
	'form.new-asset.currency': 'Currency',
	// The unit is named in the LABEL rather than left to a placeholder: every world
	// coordinate in this plugin is millimetres (ADR-009), and a bare `Width` invites metres.
	'form.new-asset.width': 'Width in millimetres (optional)',
	'form.new-asset.depth': 'Depth in millimetres (optional)',
	// Shown only after the catalogue entry has been written and the footprint has not. It
	// names the state rather than apologising for it: the asset exists, its details are no
	// longer this dialog's to change, and the dimensions are what a retry re-sends.
	'form.new-asset.already-created':
		'The asset is saved. Its details can be edited from the catalogue; only the dimensions below are still pending.',
	// One label per `AssetCategory`, so the control never shows the raw union member
	// (`building-element`). `ASSET_CATEGORY_LABELS` is the `Record` that makes a missing one
	// a build failure; `assetLabels.test.ts` is what asks whether these resolve.
	'form.new-asset.category.material': 'Material',
	'form.new-asset.category.furniture': 'Furniture',
	'form.new-asset.category.fixture': 'Fixture',
	'form.new-asset.category.plant': 'Plant',
	'form.new-asset.category.equipment': 'Equipment',
	'form.new-asset.category.building-element': 'Building element',
	'form.new-asset.category.custom': 'Custom',
	// One label per `MeasurementUnit`, for the same reason and with the same pair of gates.
	'form.new-asset.unit.piece': 'Piece',
	'form.new-asset.unit.m': 'Metres',
	'form.new-asset.unit.m2': 'Square metres',
	'form.new-asset.unit.m3': 'Cubic metres',
	'form.new-asset.unit.hour': 'Hour',
	'form.new-asset.unit.day': 'Day',
	'form.new-asset.unit.fixed': 'Fixed price',
	// The project list header's second action. The catalogue is VAULT-wide since design slice
	// 19, so this sits on the list state rather than inside a project's detail state.
	'view.asset.create': 'New asset',
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
	// Names the SOURCE, because the overlap sentence above names the destination and would
	// send a user round the folder picker forever: the vault root overlaps everything.
	'settings.library-source-is-vault-root':
		'The library folder is currently the whole vault, so there is nothing to move it out of. Set it to a real folder in data.json first.',
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
	// Design slice B3 (ADR-0015): the asset designer's own surface. The two empty states are
	// OVERLAYS inside the canvas region, never a replacement for it — slice 14's rule, and here
	// it matters for the same reason it does on a plan: the region exists to show the object
	// being drawn, and a panel that took its place would hide the thing.
	//
	// **Both carry an action now, and each grew one in the task that built what it hands off
	// to.** `no-shape`'s is Task B8's `asset-dimensions` dialog, reached through
	// `AssetDesignerRoot.editDimensions` — `NewAssetForm` creates a DIFFERENT asset, so nothing
	// before this typed a rectangle onto the asset already open. `no-background`'s is Task B7's
	// `BackgroundPicker` port. Slice 14's Amendment 1 refuses a live control that does nothing,
	// so `content.test.ts` asserts both actions rather than assuming either.
	'empty.asset.no-shape.headline': 'No footprint yet',
	'empty.asset.no-shape.body':
		'An asset gets its footprint from typed dimensions or from an outline traced over a spec sheet. Either one makes it something a plan can hold.',
	'empty.asset.no-shape.action': 'Set dimensions',
	'empty.asset.no-background.headline': 'No spec sheet yet',
	'empty.asset.no-background.body':
		'Set a photograph, drawing or datasheet as this asset’s background, then calibrate it so a traced outline comes out in real units.',
	'empty.asset.no-background.action': 'Choose a background',
	// The designer's own shell. `designer.asset-failed.headline` is the counterpart of
	// `editor.plan-failed.headline`: the BODY under it is `trError(error)`, so an unreadable
	// vault, unrecovered settings and an asset that is gone each say their own sentence.
	'view.asset-designer.name': 'Asset designer',
	'designer.canvas': 'Asset canvas',
	// The designer's toolbar (design slice B5). FOUR labels rather than six: camera mode, Select,
	// Undo and Redo say the same words as the Plan Editor's and take its keys
	// (`editor.toolbar.pan`/`.select`/`.undo`/`.redo`) rather than shipping a second translation
	// of "Undo" for a translator to keep in step with the first. What is designer-specific is
	// the five gestures below. Four have no counterpart on a plan; `calibrate` has one and still
	// gets a key of its own, because the Plan Editor's says "Calibrate" about a plan's background
	// and each surface's toolbar builds its buttons from its own table.
	'designer.toolbar': 'Asset tools',
	'designer.toolbar.trace-footprint': 'Trace footprint',
	'designer.toolbar.trace-clearance': 'Trace clearance',
	'designer.toolbar.set-anchor': 'Set anchor',
	'designer.toolbar.set-facing': 'Set facing',
	'designer.toolbar.calibrate': 'Calibrate',
	// The asset's own recalibration warning. NOT `editor.calibrate.recalibrate.*`, which names
	// zones and a plan — and the two questions differ in more than the noun: a plan's
	// calibration rescales every coordinate it owns, while an asset's converts only the
	// coordinate groups captured before a scale existed.
	'designer.calibrate.recalibrate.title': 'Rescale what was traced without a scale?',
	'designer.calibrate.recalibrate.message':
		'Some of this asset’s geometry was traced before a scale existed. Setting the scale converts it to millimetres. You can undo it.',
	// Task B7's picker placeholder — `ObsidianBackgroundPicker`'s modal, the same affordance
	// `PlanBackgroundSuggestModal.ts` uses `command.set-plan-background` for.
	'designer.background.pick': 'Choose a background for this asset',
	'designer.loading': 'Loading asset…',
	'designer.asset-failed.headline': 'This asset could not be loaded',
	// The DANGLING state, and the three keys are the designer's own rather than a reuse of
	// `editor.plan-missing.*`. The first two must be: every surface's copy is written from its
	// own subject, and the plan editor's say "plan". The ACTION says "Close this tab" on both
	// surfaces and could have been borrowed — the toolbar borrows `editor.toolbar.undo` on
	// exactly that argument — and is minted anyway, because the key that would be borrowed is
	// `editor.plan-missing.action`: its NAME claims the plan editor's state, so a later change
	// to that state reaches into this one with nothing to notice. A borrowed key whose name
	// names a sibling's state is not the same trade as a borrowed word.
	'designer.asset-missing.headline': 'This asset no longer exists',
	'designer.asset-missing.body': 'This tab points at an asset that is not in the vault any more.',
	'designer.asset-missing.action': 'Close this tab',
	'designer.refresh-failed':
		'This asset could not be re-read after the last change; what you see may be out of date.',
	// The spec sheet's own two failures, and the counterparts of `editor.background-missing`
	// and `editor.background-failed` rather than a reuse of them: those two say "this plan",
	// and every surface's copy is written from its own subject. They are NOTICES and not a
	// failure state — the asset read fine and the rest of the designer still works — which is
	// what the empty state above them cannot say, since a reference that exists retires
	// `noBackground` whatever became of the file it names.
	'designer.background-missing': 'The background file for this asset is missing.',
	'designer.background-failed': 'The background for this asset could not be rendered.',
	// Task B8's inspector region: derived dimensions, an honest unscaled warning, and the one
	// editable scalar (height). `designer.inspector` labels the region the same way
	// `editor.inspector` does the plan editor's own panel.
	'designer.inspector': 'Inspector',
	'designer.inspector.dimensions': 'Dimensions',
	// The warning `dimensionsUnscaled` earns — a traced outline captured before this asset had
	// a scale, so the numbers beside it are not yet real millimetres (§88, Decision 6).
	'designer.inspector.dimensions.unscaled':
		'This footprint was traced before a scale existed, so these numbers are not real measurements yet.',
	'designer.inspector.edit-dimensions': 'Edit dimensions',
	// The same gesture named for what it DOES in the state it is offered from: with no shape
	// there is nothing to edit, and this is the one control that creates one.
	'designer.inspector.set-dimensions': 'Set dimensions',
	'designer.inspector.height': 'Height in millimetres',
	'designer.inspector.height.unparseable': 'Enter a height as a number, or clear it.',
	// Task B8's dialog kind (`asset-dimensions`), reached from BOTH the no-shape empty state
	// and this inspector's own Edit dimensions control — the same width/depth vocabulary
	// `form.new-asset.width`/`.depth` already uses, minus their "(optional)" suffix: both
	// fields are required here, since a rectangle needs both halves.
	'designer.dimensions.edit.title': 'Set this asset’s dimensions',
	// Shown INSTEAD of the current numbers, not beside them: this footprint's dimensions are
	// placeholder-space coordinates, and offering them as the form's default is how they get
	// saved back as authored millimetres in two clicks. It says the same thing
	// `designer.inspector.dimensions.unscaled` says and cannot be that key: there, numbers are
	// on screen for "these numbers" to point at, and here the fields are deliberately empty.
	'designer.dimensions.unscaled':
		'This footprint was traced before a scale existed, so its current size is not a real measurement. Type the real width and depth, or calibrate the background first.',
	'designer.dimensions.width': 'Width in millimetres',
	'designer.dimensions.depth': 'Depth in millimetres',
	// The undo stack's own refusal, keyed by the exact `AppError.code` for the reason the
	// slice 16 block above states. Without an entry it falls through to
	// `error.category.validation` — "This data is not in the expected form" — about data that
	// is perfectly well formed and an undo refused to protect somebody else's edit, which is
	// the wrong-sentence failure slice 11 recorded rather than a silent one.
	//
	// It names the CONSEQUENCE rather than the mechanism: a user has no model of a write
	// ledger, and what they need to know is that the step is still undoable by hand and that
	// something they did not do is what stands in the way.
	'undo.superseded':
		'This change was edited elsewhere after this step, so undoing it would discard that edit. Reload and undo again if you still want it reversed.',
	// The diagnostics report's own keys. `session-only` is the first of this increment's two
	// recorded limitations, put on the surface where the user meets it rather than only in a
	// docblock: the ledger is in-memory, so reopening the vault empties the report.
	'command.show-diagnostics-report': 'Show diagnostics report',
	'settings.diagnostics.name': 'Diagnostics report',
	'settings.diagnostics.desc':
		'Versions, schema versions, and the notes that refused to load in this session.',
	'diagnostics.title': 'Diagnostics report',
	'diagnostics.no-issues': 'No notes have refused to load in this session.',
	'diagnostics.session-only':
		'This report covers the current session only. It is cleared when the vault is reopened.',
	'diagnostics.plugin-version': 'Plugin version',
	'diagnostics.obsidian-version': 'Obsidian version',
	'diagnostics.last-migration': 'Last migration applied',
	'diagnostics.schema-versions': 'Schema versions',
	'diagnostics.pending-migrations': 'Pending migrations',
	'diagnostics.none': 'None',
	'diagnostics.copy': 'Copy report',
	'diagnostics.copied': 'Diagnostics report copied.',
	// The one refusal the skip-and-count listings produce, and the only consumer that raises it
	// is the reassignment picker: every other reader carries the count into a warning strip
	// instead. Keyed by the exact code, per the slice-19 block above — an `error.`-prefixed key
	// would fall through to the Persistence category's "reading or writing the vault failed
	// unexpectedly", which is false about a refusal that knows precisely what is wrong.
	//
	// The second sentence points at the diagnostics report, which is why the report is in the
	// same increment: a sentence naming a surface that does not exist is a promise on screen.
	'zone.listing-incomplete':
		'Some zones in this project could not be read, so the list of places to move this to is incomplete. Open the diagnostics report to see which notes refused.',
	// The asset-side sibling: the catalogue is vault-wide rather than per-project (design
	// slice 19), so this names the catalogue rather than a project, but the reasoning is
	// `zone.listing-incomplete`'s own — an incomplete reassignment picker is how a user
	// reassigns to the wrong asset and then deletes the right one.
	'asset.listing-incomplete':
		'Some assets in the catalogue could not be read, so the list of assets to reassign to is incomplete. Open the diagnostics report to see which notes refused.',
	'save-state.saved': 'Saved',
	'save-state.saving': 'Saving',
	'save-state.unsaved-changes': 'Unsaved changes',
	'save-state.save-error': 'Save error',
} as const;

export type StringKey = keyof typeof en;

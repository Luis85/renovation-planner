/**
 * The English table is the COMPLETE one: a key exists because this file answers it, and
 * `StringKey` derives from here, so the compiler demands English before a caller can
 * name a key. The file is named `en.ts` because that is the filename the obsidianmd
 * ruleset's locale rules match — sentence case in this table is linted, not reviewed.
 */
export const en = {
	'command.open-project': 'Open renovation project',
	'view.project.name': 'Renovation project',
	'settings.units.name': 'Units',
	'settings.units.desc': 'Measurement system for quantities and dimensions.',
	'settings.units.metric': 'Metric',
	'settings.units.imperial': 'Imperial',
	'settings.project-folder.name': 'Default projects folder',
	'settings.project-folder.desc':
		'Vault folder where a new project’s folder is created. An existing project keeps the folder it is already in.',
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
	'editor.inspector.override.apply': 'Apply',
	'entity.requirement.plural': 'Requirements',
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
	'editor.plan-missing': 'This plan no longer exists.',
	'editor.plan-failed': 'This plan could not be read from the vault.',
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
	'requirement.unit-not-area': 'This asset is not measured by area, so a zone area cannot drive its quantity.',
	'requirement.cross-project': 'A zone and an asset from different projects cannot be linked.',
	'requirement.negative-quantity': 'A quantity cannot be negative.',
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
	'view.project.loading': 'Loading projects…',
	// No second sentence pointing at a diagnostics report: `GetDiagnosticsSnapshotQuery` is
	// composed and consumed by nobody — no command, no settings entry, no view — so "open the
	// diagnostics report" was an instruction the user cannot follow. Slice 14's Amendment 1
	// refuses a button that does nothing; a sentence that does nothing is the same defect.
	'view.project.some-unreadable': 'Some projects could not be read from the vault.',
	'save-state.saved': 'Saved',
	'save-state.saving': 'Saving',
	'save-state.unsaved-changes': 'Unsaved changes',
	'save-state.save-error': 'Save error',
} as const;

export type StringKey = keyof typeof en;

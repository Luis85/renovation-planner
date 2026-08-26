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
	'settings.project-folder.name': 'Project folder',
	'settings.project-folder.desc': 'Vault folder where project, plan and zone notes are stored, each with its geometry file beside it.',
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
	'cascade.stale-marker-failed': 'A requirement could not be marked out of date. Its figures may be wrong until it is recalculated.',
	'cascade.aborted': 'Requirements linked to this change could not be updated. Their figures may be out of date.',
	'editor.zone.default-name': 'Zone',
	'editor.canvas': 'Plan canvas',
	'editor.status': 'Status',
	'editor.measurements': 'Measurements',
	'editor.save-state': 'Save state',
	'editor.zoom': 'Zoom',
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
} as const;

export type StringKey = keyof typeof en;

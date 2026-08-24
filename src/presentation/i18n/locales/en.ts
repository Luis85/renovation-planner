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
	'view.geometry.name': 'Geometry sidecar',
	'settings.unrecovered': 'Settings could not be read. Fix or remove data.json in the plugin folder, then reload the app.',
} as const;

export type StringKey = keyof typeof en;

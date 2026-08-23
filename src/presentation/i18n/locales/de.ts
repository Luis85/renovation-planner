/**
 * German. `Partial` on purpose: a key this table does not answer falls back to English
 * PER KEY in `t`, so an incomplete translation degrades one string at a time instead of
 * failing the locale. (German noun capitalization is why the English sentence-case lint
 * deliberately does not run here.)
 */
import type { StringKey } from './en';

export const de: Partial<Record<StringKey, string>> = {
	'command.open-project': 'Renovierungsprojekt öffnen',
	'view.project.name': 'Renovierungsprojekt',
	'settings.units.name': 'Einheiten',
	'settings.units.desc': 'Maßsystem für Mengen und Abmessungen.',
	'settings.units.metric': 'Metrisch',
	'settings.units.imperial': 'Imperial',
	'settings.unrecovered':
		'Einstellungen konnten nicht gelesen werden. data.json im Plugin-Ordner reparieren oder entfernen, dann Obsidian neu laden.',
};

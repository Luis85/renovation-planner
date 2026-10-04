import type { errorFallbackEn } from '../en/errorFallback';

/**
 * Die deutsche Hälfte von `en/errorFallback.ts`: die beiden generischen Stufen, auf die
 * `toUserMessage` zurückfällt — die Code-Suffixe und je ein Satz pro Fehlerkategorie. Aus
 * `de.ts` ausgelagert, weil diese Datei mit 401 Zeilen über dem `max-lines`-Limit von 400 lag;
 * dieselben Schlüssel wie im Englischen, damit `strings.test.ts`' Vollständigkeitsprüfung beide
 * Tabellen weiterhin Schlüssel für Schlüssel vergleicht.
 */
export const errorFallbackDe: Record<keyof typeof errorFallbackEn, string> = {
	'error.suffix.schema-version-unsupported':
		'Diese Notiz wurde von einer neueren Version dieses Plugins geschrieben. Aktualisieren Sie das Plugin, um sie zu öffnen.',
	'error.suffix.revision-conflict':
		'Dieser Eintrag wurde zwischenzeitlich an anderer Stelle geändert. Bitte neu laden und erneut versuchen.',
	'error.suffix.external-modification':
		'Dieser Eintrag wurde außerhalb des Plugins bearbeitet. Bitte neu laden und erneut versuchen.',
	'error.suffix.migration-failed': 'Diese Notiz konnte nicht in das aktuelle Format umgewandelt werden.',
	'error.suffix.schema-version-malformed':
		'Die Version dieser Notiz konnte nicht gelesen werden, daher wurde sie nicht geöffnet.',
	'error.suffix.project-folder-unresolved':
		'Diese Notiz konnte nicht gespeichert werden, weil der Ordner des zugehörigen Projekts nicht gefunden wurde.',
	'error.suffix.note-id-mismatch':
		'Diese Notiz gehört zu einem anderen Eintrag, daher wurde sie nicht geöffnet. Laden Sie den Vault neu, um den Index neu aufzubauen.',
	// Sie-Form wie der Rest dieser Datei und wie die beiden `zone.sidecar-*-uncompensated`
	// oben: derselbe Vorfall darf nicht in zwei Anreden erscheinen. Sagt dasselbe wie das
	// englische Original — siehe dessen Kommentar für den Grund, warum kein Objekt genannt wird.
	'error.suffix.uncompensated':
		'Eine Änderung wurde geschrieben und konnte nicht wieder rückgängig gemacht werden, daher ist ein Teil davon noch im Vault. Prüfen Sie die Entwicklerkonsole, um zu sehen, was zurückgeblieben ist, bevor Sie weiterarbeiten.',
	'error.category.domain': 'Die Projektdaten sind ungültig.',
	'error.category.validation': 'Diese Daten haben nicht die erwartete Form.',
	'error.category.persistence': 'Der Vault konnte nicht gelesen oder geschrieben werden.',
	'error.category.geometry': 'Ein Geometriewert ist ungültig.',
	'error.category.import': 'Der Import ist fehlgeschlagen.',
	'error.category.migration': 'Diese Notiz kann mit dieser Version des Plugins nicht gelesen werden.',
	'error.category.reference': 'Dieser Eintrag existiert nicht mehr.',
	'error.category.calculation': 'Eine Menge konnte nicht berechnet werden.',
};

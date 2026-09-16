import type { writeIncidentEn } from '../en/writeIncident';

/**
 * Die deutsche Hälfte von `en/writeIncident.ts`: der eine Satz, den ein blockierter Befehl
 * zeigt, solange ein offener Schreibvorfall (ADR-0034) im Vault steht.
 *
 * Sie-Form wie der Rest dieser Tabelle — derselbe Vorfall darf nicht in zwei Anreden
 * erscheinen. Sagt dasselbe wie das englische Original: kein Reparaturangebot und kein
 * Hinweis darauf, dass das Plugin sich selbst wieder freigibt.
 *
 * `Record<keyof typeof writeIncidentEn, string>` statt `Partial`, wie die meisten Paare in
 * diesen beiden Verzeichnissen: ein Schlüssel ohne deutsches Gegenstück ist damit ein
 * Compile-Fehler und nicht erst ein roter Testfall.
 */
export const writeIncidentDe: Record<keyof typeof writeIncidentEn, string> = {
	'write-incident.writes-paused':
		'Das Schreiben ist pausiert. Eine frühere Änderung wurde geschrieben und konnte nicht rückgängig gemacht werden, daher sind Dateien in diesem Vault möglicherweise nur halb geschrieben. Vergleichen Sie sie mit einer Sicherung und entfernen Sie dann write-incidents.json aus dem Plugin-Ordner, um das Schreiben fortzusetzen.',
	'diagnostics.incidents': 'Offene Schreibvorfälle',
	'diagnostics.incidents.none': 'Es ist kein Schreibvorfall offen.',
	'diagnostics.incidents.remove':
		'Nichts hier räumt diese Einträge ab. Vergleichen Sie die betroffenen Dateien mit einer Sicherung und entfernen Sie dann {path}, um das Schreiben fortzusetzen.',
	'diagnostics.incidents.unreadable': 'Dieser Build kann den Eintrag nicht lesen; bekannt ist nur, dass es ihn gibt.',
	'diagnostics.incidents.unnamed': 'Die betroffenen Dateien konnten nicht benannt werden.',
};

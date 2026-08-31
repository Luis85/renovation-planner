/**
 * German. `Partial` on purpose: a key this table does not answer falls back to English
 * PER KEY in `t`, so an incomplete translation degrades one string at a time instead of
 * failing the locale. (German noun capitalization is why the English sentence-case lint
 * deliberately does not run here.)
 */
import type { StringKey } from './en';

export const de: Partial<Record<StringKey, string>> = {
	'command.open-project': 'Renovierungsprojekt öffnen',
	'command.open-project-detail': 'Zu Renovierungsprojekt wechseln',
	'view.project.name': 'Renovierungsprojekt',
	'settings.units.name': 'Einheiten',
	'settings.units.desc': 'Maßsystem für Mengen und Abmessungen.',
	'settings.units.metric': 'Metrisch',
	'settings.units.imperial': 'Imperial',
	'settings.unrecovered':
		'Einstellungen konnten nicht gelesen werden. data.json im Plugin-Ordner reparieren oder entfernen, dann Obsidian neu laden.',
	'settings.project-folder.name': 'Standardordner für neue Projekte',
	'settings.project-folder.desc':
		'Vault-Ordner, in dem der Ordner eines neuen Projekts angelegt wird. Ein bestehendes Projekt behält den Ordner, in dem es sich bereits befindet.',
	'settings.library-folder.name': 'Bibliotheksordner',
	'settings.library-folder.current': 'Zurzeit {folder}. Eine Änderung verschiebt die Notizen.',
	'settings.library-folder.move.name': 'Bibliothek verschieben',
	'settings.library-folder.move.desc': 'Einen neuen Ordner wählen und den Katalog dorthin verschieben.',
	'settings.library-folder-empty': 'Ein Bibliotheksordner darf nicht leer sein.',
	'settings.library-overlaps-project': 'Dieser Ordner liegt in einem Projektordner oder enthält einen.',
	'settings.library-overlaps-source': 'Dieser Ordner überlappt den aktuellen Bibliotheksordner.',
	'settings.library-source-case-mismatch':
		'Der Bibliotheksordner existiert nicht in der Schreibweise, die diese Einstellung nennt, aber ein ähnlich benannter Ordner ist vorhanden. Bitte diesen Ordner passend umbenennen, bevor verschoben wird.',
	'settings.library-refresh-failed':
		'Die App konnte den Vault nicht einlesen. Es wurde nichts verschoben und die Einstellung wurde nicht geändert. Bitte erneut versuchen oder Obsidian neu laden.',
	'settings.library-move-failed':
		'Die Bibliothek konnte nicht verschoben werden, die Einstellung wurde nicht geändert.',
	'settings.library-rebuild-failed':
		'Der Katalog wurde verschoben, aber die App konnte die Änderung nicht nachvollziehen. Bitte Obsidian neu laden und dann den Bibliotheksordner auf den neuen Ort setzen.',
	'settings.library-persist-failed':
		'Der Katalog wurde verschoben, aber die Einstellung konnte nicht gespeichert werden. Bitte den Bibliotheksordner auf den neuen Ort setzen.',
	'project.folder-overlaps-library': 'Dieser Projektordner würde den Bibliotheksordner überlappen.',
	// „Zonen“, nicht „Bereiche“: die deutsche Oberfläche nennt eine Zone überall sonst so
	// (`editor.zone.default-name`, `editor.inspector.delete-zone.reassign-title`).
	// „Vault“ bleibt unübersetzt — Obsidians eigener Name dafür, was `strings.test.ts` prüft.
	'command.show-diagnostics-report': 'Diagnosebericht anzeigen',
	'settings.diagnostics.name': 'Diagnosebericht',
	'settings.diagnostics.desc':
		'Versionen, Schemaversionen und die Notizen, die das Laden in dieser Sitzung verweigert haben.',
	'diagnostics.title': 'Diagnosebericht',
	'diagnostics.no-issues': 'In dieser Sitzung hat keine Notiz das Laden verweigert.',
	'diagnostics.session-only':
		'Dieser Bericht umfasst nur die aktuelle Sitzung. Beim erneuten Öffnen des Vaults wird er geleert.',
	'diagnostics.plugin-version': 'Plugin-Version',
	'diagnostics.obsidian-version': 'Obsidian-Version',
	'diagnostics.last-migration': 'Zuletzt angewendete Migration',
	'diagnostics.schema-versions': 'Schemaversionen',
	'diagnostics.pending-migrations': 'Ausstehende Migrationen',
	'diagnostics.none': 'Keine',
	'diagnostics.copy': 'Bericht kopieren',
	'diagnostics.copied': 'Diagnosebericht kopiert.',
	'zone.listing-incomplete':
		'Einige Zonen in diesem Projekt konnten nicht gelesen werden, daher ist die Liste möglicher Ziele unvollständig. Der Diagnosebericht zeigt, welche Notizen abgelehnt wurden.',
	'settings.verbose-logging.name': 'Ausführliche Protokollierung',
	'settings.verbose-logging.desc': 'Debug-Meldungen in der Entwicklerkonsole anzeigen. Alles bleibt auf diesem Gerät.',
	'view.geometry.name': 'Geometrie-Seitendatei',
	'view.plan-editor.name': 'Grundriss-Editor',
	'command.open-plan-editor': 'Grundriss-Editor öffnen',
	'command.set-plan-background': 'Grundriss-Hintergrund festlegen',
	'command.create-sample-project': 'Beispielprojekt anlegen',
	'plan.none': 'In diesem Vault gibt es noch keine Grundrisse.',
	'sample.project.name': 'Beispiel-Renovierung',
	'sample.plan.name': 'Erdgeschoss',
	'sample.zone.kitchen': 'Küche',
	'sample.zone.bathroom': 'Badezimmer',
	'sample.zone.living-room': 'Wohnzimmer',
	'sample.zone.terrace': 'Terrasse',
	'sample.zone.garden': 'Garten',
	'editor.toolbar': 'Editor-Werkzeuge',
	'editor.layers': 'Ebenen',
	'editor.toolbar.pan': 'Verschieben',
	'editor.toolbar.select': 'Auswählen',
	'editor.toolbar.draw-zone': 'Zone zeichnen',
	'editor.toolbar.undo': 'Rückgängig',
	'editor.toolbar.redo': 'Wiederholen',
	'editor.toolbar.calibrate': 'Kalibrieren',
	'editor.inspector': 'Inspektor',
	'editor.inspector.empty': 'Nichts ausgewählt.',
	'editor.inspector.multiple': 'Mehrere Objekte ausgewählt.',
	'editor.inspector.name': 'Name',
	'editor.inspector.area': 'Fläche',
	'editor.inspector.delete-zone': 'Zone löschen',
	'editor.inspector.requirements': 'Anforderungen',
	'editor.inspector.requirements.empty': 'Noch keine Anforderungen für diese Zone.',
	'editor.inspector.requirement.asset': 'Objekt',
	'editor.inspector.requirement.quantity': 'Menge',
	'editor.inspector.requirement.cost': 'Kosten',
	'editor.inspector.requirement.overridden': 'Übersteuert',
	'editor.inspector.requirement.stale': 'Werte sind veraltet; Anforderung neu berechnen.',
	'editor.inspector.requirement.missing-asset': 'Objekt fehlt im Katalog.',
	'editor.inspector.assign.label': 'Objekt zuweisen',
	'editor.inspector.assign.button': 'Zuweisen',
	'editor.inspector.quantity-override.label': 'Mengen-Übersteuerung für',
	'editor.inspector.cost-override.label': 'Kosten-Übersteuerung für',
	'editor.inspector.override.reset': 'Auf berechneten Wert zurücksetzen',
	'editor.inspector.delete-zone.reassign-title': 'Zu welcher Zone sollen diese Anforderungen verschoben werden?',
	'sequence.marker-clear-failed': 'Das Löschen wurde gespeichert, aber der Wiederherstellungseintrag konnte nicht aus dem Vault entfernt werden. Er wird beim nächsten Öffnen dieses Vaults entfernt.',
	'cascade.stale-marker-failed': 'Eine Anforderung konnte nicht als veraltet markiert werden. Ihre Werte können falsch sein, bis sie neu berechnet wird.',
	'cascade.aborted': 'Mit dieser Änderung verknüpfte Anforderungen konnten nicht aktualisiert werden. Ihre Werte können veraltet sein.',
	'editor.zone.default-name': 'Zone',
	'editor.canvas': 'Grundriss-Zeichenfläche',
	'editor.status': 'Status',
	'editor.measurements': 'Messwerte',
	'editor.save-state': 'Speicherstatus',
	'editor.zoom': 'Zoom',
	// `Umschalttaste` is the German name of the key itself, which is what a hint about holding
	// it has to say — `Shift` is the legend printed on many keyboards but not the word.
	'editor.hint.constrain-angle': 'Umschalttaste beschränkt den Winkel',
	'editor.loading': 'Grundriss wird geladen …',
	'editor.background-missing': 'Die Hintergrunddatei dieses Grundrisses fehlt.',
	'editor.background-failed': 'Der Hintergrund dieses Grundrisses konnte nicht gezeichnet werden.',
	'editor.layer.background': 'Hintergrund',
	'editor.layer.architecture': 'Architektur',
	'editor.layer.zone': 'Zonen',
	'editor.layer.construction': 'Bauabschnitte',
	'editor.layer.asset': 'Ausstattung',
	'editor.layer.annotation': 'Anmerkungen',
	'editor.layer.interaction': 'Interaktion',
	'editor.calibrate.distance.title': 'Reale Entfernung festlegen',
	'editor.calibrate.distance.label': 'Entfernung in Millimetern',
	'editor.calibrate.distance.measured': 'Auf dem Plan gemessen:',
	'editor.calibrate.recalibrate.title': 'Die Zonen auf diesem Plan neu skalieren?',
	'editor.calibrate.recalibrate.message': 'Auf diesem Plan sind bereits Zonen eingezeichnet. Beim Festlegen des Maßstabs werden alle skaliert. Sie können den Vorgang rückgängig machen.',
	'background.no-plan-open': 'Zuerst einen Grundriss-Editor öffnen.',
	'background.unsupported': 'Nur PNG-, JPEG- und PDF-Dateien können ein Grundriss-Hintergrund sein.',
	'zone.status.planned': 'Geplant',
	'zone.status.in-progress': 'In Arbeit',
	'zone.status.complete': 'Fertig',
	'zone.status.unknown': 'Unbekannter Status',
	// Fehlermeldungen (Slice 11). Geschlüsselt über `AppError.code`, über eine geschlossene
	// Menge dynamischer Code-Suffixe und über die Kategorie — nie über die `message` des
	// Fehlers selbst, die Logtext ist.
	'vault.unexpected-failure': 'Der Vault konnte unerwartet nicht gelesen oder geschrieben werden. Bitte erneut versuchen.',
	'migration.chain-gap': 'Diese Notiz verwendet ein Format, das dieses Plugin nicht lesen kann.',
	// Slice 10: Referenzintegrität und Anforderungen. Feste Sätze, keine Interpolation.
	//
	// GLOSSAR — diese Sätze verwenden dieselben Wörter wie die Oberfläche, die sie
	// zurückweisen: ein Asset heißt `Objekt` (`editor.inspector.requirement.asset`,
	// `editor.inspector.assign.label`), eine Referenz heißt `Referenz`
	// (`dialog.delete-reference.*`), und das Umhängen heißt `neu zuweisen`
	// (`dialog.delete-reference.reassign`). Die erste Fassung schrieb `Material` und
	// `Verweis`: der Nutzer drückte `Objekt zuweisen` bzw. `Referenzen entfernen` und
	// wurde mit einem Satz über ein `Material` bzw. einen `Verweis` abgewiesen — zwei
	// Namen für eine Sache, in einem Ablauf. Genau das soll eine übersetzte Absage
	// verhindern.
	//
	// Diese Regel wurde in Slice 14 erneut gebrochen: `empty.project.no-projects.body`
	// schrieb `Materialien`, vierzig Zeilen unter diesem Absatz. Seit dem Politur-Durchgang
	// zu Slice 11/14 prüft `tests/presentation/i18n/strings.test.ts` beide Begriffe, weil
	// eine Regel, die nur als Kommentar existiert, genau so lange hält, wie sie jemand
	// liest. `Vault` steht dort ebenfalls: es ist Obsidians eigener Name und wird nicht
	// übersetzt — fünf Schlüssel übersetzten ihn vorher, VIER davon als `Tresor` (einer
	// als `Das Tresor`, einer als `Der Tresor` — zwei Schlüssel, ein Substantiv, zwei
	// Genera), der fünfte als
	// das verstümmelte `Tresnornder`. Genau diese Vier-gegen-Fünf ist der Grund für die
	// zweite Prüfung: eine verbotene Schreibweise fängt nur das falsche Wort, an das
	// jemand gedacht hat, und `Tresnornder` enthält `Tresor` nicht.
	'reference.referents-exist': 'Andere Einträge referenzieren dies noch. Entfernen Sie die Referenzen oder weisen Sie sie zuerst neu zu.',
	'reference.set-changed': 'Die Referenzen hierauf haben sich während Ihrer Entscheidung geändert. Bitte prüfen und erneut bestätigen.',
	'reference.resolution-required': 'Dies wird noch referenziert. Entscheiden Sie vor dem Löschen, was mit diesen Referenzen geschehen soll.',
	'reference.no-reassignment-target': 'In diesem Projekt gibt es keine andere Zone, der diese Anforderungen zugewiesen werden könnten.',
	'reference.self-reassign': 'Referenzen können nicht dem zu löschenden Eintrag neu zugewiesen werden. Bitte einen anderen wählen.',
	'reference.cross-project-reassign': 'Referenzen können nur innerhalb desselben Projekts neu zugewiesen werden.',
	// Zeilen im Löschdialog (Slice 15, Punkt 6): zwei Schlüssel statt eines mit fest
	// verdrahtetem Trennzeichen — Wortstellung und Interpunktion um einen eingesetzten
	// Namen gehören der Übersetzung.
	'reference.row.project': '{name}',
	'reference.row.project-at-path': '{name} — {path}',
	'requirement.unit-not-area': 'Dieses Objekt wird nicht in Fläche gemessen; die Fläche einer Zone kann seine Menge daher nicht bestimmen.',
	'requirement.negative-quantity': 'Eine Menge darf nicht negativ sein.',
	'error.requirement.quantity.unparseable': 'Geben Sie eine Zahl ein, oder setzen Sie auf den berechneten Wert zurück.',
	'error.requirement.cost.unparseable': 'Geben Sie einen Betrag ein, oder setzen Sie auf den berechneten Wert zurück.',
	'error.suffix.schema-version-unsupported':
		'Diese Notiz wurde von einer neueren Version dieses Plugins geschrieben. Aktualisieren Sie das Plugin, um sie zu öffnen.',
	'error.suffix.revision-conflict':
		'Dieser Eintrag wurde zwischenzeitlich an anderer Stelle geändert. Bitte neu laden und erneut versuchen.',
	'error.suffix.external-modification':
		'Dieser Eintrag wurde außerhalb des Plugins bearbeitet. Bitte neu laden und erneut versuchen.',
	'error.suffix.migration-failed': 'Diese Notiz konnte nicht in das aktuelle Format umgewandelt werden.',
	'error.category.domain': 'Die Projektdaten sind ungültig.',
	'error.category.validation': 'Diese Daten haben nicht die erwartete Form.',
	'error.category.persistence': 'Der Vault konnte nicht gelesen oder geschrieben werden.',
	'error.category.geometry': 'Ein Geometriewert ist ungültig.',
	'error.category.import': 'Der Import ist fehlgeschlagen.',
	'error.category.migration': 'Diese Notiz kann mit dieser Version des Plugins nicht gelesen werden.',
	'error.category.reference': 'Dieser Eintrag existiert nicht mehr.',
	'error.category.calculation': 'Eine Menge konnte nicht berechnet werden.',
	'dialog.confirm': 'Bestätigen',
	'dialog.cancel': 'Abbrechen',
	'dialog.delete-reference.referenced-by': 'Referenziert von',
	'dialog.delete-reference.remove-references': 'Referenzen entfernen',
	'dialog.delete-reference.reassign': 'Neu zuweisen',
	'dialog.delete-reference.delete-anyway': 'Trotzdem löschen',
	'dialog.entity-picker.empty': 'Nichts zur Auswahl.',
	'dialog.form.submit': 'Speichern',
	'notice.severity.success': 'Erfolg',
	'notice.severity.info': 'Information',
	'notice.severity.warning': 'Warnung',
	'notice.severity.error': 'Fehler',
	'notice.dismiss': 'Schließen',
	'empty.project.no-projects.headline': 'Noch keine Renovierungsprojekte',
	'empty.project.no-projects.body': 'Ein Renovierungsprojekt enthält Ihre Grundrisse, Zonen, Objekte und Kosten. Erstellen Sie eines, um zu beginnen.',
	'empty.plan.no-background.headline': 'Noch kein Plandokument',
	'empty.plan.no-background.body': 'Legen Sie einen Grundriss, Lageplan, eine Skizze oder einen Gartenplan als Hintergrund dieses Plans fest und kalibrieren Sie ihn, damit Flächen in echten Einheiten herauskommen.',
	'empty.plan.no-zones.headline': 'Noch keine Zonen',
	'empty.plan.no-zones.body': 'Zeichnen Sie die erste Zone auf diesem Plan. Ihre Fläche wird aus dem Umriss gemessen und bestimmt Mengen und Kosten für alles, was Sie ihr zuweisen.',
	'empty.plan.no-zones.action': 'Zone zeichnen',
	// Design slice 17: die Fehlerzustände, die den Inhalt einer Ansicht ersetzen.
	'view.failure.retry': 'Erneut versuchen',
	'view.project.failed.headline': 'Projekte konnten nicht geladen werden',
	'editor.plan-failed.headline': 'Dieser Grundriss konnte nicht geladen werden',
	'editor.refresh-failed': 'Dieser Grundriss konnte nach der letzten Änderung nicht neu gelesen werden; die Anzeige ist möglicherweise nicht aktuell.',
	// „Zonen“, wie überall sonst in dieser Oberfläche — siehe `zone.listing-incomplete`.
	'editor.some-zones-unreadable':
		'{count} Zone(n) in diesem Grundriss konnten nicht gelesen werden und werden nicht gezeichnet. Der Diagnosebericht zeigt, welche Notizen abgelehnt wurden.',
	'editor.plan-missing.headline': 'Diesen Grundriss gibt es nicht mehr',
	'editor.plan-missing.body': 'Dieser Tab verweist auf einen Grundriss, der nicht mehr im Vault ist.',
	'editor.plan-missing.action': 'Tab schließen',
	'view.session-failure.headline': 'Renovation Planner konnte nicht gestartet werden',
	'view.project.loading': 'Projekte werden geladen …',
	// Kein zweiter Satz über einen Diagnosebericht: den gibt es in diesem Build nicht — siehe
	// den Kommentar am gleichen Schlüssel in `en.ts`.
	'view.project.some-unreadable': 'Einige Projekte konnten nicht aus dem Vault gelesen werden.',
	'view.project.some-plans-unreadable':
		'{count} Grundriss(e) in diesem Projekt konnten nicht gelesen werden. Der Diagnosebericht zeigt, welche Notizen abgelehnt wurden.',
	'form.new-project.title': 'Neues Renovierungsprojekt',
	'form.new-project.name': 'Name',
	'form.new-project.status': 'Status',
	'form.new-project.description': 'Beschreibung',
	'form.new-project.start': 'Beginn',
	'form.new-project.target-completion': 'Fertigstellungstermin',
	'form.new-project.status.idea': 'Idee',
	'form.new-project.status.survey': 'Bestandsaufnahme',
	'form.new-project.status.design': 'Planung',
	'form.new-project.status.estimate': 'Kostenschätzung',
	'form.new-project.status.procurement': 'Beschaffung',
	'form.new-project.status.ready': 'Bereit',
	'form.new-project.status.execution': 'Ausführung',
	'form.new-project.status.inspection': 'Abnahme',
	'form.new-project.status.complete': 'Abgeschlossen',
	'form.new-project.status.as-built': 'Bestandsdokumentation',
	'empty.project.no-projects.action': 'Projekt erstellen',
	'view.project.list-title': 'Renovierungsprojekte',
	'view.project.create': 'Neues Projekt',
	// `Grundriss`/`Grundrisse` is this file's own word for a plan ('command.open-plan-editor':
	// 'Grundriss-Editor öffnen') — the vocabulary comes from the file, never from a dictionary.
	'view.project.back': 'Zurück zu den Projekten',
	'view.project.open-note': 'Notiz öffnen',
	'view.project.plans-title': 'Grundrisse',
	'view.project.create-plan': 'Neuer Grundriss',
	'form.new-plan.title': 'Neuer Grundriss',
	'form.new-plan.name': 'Name',
	// SIEZEN, wie jeder andere Fließtext in dieser Datei ('Erstellen Sie eines, um zu beginnen.',
	// 'Zeichnen Sie die erste Zone auf diesem Plan.'): die englische Vorlage kennt diese
	// Unterscheidung nicht, und zwei Anreden in einer Oberfläche sind derselbe Fehler wie zwei
	// Namen für eine Sache.
	'empty.project.no-plans.headline': 'Noch keine Grundrisse',
	'empty.project.no-plans.body': 'Fügen Sie einen Grundriss hinzu, um Zonen zu zeichnen und Mengen zu ermitteln.',
	'empty.project.no-plans.action': 'Neuer Grundriss',
	'view.project.gone': 'Dieses Projekt existiert nicht mehr.',
	'view.project.gone-body': 'Es wurde möglicherweise gelöscht oder aus diesem Vault verschoben. Gehen Sie zurück zur Projektliste.',
	// 'überlappt', the verb `settings.library-overlaps-source` already uses for the same
	// relation — one noun and one verb per concept, which is the rule the 'Material'/'Objekt'
	// correction was made for.
	'view.project.library-overlap': 'Überlappt den Bibliotheksordner',
	'project.empty-name': 'Ein Projekt braucht einen Namen.',
	'project.unknown-status': 'Wählen Sie einen Status aus der Liste.',
	'project.target-before-start': 'Der Fertigstellungstermin muss am oder nach dem Beginn liegen.',
	'project.invalid-date': 'Geben Sie ein echtes Kalenderdatum ein.',
	'plan.empty-name': 'Ein Grundriss braucht einen Namen.',
	'save-state.saved': 'Gespeichert',
	'save-state.saving': 'Wird gespeichert',
	'save-state.unsaved-changes': 'Nicht gespeicherte Änderungen',
	'save-state.save-error': 'Fehler beim Speichern',
};

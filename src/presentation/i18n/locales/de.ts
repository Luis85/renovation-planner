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
	'settings.project-folder.name': 'Standardordner für neue Projekte',
	'settings.project-folder.desc':
		'Vault-Ordner, in dem der Ordner eines neuen Projekts angelegt wird. Ein bestehendes Projekt behält den Ordner, in dem es sich bereits befindet.',
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
	'entity.requirement.plural': 'Anforderungen',
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
	'requirement.unit-not-area': 'Dieses Objekt wird nicht in Fläche gemessen; die Fläche einer Zone kann seine Menge daher nicht bestimmen.',
	'requirement.cross-project': 'Eine Zone und ein Objekt aus verschiedenen Projekten können nicht verknüpft werden.',
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
	'editor.plan-missing.headline': 'Diesen Grundriss gibt es nicht mehr',
	'editor.plan-missing.body': 'Dieser Tab verweist auf einen Grundriss, der nicht mehr im Vault ist.',
	'editor.plan-missing.action': 'Tab schließen',
	'view.session-failure.headline': 'Renovation Planner konnte nicht gestartet werden',
	'view.project.loading': 'Projekte werden geladen …',
	// Kein zweiter Satz über einen Diagnosebericht: den gibt es in diesem Build nicht — siehe
	// den Kommentar am gleichen Schlüssel in `en.ts`.
	'view.project.some-unreadable': 'Einige Projekte konnten nicht aus dem Vault gelesen werden.',
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
	'project.empty-name': 'Ein Projekt braucht einen Namen.',
	'project.unknown-status': 'Wählen Sie einen Status aus der Liste.',
	'project.target-before-start': 'Der Fertigstellungstermin muss am oder nach dem Beginn liegen.',
	'project.invalid-date': 'Geben Sie ein echtes Kalenderdatum ein.',
	'save-state.saved': 'Gespeichert',
	'save-state.saving': 'Wird gespeichert',
	'save-state.unsaved-changes': 'Nicht gespeicherte Änderungen',
	'save-state.save-error': 'Fehler beim Speichern',
};

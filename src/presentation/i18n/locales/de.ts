/**
 * German. `Partial` on purpose: a key this table does not answer falls back to English
 * PER KEY in `t`, so an incomplete translation degrades one string at a time instead of
 * failing the locale. (German noun capitalization is why the English sentence-case lint
 * deliberately does not run here.)
 *
 * `deAssetLibrary` is spread in for the same reason `en.ts` spreads `enAssetLibrary`: this
 * file had no `max-lines` headroom for the Asset library's §8 inventory, whose SIZE is
 * stated by `strings.test.ts`'s own pin rather than restated here — a count in a docblock
 * is wrong at the next key, and that pin is the thing a gate actually holds.
 * `de` is still the one object `strings.test.ts`'s completeness check reads.
 *
 * **Split at Task 20**, alongside `en.ts` and for the same reason: this table was at its
 * 400-line budget (`max-lines`, which skips blanks and comments) with no room for the next
 * handful of keys. `de/editor.ts` holds the German half of the Plan Editor's own
 * vocabulary — the counterpart of `en/editor.ts`, spread into this object below
 * (`...editorDe,`) — and its own header explains why it is typed `Record` rather than this
 * table's `Partial`.
 */
import type { StringKey } from './en';
import { deAssetLibrary } from './de-assetLibrary';
import { editorDe } from './de/editor';

export const de: Partial<Record<StringKey, string>> = {
	...editorDe,
	'command.open-project': 'Renovierungsprojekt öffnen',
	'command.open-project-detail': 'Zu Renovierungsprojekt wechseln',
	'view.project.name': 'Renovierungsprojekt',
	'settings.units.name': 'Einheiten',
	'settings.units.desc': 'Maßsystem für Mengen und Abmessungen.',
	'settings.units.metric': 'Metrisch',
	'settings.units.imperial': 'Imperial',
	'settings.unrecovered': 'Einstellungen konnten nicht gelesen werden. data.json im Plugin-Ordner reparieren oder entfernen, dann Obsidian neu laden.',
	'settings.project-folder.name': 'Standardordner für neue Projekte',
	'settings.project-folder.desc': 'Vault-Ordner, in dem der Ordner eines neuen Projekts angelegt wird. Ein bestehendes Projekt behält den Ordner, in dem es sich bereits befindet.',
	'settings.library-folder.name': 'Bibliotheksordner',
	'settings.library-folder.current': 'Zurzeit {folder}. Eine Änderung verschiebt die Notizen.',
	'settings.library-folder.move.name': 'Bibliothek verschieben',
	'settings.library-folder.move.desc': 'Einen neuen Ordner wählen und den Katalog dorthin verschieben.',
	'settings.library-folder-empty': 'Ein Bibliotheksordner darf nicht leer sein.',
	'settings.library-overlaps-project': 'Dieser Ordner liegt in einem Projektordner oder enthält einen.',
	'settings.library-overlaps-source': 'Dieser Ordner überlappt den aktuellen Bibliotheksordner.',
	'settings.library-source-is-vault-root': 'Der Bibliotheksordner ist derzeit der gesamte Vault, es gibt also nichts, woraus er verschoben werden könnte. Setzen Sie ihn zuerst in der data.json auf einen echten Ordner.',
	'settings.library-source-case-mismatch': 'Der Bibliotheksordner existiert nicht in der Schreibweise, die diese Einstellung nennt, aber ein ähnlich benannter Ordner ist vorhanden. Bitte diesen Ordner passend umbenennen, bevor verschoben wird.',
	'settings.library-refresh-failed':
		'Die App konnte den Vault nicht einlesen. Es wurde nichts verschoben und die Einstellung wurde nicht geändert. Bitte erneut versuchen oder Obsidian neu laden.',
	'settings.library-move-failed':
		'Die Bibliothek konnte nicht verschoben werden, die Einstellung wurde nicht geändert.',
	'settings.library-rebuild-failed':
		'Der Katalog wurde verschoben, aber die App konnte die Änderung nicht nachvollziehen. Bitte Obsidian neu laden und dann den Bibliotheksordner auf den neuen Ort setzen.',
	'settings.library-persist-failed':
		'Der Katalog wurde verschoben, aber die Einstellung konnte nicht gespeichert werden. Bitte den Bibliotheksordner auf den neuen Ort setzen.',
	'project.folder-overlaps-library': 'Dieser Projektordner würde den Bibliotheksordner überlappen.',
	'settings.default-currency.name': 'Standardwährung',
	'settings.default-currency.desc':
		'Die Währung, in der ein neues Projekt kalkuliert wird. Ein Projekt ohne eigene Währung folgt dieser Einstellung.',
	// „Zone“ war einmal das Wort dieser Oberfläche, und der Beleg, den dieser Kommentar dafür
	// nannte, sagt es nicht mehr: `editor.inspector.delete-zone.reassign-title` fragt seit
	// Task 6 nach „Raum oder Fläche“ (ADR-0016). Wo eine Zeichenfläche gemeint ist, heißt es
	// hier weiterhin „Zone“ — nur eben nicht dort, wo ein Bewohner mitliest.
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
	// „Räume oder Flächen“ statt „Zonen“, aus demselben Grund wie bei
	// `reference.no-reassignment-target`: Diese Absage ersetzt die Auswahlliste im Löschdialog
	// des Grundriss-Editors.
	'zone.listing-incomplete':
		'Einige Räume oder Flächen in diesem Projekt konnten nicht gelesen werden, daher ist die Liste möglicher Ziele unvollständig. Der Diagnosebericht zeigt, welche Notizen abgelehnt wurden.',
	'asset.listing-incomplete':
		'Einige Objekte im Katalog konnten nicht gelesen werden, daher ist die Liste möglicher Objekte unvollständig. Der Diagnosebericht zeigt, welche Notizen abgelehnt wurden.',
	'settings.verbose-logging.name': 'Ausführliche Protokollierung',
	'settings.verbose-logging.desc': 'Debug-Meldungen in der Entwicklerkonsole anzeigen. Alles bleibt auf diesem Gerät.',
	'view.geometry.name': 'Geometrie-Seitendatei',
	'view.plan-editor.name': 'Grundriss-Editor',
	'command.open-plan-editor': 'Grundriss-Editor öffnen',
	'command.set-plan-background': 'Grundriss-Hintergrund festlegen',
	'command.open-asset-designer': 'Objekt-Designer öffnen',
	'command.create-sample-project': 'Beispielprojekt anlegen',
	'command.new-project': 'Neues Projekt',
	'plan.none': 'In diesem Vault gibt es noch keine Grundrisse.',
	'asset.none': 'In diesem Vault gibt es noch keine Objekte.',
	'sample.project.name': 'Beispiel-Renovierung',
	'sample.plan.name': 'Erdgeschoss',
	'sample.zone.kitchen': 'Küche',
	'sample.zone.bathroom': 'Badezimmer',
	'sample.zone.living-room': 'Wohnzimmer',
	'sample.zone.terrace': 'Terrasse',
	'sample.zone.garden': 'Garten',
	// Keys that are not `editor.*` but sit where the moved block used to be read — see
	// `de/editor.ts`'s own header (and `en/editor.ts`'s) for why they stayed.
	'sequence.marker-clear-failed': 'Das Löschen wurde gespeichert, aber der Wiederherstellungseintrag konnte nicht aus dem Vault entfernt werden. Er wird beim nächsten Öffnen dieses Vaults entfernt.',
	'asset-price.cleanup-failed': 'Das Objekt wurde gelöscht, aber eine Preisnotiz dafür konnte nicht aus dem Vault entfernt werden. Löschen Sie sie von Hand, falls Sie sie finden.',
	'cascade.stale-marker-failed': 'Eine Anforderung konnte nicht als veraltet markiert werden. Ihre Werte können falsch sein, bis sie neu berechnet wird.',
	'cascade.aborted': 'Mit dieser Änderung verknüpfte Anforderungen konnten nicht aktualisiert werden. Ihre Werte können veraltet sein.',
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
	// „Raum oder Fläche“ statt „Zone“: Diese Absage erscheint im Löschdialog des
	// Grundriss-Editors, dessen Beschriftungen daneben ebenfalls von Räumen und Flächen
	// sprechen. Zwei Substantive verschiedenen Geschlechts (der Raum, die Fläche), daher
	// „keinen anderen Raum und keine andere Fläche“ und ein Plural-Relativpronomen im Dativ.
	'reference.no-reassignment-target':
		'In diesem Projekt gibt es keinen anderen Raum und keine andere Fläche, denen diese Anforderungen zugewiesen werden könnten.',
	'reference.no-reassignment-asset':
		'In diesem Vault gibt es kein anderes flächenbasiertes Objekt, dem diese Anforderungen zugewiesen werden könnten.',
	'reference.self-reassign': 'Referenzen können nicht dem zu löschenden Eintrag neu zugewiesen werden. Bitte einen anderen wählen.',
	'reference.cross-project-reassign': 'Referenzen können nur innerhalb desselben Projekts neu zugewiesen werden.',
	// Zeilen im Löschdialog (Slice 15, Punkt 6): zwei Schlüssel statt eines mit fest
	// verdrahtetem Trennzeichen — Wortstellung und Interpunktion um einen eingesetzten
	// Namen gehören der Übersetzung.
	'reference.row.project': '{name}',
	'reference.row.project-at-path': '{name} — {path}',
	'requirement.unit-not-area': 'Dieses Objekt wird nicht in Fläche gemessen; die Fläche einer Zone kann seine Menge daher nicht bestimmen.',
	'requirement.negative-quantity': 'Eine Menge darf nicht negativ sein.',
	'cost.currency-mismatch':
		'Der Preis dieses Objekts ist nicht in der Währung dieses Projekts, daher kann keine Schätzung erstellt werden. Öffnen Sie die Notiz des Objekts und erfassen Sie den Preis in der Währung dieses Projekts.',
	'requirement.project-not-found': 'Diese Zone gehört zu einem Projekt, das nicht mehr vorhanden ist.',
	'requirement.project-gone': 'Dieser Bedarf gehört zu einem Projekt, das nicht mehr vorhanden ist.',
	// Beide Kalibrierungs-Ablehnungen gelten für beide Oberflächen — ein Grundriss und ein
	// Objekt teilen sich dasselbe Werkzeug —, also nennt keiner der beiden Sätze das eine
	// oder das andere.
	'calibration.coincident-points':
		'Diese beiden Punkte liegen an derselben Stelle. Wählen Sie zwei Punkte mit einem echten Abstand dazwischen.',
	'calibration.degenerate-scale':
		'Diese beiden Punkte und dieser Abstand ergeben keinen brauchbaren Maßstab. Wählen Sie zwei weiter entfernte Punkte, oder prüfen Sie den eingegebenen Abstand.',
	'error.requirement.quantity.unparseable': 'Geben Sie eine Zahl ein, oder setzen Sie auf den berechneten Wert zurück.',
	'error.requirement.cost.unparseable': 'Geben Sie einen Betrag ein, oder setzen Sie auf den berechneten Wert zurück.',
	'zone.sidecar-insert-uncompensated':
		'Ein Raum wurde geschrieben, aber seine Form konnte nicht gespeichert werden, und die Notiz konnte nicht wieder entfernt werden. Prüfen Sie die Notiz des Raums, bevor Sie weiter bearbeiten.',
	'zone.sidecar-update-uncompensated':
		'Ein Raum wurde geändert, aber seine Form konnte nicht gespeichert werden, und die Notiz konnte nicht wiederhergestellt werden. Prüfen Sie die Notiz des Raums, bevor Sie weiter bearbeiten.',
	'error.asset.unit-cost.unparseable': 'Geben Sie einen Betrag ein, zum Beispiel 34.95.',
	'error.asset.waste.unparseable': 'Geben Sie einen Bruchteil zwischen 0 und 1 ein, zum Beispiel 0.08.',
	'error.suffix.schema-version-unsupported':
		'Diese Notiz wurde von einer neueren Version dieses Plugins geschrieben. Aktualisieren Sie das Plugin, um sie zu öffnen.',
	'error.suffix.revision-conflict':
		'Dieser Eintrag wurde zwischenzeitlich an anderer Stelle geändert. Bitte neu laden und erneut versuchen.',
	'error.suffix.external-modification':
		'Dieser Eintrag wurde außerhalb des Plugins bearbeitet. Bitte neu laden und erneut versuchen.',
	// Die Absagen des Preisbereichs, nach dem exakten `AppError.code` ihrer Fundstellen benannt.
	// Zwei davon überschreiben absichtlich einen Suffix-Eintrag: `toUserMessage` fragt zuerst
	// `hasLocaleKey(error.code)`, und auf dieser Oberfläche gibt es nichts neu zu laden.
	'asset-price.currency-mismatch': 'Ein Preis muss in der Währung des Projekts angegeben sein.',
	'asset-price.revision-conflict':
		'Dieser Preis wurde an anderer Stelle geändert. Verwerfen Sie Ihre Eingabe, um den aktuellen zu sehen.',
	'asset-price.external-modification':
		'Dieser Preis wurde außerhalb des Plugins bearbeitet. Verwerfen Sie Ihre Eingabe, um den aktuellen zu sehen.',
	'asset-price.project-not-found': 'Dieses Projekt ist nicht mehr vorhanden.',
	'asset-price.asset-not-found': 'Dieses Objekt ist nicht mehr vorhanden.',
	'asset-price.write-failed': 'Der Preis konnte nicht gespeichert werden.',
	'asset-price.delete-failed': 'Der Preis konnte nicht entfernt werden.',
	'asset-price.entity-invalid': 'Diese Preisnotiz konnte nicht gelesen werden.',
	'asset-price.frontmatter-invalid': 'Diese Preisnotiz konnte nicht gelesen werden.',
	'asset-price.negative-unit-cost': 'Ein Preis kann nicht negativ sein.',
	'error.suffix.migration-failed': 'Diese Notiz konnte nicht in das aktuelle Format umgewandelt werden.',
	'error.suffix.schema-version-malformed':
		'Die Version dieser Notiz konnte nicht gelesen werden, daher wurde sie nicht geöffnet.',
	'error.suffix.project-folder-unresolved':
		'Diese Notiz konnte nicht gespeichert werden, weil der Ordner des zugehörigen Projekts nicht gefunden wurde.',
	'error.suffix.note-id-mismatch':
		'Diese Notiz gehört zu einem anderen Eintrag, daher wurde sie nicht geöffnet. Lade den Vault neu, um den Index neu aufzubauen.',
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
	'empty.plan.no-zones.headline': 'Noch keine Räume',
	'empty.plan.no-zones.body': 'Fügen Sie den ersten Raum auf diesem Geschoss hinzu. Seine Fläche wird aus dem Umriss gemessen und bestimmt Mengen und Kosten für alles, was Sie ihm zuweisen.',
	'empty.plan.no-zones.action': 'Raum hinzufügen',
	// Design slice 17: die Fehlerzustände, die den Inhalt einer Ansicht ersetzen.
	'view.failure.retry': 'Erneut versuchen',
	'view.project.failed.headline': 'Projekte konnten nicht geladen werden',
	'editor.plan-failed.headline': 'Dieser Grundriss konnte nicht geladen werden',
	'editor.refresh-failed': 'Dieser Grundriss konnte nach der letzten Änderung nicht neu gelesen werden; die Anzeige ist möglicherweise nicht aktuell.',
	// Reviewer round 1 (Task 6): eine Notiz, die nicht gelesen werden konnte, kann ein Raum
	// oder eine Fläche sein. Damals stand hier, `zone.listing-incomplete` sage weiterhin
	// „Zonen“, weil es kein `editor.`/`empty.plan.`-Präfix trägt und die „nie Zone“-Regel es
	// deshalb nicht erfasst. Das Präfix erfasst es immer noch nicht — die Endabnahme hat den
	// Schlüssel dennoch umformuliert, weil er im Löschdialog genau dieses Editors erscheint;
	// `strings.test.ts` prüft ihn jetzt namentlich.
	'editor.some-zones-unreadable':
		'{count} Raum/Räume oder Fläche(n) in diesem Grundriss konnten nicht gelesen werden und werden nicht gezeichnet. Der Diagnosebericht zeigt, welche Notizen abgelehnt wurden.',
	'editor.plan-missing.headline': 'Diesen Grundriss gibt es nicht mehr',
	'editor.plan-missing.body': 'Dieser Tab verweist auf einen Grundriss, der nicht mehr im Vault ist.',
	'editor.plan-missing.action': 'Tab schließen',
	'view.session-failure.headline': 'Renovation Planner konnte nicht gestartet werden',
	'view.project.loading': 'Projekte werden geladen …',
	// Kein zweiter Satz über einen Diagnosebericht — den gibt es in diesem Build inzwischen
	// sehr wohl; der Grund steht jetzt am gleichen Schlüssel in `en.ts` und ist ein anderer.
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
	'view.project.currency': 'Kalkuliert in {currency}',
	'view.project.plans-title': 'Grundrisse',
	'view.project.create-plan': 'Neuer Grundriss',
	'view.project.filter.label': 'Projekte filtern',
	'view.project.filter.placeholder': 'Nach Namen filtern',
	'view.project.count-one': '1 Projekt',
	'view.project.count-many': '{count} Projekte',
	'view.project.filter.matches': '{shown} von {total}',
	'view.project.filter.none': 'Kein Projekt passt zu „{query}“.',
	'view.project.filter.clear': 'Filter zurücksetzen',
	'view.project.create-named': 'Neues Projekt namens „{query}“',
	'view.project.group.continue': 'Weitermachen',
	'view.project.group.projects': 'Projekte',
	'view.project.group.completed': 'Abgeschlossen ({count})',
	'view.project.continue.resume': 'Weitermachen',
	'view.project.continue.open': 'Öffnen',
	'view.project.plans-one': '1 Plan',
	'view.project.plans-many': '{count} Pläne',
	'view.project.keys': '↵ öffnen · {mod}↵ Notiz öffnen',
	// Der Preisbereich eines Projekts. Ein Asset heißt hier `Objekt`, niemals `Material` —
	// `tests/presentation/i18n/strings.test.ts` weist diesen Wert zurück, und Slice 14 hat ihn
	// vierzig Zeilen unter dem Kommentar wieder eingeführt, das seine Entfernung festhielt.
	'view.project.prices-title': 'Objektpreise',
	'view.project.price-catalogue': 'Bibliothekspreis',
	'view.project.price-yours': 'Dieses Projekt',
	'view.project.price-set': 'Preis festlegen',
	'view.project.price-clear': 'Bibliothekspreis verwenden',
	'view.project.no-assets': 'Die Bibliothek enthält noch keine Objekte',
	// Zeigt die FORM, statt sie zu beschreiben — genau wie die englische Fassung, und aus
	// demselben Grund: „ein gültiger Geldbetrag“ sagt niemandem, dass `.5` und `1e3` zu den
	// zurückgewiesenen Schreibweisen gehören.
	//
	// **Der Dezimalpunkt wird NICHT lokalisiert, und das ist der ganze Zweck dieses
	// Schlüssels statt eine Nachlässigkeit.** `AMOUNT_PATTERN` in `core/money/Money.ts`
	// akzeptiert allein den Punkt — gemessen, nicht vermutet: `"19.50"` wird angenommen,
	// `"19,50"` mit `money.invalid-amount` zurückgewiesen. Ein lokalisiertes `19,50` würde
	// also genau die Schreibweise vorschlagen, die `validatePrice` ablehnt, und die
	// Benutzerin in eine Schleife schicken: eintippen, abgelehnt, dasselbe Beispiel wieder
	// lesen. Diese Zeile hat einmal `19,50` gesagt und wurde erst bei der abschließenden
	// Durchsicht des Increments gefunden — kein Gate rendert `de.ts`, und die beiden Prüfungen
	// in `strings.test.ts` fragten damals nach Begriffen und Platzhaltern, nicht nach
	// Beispielen. Sie ändert sich, wenn das Eingabefeld eines Tages ein Komma annimmt — und
	// `tests/presentation/i18n/strings.test.ts` fragt jetzt genau danach.
	'view.project.price-invalid': 'Geben Sie einen Preis wie 19.50 ein',
	'view.project.price-negative': 'Ein Preis kann nicht negativ sein.',
	'view.project.price-scope':
		'Ein hier festgelegter Preis gilt für jede Anforderung in diesem Projekt, die das Objekt verwendet',
	// Zwei Sätze für zwei Zustände, die `AssetPriceRowDto` bewusst auseinanderhält: der eine
	// benennt eine Löschung, der andere nur eine fehlgeschlagene Lektüre der Notiz. Ein
	// gemeinsamer Schlüssel würde einer Person sagen, ihr Objekt sei fort, obwohl seine Notiz
	// heute lediglich nicht gelesen werden kann.
	'view.project.price-orphan': 'Dieses Objekt ist nicht mehr in der Bibliothek',
	'view.project.price-unreadable':
		'Die Notiz zu diesem Objekt konnte nicht gelesen werden. Der Preis kann hier erst wieder '
		+ 'festgelegt werden, wenn die Notiz repariert ist.',
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
	// Design slice A10. „Objekt“ für Asset, nie „Material“ — siehe die Korrektur in Slice 11.
	//
	// Die Kategorie `material` heißt hier deshalb „Baustoff“ und nicht „Material“: das ist
	// das treffendere deutsche Wort für eine Baustoff-Kategorie UND es hält die Regel ein,
	// die `strings.test.ts` als Teilstring über die ganze Datei prüft. Zwei Gründe, ein Wort.
	'asset.empty-name': 'Ein Objekt braucht einen Namen.',
	'asset.unknown-category': 'Wählen Sie eine Kategorie aus der Liste.',
	'asset.negative-unit-cost': 'Ein Stückpreis kann nicht negativ sein.',
	'asset.unit-kind-referenced':
		'Dieses Objekt wird von einer Anforderung verwendet, daher kann seine Einheit nicht zu einer anderen Messgröße wechseln.',
	'asset.negative-waste-factor-default': 'Ein Verschnitt kann nicht negativ sein.',
	'asset.waste-factor-default-above-one': 'Ein Verschnitt ist ein Bruchteil zwischen 0 und 1.',
	'asset.invalid-height': 'Geben Sie eine Höhe als Zahl in Millimetern ein.',
	'asset.negative-height': 'Eine Höhe kann nicht negativ sein.',
	'asset.non-positive-dimension': 'Breite und Tiefe müssen jeweils größer als null sein.',
	'asset.dimension-underflow': 'Diese Maße sind zu klein für ein Rechteck.',
	'asset.invalid-footprint': 'Dieser Umriss ist keine Form, die gespeichert werden kann.',
	'asset.degenerate-footprint': 'Dieser Umriss umschließt keine Fläche.',
	'asset.invalid-clearance': 'Dieser Freiraum ist keine Form, die gespeichert werden kann.',
	'asset.degenerate-clearance': 'Dieser Freiraum umschließt keine Fläche.',
	'asset.invalid-anchor': 'Ein Ankerpunkt braucht endliche Koordinaten.',
	'asset.invalid-facing': 'Eine Ausrichtung braucht einen endlichen Winkel.',
	'asset.facing-without-direction':
		'Ziehen Sie in die Richtung, in die das Objekt zeigt; ein Klick allein nennt keine.',
	'asset.typed-footprint-cannot-be-pending':
		'Ein eingegebener Umriss ist bereits in Millimetern und wartet daher auf keinen Maßstab.',
	'asset.absent-clearance-cannot-be-pending': 'Es gibt keinen Freiraum, der auf einen Maßstab warten könnte.',
	'asset.no-footprint':
		'Geben Sie diesem Objekt zuerst einen Umriss; Freiraum, Ankerpunkt und Ausrichtung beziehen sich jeweils darauf.',
	'asset.not-found': 'Dieses Objekt existiert nicht mehr.',
	'asset.background-not-found': 'Diese Datei ist nicht mehr im Vault. Wählen Sie ein anderes Datenblatt.',
	'plan.background-not-found': 'Diese Datei ist nicht mehr im Vault. Wählen Sie ein anderes Plandokument.',
	'asset.dimensions-incomplete': 'Ein Rechteck braucht Breite und Tiefe.',
	'money.invalid-amount': 'Geben Sie einen Betrag als einfache Dezimalzahl ein, zum Beispiel 45.00.',
	'money.invalid-currency': 'Geben Sie einen dreibuchstabigen Währungscode in Großbuchstaben ein.',
	'form.new-asset.title': 'Neues Objekt',
	'form.new-asset.name': 'Name',
	'form.new-asset.category': 'Kategorie',
	'form.new-asset.unit': 'Einheit',
	'form.new-asset.unit-cost': 'Stückpreis',
	'form.new-asset.currency': 'Währung',
	'form.new-asset.width': 'Breite in Millimetern (optional)',
	'form.new-asset.depth': 'Tiefe in Millimetern (optional)',
	'form.new-asset.already-created':
		'Das Objekt ist gespeichert. Seine Angaben lassen sich im Katalog bearbeiten; nur die Maße unten stehen noch aus.',
	'form.new-asset.category.material': 'Baustoff',
	'form.new-asset.category.furniture': 'Möbel',
	'form.new-asset.category.fixture': 'Einbauteil',
	'form.new-asset.category.plant': 'Pflanze',
	'form.new-asset.category.equipment': 'Gerät',
	'form.new-asset.category.building-element': 'Bauteil',
	'form.new-asset.category.custom': 'Sonstiges',
	'form.new-asset.unit.piece': 'Stück',
	'form.new-asset.unit.m': 'Meter',
	'form.new-asset.unit.m2': 'Quadratmeter',
	'form.new-asset.unit.m3': 'Kubikmeter',
	'form.new-asset.unit.hour': 'Stunde',
	'form.new-asset.unit.day': 'Tag',
	'form.new-asset.unit.fixed': 'Pauschale',
	'view.asset.create': 'Neues Objekt',
	// Design slice B3 (ADR-0015). "Objekt" für Asset, nie "Material" — siehe den Kommentar
	// weiter oben in dieser Datei; "Material" ist hier eine Kategorie und kein Synonym.
	'empty.asset.no-shape.headline': 'Noch kein Umriss',
	'empty.asset.no-shape.body':
		'Ein Objekt erhält seinen Umriss aus eingegebenen Maßen oder aus einer über ein Datenblatt gezeichneten Kontur. Beides macht daraus etwas, das ein Grundriss aufnehmen kann.',
	'empty.asset.no-shape.action': 'Maße festlegen',
	'empty.asset.no-background.headline': 'Noch kein Datenblatt',
	'empty.asset.no-background.body':
		'Legen Sie ein Foto, eine Zeichnung oder ein Datenblatt als Hintergrund dieses Objekts fest und kalibrieren Sie es, damit eine gezeichnete Kontur in echten Einheiten herauskommt.',
	'empty.asset.no-background.action': 'Hintergrund wählen',
	'view.asset-designer.name': 'Objekt-Designer',
	'designer.canvas': 'Objekt-Zeichenfläche',
	'designer.toolbar': 'Objekt-Werkzeuge',
	'designer.toolbar.pan': 'Verschieben',
	'designer.toolbar.undo': 'Rückgängig',
	'designer.toolbar.redo': 'Wiederholen',
	'designer.toolbar.trace-footprint': 'Umriss nachzeichnen',
	'designer.toolbar.trace-clearance': 'Freiraum nachzeichnen',
	'designer.toolbar.set-anchor': 'Ankerpunkt setzen',
	'designer.toolbar.set-facing': 'Ausrichtung setzen',
	'designer.toolbar.calibrate': 'Kalibrieren',
	'designer.calibrate.recalibrate.title': 'Ohne Maßstab Nachgezeichnetes neu skalieren?',
	'designer.calibrate.recalibrate.message':
		'Ein Teil der Geometrie dieses Objekts wurde nachgezeichnet, bevor ein Maßstab vorlag. Beim Festlegen des Maßstabs wird sie in Millimeter umgerechnet. Sie können den Vorgang rückgängig machen.',
	'designer.background.pick': 'Hintergrund für dieses Objekt wählen',
	'designer.loading': 'Objekt wird geladen …',
	'designer.asset-failed.headline': 'Dieses Objekt konnte nicht geladen werden',
	'designer.asset-missing.headline': 'Dieses Objekt gibt es nicht mehr',
	'designer.asset-missing.body': 'Dieser Tab verweist auf ein Objekt, das nicht mehr im Vault ist.',
	'designer.asset-missing.action': 'Tab schließen',
	'designer.refresh-failed':
		'Dieses Objekt konnte nach der letzten Änderung nicht neu gelesen werden; die Anzeige ist möglicherweise nicht aktuell.',
	// „Objekt“, nie „Material“ — dasselbe Wort wie in jeder anderen Zeile dieses Abschnitts.
	'designer.background-missing': 'Die Hintergrunddatei dieses Objekts fehlt.',
	'designer.background-failed': 'Der Hintergrund dieses Objekts konnte nicht gezeichnet werden.',
	'designer.inspector': 'Inspektor',
	'designer.inspector.dimensions': 'Maße',
	'designer.inspector.dimensions.unscaled':
		'Dieser Umriss wurde gezeichnet, bevor ein Maßstab vorlag; diese Zahlen sind noch keine echten Maße.',
	'designer.inspector.edit-dimensions': 'Maße bearbeiten',
	'designer.inspector.set-dimensions': 'Maße festlegen',
	'designer.inspector.height': 'Höhe in Millimetern',
	'designer.inspector.height.unparseable': 'Geben Sie eine Höhe als Zahl ein, oder leeren Sie das Feld.',
	'designer.dimensions.edit.title': 'Maße dieses Objekts festlegen',
	// „Objekt“, nie „Material“. Statt der aktuellen Zahlen und nicht daneben: das Formular
	// bleibt leer, damit Platzhalterwerte nicht als echte Millimeter gespeichert werden.
	'designer.dimensions.unscaled':
		'Dieser Umriss wurde gezeichnet, bevor ein Maßstab vorlag; seine aktuelle Größe ist kein echtes Maß. Geben Sie die echte Breite und Tiefe ein, oder kalibrieren Sie zuerst den Hintergrund.',
	'designer.dimensions.width': 'Breite in Millimetern',
	'designer.dimensions.depth': 'Tiefe in Millimetern',
	'undo.superseded':
		'Diese Änderung wurde nach diesem Schritt an anderer Stelle bearbeitet; ein Rückgängigmachen würde diese Bearbeitung verwerfen. Laden Sie neu und machen Sie es erneut rückgängig, wenn Sie es weiterhin möchten.',
	'save-state.saved': 'Gespeichert',
	'save-state.saving': 'Wird gespeichert',
	'save-state.unsaved-changes': 'Nicht gespeicherte Änderungen',
	'save-state.save-error': 'Fehler beim Speichern',
	...deAssetLibrary,
};

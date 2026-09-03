/**
 * German for the Asset library's own copy (`en.assetLibrary.ts`), split out for the identical
 * reason: `de.ts` had 24 lines of `max-lines` headroom and this surface adds 58 keys. Spread
 * into `de.ts` rather than declared there, so `de` stays the one object the completeness check
 * in `strings.test.ts` reads.
 *
 * `Partial<Record<StringKey, string>>` at THIS declaration is what keeps "an orphaned German
 * key is a build failure" true here too: excess-property checking runs at the object literal
 * assigned to that type, wherever that assignment sits.
 *
 * German noun capitalization is why the English sentence-case lint does not run here, exactly
 * as `de.ts`'s own header says — this file is not matched by the "en" filename regex either.
 */
import type { StringKey } from './en';

export const deAssetLibrary: Partial<Record<StringKey, string>> = {
	'view.asset-library.title': 'Objekt-Bibliothek',
	'command.open-asset-library': 'Objekt-Bibliothek öffnen',
	'view.asset-library.search.label': 'Objekte durchsuchen',
	'view.asset-library.search.placeholder': 'Nach Name, Lieferant oder Artikelnummer suchen',
	'view.asset-library.search.results': '{count} passende Objekte',
	'view.asset-library.unselected': 'Nichts ausgewählt.',
	'view.asset-library.assets': '{count} Objekte',
	'view.asset-library.used-in': 'Verwendet in',
	'view.asset-library.used-in.none': 'In keinem Projekt verwendet',
	'view.asset-library.used-in.project': '{name} — {count} Anforderung(en)',
	'view.asset-library.used-in.vault-root': 'Vault-Wurzel',
	'view.asset-library.open-designer': 'Designer öffnen',
	'view.asset-library.open-note': 'Notiz öffnen',
	'view.asset-library.back': 'Zurück zur Bibliothek',
	'view.asset-library.delete': 'Löschen',
	'view.asset-library.shape': 'Form',
	'view.asset-library.footprint': 'Umriss',
	'view.asset-library.clearance': 'Freiraum',
	'view.asset-library.spec-sheet': 'Datenblatt',
	'view.asset-library.none': 'Keine',
	'view.asset-library.shape.loading': 'Form wird geladen …',
	'view.asset-library.shape.gone': 'Dieses Objekt gibt es nicht mehr.',
	'view.asset-library.shape.read-failed': 'Die Form dieses Objekts konnte nicht gelesen werden: {path}',
	'view.asset-library.clearance.unscaled':
		'Dieser Freiraum wurde gezeichnet, bevor ein Maßstab vorlag; diese Zahl ist noch kein echtes Maß.',
	'view.asset-library.loading': 'Objekte werden geladen …',
	'view.asset-library.some-unreadable':
		'{count} Objektnotiz(en) konnten nicht gelesen werden. Der Diagnosebericht zeigt, welche Notizen abgelehnt wurden.',
	'view.asset-library.some-unreadable.open-note': 'Notiz öffnen',
	'view.asset-library.unreadable.read-failed': 'Konnte nicht gelesen werden',
	'view.asset-library.unreadable.no-id': 'Keine ID',
	'view.asset-library.unreadable.duplicate-id': 'Doppelte ID',
	'view.asset-library.unreadable.future-schema': 'Von einer neueren Plugin-Version geschrieben',
	'view.asset-library.note-unreadable': 'Die Notiz dieses Objekts konnte nicht gelesen werden: {path}',
	'view.asset-library.asset-gone': 'Dieses Objekt gibt es nicht mehr.',
	'view.asset-library.shape.unusable-id':
		'Die ID dieses Objekts kann keine Formdatei benennen, sodass keine Form dafür gespeichert werden kann.',
	'view.asset-library.shape.extent-overflow': 'Diese Form ist zu groß, um gemessen zu werden.',
	'view.asset-library.failed.headline': 'Objekte konnten nicht geladen werden',
	'view.asset-library.new-asset': 'Neues Objekt',
	'view.asset-library.results': 'Ergebnisse',
	'view.asset-library.category': 'Kategorie',
	'view.asset-library.unit': 'Einheit',
	'view.asset-library.unit-cost': 'Stückpreis',
	'view.asset-library.waste': 'Verschnitt',
	'view.asset-library.supplier': 'Lieferant',
	'view.asset-library.sku': 'SKU',
	'view.asset-library.height': 'Höhe',
	'view.asset-library.notes': 'Notizen',
	'view.asset-library.shape.none': 'Kein Umriss',
	'view.asset-library.shape.unscaled': 'Nicht skalierter Umriss',
	'view.asset-library.shape.pending': 'Umriss noch nicht gelesen',
	'view.asset-library.shape.unreadable': 'Umriss konnte nicht gelesen werden',
	'view.asset-library.used-in.loading': 'Wird geladen, wo dies verwendet wird …',
	'view.asset-library.used-in.failed':
		'Es konnte nicht geprüft werden, wo dies verwendet wird, daher ist Löschen nicht möglich.',
	'empty.asset-library.no-assets.headline': 'Noch keine Objekte',
	'empty.asset-library.no-assets.body':
		'Ein Objekt ist ein Baustoff, Einbauteil, eine Pflanze oder ein Möbelstück, das Sie einmal bepreisen und in jedem Projekt wiederverwenden. Legen Sie eines an, um die Bibliothek zu beginnen.',
	'empty.asset-library.no-assets.action': 'Neues Objekt',
	'empty.asset-library.no-matches.headline': 'Keine passenden Objekte',
	'empty.asset-library.no-matches.body':
		'Keine Objekte entsprechen dieser Suche. Versuchen Sie einen anderen Namen, Lieferanten oder eine andere Artikelnummer.',
	'empty.asset-library.no-matches.action': 'Suche leeren',
};

/**
 * German for the Asset library's own copy (`en-assetLibrary.ts`), split out for the identical
 * reason: `de.ts` had 24 lines of `max-lines` headroom and this surface adds 59 keys. Spread
 * into `de.ts` rather than declared there, so `de` stays the one object the completeness check
 * in `strings.test.ts` reads. The filename carries the same hyphen `en-assetLibrary.ts` does,
 * for the identical reason recorded there — though this file is not itself linted for
 * sentence case either way, exactly as `de.ts`'s own header says.
 *
 * `satisfies Partial<Record<StringKey, string>>` rather than an ANNOTATION of that type is
 * what makes a duplicate key here a build failure two ways rather than one. Annotating the
 * literal `Partial<Record<StringKey, string>>` still catches an orphaned key (excess-property
 * checking runs at the literal either way) but WIDENS this object's own inferred type to one
 * where every property is optional — and TypeScript's "specified more than once" check
 * (`TS2783`) does not fire when the SPREAD side of a collision is that wide a type, measured:
 * `en.ts`'s spread of `enAssetLibrary` (a concrete literal type) is caught by `TS2783` on a
 * duplicate; `de.ts`'s spread of `deAssetLibrary` was not, before this file used `satisfies`,
 * because a `Partial<Record<...>>`-typed value carries no concrete key TypeScript can compare
 * a sibling property against. `satisfies` keeps the literal's own narrow, concrete type
 * (`{ 'view.asset-library.title': string; … }`) while still checking it against the wider
 * shape, so `de.ts`'s spread gets the same protection `en.ts`'s always had.
 */
import type { StringKey } from './en';

export const deAssetLibrary = {
	'view.asset-library.title': 'Objekt-Bibliothek',
	'command.open-asset-library': 'Objekt-Bibliothek öffnen',
	'view.asset-library.door': 'Objekte',
	'view.asset-library.search.label': 'Objekte durchsuchen',
	'view.asset-library.search.placeholder': 'Nach Name, Lieferant oder SKU suchen',
	'view.asset-library.search.results': '{count} passende Objekte',
	'view.asset-library.unselected': 'Nichts ausgewählt.',
	'view.asset-library.assets': '{count} Objekte',
	'view.asset-library.used-in': 'Verwendet in',
	'view.asset-library.used-in.none': 'In keinem Projekt verwendet',
	'view.asset-library.used-in.project': '{name} — {count} Anforderung(en)',
	'view.asset-library.used-in.vault-root': 'Vault-Stammverzeichnis',
	// §11 item 6's Wort neben der Markierung — die deutsche UI sagt "Übersteuert"
	// (`editor.inspector.requirement.overridden`), nicht "überschrieben".
	'view.asset-library.used-in.overridden': 'Übersteuert diesen Preis',
	'view.asset-library.open-designer': 'Designer öffnen',
	'view.asset-library.open-note': 'Notiz öffnen',
	'view.asset-library.back': 'Zurück zur Bibliothek',
	'view.asset-library.delete': 'Löschen',
	// `Objekt` ist das Wort dieser Oberfläche für einen Asset (`Material` ist verboten), und
	// `Anforderungen` das für Requirements — beide wie in `de.ts` bereits festgelegt.
	'view.asset-library.delete.reassign-title':
		'Zu welchem Objekt sollen diese Anforderungen verschoben werden?',
	'view.asset-library.shape': 'Form',
	'view.asset-library.footprint': 'Umriss',
	'view.asset-library.clearance': 'Freiraum',
	'view.asset-library.spec-sheet': 'Datenblatt',
	'view.asset-library.none': 'Keiner',
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
	'view.asset-library.note-future-schema':
		'Die Notiz dieses Objekts wurde mit einer neueren Version dieses Plugins geschrieben: {path}. Aktualisieren Sie das Plugin, um sie zu öffnen.',
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
	// `Umriss`, not `Grundriss` — this file's own word for an asset's footprint everywhere
	// else in this list (`view.asset-library.footprint`, and the four keys below); `Grundriss`
	// is `de.ts`'s separate word for a PLAN (`Grundriss-Editor`, `command.open-plan-editor`,
	// ~25 keys), unrelated to an asset's shape. The coordinator's instruction for this key said
	// `Gemessener Grundriss`; checking the file rather than complying is what caught it.
	'view.asset-library.shape.measured': 'Gemessener Umriss',
	'view.asset-library.shape.none': 'Kein Umriss',
	'view.asset-library.shape.unscaled': 'Nicht skalierter Umriss',
	'view.asset-library.shape.pending': 'Umriss noch nicht gelesen',
	'view.asset-library.shape.unreadable': 'Umriss konnte nicht gelesen werden',
	'view.asset-library.used-in.loading': 'Wird geladen, wo dies verwendet wird …',
	'view.asset-library.used-in.failed':
		'Es konnte nicht geprüft werden, wo dies verwendet wird, daher ist Löschen nicht möglich.',
	'empty.asset-library.no-assets.headline': 'Noch keine Objekte',
	'empty.asset-library.no-assets.body':
		'Ein Objekt ist ein Baustoff, Einbauteil, eine Pflanze oder ein Möbelstück, das Sie einmal bepreisen und in jedem Projekt wiederverwenden. Legen Sie eines an, um die Bibliothek aufzubauen.',
	'empty.asset-library.no-assets.action': 'Neues Objekt',
	'empty.asset-library.no-matches.headline': 'Keine passenden Objekte',
	'empty.asset-library.no-matches.body':
		'Keine Objekte entsprechen dieser Suche. Versuchen Sie einen anderen Namen, Lieferanten oder eine andere SKU.',
	'empty.asset-library.no-matches.action': 'Suche löschen',
	"view.asset-library.draft.title": "Ungespeicherte Änderungen",
	"view.asset-library.draft.leave": "Dieses Objekt enthält ungespeicherte Änderungen. Verwerfen und fortfahren?",
	"view.asset-library.draft.discard-continue": "Verwerfen und fortfahren",
	"view.asset-library.draft.keep": "Weiter bearbeiten",
	"view.asset-library.draft.required": "Einen Namen eingeben.",
	"view.asset-library.draft.number": "Eine endliche, nicht negative Zahl eingeben; Verschnitt muss zwischen 0 und 100 % liegen.",
	"view.asset-library.draft.conflict": "Diese Notiz wurde zwischenzeitlich geändert. Aktuelle Werte prüfen und zum Neuladen verwerfen. Der Entwurf bleibt erhalten.",
	"view.asset-library.draft.refresh": "Objekt gespeichert. Vor weiteren Änderungen neu laden. Die Projektneuberechnung wird separat gemeldet.",
	"view.asset-library.draft.unknown": "Das Schreibergebnis ist unklar. Aktuelle Notiz prüfen, bevor der Entwurf verworfen oder erneut gespeichert wird.",
	"view.asset-library.draft.save": "Speichern",
	"view.asset-library.draft.discard": "Verwerfen",
	"view.asset-library.draft.saving": "Wird gespeichert…",
	"view.asset-library.draft.saved": "Objekt gespeichert",
	"view.asset-library.outside-search": "Das ausgewählte Objekt liegt außerhalb der Suchergebnisse.",
	"view.asset-library.used-in.library-price": "Bibliothekspreis",
} satisfies Partial<Record<StringKey, string>>;

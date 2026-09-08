/**
 * The project surface's navigation and entry-path copy.
 *
 * **This table addresses the reader informally (`du`), and the rest of `de` does not.** The
 * design package is the authority for the words on this surface —
 * `docs/user-experience/renovation-planner-project-specs/ui-copy.md` gives every guidance and
 * entry string in du-form — while `de.ts`'s own register is the formal `Sie`, which
 * `tests/presentation/i18n/strings.test.ts` holds as a rule over the whole locale. The two
 * disagree, the disagreement is the design package's to settle for the app as a whole, and it is
 * recorded at that test's own exemption rather than resolved by quietly rewording one half.
 */
export const deProjectNavigation = {
	'view.project.guidance-title': 'Was möchtest du als Nächstes tun?',
	'view.project.guidance-start-title': 'Womit möchtest du beginnen?',
	'view.project.guidance-optional-plan': 'Du kannst mit einer Notiz beginnen. Ein Grundriss ist keine Voraussetzung.',
	'view.project.guidance-hide': 'Einstiegshilfe ausblenden',
	'view.project.guidance-show': 'Einstiegshilfe anzeigen',
	'view.project.entry-note-title': 'Renovierung beschreiben',
	'view.project.entry-note-body': 'Halte fest, was sich verändern soll und welche Fragen offen sind.',
	'view.project.entry-note-action': 'Projektnotiz öffnen',
	'view.project.entry-plan-start-title': 'Mit einem Plan beginnen',
	'view.project.entry-plan-start-body': 'Zeichne einen Grundriss oder nutze eine vorhandene Referenz.',
	'view.project.entry-plan-create': 'Ersten Plan anlegen',
	'view.project.entry-plan-continue-title': 'Am Plan weiterarbeiten',
	'view.project.entry-plan-continue-body': 'Mach dort weiter, wo du aufgehört hast, oder öffne einen Plan aus der Liste.',
	'view.project.entry-plan-open': '{planName} öffnen',
	'view.project.entry-plan-choose': 'Plan auswählen',
	'view.project.entry-prices-title': 'Projektpreise festlegen',
	'view.project.entry-prices-body': 'Hinterlege eigene Preise, sobald du sie kennst.',
	'view.project.prices-open': 'Preise ansehen',
	'view.project.prices-back': 'Zurück zum Projekt',
} as const;

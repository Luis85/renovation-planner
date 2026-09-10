# UI copy — English and German

English is the project documentation language. UI language follows Obsidian's locale; do not add a separate plugin language setting. These are proposed canonical labels for this design, not claims about existing translation keys. Reuse current keys where semantics match. Braced values are placeholders and must be interpolated safely.

Original PNGs are retained as **German UI localization references**, not English-rendering evidence. English prose, behavior rules, and this table take precedence over generated labels. Example project/plan names are user content, not translated application strings.

| Purpose | English | German |
| --- | --- | --- |
| Overview title | Projects | Projekte |
| Create project | New project | Neues Projekt |
| Search label | Search projects | Projekte suchen |
| Search count | {matches} of {total} projects | {matches} von {total} Projekten |
| Resume group/action | Resume | Fortsetzen |
| Open details | Open project | Projekt öffnen |
| Open exact plan | Open {planName} | {planName} öffnen |
| Completed group | Completed projects ({count}) | Abgeschlossene Projekte ({count}) |
| No matches | No projects match “{query}”. | Keine Projekte passen zu „{query}“. |
| Clear search | Clear search | Suche zurücksetzen |
| Prefilled creation | Create project “{name}” | Projekt „{name}“ anlegen |
| Empty overview | No projects yet | Noch keine Projekte |
| Partial read warning | Some projects could not be read. | Einige Projekte konnten nicht gelesen werden. |
| All unreadable | Projects could not be read. | Projekte konnten nicht gelesen werden. |
| Asset creation | New asset | Neues Asset |
| Library access | Asset library | Asset-Bibliothek |
| Return to launcher | All projects | Alle Projekte |
| Return from prices | Back to project | Zurück zum Projekt |
| Note access | Open project note | Projektnotiz öffnen |
| New-project guidance | What would you like to start with? | Womit möchtest du beginnen? |
| Active-project guidance | What would you like to do next? | Was möchtest du als Nächstes tun? |
| Note entry title | Describe your renovation | Renovierung beschreiben |
| Note entry explanation | Record what should change and which questions remain. | Halte fest, was sich verändern soll und welche Fragen offen sind. |
| Plan entry title | Start with a plan | Mit einem Plan beginnen |
| Plan entry explanation | Draw a floor plan or use an available reference. | Zeichne einen Grundriss oder nutze eine vorhandene Referenz. |
| First plan | Create first plan | Ersten Plan anlegen |
| Existing plan entry | Continue with a plan | Am Plan weiterarbeiten |
| Plan selection | Choose a plan | Plan auswählen |
| Plans section | Plans | Pläne |
| Plan creation | New plan | Neuer Plan |
| Price entry title | Set project prices | Projektpreise festlegen |
| Price entry explanation | Add your own prices when you know them. | Hinterlege eigene Preise, sobald du sie kennst. |
| Open price section | View prices | Preise ansehen |
| Optional plan explanation | You can start with a note. A floor plan is optional. | Du kannst mit einer Notiz beginnen. Ein Grundriss ist keine Voraussetzung. |
| Hide guidance | Hide getting-started guidance | Einstiegshilfe ausblenden |
| Show guidance | Show getting-started guidance | Einstiegshilfe anzeigen |
| Missing last plan | The last plan is no longer available. | Der zuletzt verwendete Plan ist nicht mehr verfügbar. |
| Recovery selection | Choose another plan | Wähle einen anderen Plan |
| Missing project | This project is no longer available. | Dieses Projekt ist nicht mehr verfügbar. |
| Retry allowed | Try again | Erneut versuchen |
| Loading | Loading… | Wird geladen… |
| Partial plan warning | Some plans could not be read. | Einige Pläne konnten nicht gelesen werden. |
| All plans unreadable | Plans could not be read. | Pläne konnten nicht gelesen werden. |
| Truly empty plans | No plans yet | Noch keine Pläne |
| Price title | Project prices | Projektpreise |
| Catalogue value | Catalogue price | Katalogpreis |
| Own saved value | Project price | Eigener Projektpreis |
| Usable value | Used price | Verwendeter Preis |
| Begin override | Set project price | Eigenen Preis festlegen |
| Edit | Edit | Bearbeiten |
| Commit draft | Apply | Übernehmen |
| Cancel draft | Cancel | Abbrechen |
| Saved override removal | Remove project price | Eigenen Preis entfernen |
| Missing usable source | No usable price | Kein verwendbarer Preis |
| Unsaved draft | Unsaved | Nicht gespeichert |
| Pending write | Saving… | Wird gespeichert… |
| Write confirmed | Saved | Gespeichert |
| Write succeeded, refresh failed | Saved; could not refresh the display. | Gespeichert; die Anzeige konnte nicht aktualisiert werden. |
| Read-only refresh action | Refresh display | Anzeige aktualisieren |
| Dirty navigation title | Discard unsaved changes? | Ungespeicherte Änderungen verwerfen? |
| Retain draft | Keep editing | Weiter bearbeiten |
| Discard draft and navigate | Discard and continue | Verwerfen und fortfahren |
| Conflict | This price changed elsewhere. Review the current value before applying your draft again. | Dieser Preis wurde an anderer Stelle geändert. Prüfe den aktuellen Wert, bevor du deinen Entwurf erneut übernimmst. |
| Orphan asset | Asset no longer available | Asset nicht mehr verfügbar |
| Unreadable asset | Asset could not be read | Asset konnte nicht gelesen werden |
| Read-only explanation where needed | Available for viewing on mobile | Auf Mobilgeräten zum Ansehen verfügbar |

## Terminology and formatting
- “Project” is the renovation context; “plan” is a drawing/planning entity, not a synonym for room.
- “Open project” always means details. “Open project note” means the associated vault note.
- “Resume” names and validates its target. It does not imply restored viewport or a per-project history.
- “Project price” means a project-specific override, not an overall budget.
- “Remove project price” describes the actual action even when catalogue fallback is missing/unusable.
- Show project currency explicitly, for example EUR. Do not change user-entered project names across locales.
- Acceptance examples use canonical amounts such as 49.90. English display may show 49.90; German display may show 49,90. Use the existing locale formatter and preserve currency identity.
- Proposed input parser accepts plain decimal comma or dot, rejects grouping/mixed separators, and retains canonical decimal strings for storage.
- Domain project status labels come from the existing status enum/localization map; this package creates no new statuses or percentage mapping.
- Error copy must use the existing error taxonomy. Do not display Retry for errors that cannot be retried.

## Amendments (2026-09-09)

The table above is the source of truth for the project surfaces' copy, and this section records
every place the shipped strings deliberately do NOT match it. Each entry is a deviation kept on
purpose; everything not listed here was reconciled to the table.

1. **German stays formal (Sie) throughout.** The table's German column uses the du-form in
   several rows (`Womit möchtest du beginnen?`, `Halte fest, …`, `Zeichne einen Grundriss …`,
   `Hinterlege eigene Preise …`, `Du kannst mit einer Notiz beginnen.`, `Wähle einen anderen
   Plan`, `Prüfe den aktuellen Wert, bevor du …`). The shipped locale is Sie-form everywhere and
   stays that way: register is a fact about the whole file rather than about a row, and
   `tests/presentation/i18n/strings.test.ts` refuses a du-form imperative anywhere in `de.ts`.
   Read the German column as *wording*, not as *register*.
2. **German asset vocabulary stays `Objekt` / `Objekte`.** The table's German column says
   `Asset`, `Asset-Bibliothek`, `Neues Asset`, `Asset nicht mehr verfügbar`. The shipped locale
   says `Objekt` and `Objekt-Bibliothek`, a repo-wide decision pinned by the forbidden-word case
   in `strings.test.ts` (`Material` → `Objekt`) and by every key under
   `view.asset-library.*`. One German noun per concept beats matching this table row.
3. **`view.project.some-plans-unreadable` keeps a second sentence.** The table states it as
   `Some plans could not be read.` alone; the shipped string adds `Open the diagnostics report to
   see which notes refused.` because that sentence names a next action the user needs and can
   take — the diagnostics report is a real command and a real settings row, and it lists the
   refused notes by name. The `{count}` placeholder the string used to carry IS dropped, per the
   table.
4. **`view.project.resume-missing-project` and `view.project.draft-body` are unchanged.**
   Neither has a row in the table, and both still say something true about their own surface.
   `view.project.resume-missing-plan` DID lose its second sentence, because the recovery screen
   (`view.project.recovery-title` / `.recovery-body`) is what offers the way on now.
5. **`view.project.count-one` / `.count-many` and `view.project.filter.placeholder` are
   unchanged.** The table's `Search count` row is the FILTERING state
   (`{matches} of {total} projects`); the resting count line and the field's placeholder hint are
   separate strings with no row here.
6. **German plan vocabulary: `Plan` / `Pläne` on the project surfaces, `Grundriss` in the plan
   editor.** The terminology section is explicit that a plan is a planning entity rather than a
   drawing of a floor, so `view.project.plans-title`, `view.project.create-plan`,
   `view.project.some-plans-unreadable`, `empty.project.no-plans.*`, `form.new-plan.title`,
   `empty.project.no-projects.body` and `plan.empty-name` now say `Plan`/`Pläne`. `Grundriss`
   deliberately SURVIVES in two places:
   - the plan editor's own vocabulary (`view.plan-editor.name`, `command.open-plan-editor`,
     `command.set-plan-background`, `background.*`, `plan.none`, every `editor.*`, `planning.*`
     and `renovation.*` key, and `empty.plan.no-background.body`), which is a different surface
     and not this package's to rename; and
   - `view.project.guidance-optional-plan` and `view.project.entry-plan-start-body`, where the
     English original says *floor plan* and means one — a literal drawing the user may or may not
     have. `Grundriss` is the correct German word there, not a leftover.
7. **`asset-price.external-modification` still tells the user to discard.**
   `asset-price.revision-conflict` was changed to preserve the draft for deliberate
   reapplication (the table's `Conflict` row); its sibling, raised one cause along by an
   out-of-plugin edit, has no row in this table and was left alone rather than reworded on
   inference. It is now the one sentence on that surface still naming discard as the remedy, and
   is the obvious next amendment.
8. **New keys live in `locales/en/projectNavigation.ts` and `locales/de/projectNavigation.ts`,
   not in `en.ts` / `de.ts`.** Purely mechanical: `en.ts` is AT its 400-line `max-lines` budget.
   `StringKey` derives from the spread either way, so no caller can tell which file answered.
9. **German `view.project.detail-loading` is `Wird geladen …`** — a narrow no-break space before
   the ellipsis, matching every other German loading string in the file, where the table writes
   `Wird geladen…`.
10. **`view.project.filter.placeholder` changed even though it has no row** — `Filter by name` /
    `Nach Namen filtern` became `Search by name` / `Nach Namen suchen`. Not a deviation from the
    table but a consequence of one: the label above it now says `Search projects`, and a field
    labelled *search* whose own hint said *filter* named one control two ways.

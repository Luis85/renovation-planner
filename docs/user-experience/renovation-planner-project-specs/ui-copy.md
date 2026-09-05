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


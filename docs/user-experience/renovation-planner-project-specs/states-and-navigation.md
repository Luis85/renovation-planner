# Shared states and navigation

## Navigation contract
| Action | Destination | Retained context |
| --- | --- | --- |
| Open project | Selected project's details | Project ID |
| Resume | Validated last plan, otherwise explained project fallback | Project ID, valid plan ID |
| Open plan | Editor | Project/plan identity; further editor UI only where supported |
| All projects | Project overview | Search, group preference, scroll, meaningful return focus |
| View prices | Project price section | Project ID |
| Back to project | Project details | Project ID, guidance visibility |
| Open project note | Ordinary associated note | Project identity through existing host navigation |

The note may open in another leaf according to existing Obsidian conventions. No forced split. Confirm exact host navigation against implementation before changing it.

Obsidian view state/history is the navigation authority. Do not duplicate selection in a competing store/router history. A wider or narrower leaf is not a new navigation state. Keep search, group expansion, scroll, focus, and guidance visibility in a leaf-local UI snapshot that survives Vue remounts. Guidance visibility is session-only in this slice; no new frontmatter property.

## Resume resolution
1. While index/loading prerequisites are incomplete, show loading, not absence.
2. Successfully resolve project and plan: open the target.
3. Project exists, plan missing: P03, including its no-remaining-plans variant.
4. Only project saved and present: project details.
5. Project reliably absent: explanation and deliberate return, no redirect loop.
6. Read failed: show the existing error class; do not prematurely clear saved context.

IDs are the minimum basis. Restore viewport, perspective, or selected entity only where the editor has a reliable contract. An unsuccessful opening attempt must not be labelled successful work.

Proposed bounded context rule: one global last target. Opening the same project's details preserves its plan reference; opening another project records that project without inheriting a plan. No per-project history is implied. The meaning of successful opening still requires the spike in PBI-04.

## State matrix
| Region/state | Behavior | Prohibited |
| --- | --- | --- |
| Projects loading | Loading indication | Reporting unknown as 0 projects |
| Projects truly empty | One primary creation action | Duplicate primary creation actions |
| No search matches | Retain text; reset and prefilled creation | Automatic creation |
| Some projects unreadable | Readable rows plus warning | Replacing whole list with error |
| All projects unreadable | Explain unreadability; creation remains available where supported | “No projects yet” |
| Project loading | Known context and loading indicator | Treating incomplete index as deletion |
| Project without plans | P01 or compact empty region when guidance hidden | Requiring a plan |
| Some plans unreadable | Readable plans plus warning | Guidance concealing warning |
| All plans unreadable | Explain unreadability | Pretending confirmed emptiness |
| Last plan missing | P03 | Unrequested substitute plan |
| Project gone | Explanation with All projects | Redirect loop |
| Prices loading | Only price region loads | Removing project/back navigation |
| Price read failed | Local error; project accessible | Blocking unrelated plans |
| Invalid draft | Field message; retain input | Clearing input or silently rounding |
| Price writing | Prevent duplicate submission | Showing unconfirmed draft as effective |
| Price write failed | Retain draft; appropriate retry | Reporting success |
| Price saved, refresh failed | Distinguish saved from stale display | Encouraging another write |
| Price conflict | Inspect current data; deliberately reapply | Dropping expected version silently |

Retry only where existing error policy permits. A session failure is not repaired by arbitrary refresh. Explain known cause, affected region, data state, and next action without unproven loss/recovery claims.

## Guidance and progress
Guidance is neither a wizard nor a checklist. Opening a note or price section does not mark a step complete. Order remains stable. Data updates do not steal focus or change an action mid-interaction.

After hiding guidance, note, plan creation, plans, and prices remain accessible within supported capabilities. No new domain status or frontmatter field for presentation.

## Focus and form protection
- No initial autofocus when opening a view beside a note.
- User-triggered navigation moves focus meaningfully to the new heading/region, respecting host behavior.
- Return focus uses stable IDs, not row indices; if unavailable, use the project filter.
- Announce warnings gently; background events do not repeatedly flood live regions.
- Deliberate internal navigation with an unsaved price draft offers Keep editing or Discard.
- During a write, use an explicit in-flight policy. Cancel is not undo for a dispatched command. Check leaf closing separately; do not promise an abortable transaction.
- Do not nest interactive elements. Icons/chevrons are decorative when the labelled entry already carries the action.

## Theme, responsive layout, and device scope
Use Obsidian variables for background, text, borders, hover, accent, and focus. No plugin theme switch. Layout depends on container width. Initial checks: 1440, 1024, 768, 460, and 360 CSS px; derive final breakpoints from actual content and host fonts.

Narrow prices become asset sections with labelled value pairs. Catalogue, saved project price, draft, and usable price remain distinguishable. Do not remove necessary information without an equivalent.

Narrow desktop retains permitted editing. Mobile follows PRODUCT's read-only scope; CSS breakpoints do not grant writing. Test desktop narrow editing and mobile reading separately.


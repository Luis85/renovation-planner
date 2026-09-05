# Component library — Projects

## Boundaries
Obsidian is the design system. This library defines responsibilities and states, not a brand palette. Vue presentation components emit intents; queries, commands, and host navigation stay outside pure presentation. Prefer existing components. New component names below are proposals.

## Component contracts
| Component | Responsibility | Inputs | Outputs/intents |
| --- | --- | --- | --- |
| ProjectList | Groups and ordering | Project summaries, filter, group state | openProject(id), toggleCompleted, query changes |
| ProjectRow | Readable project identity | Name, status, currency, plan count, available date, warning marker | open(id) |
| ProjectFilter | Search and match status | query, loadedCount, matchCount, busy | changeQuery, clear |
| ContinueRow | Named last target | Resolution, project name, optional plan name | resume, openProject |
| ProjectHeader | Identity and return path | Project, back target, note action | back, openNote |
| ProjectEntryGuidance | Three optional entry paths | New/active state, valid last context | openNote, choosePlan, openPlan, createPlan, openPrices |
| ProjectEntryAction | One understandable task | Title, benefit, action label, priority, busy | activate |
| GuidanceVisibilityControl | Deliberate show/hide | visible | changeVisibility |
| PlanList | Direct plan selection and creation | Plan IDs/names, readable state | openPlan(id), createPlan |
| ProjectPricesSection | Independent price loading/error region | Rows, project currency, region status | edit/commit/clear via existing interface |
| AssetPriceRow | Saved/usable price vs. draft | Persisted values, draft, expected version, commit state | beginEdit, changeDraft, commit, cancel, clear |
| MoneyInput | Labelled price input | Input text, currency, validation | textChanged, submit, cancel |
| PersistentWarningStrip | Additive warning retaining context | Meaning, text, permitted actions | action |
| EmptyState | Truthful emptiness | Heading, explanation, action, heading level | action |
| ViewFailure | Existing error policy | Mapped error, permitted action | allowedAction |
| UnsavedChangesDialog | Deliberate discard or continue | Navigation intent, dirty state | keepEditing, discardAndContinue |

## State ownership
| State | Owning boundary |
| --- | --- |
| Open project/view | Obsidian view state/existing host navigation |
| Domain project/price data | Persisted domain models behind queries/commands |
| Hydration, partial failure, gone | Existing view/query controller |
| Filter, groups, scroll/focus, guidance | Leaf-local UI snapshot, no competing domain selection |
| Uncommitted price | Local editor with saved starting value |
| Write version check | Existing application command boundary |
| Colors/typography | Obsidian theme |

## Price editor states
The success path is resting → editing → saving → resting. Invalid, write-failed, and conflict preserve a correctable draft. Saved-refresh-needed means confirmed writing with a stale display; it must not require another Apply. These are conceptual names: reconcile existing state types before introducing new ones.

Apply and Clear use existing commands and expected versions. No direct file access in rows. Offer Clear only for a saved override; Cancel discards a first draft. Preserve clearing for orphan/unreadable assets while disallowing unsupported new values.

The existing use-field-commit hook already handles canonical/draft separation and concurrency. Change the local price interaction, not every editor consumer. During a pending write, Cancel must not imply rollback. A UI parser may normalize decimal commas; Money remains canonical.

## Accessibility
- Project/plan entries have meaningful accessible names; facts are associated without dozens of focus stops.
- Search has a label independent of placeholder.
- Disclosure uses a semantic control with expanded state; existing native details/summary is valid.
- Price fields identify asset and currency and associate error text.
- Actions remain available without hover. Text/icons supplement color.
- Responsive variants use the same content and command paths within device capabilities.
- Browser and real Obsidian checks cover focus, 200% zoom, and theme changes.

## Reuse plan
ProjectList, ProjectRow, ProjectFilter, ContinueRow, PlanList, and AssetPriceList were present in the reviewed implementation. Split ProjectDetail into header, guidance, and regions while ProjectDetailState retains hydration/error responsibility. A new price subview must not leave a duplicate price subscription running. Keep the shared DialogHost in its existing stable location.


# Requirement update date preservation

Root explicitly approved this bounded production cleanup after auditing the callers.
The only production file is `src/domain/requirement/Requirement.ts`.

The private `with` helper previously accepted every `RequirementFields` property and
tested whether a caller supplied `requiredDate`. None of its seven callers supplies
that field. The helper now always preserves `this.requiredDate`, and its parameter
is `Partial<Omit<RequirementFields, 'requiredDate'>>`. An unsupported future date
update therefore fails type checking instead of being silently ignored.

| Public caller | Fields supplied to the private helper |
| --- | --- |
| `withWasteFactor` | waste factor |
| `withQuantityOverride` | quantity |
| `withCostOverride` | estimated cost |
| `withCalculatedCost` | estimated cost |
| `withRecalculation` | quantity, estimated cost, calculation inputs, recalculation status |
| `markedStale` | recalculation status |
| `repointedTo` | origin, asset, recalculation status |

Public creation, persisted hydration and date validation are unchanged. So are all
public methods, including the declared `withWasteFactor` capability. The prior
date-delta conditional and its two nullish-coalescing arms were unreachable through
this public API. No counter, coverage threshold or test-discovery setting changed.

The public recalculation regression uses a persisted dated material with independent
quantity and money overrides. It asserts the same identity/date/source/overrides and
the correct recomputed bases after command execution and repository reread. Domain
validation and event neighbors run alongside it; results and exact removed counters
are recorded in the coverage continuation report.

Verified: 16/16 tests in three files (2.36 seconds), types, whole Oxlint, scoped
ESLint and Fallow static analysis passed. The same two command cases also passed
under scoped coverage (9.26 seconds), with all global thresholds unchanged and
therefore still failing for a scoped run. Requirement counters went from 54 to 50
total arms and 39 to 38 hits: four total arms removed, of which three were uncovered
and one was the covered preservation fallback. All 39 statements remain.
[Original counter-map receipt](evidence/requirement-date-counter-removal.json).

## Integration confirmation

Root imported the exact production change and counter receipt from owner
83ca2f751894f7e7081c30b76edaf2a8b3304e54. The Root command/domain integration
run passed16/16tests in6.04seconds. Only the private update field type and date
preservation expression changed; public constructors/validation remain intact.
Root log: requirement-date-integrated.log in the finalization scratch.

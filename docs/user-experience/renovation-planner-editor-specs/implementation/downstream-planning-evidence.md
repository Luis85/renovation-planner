# Trade, schedule and quote finalization evidence

Status: bounded implementation checkpoint after integration `2c2c1d71`. The source and new tests below have targeted verification; the final combined gates have not passed. [ADR-0024](../../../../development/adrs/0024-trades-manual-schedules-and-quote-comparison.md) records the accepted source contracts and implementation decisions.

## Production paths

Shared Trades and Suppliers use named-note repositories, the configured Library, the Project Index and existing guarded catalogue services. Library migration now includes both within its source-folder intersection. Work retains its Plan authority, shared identities, existing RenovationForm/command/history and explicit date endpoints. Project Work reads each floor register and displays Room context and existing dependency blockers.

Project quote notes use the shared conditional note writer. Expected versions are checked again inside the host frontmatter callback before mutation. The same fresh callback content enforces received immutability and project ownership. Stable creation retries compare canonical quote facts; property insertion order cannot create a false conflict. Offer lines keep exact decimal Money and explicit floor-qualified Work/catalogue scope. The separate Project table aligns equal scope sets, exposes missing scope and totals each offer/currency independently.

Project destination/origin state uses the existing host navigation. Contextual editor arrival is queued per physical leaf after a Plan-only reveal, so a plain open and a contextual open cannot create two editors for one floor. The existing editor applies selection/focus after hydration and guards save, dialog and active-draft state.

## Verification record

- Node 24.20.0, two workers: the initial downstream run passed 76/79 cases. Two failures were ineffective fixture insertions; the third exposed a stable-quote retry comparison defect. Parsed-frontmatter fixture assertions and canonical quote-fact comparison corrected them. The expanded 15-file run passed all 134 cases in 40.87 seconds.
- Broader repository/navigation/native UI verification after lint refactors and UI integration: 49 files, 980 passed/2 failed, 162.42 seconds. Both failures were existing completeness guards requiring the three new note kinds in shared refusal/identity/preservation tables. Those tables now exercise real Trade, Supplier and Quote repositories through the unchanged contracts.
- A follow-up run passed all 76 cases in those two repository files and the generic-element interaction file, 12.72 seconds. New Edit/Delete regressions first reproduced peer-deleted elements remaining displayed (11 passed/2 failed); projection comparison now occurs before missing-element return and both pass, including selection/Inspector cleanup and no writes.
- Native catalogue disposal regression first failed with one unwanted repository save after dialog unmount (1 passed/1 failed). The form now refuses late submission. Both disposal/authorized-save completion cases passed in the broader run.
- The broader run includes atomic quote peer title/status/revision changes inside the host callback; native Supplier/Quote creation and received revisions; explicit scope gaps; retained raw drafts and updated choices; successful-write/failed-read retry; conflict preservation; expiry timer cleanup; per-leaf arrival ordering and actual editor returns; retained Project reads; Trade rename/missing identity; Library relocation; and ten source lifecycle/marker regressions from hardening.
- After the projection comparison extraction, all 53 cases in five element/Room/naming/outline/retry files passed in 88.38 seconds.
- Production build/types passed. Full Oxlint/ESLint passed with zero warnings before the final disposal/projection/test corrections; subsequent whole Oxlint and affected ESLint also pass, including the extracted projection comparison within the unchanged complexity limit. Earlier 483 focused spatial/read-only cases remain historical evidence.
- Source-only recovery review found missing Trade/date comparison fields and named catalogues in Library relocation, both corrected by root. It traced remaining Work copy, form, shared-link and compensation paths without an additional finding. This is review evidence, not host acceptance.

The unchanged full coverage/quality gates, final eight browser journeys plus the downstream ninth journey/eighteen image comparisons, performance/cleanup measurements and required live-host observations remain open. No timing or browser claim is transferred from an earlier source tree.

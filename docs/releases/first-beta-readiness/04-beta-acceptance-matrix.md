# First beta — acceptance matrix and scenario contracts

Prepared: 2026-09-16. **All cases below are proposed acceptance work, not executed results.**

This is a release-level index. Map the scenario IDs to the repository's existing case notes and automated tests during BP-00. Extend an existing case when it owns the behaviour; create a new case only for genuinely uncovered behaviour. Do not duplicate the full catalogue or copy historical “pass” results onto a new candidate.

## 1. Evidence layers

| Layer | What it establishes | What it cannot establish alone |
|---|---|---|
| Unit / geometry | Input validation, exact transformations, state transitions. | Correct native UI, real vault lifecycle, complete integration. |
| Composed integration / fault injection | Command/repository/history behaviour, write counts, stale guards, recovery, reconstruction. | Actual Obsidian API/platform/input behaviour unless exercised there. |
| Browser harness | Real component interaction and visible layout in its configured browser environment. | Actual Obsidian host CSS/API behaviour, physical device behaviour, audible announcements. |
| Native Obsidian | Plugin loading, real vault/workspace integration, host layout/zoom, actual runtime rendering. | Physical hardware behaviour if only synthetic input was injected. |
| Physical device / assistive technology | Behaviour of the named mouse/trackpad/phone/screen reader actually used. | Other devices, platforms, readers, or configurations not tested. |
| First-time-user observation | Discoverability and task friction for the people observed. | Statistical success rates or universal usability. |

Screenshots show visible state, not persistence integrity. A test procedure is not a test result. An automated accessibility scan is not a full conformance audit.

## 2. Shared fixture set

Use fictional projects and synthetic references/evidence. Record fixture paths, generator/version or content hash, and expected values in the existing fixture system. Do not distribute private house plans, photos, addresses, or receipts.

| Fixture | Contents | Primary use |
|---|---|---|
| F0 — clean vault | No plugin records; production plugin assets installed. | Installation, onboarding, empty states. |
| F1 — precise room | 4,000 × 3,000 mm rectangle, irregular Room and Area, negative coordinates, deliberately non-rounded coordinate. | Expected rectangle area 12 m² and perimeter 14 m; exact input/undo tests. |
| F2 — structure and overlaps | Rooms, shared/connected walls, door/window/opening, object overlapping a room and wall, saved group with hidden member, locked area. | Targeting, hosted relationships, grouping, delete impact. |
| F3 — curves and advanced elements | Supported curved Room/wall geometry, stairs, arrows, posts/beams, drafting marks, detailed placed assets, item color override. | Non-regression smoke for existing capabilities; numeric correction. |
| F4 — prepared references | Synthetic image with known distance; multi-page PDF; rotated/cropped case; missing and unreadable variants. | Scale, import/cancel, replacement, file movement. |
| F5 — connected renovation | Existing/planned facts, shared Work, material requirement, costs, photo/note evidence, more than one plan. | Context navigation, quantity staleness, independent current/intended geometry. |
| F6 — versioned persistence | Supported legacy note/sidecar versions, future versions, malformed data, human-written content. | Read compatibility, refusal, no read-time rewriting. |
| F7 — recovery injection | Real composed command stack with controllable repository failures/held completions and supported marker storage. | Partial operations, restart, peer conflict, read-only retry. |
| F8 — representative performance | Small and mixed-property scenes plus retained room-heavy and stress fixtures; exact counts and sizes recorded. | Camera, load, save/read-back, DPR, cleanup. |

F1's simple area/perimeter values are mathematical expectations, not measurements from a user's property. Do not assume all other quantities are just bounding-box calculations.

## 3. Acceptance scenarios

Priority is release impact. A failure involving data loss, silent overwrite, or misleading recovery is P0 even when discovered by a P1 scenario.

| ID | Journey / condition | Fixture | Expected outcome | Minimum evidence | Package |
|---|---|---|---|---|---|
| A01 | Fresh install and enable | F0 | Production assets load without an unhandled error; project and editor routes are reachable without developer tooling. | Native exact-bundle run | BP-10, BP-12 |
| A02 | Start without a reference | F0/F1 | Create a project/plan, select room-first or empty start, create a named room, cancel a second draft without writing. | Browser + native | BP-06 |
| A03 | Image reference preparation | F4 | Crop, rotate, set a known scale, preview, save, reopen; measured distance agrees. | Integration + native | BP-06 |
| A04 | Multi-page PDF reference | F4 | Correct page and preparation persist; cancel/error leaves the prior reference unchanged. | Integration + native | BP-06 |
| A05 | Exact dimensions and untouched precision | F1 | Entered axis changes exactly; untouched values retain full precision; no-op adds no history. | Geometry/integration + native field path | BP-04, BP-05 |
| A06 | Edit an arbitrary existing corner | F1/F3 | Select a corner without dragging; preview numerical correction; apply one guarded change; preserve curve semantics and references. | Integration + keyboard and simple-pointer native paths | BP-04 |
| A07 | Invalid numerical geometry | F1/F3 | Invalid text/geometries are explained without writing or silently normalizing unrelated geometry. | Geometry/integration + visible form | BP-04 |
| A08 | Dense overlap and groups | F2 | Accepted target priority/cycling works; group or member choice is explicit; lock and hidden-member behaviour matches contract. | Integration + native | BP-05 |
| A09 | Move/rotate/resize at different zoom levels | F1/F2/F3 | Visible handles and hit targets agree; preview and saved result match; intended geometry remains independent. | Geometry/integration + native pointer | BP-05 |
| A10 | Hosted openings and structural edits | F2/F3 | Door/window/opening relationships survive move/rotate, reload, undo, and impact-reviewed deletion; invalid containment is refused. | Fresh-repository integration + native | BP-05 |
| A11 | Clipboard across plans and asset placement | F2/F3/F5 | Copy/paste preserves supported properties; identities/references follow the current contract; missing asset handling is explicit. | Integration + native | BP-05 |
| A12 | Finish/cancel/undo/redo routes | F1/F2 | Each exposed task has the intended completion/cancel boundary; fields own text shortcuts; one command creates the intended history entry. | Integration + native keyboard | BP-03, BP-05 |
| A13 | Perspective and record navigation | F5 | Plan edits current geometry; Renovate routes to the appropriate records; Review is read-only; view switching itself writes no geometry. | Integration + native | BP-05, BP-13 |
| A14 | Successful save, failed read-back, repeated retry | F7 | One confirmed write; qualified save/stale state; retries only read; draft/selection stays attached to the right target. | Fault-injected composed runtime; native warning/focus separately | BP-01–BP-03 |
| A15 | Incomplete write then settings rebind | F7 | Incident remains; affected writes stay blocked; unrelated healthy data is not unnecessarily disabled. | Plugin integration + native warning presentation | BP-01 |
| A16 | Incomplete operation then full service restart | F7 | Persisted pending/incident state is classified before affected mutation; no automatic replay or false repair. | Reconstructed services over persisted files | BP-02 |
| A17 | Recovery marker cannot be persisted/read | F7 | Failure before covered mutation prevents that mutation; unreadable marker on restart is unknown recovery state, not healthy absence. | Boundary-by-boundary fault injection | BP-02 |
| A18 | Explicit recovery / coherent backup restore | F6/F7 | Affected resources are verified under the documented recovery procedure; only deliberate valid resolution releases protection. | Integration + supervised native procedure | BP-02, BP-11 |
| A19 | Peer edit and second pane | F2/F7 | Stale command is refused; same-plan pane cannot bypass incident state; valid independent edits remain possible. | Composed integration + native multiple panes | BP-01–BP-03 |
| A20 | Draft or command at close/settings/reflow | F1/F7 | No hidden write on cancel; pending commands retain correct ownership; late reads cannot act in retired context; recoverable draft is not silently lost. | Integration + native | BP-03 |
| A21 | Fresh reconstruction / legacy and future formats | F3/F5/F6 | Saved identities, geometry and links survive; opening legacy records does not rewrite them; unsupported future data is refused safely. | Fresh repository/index/runtime + native reopen | BP-11, BP-13 |
| A22 | Reference/evidence file moved, missing, restored | F4/F5 | Correct links/context after supported moves; missing data is explained; restored source can recover without duplicate writes. | Integration + real vault operations | BP-06, BP-13 |
| A23 | Layout, theme, locale, host zoom | F1/F2/F5 | Controls remain reachable at supported sizes; focus/draft survives reflow; labels/warnings remain readable. | Actual host screenshots and interactions | BP-07 |
| A24 | Keyboard and non-drag pointer inventory | F1/F2/F4 | Essential actions work without dragging and with keyboard; custom canvas controls are included, not only forms. | Named actual input walkthroughs | BP-04, BP-07 |
| A25 | Screen-reader validation and recovery | F1/F7 | Selected context, invalid input, saving/recovery status, and focus return are understandable to the actual reader. | Named reader/version and observed announcements | BP-07 |
| A26 | Mobile read-only, restored desktop tabs | F2/F5 | Promised data is readable; writes are guarded across entry points; unsupported editor tabs show a safe fallback; desktop remains usable afterward. | Real device/Obsidian observations | BP-09 |
| A27 | Mixed-plan performance and repeated cleanup | F8 | Recorded budgets met for supported fixture; stress limits explicit; no unbounded retained stages/listeners after cycles. | Reproducible measurement + native representative interaction | BP-08 |
| A28 | Clean upgrade and compatibility guidance | F5/F6 | Actual candidate installs over prior synthetic state; supported data opens; restore/downgrade guidance is accurate. | Packaged native upgrade + integration | BP-11, BP-12 |
| A29 | First-time-user journey | F0 | Observed testers can find first start, correct a room, undo, and reopen; points of confusion are recorded before coaching. | Actual observation; no invented results | BP-10 |
| A30 | Clean snapshot, only if selected | F3/F4/F5 | Declared content and perspective exported; no chrome/drafts omitted ambiguously; failure does not mutate plan data. | Output inspection + integration/native | BP-15 |

A30 is not required when optional export is excluded. “Native warning presentation” does not require unsafe manual disk failures in a normal vault: use an approved isolated seam or clearly recorded test setup, and keep the deterministic failure assertions in the integration suite.

## 4. High-risk BDD acceptance examples

These are behaviour contracts to map to existing tests. They are not runnable test files and do not imply that Gherkin execution infrastructure exists or should be introduced.

```gherkin
Feature: Recovery incidents outlive editor components

  Scenario: A settings change does not clear an incomplete-write incident
    Given a real composed editor command left affected resources incompletely written
    And compensation failed and an incident was recorded
    When plugin settings are saved and the editor is rebound
    Then the affected plan still presents the incident
    And unsafe mutations of affected resources remain blocked
    And an unrelated successful write does not resolve the incident

  Scenario: A new pane cannot bypass the incident
    Given an unresolved incident affects a plan and its shared resource
    When the same plan is opened in another editor pane
    Then incident protection is applied before affected editing becomes available
    And the affected shared-resource route cannot bypass that protection
    And independent healthy data remains usable
```

```gherkin
Feature: Conservative durable detection without automatic replay

  Scenario: Pending operation is found after process restart
    Given a covered multi-file operation recorded its pending indicator
    And the process stopped before conclusive completion was recorded
    When fresh plugin services read the persisted vault and recovery state
    Then the operation is classified as requiring integrity verification
    And it is not automatically replayed
    And a successful ordinary read does not count as repair

  Scenario: Detection metadata cannot be written before mutation
    Given the pending-indicator repository refuses a write
    When a covered destructive multi-file operation is requested
    Then no destructive resource mutation begins
    And the user receives an actionable failure state
```

```gherkin
Feature: A read-back retry is not a write retry

  Scenario: A confirmed save survives repeated read failures
    Given one geometry command was successfully committed
    And its subsequent projection read failed
    When the user retries reading twice and the second retry succeeds
    Then the command's confirmed mutation count remains one
    And the final view reflects the saved geometry
    And save and recovery messages describe the actual outcomes
```

```gherkin
Feature: Exact correction of an existing corner

  Scenario: Change one corner without dragging
    Given an existing room with saved identity, links, and unrounded coordinates
    When the user selects a numbered corner using ordinary controls
    And enters valid plan coordinates and applies the preview
    Then only the intended corner geometry changes under the existing curve policy
    And untouched coordinates preserve their original precision
    And identities, links, and separate intended geometry remain unchanged
    And one undo restores the exact previous geometry

  Scenario: Peer edit refuses a stale correction
    Given the corner form captured a versioned room baseline
    And another editor changed the room after that baseline was captured
    When the first editor submits its corner correction
    Then the stale mutation is refused
    And the peer geometry remains intact
    And the user's draft is not silently applied to another target
```

```gherkin
Feature: Acceptance refers to the installed production artifact

  Scenario: Production candidate is installed for native verification
    Given a frozen candidate source and production asset hashes are recorded
    When the candidate is installed into an isolated acceptance vault
    Then the installed asset hashes match the candidate record
    And native outcomes name that candidate and host environment
    And a later different bundle cannot inherit those outcomes automatically
```

## 5. Cross-cutting variations and sampling

Run a full core journey on the primary supported desktop configuration. Use targeted cross-platform/theme/input checks for the additional conditions below and record the sampling rationale. A representative matrix is more useful than an unexecuted claim of exhaustive combinations.

| Dimension | Required variation |
|---|---|
| Source | Frozen production candidate; relevant legacy fixtures and unsupported future-version fixture. |
| Workspace | One editor, same-plan second pane, another plan, layout resize, close/reopen, settings rebind. |
| Size | Just below/at/above current breakpoints; constrained and full width; actual host zoom. |
| Appearance | Light, dark, at least one community theme; long names and warning text. |
| Language / input | English/German, decimal point/comma, negative numbers where valid, invalid and unchanged fields. |
| Input | Mouse, keyboard, simple-pointer-without-drag; physical trackpad/pen only when claimed and actually available. |
| State | Idle, preview, invalid draft, command pending, stale projection, incomplete-write incident. |
| Geometry | Simple/irregular/rotated/curved, overlapping entities, hosted openings, group/hidden/locked members. |
| Lifecycle | Service reconstruction, native reload, supported upgrade, missing/moved/restored linked file. |

A general mobile-support claim needs corresponding actual-device evidence. Document exact OS/device/Obsidian versions; a body class or emulator screenshot is not a physical phone observation.

## 6. Result record template

Create a result entry per scenario and tested environment, using the repository's existing format where available.

| Field | Required value |
|---|---|
| Scenario / existing case | Acceptance ID plus repository case/test link. |
| Candidate | Source SHA, version, production asset hashes or link to candidate identity. |
| Fixture | Identity/version, exact counts or important input values. |
| Environment | OS, Obsidian, device/reader, theme, language, dimensions/zoom/DPR as applicable. |
| Method | Unit, integration, browser, native, physical device, or user observation. |
| Actions | What was actually done, including any departures from the procedure. |
| Expected | Relevant acceptance condition. |
| Actual | Observed behaviour; no inferred outcomes. |
| Outcome | Pass, fail, blocked, not run, or explicitly not applicable with a reason. |
| Evidence | Log/test/screenshot/recording locations; redact private information. |
| Defect / limitation | Linked item and release impact, when applicable. |
| Retest | Corrected candidate identity and outcome; retain original failure record. |

## 7. Completion and invalidation rules

A release case is complete when its applicable assertions have evidence on the candidate, not when its procedure is written. No native/device result is pre-filled in this handoff.

A production change invalidates the evidence it can affect. Re-run relevant cases and the integrated core journey after shared runtime/persistence changes. Record whether the installed bytes changed. If a workflow rebuilds the release, prove artifact equivalence or repeat the necessary verification; commit identity alone is not binary identity.

Failure of a safety case is a release blocker, not a candidate limitation to hide in notes. Optional A30 cannot hold up the default release while unselected, but it must be tested when it is included.

# Novice and accessibility validation protocol

**Recruitment-ready working protocol — 2026-09-13.** No participant, native Obsidian or
assistive-technology session has been run. Every result field in this document is intentionally
blank/not-run until a human session produces it.

This is the operational companion to the [validation and release plan](validation-plan.md).
Use the [current Plan Editor help](../../using-plan-editor.md) for participant-facing route
names and the [hybrid interaction contracts](mockups/hybrid-screens.md) for the intended
Plan/Renovate distinction. The [I15 record](parallel-delivery/receipts/I15.md) and
[I18 disposition](parallel-delivery/receipts/I18.md) define current evidence limits and the
deferred arbitrary-corner limitation.

## Evidence boundary and release dependency

This protocol records observed performance and comprehension for named participants. It does
not turn browser observations, automated checks, mockups or help text into human evidence. A
session counts only when the participant independently performs the task in the supplied
fixture and the moderator records the actual result. Assistance is recorded separately from
success.

The initial status for this packet is:

| Evidence stream | Required record | Current status |
| --- | --- | --- |
| First-use core loop | T1–T4, T5 and T12 counts for first-time participants | **Not run — 0 participants; result blank** |
| Mode comprehension | T11 identification probe, separate from task completion | **Not run — 0 probes; result blank** |
| Secondary workflows | Per-task denominators for T6–T10 and T11 task work | **Not run — 0 attempts; result blank** |
| Native host acceptance | Disposable-vault, persistence, restart/two-leaf and real files | **Not run — I16 dependency** |
| AT/access sessions | Keyboard/alternative pointer, enlargement and screen reader | **Not run — 0 sessions; result blank** |
| Release decision | Product-owner decision using complete evidence | **Pending; cannot be inferred from this protocol** |

The release decision remains blocked until the agreed human/native/accessibility evidence is
available. I18's unsupported task is not a pass condition: selecting one existing arbitrary
Room/Area vertex and changing it without a drag has no approved keyboard/non-drag route.

## Recruitment brief and screener

Run two formative rounds of six: baseline first, then candidate after priority fixes. Across the
12 participants, seek at least eight new to this editor with no CAD practice, six with low
confidence using unfamiliar software, six aged 65+, and four unfamiliar with Obsidian. These
characteristics overlap and must be reported per round. Include two confident experienced users
to detect efficiency regressions. Aim for at least three older and three low-confidence people
in each round.

Run four to six paid accessibility sessions covering low vision/enlargement, keyboard or
alternative pointer use, and screen-reader use. Record the input method and overlap with the
novice sample; do not inflate denominators by counting one person twice. Pilot with two people
who are excluded from all gate counts. Do not recruit from personal renovation data.

Record only what is needed for sampling and consent:

| Field | Record |
| --- | --- |
| Participant ID | `[blank — not recruited]` |
| Round / date | `[blank — not scheduled]` |
| New to this editor / CAD practice | `[blank]` |
| Confidence with unfamiliar software | `[blank]` |
| Age-band quota (if volunteered) | `[blank]` |
| Obsidian familiarity | `[blank]` |
| Device, input method, glasses/zoom | `[blank]` |
| AT used and version/configuration | `[blank — not assessed]` |
| Consent for observation / recording / quote / follow-up | `[blank — not obtained]` |
| Exclusion or pilot flag | `[blank]` |

Do not collect vault paths, room names from personal projects, note contents, photos, raw keys,
geometry coordinates or inferred disability. Store contact details separately from task results.

## Session setup and moderator script

Use the synthetic project specified by the [validation plan](validation-plan.md): realistic rooms,
independent and connected walls, doors/windows, overlaps, objects/groups, a marked reference
distance and fake renovation links. Validate the saved fixture through domain/persistence code.
Use the current production-equivalent route:

```text
?view=plan-editor&reference&planning&fidelity
```

Record the actual leaf width and height, commit, build, browser or native host, OS, language,
theme, input method, zoom/scaling and fixture identifier before the task starts. Use the same
inputs in baseline and candidate rounds. Counterbalance secondary-task order. Do not teach Add,
Details, shortcuts or calibration before the corresponding task. Give only neutral orientation
needed to open the supplied project and record that setup effort separately.

Read this opening instruction verbatim, then allow the participant to work:

> “Please work on this sample renovation plan as you normally would. Tell me what you expect to
> happen, and think aloud if that is comfortable. I may ask what you are looking for, but I will
> not explain the control before you try it.”

Use the assistance ladder in order and record the first level used: repeat goal → neutral
encouragement → directional hint → exact instruction → moderator completion. A task requiring a
directional hint or later is assisted, even if the final state is correct. Stop for distress or
request; there is no age-based speed deadline.

## Task cards

Give each task only its neutral goal. Record completion from the saved/observable result, not
from a participant's verbal intention. T1–T4, T5 and T12 are the first-use core set. T6–T10
and the task portion of T11 are secondary workflows with their own denominators.

| ID | Participant goal | Independent evidence | Count stream |
| --- | --- | --- | --- |
| T1 | Open the sample ground-floor plan and explain what you can do first. | Correct floor; identifies a valid start without requiring a reference. | First-use |
| T2 | Add a Kitchen 3.5 m wide and 4.2 m deep. | One committed named room; saved dimensions match, not just preview. | First-use |
| T3 | Make the depth 4 m while retaining width. | Intended dimension changes; other geometry stays as promised. | First-use |
| T4 | Undo the last change; remove and restore a disposable spare room. | Correct original state and identity; supported recovery discovered. | First-use |
| T5 | Inspect a corner, then see the whole floor. | Camera changes without geometry changes; **Fit floor** or **Fit selection** route found. | First-use |
| T6 | Select the marked door in a wall/room overlap, then the room underneath. | Correct target each time; no accidental movement; no moderator-taught modifier. | Secondary |
| T7 | Use the supplied drawing and marked 4 m distance as a reference. | Correct source/points/unit, committed scale, and clear review/cancel/retry understanding. | Secondary |
| T8 | Adjust a supported door, then make a precise rotation or move. | Valid result with pointer and equivalent precision route; impact understood. | Secondary |
| T9 | Copy the specified Room/group to another supplied floor. | Predicts copied dependencies/exclusions; one direct Paste and correct Undo. | Secondary |
| T10 | Open the related note, return, narrow the pane and continue editing. | Meaningful context and draft survive the return; Details/canvas route works. | Secondary |
| T11 probe | Without coaching, say where you would change room size and where you would plan renovation work. | Chooses Plan for layout and Renovate for work/material/cost context. | Mode comprehension |
| T11 task | Perform each supported mode task, return to the same target, and continue. | Finds relevant controls; target/camera return; no accidental geometry edit in Renovate. | Secondary |
| T12 | Finish for today, reopen, then encounter a controlled failed/stale write. | Distinguishes saved/failed/stale; persisted data independently verified. | First-use |

Do not ask participants to resize arbitrary rotated Room bounds as though the rectangular
dimension form supported it. If a corner-editing question is included, label it as an explicit
unsupported probe and do not count it as a failed completion of an adopted route.

## Scorecards

Complete one row per participant/task. Use `I` for independent, `A` for assisted, `M` for
moderator completion, `F` for failed/refused, and `NR` for not run. Never convert a blank or NR
into a failure or success.

### A. First-use core scorecard

| Participant | First-time eligible | T1 | T2 | T3 | T4 | T5 | T12 | Core loop independent? | Assistance / notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `[blank]` | `[blank]` | `NR` | `NR` | `NR` | `NR` | `NR` | `NR` | `[blank — not run]` | `[blank]` |

Report separately: `independent participants / eligible participants` for each T1–T4, T5 and
T12, then the complete-loop count. Proposed gate: at least 5 of 6 final-round first-time
participants independently complete T1–T4 and T12.

### B. Mode-comprehension scorecard

This denominator is separate from T11 task completion and from the first-use core loop.

| Participant | Probe eligible | Plan for layout? | Renovate for work context? | No coaching? | T11 task completed independently? | Geometry stayed protected? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `[blank]` | `[blank]` | `NR` | `NR` | `NR` | `NR` | `NR` | `[blank]` |

Report probe correctness as `correct probes / probe-eligible participants`, with the full
denominator. Proposed gate: all six final-round novices receive the probe and at least 5 of 6
choose Plan for layout and Renovate for work/material/cost context without coaching.

### C. Secondary-task scorecard

Each task has an independent denominator. A participant who fails T6 must still appear in the
T7–T11 rows they attempted; do not silently drop a difficult task.

| Task | Attempts | Independent | Assisted | Moderator-completed | Failed/refused | Not run | Blocking observation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| T6 overlap selection | 0 | 0 | 0 | 0 | 0 | 0 | `[blank — not run]` |
| T7 reference | 0 | 0 | 0 | 0 | 0 | 0 | `[blank — not run]` |
| T8 existing manipulation | 0 | 0 | 0 | 0 | 0 | 0 | `[blank — not run]` |
| T9 copy scope | 0 | 0 | 0 | 0 | 0 | 0 | `[blank — not run]` |
| T10 interrupt/compact | 0 | 0 | 0 | 0 | 0 | 0 | `[blank — not run]` |
| T11 task | 0 | 0 | 0 | 0 | 0 | 0 | `[blank — not run]` |

For each row report `independent / attempts` and assistance distribution. Proposed gate: at
least 4 of 5 candidate attempts per T6, T7, T9, T10 and T11 succeed unaided; any shared failure
blocks claiming that workflow is consolidated until fixed and retested. T8 is reported with its
actual denominator and supported route; it does not inherit another task's denominator.

### D. Native and AT evidence card

| Session | Host/AT environment | Task route | Actual result | Limitation / follow-up |
| --- | --- | --- | --- | --- |
| `[blank — not run]` | `[blank — not assessed]` | `[blank]` | `[blank]` | `[blank]` |

Do not label the Browser AX tree, axe/jsdom gate, screenshots or this protocol as screen-reader,
native Obsidian, zoom, contrast, target-size or participant evidence. I16 owns the native
disposable-vault evidence; the applicable AT matrix remains an explicit release dependency.

## Analysis and release handoff

For every failure, retain the task, participant characteristics relevant to the sampling plan,
assistance level, exact route, observed recovery, and whether the issue affected data safety,
mode meaning, focus, or comprehension. Report older, low-confidence, first-use and input-method
results visibly; do not average away a disparity. A small-sample result is a formative signal,
not a population success rate.

At handoff, attach the completed scorecards and a receipt containing commit, fixture, actual
dimensions, language/theme, input/AT environment, action sequence, expected/actual result and
limits. If denominators cannot be met, mark usability validation incomplete; unavailable
participants are not a passed gate. The product owner decides whether to release, defer, or
narrow the claim after I16 native evidence and the human/AT records exist.

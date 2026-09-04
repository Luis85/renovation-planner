---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 75
sources:
  - SDD §66
  - SDD §68
  - SDD §86
  - SDD §92
status: Ready
---
# A note that cannot be read

**One bad note costs the user that note and nothing more.** The zone and plan listings skip
a note they cannot read and count it, two surfaces draw that count as a warning strip, and
the reassignment picker refuses instead — deliberately, because it is offered before a
delete. The diagnostics report that all three sentences point at has a door for the first
time.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled.

## Why a human is the only instrument here

Three things put every step below out of reach of `npm run check`, and they are different
reasons rather than one restated:

- **No gate draws either strip.** jsdom lays nothing out, so the suite can read a strip's
  TEXT and never its position, its wrapping or whether it is legible beside the notices it
  sits with. The browser harness cannot help either: its repositories start empty and hold
  ENTITIES rather than text, so no page it can draw has a note that refused.
- **The report is a `Modal`, and this repository cannot draw one.** The vendored
  `tests/harness/obsidian.css` declares no modal chrome, exactly as it declares no
  `.notice` — so `styles/diagnostics.css` is verified by nothing anywhere. Every rule in
  it is an expectation until this case is run.
- **The clipboard is a real permission.** `navigator.clipboard.writeText` is stubbed in
  the suite. Whether Obsidian's renderer grants it, and what the user sees when it does
  not, is a vault question.

## Steps

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | Run `npm run test-build`, open this folder as a vault (or reload it), enable the plugin, open the developer console (`Ctrl+Shift+I`), and run **Create sample project** from the palette | A project, a plan and five zones exist, and the Plan Editor opens on the plan with five zones drawn | The baseline every later step corrupts. Five is the number to remember: every count below is against it |
| 2 | `obsidian` | In the file explorer, open one zone note and change its frontmatter `schema-version: 1` to `schema-version: 99`. Save | Nothing visible happens yet | A note from a build this one predates — the fail-closed read gate (SDD §44), and the cheapest refusal a user can produce by hand |
| 3 | `obsidian` | Reload the plugin and open the Plan Editor on that plan | **Four zones are drawn**, and a notice reads "1 room(s) or area(s) in this plan could not be read and are not drawn. Open the diagnostics report to see which notes refused." | The whole increment, in one step. **Before it: no zones at all** — `ObsidianZoneRepository.list` answered the first read failure it met, so one unparseable note failed the listing and the canvas drew nothing. Read the sentence rather than paraphrasing it: a code with no locale entry does not degrade to silence, it degrades to the wrong sentence. **It said "1 zone(s) in this plan" here until 2026-09-05** — the Add Room increment rewrote `editor.some-zones-unreadable` into homeowner words and step 7's quote below was swept with it while this one was not, which is how one sweep leaves two quotes of one branch's copy disagreeing |
| 4 | `obsidian` | Corrupt a second zone note the same way, reload, and reopen the editor | Three zones are drawn and the notice says **2** | The count is real rather than a boolean wearing a number. `{count}` is interpolated by slice 19's `t(language, key, params)`; a build that lost the parameter renders a literal `{count}`, which is a visible bug report rather than a silent one — that is why the hole is left standing rather than blanked |
| 5 | `obsidian` | Restore both zone notes to `schema-version: 1`. Now open a PLAN note and set its `schema-version: 99`. Reload, open the Renovation project view, and click into the project | The project's other plans are listed, and a notice reads "1 plan(s) in this project could not be read." | The sibling listing, on design slice 21's detail state. Before this increment that state drew its **failure screen** with no plans at all |
| 6 | `obsidian` | Delete every plan note but the corrupted one (or corrupt the only plan), reload, and click into that project | The plans region shows the **notice** and **no "no plans yet" empty state** | `selectProjectDetailEmptyState` refuses the empty state when anything refused. "Create your first plan" beside "1 plan could not be read" is two sentences contradicting each other about one project, and this state was unreachable before the listing learned to skip — it used to be the failure screen |
| 7 | `obsidian` | Restore the plan note. Corrupt one zone note again, reload, select a zone that has a Requirement, and press **Delete** | A refusal appears reading "Some rooms or areas in this project could not be read, so the list of places to move this to is incomplete. Open the diagnostics report to see which notes refused." — **never a picker with four rooms in it** | The one consumer that must NOT carry the count, and the step where that decision is looked at. The picker is offered BEFORE a delete, so a silently short list is how a user reassigns to the wrong room and then destroys the right one. A refusal is recoverable by asking again; a short list is not recoverable at all |
| 8 | `obsidian` | Run **Show diagnostics report** from the palette | A modal titled "Diagnostics report" opens, carrying the plugin and Obsidian versions, the schema versions, the pending migrations, and **one row per refusal — each naming the note's PATH** | The join, and the surface `GetDiagnosticsSnapshotQuery` never had: it was built, guarded, composed and tested in slice 11 and consumed by nobody, while three sentences now point at it. The ledger holds an opaque id and never a path (`diagnostics.test-d.ts` makes that a compile-time guarantee); the VIEW joins the id against the project index so the user can find the note |
| 8a | `obsidian` | Read the modal's layout | The scope sentence sits above the facts, the facts read as a two-column list, each issue row stacks its code, id and path, and nothing overflows the panel | `styles/diagnostics.css`, which **no gate anywhere reads**: jsdom resolves no CSS and the harness cannot draw a Modal. Every rule in that file is an expectation until this row is filled in. The row is a COLUMN on purpose — a path is long, an id is opaque and a code is short, and three on one line either wrap unpredictably or push the path out of the panel |
| 9 | `obsidian` | Press **Copy report** and paste into a scratch note | A notice reads "Diagnostics report copied.", and the pasted text carries the entity **ids** and **no path at all** — no `.md`, no folder name | SDD §86's asymmetry, which is what this increment is built on: the report SHOWS a path because the user has to find the note, and the EXPORT carries none because exporting is what leaves the device. `diagnosticsReportText` takes the snapshot and nothing else, so a future edit wanting a path there has to widen the signature |
| 9a | `obsidian` | Deny or disable clipboard access if your platform allows it, and press **Copy report** again | A notice explains the failure and the console carries a `diagnostics.copy.failed` line — **no "Copied" notice appears** | The success notice is chained inside the promise so it fires on fulfilment only: "Copied" beside an empty clipboard is worse than no notice at all. The handler is `runDetached` rather than a bare `void`, which discards a rejection rather than handling it. If your platform cannot deny the permission, record that rather than passing the row |
| 10 | `obsidian` | Open **Settings → Renovation Planner** and press the **Diagnostics report** row | The same modal opens, with the same rows | One action, every input. Two doors with two compositions look correct alone and drift the moment either is edited |
| 11 | `obsidian` | Reload the vault. Without opening any plan, run **Show diagnostics report** | The report opens, says **"No notes have refused to load in this session."**, and carries the sentence "This report covers the current session only. It is cleared when the vault is reopened." | The recorded limitation, LOOKED AT rather than described. The ledger is in-memory and session-scoped, so an empty report after a restart means "not recorded yet" and never "nothing is wrong" — which is why that sentence is on the surface the user reads rather than only in a docblock |
| 11a | `obsidian` | Now open the plan with the corrupted zone, then reopen the report | The report holds the refusal. Open a SECOND plan with its own corrupted note and reopen: the report holds **both**, while each editor's strip counts only its own | The second recorded limitation: a strip counts ONE listing and the report holds every refusal this session, deduplicated on `(kind, id, code)`. The two disagreeing is correct and is not reconciled anywhere |
| 12 | `obsidian` | Break `data.json` in the plugin folder so the settings cannot be read, reload, and run **Show diagnostics report** | A notice reads "Settings could not be read. Fix or remove data.json in the plugin folder, then reload the app." and **no modal opens**. The settings pane offers no diagnostics row | An empty report is the WRONG answer there rather than a lesser one: `GetDiagnosticsSnapshotQuery` is composed inside `persistence`, which is null exactly when settings are, so a report that opened would say "No notes have refused to load" about a session that never attempted a read |
| 13 | `obsidian` | Restore `data.json`. Switch Obsidian to German (Settings → General → Language) and repeat steps 3 and 8 | Both sentences are German — "1 Zone(n) in diesem Grundriss konnten nicht gelesen werden…" and a "Diagnosebericht" — and **the count is rendered as a digit, never as a literal `{count}`** | Nothing in any gate RENDERS `de.ts`; the two terms `strings.test.ts` pins are two words, not the language. Every earlier German defect here — a wrong term, a garbled word, one noun with two genders — was found by a human reading the rendered pane. The `{count}` half is its own check: `strings.test.ts` asks that each key's German names the same holes as its English, and a hole that survives to the screen means the interpolation never ran |

## Deliberately NOT checked

- **Whether the skipped note is ever repaired.** This increment makes one bad note cost one
  note; it does not fix the note. `docs/issues/A future-version note can be neither read nor
  deleted.md` stays open, and its *which note* half is what step 8 answers.
- **The 200-issue cap.** `MAX_ISSUES` bounds the ledger and evicts the oldest entry. Reaching
  it by hand means 200 distinct corrupted notes, which is not a scenario a walkthrough can
  arrange honestly.
- **Whether the report's rows are ordered usefully.** They are in recording order, which is
  the order reads happened rather than anything a user chose. Nothing here claims otherwise.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the design document, the plan and the code, not an observation. |

Fill this table in on the first walkthrough, and treat anything it finds as a defect of this
increment rather than of this case — with a test that fails without the fix, per the suite's
own rule.

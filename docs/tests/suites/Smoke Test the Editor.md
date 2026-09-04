---
type: Test suite
order: 220
sources:
  - SDD §11
  - SDD §60
  - SDD §91
status: Ready
---
# Smoke Test the Editor

The cases that can only be run **by a human, inside Obsidian**. Everything here exists
because `npm run check` cannot see it.

That is not a general claim about manual testing being valuable; it is the specific record
of what this project's four gates missed. Design slice 5 shipped with all thirteen of its
Definition-of-Done items verified by the suite and by `npm run harness-shot`, and **none of
them had ever been seen in the app**. The first walkthrough found four defects in a row,
every one of them green in 869 tests:

| What broke in the vault | Why no gate saw it |
| --- | --- |
| Creating a plan reported a failed migration | `FakeMetadataCache` parsed the vault synchronously; Obsidian's `MetadataCache` is asynchronous, so a note read back in the tick it was created has no cache entry |
| The geometry sidecar could not be created | `FakeVault.create` accepted a path whose parent folder did not exist; Obsidian refuses one, and nothing creates `Geometry/` |
| Reactivating the plugin logged `Several Konva instances detected` | Konva assigns `window.Konva` at module scope on every load and nothing released it on unload |
| A restored Plan Editor said "This plan no longer exists" | Obsidian restores leaves BEFORE `onLayoutReady`, and the index scan runs FROM it, so the view hydrated against an empty index |

Three of those four are the same defect wearing different clothes: **a test fake that
accepted what Obsidian refuses.** That is the thing to be suspicious of when a case here
fails and the suite disagrees.

**A clean walkthrough is a result too, and slice 14's was the first.** Its run on 2026-08-27
([[Empty States Walkthrough]]) found nothing — the first slice touching a rendered surface to
go through this suite without a finding. Read that as the suite still earning its place rather
than as a reason to skip it: the slice's central decision was that the Plan Editor's empty
states OVERLAY a canvas that stays mounted, and the two things that protects —
`create-sample-project`'s backgroundless plan, and this harness's own refusal of a background
— are both unreachable from the automated suite. A replacement would have drawn an empty
state where the scene belongs with all 1976 tests green. The walkthrough is what said it did
not. **A pass here means a claim was checked, not that checking was unnecessary.**

## Running it

```bash
npm run test-build      # builds into .obsidian/plugins/ — this repository IS a vault
```

Then open this folder as a vault (or reload it if it is already open) and work through the
cases below. Two of the steps need real files, both in
[`docs/tests/fixtures/`](../fixtures/):

- `editor-background-png-test.png` — redraw it with `npm run background-fixture`. It is
  generated rather than hand-made so that what it asserts is reviewable as code;
  `scripts/background-fixture.mjs` says what every mark on it is for.
- `editor-background-pdf-test.pdf` — a real printer-driver PDF (Chrome's "Print to PDF"),
  carrying the compression, embedded fonts and image a minimal fixture does not.

**These are the vault's copies, and they are yours to move.** Both files also exist in
`tests/fixtures/`, and that is where the automated check
(`tests/presentation/editor/committedFixtures.test.ts`) reads them from — never from here.
`docs/` is user land: reorganising it while working in Obsidian must not turn a test red,
which it would if the suite depended on these paths. `npm run background-fixture` writes the
PNG to both places, so the two cannot drift; the PDF has no generator, so it is simply
tracked twice.

The automated check does not replace the walkthrough. It exists so a walkthrough never
begins with a fixture that has quietly stopped decoding.

## What to do with a failure

Record it in the case, then treat it as a defect of the slice that owns the surface rather
than of the walkthrough. Every defect above was fixed in the slice that shipped it, and the
fix carries a test that fails without it — a manual case whose findings are not converted
into an automated check will find the same thing again next release.

## The triage column

Every step below carries a **`Reachable by`** verdict — a column in the fourteen cases whose
steps are a table, and an inline token after the step number in [[Canvas Navigation]], whose
procedure is a list. The verdict names the **cheapest instrument that could discharge that
step as written**. It is a claim about the step's own pass condition, not a report on what is
tested today.

| Verdict | What it means | Steps |
| --- | --- | --- |
| `suite` | The pass condition is DOM state, a render model, a command outcome or a vault file — expressible in the jsdom suite with no new infrastructure | 103 |
| `browser` | Needs a real engine: layout, the CSS cascade, focus BEHAVIOUR or a visible focus ring, paint, or an input grammar jsdom cannot produce. Not focus ASSIGNMENT — jsdom models `activeElement`, so "the caret lands on Start" is `suite` | 51 |
| `obsidian` | Needs Obsidian itself — its chrome, keymap, workspace, settings pane, language, `Notice`, its copy of pdf.js, or its file explorer | 120 |
| `desktop` | Needs a real desktop or real hardware beyond a headless browser: window activation, browser chrome, a physical mouse or a touch screen | 13 |
| `judgement` | NO clause of the pass condition can be settled by any instrument. It beats the other four rather than ranking among them — a step needing Obsidian AND resting on an eye is `judgement`, because naming the host would imply an automatable claim. A judgement clause inside an otherwise assertable step does NOT promote the row: it is recorded as a residue in that case's clause table, or [[Zone Editing Walkthrough]] 4 would be `judgement` for one adverb beside three assertable clauses | 13 |

**300 steps across SEVENTEEN cases, and this paragraph has now proved itself an EIGHTH time — at
a merge, which is the shape the fifth correction had and the sixth deliberately did not.** This
branch measured 288 across sixteen and `main` measured 276 across fifteen; both were correct on
the day and neither is correct now, because each had counted a tree without the other's case in
it ([[Browse the asset library]] and [[Open a floor and select a room]] respectively).
**Neither side of the conflict could be taken.** The five figures above are a fresh run of BOTH
greps below against the merged tree, taken in the edit that resolved it, and they sum to 300
rather than being asserted to. `main` also moved rows this branch never touched — a step 11 in
[[Open a floor and select a room]] and a tenth-numbered hover step in [[Canvas Navigation]] —
which is why an arithmetic 288 + 11 would have answered 299 and been wrong by one in a way
nothing would have caught.

**The seventh correction's own account follows, and it stands.** *288 steps across SIXTEEN
cases, and this paragraph has now proved itself a SEVENTH time.* The
asset library increment's Task 17 appended [[Browse the asset library]] to the `## Cases` list
below — eighteen steps spread over four tiers (`suite` 4, `browser` 9, `obsidian` 1,
`judgement` 4), so every tier but `desktop` moved where the sixth correction moved exactly one.
Re-run of both greps below against the current tree, taken in the edit that wrote this.

**And it proved itself again WITHIN the same task**, which is worth one clause: the figures here
first read 287 over seventeen steps, and Task 17's own fix round added an eighteenth (the
`Back to library` chevron, which had been reported as a defect with no step to find it in). The
greps were re-run rather than the total incremented, because an arithmetic adjustment is how the
third and fourth corrections in this paragraph's history went wrong.

**That sentence first claimed the case was the FIRST here to span four tiers, and measuring it
before committing said otherwise:** [[Zone Editing Walkthrough]], [[Notices and save state]],
[[Empty States Walkthrough]], [[Create a Project]] and [[Calibrate a Plan]] each already span
four, and [[Canvas Navigation]] spans all five. What is true is the narrower thing — a case
whose subject is the gap between what each instrument can settle ends up spread rather than
concentrated — and it is worth recording that the false version was caught by a one-line loop
over the same two greps this section already names as its authority, rather than by review.

**The sixth correction's own account follows, and it stands.** *270 steps across FIFTEEN cases,
and this paragraph has now proved itself a SIXTH time — this time in the commit that ADDED the
case, which is a shape the previous five did not have.* The asset library increment appended
[[Open the Asset Library]] to the `## Cases` list below and left this paragraph reading 264
across fourteen, so the file contradicted itself within one commit rather than across a merge.
`obsidian` moved 108 → 114 with it; the other four verdicts did not move.

**The remedy is no longer a more careful paragraph.** Five previous corrections were each careful
and each went stale, so a sixth careful sentence predicts a seventh staleness. What changes here is
that the greps are the authority and this prose is a snapshot of them — read the number by running
them, and treat any figure written above as the day it was taken. Earlier account follows.** The per-project price override branch
measured 239 across thirteen and the asset designer branch measured 243 across thirteen; both
were correct on the day and neither is correct now, because each had counted a tree without the
other's case in it ([[Price a shared asset for one project]] and [[Design an Asset]]
respectively). **Neither side of the conflict could be taken.** The five figures above are a
fresh run of BOTH greps below against the merged tree, taken in the edit that resolved it, and
they sum to 264 rather than being asserted to. The asset designer branch's own note that
[[Create a Project]] had been missing from the `## Cases` list for the whole of its life stands
and is unaffected by this re-run: the greps read files, not the prose beside them.

**And two cases had already moved it before the re-run that produced those figures, which is
this paragraph proving itself a fourth time.** The line above read *203 steps across ELEVEN
cases* while `docs/tests/cases/` held TWELVE files: [[A note that cannot be read]] landed on
`main` with sixteen steps and this section was not re-measured, so the total and the `obsidian`
row were the only two figures wrong — every other tier was untouched by that case, which is
exactly why nothing looked odd. The re-run above adds it and [[Price a shared asset for one
project]] together, so the current figures are one measurement of the whole tree rather than
two arithmetic corrections stacked. A count is only as current as its last grep, and the
increment that adds a case is the one that has a reason to take it.

**276 steps across FIFTEEN cases, and this paragraph has now proved itself a SIXTH time — not at
a merge this time, but at an omission inside one tree.** [[Open a floor and select a room]] had
been in `docs/tests/cases/` since the plan editor foundation's first increment, so the case count
here was never wrong; only the step total was, because the census had not been re-run since that
case's own step 6 and step 9 were written, and it had not been re-run again after this
review-findings task gave that case a step 11 (the `Ctrl+P` keymap instrument,
[[The manual keymap claim points to a step that never invokes the keymap]]) and gave [[Canvas
Navigation]] a tenth-numbered hover step for the Select tool's two new cursor classes. The two
greps below, run in the edit that resolved it, print 259 table rows across fourteen files and 17
list steps in [[Canvas Navigation]], for 276 across fifteen cases — `suite` 99, `browser` 42,
`obsidian` 113, `desktop` 13 and `judgement` 9. See
[[The smoke-test census omits the newest case]], closed.

**This paragraph is its own worked example, twice over.** Design slices 19 and 21 each re-ran
the two greps and each wrote down what it measured; both were correct on the day, and the merge
of the two made both wrong at once, because each had counted a tree without the other's cases in
it. Slice 21 recorded 185 steps across ten cases (`obsidian` 60, `judgement` 8), slice 19
recorded 184 across ten (`suite` 71, `browser` 28, `obsidian` 65). Neither side of that conflict
could be taken: the figures above are a fresh run of both greps against the merged tree.

**And the case count went with it.** Slice 19's version carried a parenthetical saying
[[Navigate into a project and back]] "is an eleventh case file and carries no verdicts, so it is
not among the ten" — true when written, and false by the time it merged: slice 21's improvement
pass gave that case its verdict column, and it contributes 17 steps. Eleven cases, all of them
carrying verdicts, measured per file rather than assumed.

The instrument is TWO patterns, because the verdict has two spellings and a grep that sees only
the table form silently under-counts by the seventeen steps of [[Canvas Navigation]]:

```bash
grep -rhoE '^\| [0-9]+[a-z]? \| `(suite|browser|obsidian|desktop|judgement)` \|' docs/tests/cases/*.md
grep -ohE '^\s*[0-9]+[a-z]?\.\s+`(suite|browser|obsidian|desktop|judgement)`' 'docs/tests/cases/Canvas Navigation.md'
```

Written down because it had to be reconstructed once: the sentence above said the numbers were
grepped and not with what, and a first attempt that matched table rows alone answered 149 —
close enough to read as right, and wrong by exactly the case whose steps are a list.
[[Editor Walkthrough]] 7 has since moved `browser` → `obsidian` (its own paragraph says why),
which is what took those two rows from 29 and 47 at the time — a note about that edit, not
about today's five figures, every one of which has since moved again.

What is traced of the latest move and what is not, stated separately: [[Move the Library]] is
sixteen `obsidian` steps of its own and [[Navigate into a project and back]] is seventeen steps
across four verdicts, which is most of `obsidian`'s rise. The rest — and `judgement` going 8 → 9
— is drift that accumulated between re-runs and was found by re-running, not by anyone noticing.
Which is the sentence above proving itself a third time: a count is only as current as its last
measurement, and nothing here re-takes it.

**`suite` means REACHABLE, and never "already covered".** That difference is the whole of the
follow-up work. A sample was checked against the tests rather than inferred from filenames —
the click-versus-drag epsilon, the click on a vertex handle, the close-while-a-close-is-in-flight
guard and the chorded-button grammar all have named cases in `selectTool.test.ts`,
`drawPolygonTool.test.ts` and `canvasChordedButtons.test.ts`, and the empty-state overlay's
structural half is in `emptyStateOverlay.test.ts`. The other sixty-odd were not opened one at a
time. So a `suite` verdict says the step COULD be a node test; confirming that it IS one, or
writing it, is what converts that step from something a human does into something that runs.

**One case has now had that done, and it is the template for the other eight** — a template
with a procedure: `.claude/skills/auditing-manual-test-cases/SKILL.md` is what that pilot cost
turned into, and the eight remaining cases are what it exists for.
[[Zone Editing Walkthrough]] carries a *What discharges each step* section naming the test
behind each of its twenty `suite` and `browser` verdicts, read from the test BODY rather than
matched on a name. **All seventeen of its `suite` steps are discharged of every clause an
instrument can settle** — step 4 keeps "smoothly" as a residue, which a drag that lands
correctly and stutters would still fail — and SEVEN were not when the
audit began: nothing asserted the selection OUTLINE (1), nothing looked at the interaction
layer after a DESELECTION (2), nothing asserted the Undo button is DISABLED (3), nothing
asserted that a drag PREVIEW follows the pointer rather than merely existing (4), nothing
asserted the geometry entry goes on a SUCCESSFUL delete (12), nothing asserted the restore
publishes no creation event (13), and nothing redid a delete (14) — and each now has a case
watched failing against a mutation. This sentence said FIVE and listed five until steps 3 and
13 were added to the walkthrough's own list and this copy was not re-read; the step numbers
are here so that the next omission is visible as a gap in a sequence rather than as a number
only the canonical file can contradict. **Its three `browser` steps are not discharged, and are not gaps either**,
which is a distinction the first draft of this paragraph collapsed into one number: 8a and 8b
have their jsdom-reachable halves covered and a browser residue BY DESIGN — a theme colour, a
host focus behaviour — and 8e has nothing at all by construction, being a 460px truncation.
Count coverage per TIER or the totals contradict the audit's own rows.

**The audit was wrong in BOTH directions before those tests were written, which is the number
to plan against rather than the tidy one.** It OVER-reported coverage four times — the two
overlay clauses, a drag preview asserted only to be non-null, and a sidecar deletion cited to a
COMPENSATION case proving the opposite half of its pair — each time by finding an assertion
covering PART of a step and writing the step down as discharged. It UNDER-reported once: it read
a test's NAME as its whole claim and called the vertex inverse untested, where that test's last
line asserts it. Five corrections across six review rounds, and a reviewer found all but one.
So an audit wants a second reader as much as the triage did, and writing the test is what
settles a gap claim, because a mutation cannot be argued with.

What the pilot also measured is where coverage turned out to LIVE: four of the twenty are
discharged by a case in a file no reader of that walkthrough would open, including its step 1,
whose handle count sits inside the case named for its step 6, and the both-files halves of
steps 8 and 12, which are in `consistency.test.ts` two directories away. A name-matching pass
would have called step 1 a gap outright and taken 8 and 12 on trust.

**Both `suite` and `browser` run on the fakes, so neither reaches the fidelity residue.** Three
of the first four defects this suite ever found were a fake accepting what Obsidian refuses,
and a browser harness wired for real writes would compose the same `FakeVault`. That is why a
step whose "It exists to catch" names an Obsidian-specific behaviour is tagged `obsidian` even
where its logic is `suite`-reachable, and why neither verdict is on its own a reason to stop
walking a case in a vault before a release.

**A step is tagged for its WHOLE pass condition, including a clause that is not the point of
it.** Several steps end with a secondary observation in a higher tier than the thing they are
mainly about — [[Canvas Navigation]] step 3 is a grab cursor and a pan, then *"record what
Obsidian itself did with the space bar"*; [[Create a Project]] step 7a is a busy dialog
refusing `Escape`, then a conditional clause about a vault hotkey firing. The tag is the
HIGHER tier in every such case, because a verdict names what would discharge the step as
written and half a step is not discharged. The cost is that the tag then hides how much of the
step a cheaper instrument would reach, and the remedy where that matters is to split the step
rather than to soften the tag. The first draft of this triage got four of these wrong in the
cheaper direction, which is what the rule is written down for.

**And the whole ROW, not the pass condition alone — which is the half of the rule the sentence
above did not say, and a reviewer read it the narrow way twice.** A step is three columns: what
to do, what passes, and what it exists to catch. Some rows state a pass condition NARROWER than
the failure they name. [[Editor Walkthrough]] step 3 passes when "§60's five regions are
present" and exists to catch *layout collapse* — and a view collapsed to 39px of a 700px pane
has all five regions present, which is the defect `npm run harness` actually found and no gate
could see. [[Assign an Asset and Delete a Referenced Zone]] step 14 says "look at what the
dialog COVERS" and then passes on the dialog's own words. Read either row by its pass condition
alone and it is `suite`; read what the step is for and only a browser settles it. The highest
tier anything in the row requires is the tag, so both are `browser`. Where that grates, the
honest repair is to tighten the pass condition until it can fail the way the fourth column says
it should — the same remedy as the split, applied to a row that under-promises rather than one
that over-reaches.

**What the distribution says, since it is not what the suite's own header implies.** Two fifths
of these steps are already inside the jsdom suite's reach — this file has grown case by
case, and no earlier pass ever asked which steps the suite had caught up with. The steps that
genuinely need a vault are not spread evenly either: two cases, [[Notices and save state]] and
[[A Project Owns Its Folder]] held 26 of the 47 `obsidian` steps between them at the count
this sentence was written against, because one surface is drawn by Obsidian's own `Notice`
and the other is about where files sit — and [[Move the Library]] has since made a third,
fifteen `obsidian` steps of its own, for the same kind of reason. The
`browser` tier is the one this triage was made to price, and three review rounds moved it in
both directions: six of [[Canvas Navigation]]'s nine `browser` steps turned out to be `suite`,
`obsidian` or `desktop` on a closer read, and five `suite` steps then turned out to be
`browser` under the rule above. It has been 35, 27, 33, 32, 31, 30, 29, 30 and now **33** —
the last of those measured by the re-run above rather than reasoned from the one before it.
It moved by three rather than by the six [[Price a shared asset for one project]] first
carried, because that case was re-read against this section's own rule before it landed and
four of its verdicts moved: its Inspector steps need a VAULT, not a browser, since the harness
draws the Requirements panel empty and its command bundle refuses every write, so a `browser`
verdict there would have promised an instrument that does not exist. Read the sequence as the shape of the
remaining audit rather than as a settled figure — a `browser` verdict is exactly as
unconfirmed as a `suite` one, and for the same reason.

**Four `browser` steps are tagged that way for a POSITIONAL clause alone, and they are the
split candidates.** [[Create a Project]] 1, [[Empty States Walkthrough]] 1, [[Calibrate a Plan]] 2
and [[Assign an Asset and Delete a Referenced Zone]] 8 each pass on something
being *centred*, *beside* or *above* something else, while the failure each one names in its
own "It exists to catch" is presence: a view that drew nothing, a tool registered nowhere, a
calculated figure hidden behind its own override badge. The rule above still tags them
`browser`, because a panel really can render off-centre and the pass condition really does say
centred — but a reader pricing the browser tier should know that four of its steps would fall
back to `suite` the moment their positional clause became a step of its own. That is what
"split the step rather than soften the tag" means in practice, with the list to work from.

**It was FIVE until a reviewer read [[Calibrate a Plan]] 7, and that one left the list by a
third route neither this paragraph nor the rule above had allowed for.** Its positional word
was not a claim: "the measured plan distance shown *above* the field" described where the
text happens to render, while everything the step exists to catch — two dialogs in sequence
through the one-at-a-time store — is `suite`, and BOTH clauses have jsdom cases
(`calibrateWiring`'s *confirms, then asks for a distance* and *KnownDistanceForm shows what
was measured*). So the remedy was neither splitting the step nor softening the tag but
**rewording a pass condition that overclaimed**, and the row is `suite` outright. A positional
word is a candidate for the split list only once someone has asked whether the step means it —
this sweep found the word and never asked, which is the same instrument defect as the
*(see Runs below)* miss recorded below, one layer up: the first sweep matched a word that was
not a claim about the screen, and this one matched a word that was.
The count above carries no DENOMINATOR on purpose: the table has the current tier size, and a
sentence restating it is a second place for it to go stale — which it did, in three consecutive
review rounds, each time in the sentence next to the one being corrected.

**The list was SIX until a reviewer read it.** It came out of a `grep` for layout vocabulary
over each step's pass condition, and the sweep counted [[Empty States Walkthrough]] step 2 on
the word *below* — in "(see Runs below)", a cross-reference to another section of that same
file rather than a claim about where anything sits on screen. The hit was printed and
approved without being read. This project's own rule for exactly that — measure a set with
an instrument that can see all of it, and test the instrument first — is worth re-reading
before the next sweep of these files: a regex over prose finds the WORD, and every verdict
here turns on what the word is doing in the sentence. Re-run later with *under*, a word the
original pattern also lacked, it produced four hits and no change: a `.rpgeo` file "sits under
its own project's `Geometry/` folder" is a PATH, an error appearing "under both fields" is
which field it routes to, and a keyboard zoom moving "the world under the still pointer" is
neither. That miss cost nothing, which is worth recording beside the one that cost a verdict —
an instrument is not judged by whether it fires wrongly but by whether its hits get read.

**Nothing checks these verdicts.** They are a reading of each pass condition, and a step whose
condition is rewritten without its verdict being re-read will carry a stale one. Treat a
verdict the way this project treats a docblock: evidence of intent, and of nothing else.

## Cases

- [[Editor Walkthrough]] — design slice 5's Definition of Done, end to end.
- [[Zone Editing Walkthrough]] — design slice 8's Definition of Done: draw, select, move,
  reshape, delete, and every undo of those, by hand.
- [[Calibrate a Plan]] — design slice 15's dialog framework and its first caller: the
  confirmation, the focus trap, `Escape`, the `inert` background, and the calibration
  itself, which slice 7 built and slice 8 shipped unreachable. Two of its steps ask what
  Obsidian's own keymap does behind a dialog and record the answer rather than assert one.
- [[Create a Project]] — design slice 16's field-error vocabulary (`routeError`,
  `<FieldError>`, `<FormBanner>`, `useFormCommit`) through its first real caller,
  `NewProjectForm`. Steps 7 and 7b are the one place a `:disabled` control's focus
  consequence is looked at rather than asserted: Chromium blurs a disabled focused element to
  `<body>`, which the dialog does not contain, so a busy write silently killed `Escape` and
  the Tab trap for its whole duration — jsdom implements no focus-loss-on-disable at all. This
  bullet was missing from this list for the whole of the case's life, found while adding
  [[Design an Asset]] below; its steps were never invisible to `grep`, only to this paragraph.
- [[Assign an Asset and Delete a Referenced Zone]] — design slice 10's end-to-end loop
  (`Zone Geometry → Area → Requirement → Cost`) and the delete-with-references decision.
  Three of its twenty steps are the only place anything can see them: a populated
  requirement row's LAYOUT (jsdom lays nothing out, and the browser harness draws this
  panel empty), the §64 decision panel over a pane that is entirely canvas, and the
  round trip through a real reload.
- [[Canvas Navigation]] — the camera gestures a user reaches for while doing something
  else: space-drag, middle-drag, shift+wheel and the two zoom-to-fit shortcuts. **NINE of its
  SEVENTEEN steps** need Obsidian, a real desktop, or settle nothing an instrument can reach:
  what Obsidian's own keymap does with the space bar and `Shift+1`, what a real desktop does
  with a middle press, a trackpad, a touch screen and a chorded mouse, and what a right-click
  produces, which the step records rather than asserts. This sentence read "four of its twelve
  steps" until the triage gave it something to be checked against — the procedure had grown to
  sixteen and the summary had not moved. The cursor keyword it used to name is `browser` now,
  not manual: a real pointer over a real element has a computed style. **2026-09-04** added a
  seventeenth, `browser`, step — hovering a selected room's vertex handle and its body for the
  Select tool's two new cursor classes — so the ratio needing a host or a desktop is unchanged
  at nine while the denominator moves.
- [[Empty States Walkthrough]] — design slice 14's two central-view empty states. Its step 4
  is the sharpest example in this suite of a claim only a vault can settle: the Plan Editor's
  empty states are OVERLAYS over a canvas that stays mounted, and the two things that
  protects are both unreachable from the suite — `create-sample-project` seeds a
  backgroundless plan with five zones, and the browser harness refuses a background outright.
  A replacement would draw an empty state where the scene belongs with every test still
  green.
- [[Notices and save state]] — design slice 13's notice queue and save-state indicator. The
  only rendered surface in this repository with NO capture to read by eye: the vendored
  `tests/harness/obsidian.css` carries no `.notice` rule at all, so neither `npm run harness`
  nor `npm run harness-shot` can draw one. Its step 3 asks the console a question
  `obsidian.d.ts` does not answer — whether `Notice.containerEl` is the per-notice element or
  the shared stack container — and the queue's slot accounting is wrong in a way that wedges
  it at three notices if the answer is the second one.
- [[Navigate into a project and back]] — design slice 21's second state for the project
  surface, and the case is about the ROUND TRIP rather than about the state: `FakeLeaf`
  records what `setViewState` was asked for and runs no view factory, so the suite can see
  that `ViewStateResult.history` was set and never that the leaf's own arrows walk it. Its
  steps 14 and 15 are the layout half, and they are the one place in this suite where a
  `browser` verdict has already been discharged by a capture before the first vault run —
  `npm run harness-shot` writes the detail state at 1280 and at a sidebar's 460 — so what a
  vault adds there is a themed palette rather than a first look.
- [[A Project Owns Its Folder]] — design slice 18's ADR-0013: a project's folder is now
  derived from where its own note sits, rather than cached from a shared plugin setting. Its
  step 7 is the property no gate here can reach at all — dragging a project's folder
  somewhere else in Obsidian's file explorer and watching writes follow it, which the fake
  vault has no file explorer to demonstrate — and step 11 is a real-vault startup-cost
  observation against a PRD budget category (§102) that names no figure to clear.
- [[Move the Library]] — design slice 19's `libraryFolder` migration, and the most
  destructive operation this plugin performs: it renames every catalogue note in the vault.
  Every collaborator it has is a real-Obsidian API a fake stands in for — `renameFile`,
  `createFolder`, `getAllFolders`, `getFiles`, `FuzzySuggestModal` — and its central
  argument, that a rename lets Obsidian rewrite the vault's own links, rests on a link graph
  no fake here models. Its step 7 is the only instrument anywhere for the picker's
  `onChooseItem`/`onClose` ordering, which `obsidian.d.ts` does not state, and its step 12
  is the first time §83's row marker is rendered through its own data path rather than by
  injecting the span.
- [[Price a shared asset for one project]] — the per-project price override, on the two
  surfaces it added: the price section on the project detail state, and the Inspector's
  three-figure block. Its layout claims are the ones worth walking, for a reason that is a fact
  about the container rather than about the design — the Inspector's block has been drawn by
  NOTHING, that container held no pinned Chromium, and the price section's own captures were
  taken with a substitute build that prints its own *approximate* caveat. So it stands where
  [[Navigate into a project and back]] does not on the same surface: its steps 15 and 16 are a
  first look rather than a confirmation. Its step 15 is the only place the three-figure worst
  case can be held at all — a hand edit to a price note publishes no change event, so no cascade
  runs and the recorded provenance stays behind the price in force — and it is `obsidian` rather
  than `browser` for the reason the `browser` paragraph above gives: the harness draws the
  Requirements panel empty, so a browser cannot reach a populated row at any width.
- [[A note that cannot be read]] — the increment where one bad note costs one note: the two
  listings skip and count, two surfaces draw the count, the reassignment picker refuses
  instead, and the diagnostics snapshot gets its first door. Every step needs a vault for
  one of three separate reasons — no gate DRAWS either strip (jsdom lays nothing out, and
  the harness holds entities rather than text, so no page it can draw has a note that
  refused), the report is a `Modal` and the vendored `obsidian.css` declares no modal chrome
  any more than it declares a `.notice`, so `styles/diagnostics.css` is read by nothing
  anywhere, and the clipboard is a real permission the suite stubs. Its step 7 is the one
  surface in the increment that deliberately REFUSES rather than counting, and step 11 is a
  recorded limitation looked at rather than described.
- [[Design an Asset]] — the asset designer's first increment: a third workspace surface
  (ADR-0015) keyed by an asset id, its own background and its own calibration (ADR-0014's
  geometry sidecar), a footprint, a clearance, an anchor, a facing and a height. Its step 8 is
  the one place a real file explorer confirms the sidecar's `.rpgeo` file actually exists
  where ADR-0014 says it does, its step 19 is the only look anyone has taken at an asset's
  calibration beside a real, open Plan to confirm it touches neither, and its step 21 is this
  suite's second PDF-rendering step and the only caller either has for
  `editor-background-pdf-test.pdf` on the asset surface — reused rather than duplicated,
  because there is no asset-specific fixture and none of this case needs one.
- [[Browse the asset library]] — the sibling of the case below, and what its own *Deliberately
  NOT checked* list defers: §3's shelves, row, mark and inspector, §6's search and keyboard, and
  §7's three widths. FIVE of its eighteen steps are written as expected FAILURES, each with the
  browser measurement that found it — a price column whose decimals do not line up under a
  comment promising they do, a geometry mark stuck in one of its five states because nothing
  passes `outline-for`, a category named two ways on two surfaces of one pane, an override chip
  breaking a project name one character per line at §7's middle rung, and a repair strip whose
  reason column is 70px ragged. A case that predicts its own failures is what stops the next run
  reporting them as discoveries.
- [[Open the Asset Library]] — Task 11's own surface: a FOURTH workspace view, its Obsidian
  lifecycle, its two in-app doors and its rebind on a settings save, scoped to what that task
  built rather than to §3's still-unbuilt shelves. Its step 6 is where a Task 11 review
  round's own judgement on the `box`/`boxes` icon pair — "no collision … worth an eye in a
  vault" — is finally looked at rather than left standing as prose in a task report nothing
  else inherits.
- [[Open a floor and select a room]] — the plan editor foundation's first increment: the read
  path and selection, with Select as the resting state, the toolbar gone, and the shell rearranged
  around one canvas instance by leaf width. FIVE of its eleven steps are tagged `obsidian` — 1, 8,
  9, 10 and 11 — and its own header tabulates the four things no gate here can settle, which is a
  different set by one: step 11 (added 2026-09-04) is the only instrument for whether Obsidian's
  keymap fires behind an open Add menu, since jsdom models no host `Scope`; step 8 for whether a
  real sidebar leaf lands in `constrained` once the tab bar, ribbon and resize handle are
  subtracted from `layoutMode.ts`'s 900/400 JUDGEMENTS; step 9 for whether Electron honours the
  `.focus()` the overlay's close path demonstrably calls, and, since the same date, whether Tab
  from the reopened overlay's last control leaves it for the canvas without trapping focus (R3);
  and step 10 for whether `focusLeaf()` visibly brings the tab forward. The unsupported-width
  notice's own horizontal-overflow question is answered at 320 px by `npm run harness-shot`'s
  `plan-editor-unsupported` measure (2026-09-04), not by any step here; what neither that capture
  nor any step here reaches is the 460 px `constrained` width, and whether a REAL Obsidian leaf
  scrolls at either width — the capture runs in a headless Chromium, not in Obsidian's own leaf
  chrome.

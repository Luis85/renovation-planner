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

Every step below carries a **`Reachable by`** verdict — a column in the eight cases whose
steps are a table, and an inline token after the step number in [[Canvas Navigation]], whose
procedure is a list. The verdict names the **cheapest instrument that could discharge that
step as written**. It is a claim about the step's own pass condition, not a report on what is
tested today.

| Verdict | What it means | Steps |
| --- | --- | --- |
| `suite` | The pass condition is DOM state, a render model, a command outcome or a vault file — expressible in the jsdom suite with no new infrastructure | 69 |
| `browser` | Needs a real engine: layout, the CSS cascade, focus BEHAVIOUR or a visible focus ring, paint, or an input grammar jsdom cannot produce. Not focus ASSIGNMENT — jsdom models `activeElement`, so "the caret lands on Start" is `suite` | 31 |
| `obsidian` | Needs Obsidian itself — its chrome, keymap, workspace, settings pane, language, `Notice`, its copy of pdf.js, or its file explorer | 47 |
| `desktop` | Needs a real desktop or real hardware beyond a headless browser: window activation, browser chrome, a physical mouse or a touch screen | 10 |
| `judgement` | Records an answer or an eye's verdict. There is no pass condition for any instrument to settle. It BEATS the other four rather than ranking among them — a step needing Obsidian AND resting on an eye is `judgement`, because naming the host would imply an automatable claim | 8 |

165 steps across nine cases. The counts are `grep`ed out of these files rather than carried
over from the notes the classification was drafted in, so a re-tagged step moves the number.

**`suite` means REACHABLE, and never "already covered".** That difference is the whole of the
follow-up work. A sample was checked against the tests rather than inferred from filenames —
the click-versus-drag epsilon, the click on a vertex handle, the close-while-a-close-is-in-flight
guard and the chorded-button grammar all have named cases in `selectTool.test.ts`,
`drawPolygonTool.test.ts` and `canvasChordedButtons.test.ts`, and the empty-state overlay's
structural half is in `emptyStateOverlay.test.ts`. The other sixty-odd were not opened one at a
time. So a `suite` verdict says the step COULD be a node test; confirming that it IS one, or
writing it, is what converts that step from something a human does into something that runs.

**One case has now had that done, and it is the template for the other eight.**
[[Zone Editing Walkthrough]] carries a *What discharges each step* section naming the test
behind each of its twenty `suite` and `browser` verdicts, read from the test BODY rather than
matched on a name. Eighteen were discharged; two were not, both on the UNDO side and neither
visible from any test name — nothing undoes a vertex edit, and nothing redoes a delete. What
the pilot actually measured is where the coverage turned out to LIVE: four of the twenty are
discharged by a case in a file no reader of that walkthrough would open, including its step 1,
whose assertion sits inside the case named for its step 6, and the both-files halves of steps 8
and 12, which are in `consistency.test.ts` two directories away. A name-matching pass would
have called step 1 a gap and taken 8 and 12 on trust. Budget the remaining eight for reading
bodies, and expect roughly one true gap in ten steps.

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
[[A Project Owns Its Folder]], hold 26 of the 47 `obsidian` steps between them, because one
surface is drawn by Obsidian's own `Notice` and the other is about where files sit. The
`browser` tier is the one this triage was made to price, and three review rounds moved it in
both directions: six of [[Canvas Navigation]]'s nine `browser` steps turned out to be `suite`,
`obsidian` or `desktop` on a closer read, and five `suite` steps then turned out to be
`browser` under the rule above. It has been 35, 27, 33, 32 and 31. Read that as the shape of the
remaining audit rather than as a settled figure — a `browser` verdict is exactly as
unconfirmed as a `suite` one, and for the same reason.

**Five `browser` steps are tagged that way for a POSITIONAL clause alone, and they are the
split candidates.** [[Create a Project]] 1, [[Empty States Walkthrough]] 1, [[Calibrate a Plan]] 2
and 7, and [[Assign an Asset and Delete a Referenced Zone]] 8 each pass on something
being *centred*, *beside* or *above* something else, while the failure each one names in its
own "It exists to catch" is presence: a view that drew nothing, a tool registered nowhere, a
calculated figure hidden behind its own override badge. The rule above still tags them
`browser`, because a panel really can render off-centre and the pass condition really does say
centred — but a reader pricing the browser tier should know that five of its steps would fall
back to `suite` the moment their positional clause became a step of its own. That is what
"split the step rather than soften the tag" means in practice, with the list to work from.
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
- [[Assign an Asset and Delete a Referenced Zone]] — design slice 10's end-to-end loop
  (`Zone Geometry → Area → Requirement → Cost`) and the delete-with-references decision.
  Three of its twenty steps are the only place anything can see them: a populated
  requirement row's LAYOUT (jsdom lays nothing out, and the browser harness draws this
  panel empty), the §64 decision panel over a pane that is entirely canvas, and the
  round trip through a real reload.
- [[Canvas Navigation]] — the camera gestures a user reaches for while doing something
  else: space-drag, middle-drag, shift+wheel and the two zoom-to-fit shortcuts. Four of its
  twelve steps are the only place anything can see them — a cursor keyword (jsdom resolves no
  styles and a headless capture hovers over nothing), what Obsidian's own keymap does with
  the space bar and `Shift+1`, and what a real desktop does with a middle press.
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
- [[A Project Owns Its Folder]] — design slice 18's ADR-0013: a project's folder is now
  derived from where its own note sits, rather than cached from a shared plugin setting. Its
  step 7 is the property no gate here can reach at all — dragging a project's folder
  somewhere else in Obsidian's file explorer and watching writes follow it, which the fake
  vault has no file explorer to demonstrate — and step 11 is a real-vault startup-cost
  observation against a PRD budget category (§102) that names no figure to clear.

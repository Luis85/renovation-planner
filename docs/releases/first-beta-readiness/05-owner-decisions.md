# Owner decisions before the first beta

Assembled 2026-09-19 from the records named at the foot of each section. **Nothing here is a
recommendation.** Each section states a situation, what a user would see, the options that have
already been costed (including the ones that were refused, with their refusals), and the cheapest
experiment that would settle it. Choosing is the release owner's.

## 1. How to use this document

Read it once and answer the questions in sections 3 to 5. Answering them:

- **does** decide whether each named behaviour is acceptable in a first beta, and unblocks the G1
  data-trust gate evaluation and five blocked test rows (section 6);
- **does not** commit anyone to a schedule, a package, or a particular implementation. Where an
  option has an implementation cost it is stated, but no option here has been taken;
- **does not** rest on anything anybody has seen in Obsidian. **Nothing on this branch has ever
  been run in an Obsidian vault.** No native, device, screen-reader or performance verification
  has been performed or is claimed anywhere in this document.

Where a question has a residual fact that only a vault run can settle, it says so in the sentence
that needs it. The word **unverified** in this document always means exactly that:
measured on a test rig, never in Obsidian.

Q2 and Q3 are already **accepted by a recorded ruling** (Q2 by R-S7-11, Q3's test-row half by
R-S8-3/R-S8-4). Those rulings are not being re-opened here; what is open is whether the accepted
residual blocks a first beta.

**Q1 below merges two tracker rows, L-06 and L-11, into one question.** They are the same question
seen from two sides — L-06 asks how a half-failed write gets recorded, L-11 asks which writes the
vault-wide pause covers, and both turn on the same missing check. The tracker's own L-11 row says
so ("Closing the category is L-06's subject"). They are presented once so an owner answers once.

## 2. Summary

| Id | The question | Needs a vault run? | What it blocks |
|---|---|---|---|
| Q1 (L-06 + L-11) | Some half-failed writes are recorded and some are silently discarded, and no check says which. Does that stand for a first beta? | No to decide. Yes to verify any fix in situ. | G1 — data trust. The tracker's G1 row names it among the owner questions, Q1 to Q3, that its evaluation waits on. |
| Q2 (L-19) | Changing a setting while a project is being created can leave that project in the old folder, invisible in the list, with the user told nothing — so they may create it twice. Does that block first beta? | **Yes** — which of two arms production takes is unverified. | G1 — data trust. Accepted by ruling R-S7-11; only the release call is open. |
| Q3 (L-21) | May a view that is still on screen write to the vault after the plugin has been unloaded? | **Yes** — whether Obsidian leaves such a view alive, and in what order, is unverified. | G1, and five of BP-03 F3's six test rows, deliberately unwritten. |
| Q4 | Q4 does not exist as a separate question: L-11 folds into Q1 for the reason in section 1. | — | — |

## 3. Q1 — the stamp category nothing checks (tracker L-06, with L-11 folded in)

### The situation

When a write to the vault half-fails — part of it landed, the undo meant to put it back also
failed — the code marks the failure with a stamp saying "this left writes behind". The stamp is
produced in exactly one function, `markUncompensated` in
`src/application/commands/DispatchOutcome.ts`. A stamp only becomes a durable, vault-wide record
if it travels back through one of **two** recorders: the wrapper every guarded command passes
through (`guardCommand`, in `src/application/errors/guardAgainstThrowing.ts`) and one hand-written
recorder in the file-rename listener (`src/plugin/evidenceRename.ts`). A stamp raised on a path
that reaches neither recorder is produced, mapped into that one editor pane's own "unsaved" flag,
and then lost — nothing pauses, nothing is written to disk, and the diagnostics report never names
it. Undo is where this lives: an undo does not dispatch a command, it writes its saved snapshot
straight back through the raw storage ports, and those ports do not pass `guardCommand`
(`src/presentation/editor/tools/with-incident-gate.ts` states that mechanism in its own docblock).

Three such sites are named in the records; a fourth of the same shape is named on no list and is
described under "what is not settled" below. **No check anywhere refuses a new one.** That is both
halves of the question: L-06 asks why a stamp goes unrecorded, L-11 asks which writes the vault-wide
pause actually covers, and the answer to both is the same missing check.

### What the user experiences

A user deletes a room, then presses Undo. The undo puts the room's note back but fails to restore
one of the requirement records it was linked to. Today: the pane that did it shows its own unsaved
indicator, and that is all. Writing is **not** paused. No warning is raised. The diagnostics report
does not mention it. If the user closes that pane, or reloads the plugin, even the indicator is
gone, and the vault is left inconsistent with nothing anywhere saying so. The same applies to
undoing a multi-element delete or a paste, and to undoing an edit in the Asset designer.

For contrast, the *covered* half behaves very differently: a half-failed write that does reach a
recorder pauses **every** write in the vault until the plugin is reloaded (decision D-06), and
names itself in the diagnostics report.

### Options

| Option | What it changes | What it costs | What it costs if this is the wrong choice |
|---|---|---|---|
| **Leave it** (today) | Nothing. The named sites stay live and stay silent. | Nothing to build. The existing pin (below) stops the hole getting wider on the two of four pane bundles it walks — not on `assetDesignerDeps`, which is the one handing out the fourth site's ports. | A user's vault is left half-written after an undo, with no pause, no notice and nothing in the diagnostics report — and the plugin keeps writing over it. Nobody can tell from the product that it happened. |
| **Record inside `markUncompensated` itself** | Closes the category by construction: every stamp becomes a durable incident wherever it is raised, because that function is the only place the stamp is made. | Makes a pure stamping function write to module-level state — it is currently a copy-and-return with no side effect. And it necessarily turns stamps that today reach no recorder into vault-wide write blocks, which is the point of the option and also its risk. | Every newly-recorded stamp pauses **all** writing in the vault, and under decision D-06 the only way a user clears that is reloading the plugin. If any site turns out to raise a stamp routinely on a vault that is in fact fine, the plugin becomes unusable until reload — on a branch nothing has ever run in a vault. |
| **A static check that a stamp can reach a recorder** | Would refuse a raise site whose dispatch cannot reach `guardCommand`. | **Refused by measurement, not by argument** — recorded in ADR-0034. The guarded relation is made by wrapping an object at runtime and consumed by calling a port method; neither is an import edge. A walk from `guardedServices.ts` reaches 1 of the 17 stamping modules; one from `composition-root.ts` reaches 929 files including all of presentation. | Nothing — it was attempted and does not work. It is listed so it is not re-proposed. |
| **List the covered paths in prose and keep them current** | Nothing in the code. | This is what the ADR did, and it contradicted itself: a site sat on the COVERED list while being uncovered (`undoDeleteResolution.rollBack`), found only when someone measured. | A list that reads as authoritative and is wrong is worse than no list, because the next reader stops measuring. |

**One recorded cost in that table's second row does not survive checking, and it is stated here
rather than repeated.** ADR-0034 gives as its example of the risk that
`ConstructionMaterialCommand` "swallows" a stamp, so recording at stamp time would create a
vault-wide block that does not happen today. Re-read against the code, that command re-raises the
stamped error on every arm (`putBack` returns `err(error)` with the stamp intact), and its
composition wraps both its doors in `guardCommand` (`src/plugin/guardedRenovation.ts`, wired at
`src/plugin/planningEditorServices.ts`), so that stamp **already** becomes a durable incident
today. The direction of the risk is unchanged — recording at stamp time would newly block the
vault for the sites that genuinely reach no recorder, which is what the option is for — but the
named example does not demonstrate it, and no other example has been costed.

**Two further options are absent from that table because nobody has costed them, and that is said
here rather than left silent:** guarding the raw ports handed to a pane, and routing undo through a
recorder of its own. No cost, blast radius or wrong-choice cost is recorded for either anywhere, and
none is invented here — taking either means costing it first. That is the same position as Q3's
fourth option, which is in its table labelled **not costed anywhere**; the difference is that
session 8 named that one explicitly as the scope question its row is about, and no session has
costed these two.

### The deciding experiment

**No vault is needed to decide this one.** What would settle the risk in the second option is
cheap and has not been done: take the raise sites that reach no recorder, and for each one
establish whether it fires only on a genuinely half-written vault or can fire on a healthy one. The
sites are reachable from the suite. That is an afternoon of measurement against a category nobody
has enumerated, and its own result would be a count that is not a census (see below).

A vault run is needed only to verify a chosen fix in situ, never to choose.

### What is already fixed, and not in question

- **The hole cannot get wider on the bundles one pin walks — which is two of the four.**
  `tests/plugin/guardCategory.test.ts` pins, by exact value, the raw class instances it reaches from
  the shared persistence bundle and from two of the four bundles the composition root builds a pane
  from: `planEditorDeps` and `assetLibraryDeps`. A **new** raw port handed out *there* turns that
  test red and its author has to justify it in the same edit. What that check sees is class
  instances handed out by a zero-argument factory or as a field of a bundle. What it cannot see:
  - a raw port handed out by **`assetDesignerDeps` or `renovationProjectDeps`**, which the pin does
    not walk at all. The test's own comment states why it has missed nothing yet and refuses to
    call that a guarantee — those two *"hand out only members `persistence` already carries, which
    is why nothing here has missed a raw door yet, **and is a reason rather than a guarantee**"*.
    So a raw port handed out by `assetDesignerDeps` that `persistence` does not already carry is
    reached by no walk and the pin stays green. **`assetDesignerDeps` is the bundle that hands the
    Asset designer the raw ports behind the fourth site named below**, so this blind spot is the one
    containing this document's own new finding;
  - a port handed to a pane by a factory that takes arguments (recorded in the file as a
    `function-with-arguments` skip);
  - anything past depth 8;
  - a command hidden as a field inside another class instance.

  It does **not** see a stamp at all either: adding a second `markUncompensated` behind one of the
  live sites turns nothing red.
- **The vault-wide pause itself works**, on the paths it covers, and covers both the forward door
  and Undo — tracker row **L-05** (two Plan editor commands brought inside the gate, both of their
  doors) and tracker row **L-16** (undo and redo refused on both editor surfaces) are closed. **Two
  neighbouring rows are easy to read as closed with them and are not**, and the tracker says so in
  its own words: **L-01** is *"Closed for the Plan Editor only"* — a second Plan Editor pane on one
  plan is gated, and that row itself records that this **does not on its own unblock G1** — and
  **L-13** is *"RECLASSIFIED … not closed"*: the Asset Designer's forward writes ARE refused while
  an incident is open, and what is left there is a feedback gap, an enabled control that refuses on
  use, carried as L-14.
- **"Three live sites" is a count of what has been NAMED, not a census, and it is at least four.**
  The three named are `undoDeleteResolution.rollBack`
  (`src/application/reference/undoDeleteResolution.ts`), `restoreSteps`
  (`src/application/commands/spatial/composedSteps.ts`, reached from `DeleteSelectionCommand` and
  `PasteCommand`) and the stamp inside `ReversibleDeleteZoneCommand.undo()`'s `restoreEntity`
  callback (`src/application/commands/zone/reversible-delete-zone-command.ts`). A fourth of
  identical shape — the undo door of `ReversibleAssetDesignCommands`
  (`src/application/editor/asset/ReversibleAssetDesignCommands.ts`) — is named on no list, and the
  mechanism that puts it there is stated in `with-incident-gate.ts`'s own docblock. **The true size
  of the set is unmeasured**, which is the whole of what this question is about.

### Where the evidence lives

- `docs/development/adrs/0034-a-write-incident-is-durable-and-vault-scoped.md` — the decision and
  its three self-corrections
- `src/application/commands/DispatchOutcome.ts` — `markUncompensated`
- `src/application/errors/guardAgainstThrowing.ts` — `guardCommand`, the first recorder and the gate
- `src/plugin/evidenceRename.ts` — the second recorder
- `src/presentation/editor/tools/with-incident-gate.ts` — why an undo reaches neither
- `tests/plugin/guardCategory.test.ts` — the pin, at `e7c24d91b..9d08aeed4`
- Tracker rows L-06 and L-11 in `03-execution-tracker.md`

## 4. Q2 — a settings change landing inside a live project create (tracker L-19)

### The situation

A user starts creating a project and, while that create is still running, saves a change in the
plugin's settings — for instance the default folder new projects go into. Saving settings rebuilds
the plugin's internals and rebinds every open pane. The project that was already in flight is
written by the **old** internals, so it lands in the **previous** folder. That much is confirmed by
measurement on a real rig.

What happens next splits on a timing question nobody has answered in Obsidian: whether Obsidian's
own note cache has finished parsing the new note at the moment the plugin's change pipeline sees
it. In the **warm** arm it has, the project is picked up, the row appears in the list unprompted,
and nothing is wrong. In the **cold** arm it has not, and the project is indexed nowhere — the list
resolves through the index, so the row never appears, and **closing and reopening the pane does not
help**; in practice it clears only when the plugin is reloaded. **Which arm production takes is
unverified and needs one vault run.**

### What the user experiences

In the cold arm: the user creates "Kitchen", changes a setting, and Kitchen never appears in their
project list. Nothing tells them anything went wrong. The note exists, in the folder that was the
default a moment ago. The obvious thing to do is create it again — and now there are two Kitchen
projects in two folders, one of which is invisible until the plugin restarts.

In the warm arm the user sees nothing wrong at all, except that the project is filed under the old
folder.

### Options

| Option | What it changes | What it costs | What it costs if this is the wrong choice |
|---|---|---|---|
| **D — accept, correct the documents** (taken, ruling R-S7-11) | Nothing in behaviour. Three documents that stated something measurement refuted are corrected. | Already done. | The cold arm ships: silence, an invisible project, and a duplicate the user creates themselves. |
| **A — defer the rebind until the create finishes** | The in-flight create would finish against the internals it started with. | **Refused, and the refusal was re-confirmed by the measurement.** There is no seam to defer at, and deferring only lengthens the window in which the retired internals — the ones writing to the wrong folder — are still live. | Nothing; it does not close the case it was proposed for. |
| **B — give the dialog a distinct result for this case** | The form could tell the user what happened. | **Refuted as unsafe.** The controller's premise was that the result type is compiler-enforced. It is not: there is no exhaustive `switch` over a dialog result anywhere in `src/presentation/` — every call site that reads a dialog result narrows by equality, so a new value compiles clean and falls through to **SUCCESS**. A user-facing message variant is separately blocked by L-15. | Its failure mode is silent success at every place a dialog result is read, with nothing at the compiler to catch it. |
| **C — close the cold arm in the index pipeline** | The note would be indexed even when the cache is cold. | Free in the warm arm (nothing to do). In the cold arm it means changing the index pipeline, which is the widest blast radius in this area — for a path nobody has shown production takes. | If production is in fact always warm, this is a large change to the riskiest component for no user-visible gain. If production is cold and this is skipped, the duplicate-project outcome above is what ships. |

**On the size of that last one, and why no number is given for it.** The tracker's L-19 row states
"46 call sites across 34 files", and **no instrument for that figure is recorded anywhere** — its
provenance is a working note that is not tracked in git. Re-derived here with the obvious
instrument, `grep -rnE "openDialog[<(]" src/` prints **52 lines in 35 files** today, which counts
the declaration and docblock prose as well as call sites, so it neither reproduces nor refutes 46.
The number is therefore not carried here. What the option turns on is not the magnitude but the
shape, and the shape was re-checked directly: every site narrows a dialog result by equality and no
exhaustive `switch` over one exists in `src/presentation/`, so the count only sizes a risk that is
already established.

**The owner's question is not which option.** Option D is taken. The question is: **does the cold
arm's outcome — told nothing, project invisible, reopening does not help, duplicate likely — block
a first beta?**

### The deciding experiment

**One vault run**, and it is already on the native-verification list: in a real Obsidian vault,
start a project create, save a settings change before it completes, and observe whether the new
project's row appears in the list without a plugin reload. Warm arm and cold arm are
distinguishable by that one observation. A rig cannot answer it, because the thing being raced is
Obsidian's own note parser.

### What is already fixed, and not in question

- The behaviour itself is **accepted by ruling R-S7-11** and is not being re-litigated.
- The documented account of it was wrong in both directions and has been corrected in four
  documents; a fifth, a dated historical record, carries a pointer to the refutation rather than a
  rewrite.
- The claim that the dialog-result option is compiler-safe is **refuted** and must not be revived
  without the exhaustive-handling mechanism that does not exist.

### Where the evidence lives

- Tracker row L-19 in `03-execution-tracker.md`, and the session 7 log in the same file
- Ruling R-S7-11
- The measurement rig and its four numbered claims are recorded in the session 7 F1 discovery
  report (in the working notes, not tracked in git)
- Fix commits for F1's documentation half: `c5b2817e2`, `1979aa7f6`

## 5. Q3 — may a still-mounted view write to the vault after `onunload`? (tracker L-21)

### The situation

When Obsidian disables or reloads the plugin, it calls `onunload`. This plugin's `onunload` sets an
"unloaded" flag and runs five cleanup steps, and does nothing else — it **closes no view and takes
no pane off the screen**. So when `onunload` returns, every open editor pane is still on screen,
still wired up, and still able to write to the vault.

Session 8 found and fixed the sharp end of that: one of the cleanup steps used to switch off the
plugin's record of half-written writes, which simultaneously disarmed all three things that read it
— the refusal on a forward write, the refusal on Undo, and the recording of a new half-write. A
pane that was correctly refusing writes over a half-written vault started accepting them the moment
the plugin unloaded. That is fixed at `f5a7f219e`: an **open** record is no longer released, a clean
one still is.

What the fix deliberately does **not** settle is the general case. With nothing half-written, a
guarded write dispatched after `onunload` still runs, and if it half-fails it is recorded nowhere.
Reaching that window does not need a user: a queued or debounced write already in flight — a text
field committing after a pause, a queued sequence of writes — lands there with no gesture at all.

**Unverified:** whether Obsidian leaves a still-usable pane alive after `onunload`, and in what
order it tears things down relative to the cleanup steps. The test fakes here record requests
rather than behaving, so they cannot answer it.

### What the user experiences

A user edits a room dimension and, within the same second, disables the plugin or triggers a
reload (an update installs, or they toggle it off). The field's delayed save fires after the plugin
has unloaded. Today that write goes to the vault. If it half-lands, nothing records it: there is no
plugin left to warn, the diagnostics report will not name it on the next load, and the pane that
did it is about to disappear. The user has no way to know.

Whether that window is a fraction of a second or long enough for a click is exactly the unverified
part.

### Options

| Option | What it changes | What it costs | What it costs if this is the wrong choice |
|---|---|---|---|
| **Leave it** (today) | Nothing. Open records survive unload; clean sessions release, and a post-unload write with nothing open still lands. | Nothing to build. | A half-failed write in the unload window is unrecorded and unrecoverable, and the user is not told. Blast radius is unknown because the window's width in Obsidian is unverified. |
| **Never release the record at all** (drop the `anyOpen()` guard in `SessionStores.dispose()`) | Every post-unload write stays gated and recordable. | Named as the remedy in `src/plugin/sessionStores.ts`'s own docblock. The price stated there: a disposed session's record answers for the vault from module scope until the next load constructs a new one — the window is exactly "after unload, before the next load". Existing cases asserting that a clean dispose releases would need re-aiming. | The plugin's own rule that a global it installs is a global it removes is given up for one case; a stale record could answer for a vault the next load has not looked at yet. |
| **A permanently-refusing sentinel after unload** | Every post-unload write refused outright. | **Refuted by measurement in session 8.** It would refuse a write in a never-half-written vault using the only refusal message that exists, which says an earlier write left the vault half-written. Minting a message variant is blocked by limitation L-15 (no agent-minted copy in the second language). | A user in a perfectly healthy vault is told their vault is half-written. |
| **Make `onunload` own view teardown** — unmount the Vue apps, detach the leaves, or order the cleanup steps against view teardown | The premise of the whole question disappears: no pane is alive to write. | **Not costed anywhere.** Session 8 named it as a scope decision and stopped at its stop rather than build it. The plugin's own `onunload` docblock records a deliberate policy of not repeating teardown Obsidian's base class already does, which this would sit against. | Unknown, because it is uncosted. Taking it means costing it first. |

### The deciding experiment

**One vault run**, and it is the same session as Q2's: in a real vault, with an editor pane open
and a field edit pending, disable the plugin and observe whether the pane is still on screen and
whether the pending write reaches the note. That answers both halves — whether the window exists in
Obsidian at all, and roughly how wide it is. Nothing in this repository can answer it: the fakes
record requests rather than behaving, and the mock plugin base unregisters nothing.

### What is already fixed, and not in question

- **The sharp end is fixed** at `f5a7f219e` and locked by `tests/plugin/unloadWithViewOpen.test.ts`,
  which drives the plugin's own registered view factory over a real repository stack and covers
  both the forward-write arm and the Undo arm. It was watched failing against the old code as
  assertion failures, not timeouts.
- **Five of BP-03 F3's six test rows are deliberately unwritten, and this is the part an owner will
  most want to re-open, so it is stated plainly.** The six rows are the six states a pane can be in
  at unload; one — an unresolved half-write — is now covered. For three of the other five
  (idle, an unsaved form, a part-drawn shape) the lifecycle rules measure as **not violated** at
  this boundary, so a test asserting the current behaviour would assert that nothing happens —
  and what actually happens at this boundary is that a still-mounted pane **can** write after
  unload. Such a test would therefore certify that write as correct, and it would stay green on
  exactly the day somebody changes it by accident. A fourth (a write already dispatched) is
  satisfied by the **absence** of cancellation code, so there is no mechanism to break and no
  failing state to watch. **The fifth is named here rather than left to be counted: a stale
  read-back** — a pane that is refusing writes because its own last read of the project failed. It
  carries the blanket reason and nothing more specific: `04-lifecycle-contract.md`'s F3 row gives
  one reason for all five rows at once, and the one measured bad property recorded against a stale
  read-back — F2, where a remount clears the refusal and the fresh hydrate cannot re-derive it, rule
  3 declined by design — is recorded against a **settings rebind**, not against unload. **Whether
  that row also has a reason of its own that nobody wrote down is recorded nowhere**, and this
  document cannot settle it. That is rulings **R-S8-3 and R-S8-4** and it is **not open for
  revisiting**: what unblocks those rows is this question being answered, not a decision to write
  them anyway.

### Where the evidence lives

- `src/plugin/RenovationPlannerPlugin.ts` — `onunload`
- `src/plugin/sessionStores.ts` — `dispose()`, and the docblock stating the residual and the remedy
- `tests/plugin/unloadWithViewOpen.test.ts` — the lock
- `docs/releases/first-beta-readiness/04-lifecycle-contract.md` — the six rules and the state table
- Fix commit `f5a7f219e`; helper promotion `45c88a73e`
- Tracker row L-21 and the session 8 log in `03-execution-tracker.md`

## 6. What answering Q1 to Q3 unblocks

- **The G1 data-trust gate evaluation.** The tracker's gate table records G1 as "not evaluated",
  with two owner calls standing between it and an evaluation — L-19's duplicate-project risk and
  L-21's post-unload write — and the L-06 category still open beside them. G1 is the gate the rest
  of the beta sequence hangs off; G2 to G5 are all unevaluated behind it.
- **Five of BP-03 F3's six test rows.** The package's test column is locked at 1 of 6 for the
  reason in section 5. Answering Q3 says what the other five should assert; until then writing them
  would certify a behaviour nobody has decided is correct.
- **BP-02's remaining work.** The register's BP-02 row records no further action in that package
  until Q1 is answered.
- **The production candidate, indirectly.** The register's BP-12 row says the candidate depends on
  the selected production changes, several of which wait on owner questions in this document.

## 7. What this document does not cover

- **It decides nothing**, by design. Where a course of action is described it is described with
  what it costs and what it costs if it is wrong, never as a recommendation.
- **It is not a fresh investigation.** Every question here was measured and argued in an earlier
  session; this distils those records and re-drives the load-bearing claims. Three claims were
  re-driven for Q1 and one of them did not hold — it is flagged in section 3 where it sits.
- **It does not size the Q1 category.** How many raise sites reach no recorder is unmeasured, and
  every count in section 3 is a count of what has been *named*.
- **It covers no other open limitation beyond section 8's pointers.** The tracker's "Decisions and
  explicit limitations" table is the list of what is open or partly open. This section keeps no
  list of its own, because the one it kept went stale: it named L-04, which is REFUTED, and none
  of the owner questions in section 8.
- **It claims no verification in Obsidian, on any device, with any screen reader, or of any
  performance property.** None has been performed on this branch, ever. Q2 and Q3 each need one
  vault run before their answer can be acted on with confidence, and Q1 needs one before any fix to
  it can be trusted in situ.
- **It adds no user-facing copy.** Any option here that would need a new user-visible message is
  blocked behind limitation L-15 until a human writes the second language, and the option's row
  says so.

## 8. Other owner questions recorded in the tracker, open and decided since

Added 2026-09-23 (session 17). These are owner questions the tracker records outside Q1 to Q3.
This is a reading of the tracker on that date, not a census, and nothing here decides any of them.
Each names the tracker row that carries its evidence.

- **L-23: a vertex drag can write a zero-area straight Zone to the vault**, which BP-04's typed
  dialog then refuses to save. The recorded remedy (`enclosesArea` in `Zone.withGeometry`) changes
  behaviour at a trust boundary: a vault already holding such a Zone keeps loading but refuses
  further edits. It waits on a recorded trade (R-S12-7). Tracker row L-23.
- **L-33's residue: whether to mint a sentence naming the cause of a whole-outline refusal.** The
  outline dialog now shows the fallback-tier `error.category.geometry` sentence, which the locale
  file's own convention treats as a defect worth a key to avoid. Minting one needs German, which
  L-15 keeps out of an agent's hands. Tracker row L-33.
- **L-36: one form's two axis labels are written in two English registers**
  (`Starting horizontal coordinate (m)` beside `Start Y (m)`). Both remedies are copy judgements,
  and the symmetric one needs German that L-15 blocks. Tracker row L-36, to be revisited with
  L-33's residue.
- **L-37: two strings that tell the user to open the diagnostics report arrive as toasts, which
  cannot carry an action.** The question is whether a notice in this plugin should be able to
  carry an action at all. The row records it as not blocking a first beta. Tracker row L-37.
- **BP-05: the plan's clause "rejected/no-op operations do not add history".** Its no-op half
  contradicts `CommandHistory.runNow`, which puts a no-write gesture on the undo stack by design,
  and the Done PBI `docs/requirements/Undo and redo.md` records that half as NARROWED at its
  criterion 6. Narrow the clause, or change the code. Tracker row BP-05.
- **BP-08: which performance targets a run is judged against.** The plan's targets and the PBI
  `docs/requirements/Meet editor performance and cleanup budgets.md` disagree, and the plan requires
  a recorded decision for a changed target. Tracker row BP-08.
- **BP-10: copy for a help entry and for a fictional sample label.** A help entry needs a new
  command name and new copy, and labelling the sample fictional changes `sample.project.name` in
  both locales. Tracker row BP-10.

**Decided since, and no longer open:**

- **L-43, decided by the release owner on 2026-09-23: "guard the asset library on mobile."** The
  question was whether the Asset Library, which could create, edit and delete assets on mobile,
  should be guarded there or the beta's "mobile read-only" claim narrowed. The claim stands.
  `20ff37f29` refuses the library's writes on mobile with the `view.mobile.read-only` sentence,
  tested in jsdom. Nothing has been run on a device, so a published mobile claim still waits on
  BP-09's device run. Tracker row L-43 and package BP-09.

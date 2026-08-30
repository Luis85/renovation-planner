---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 70
sources:
  - PRD §44
  - PRD §67
  - SDD §60
  - SDD §66
  - SDD §84
  - SDD §85
status: Ready
---
# Notices and save state

Design slice 13 in a real vault: the notice queue drawn inside Obsidian's own `Notice`, and
the save-state indicator in the third region of SDD §60's status bar. This file is the
**canonical procedure**; `docs/tasks/13-notifications-and-save-state-surfaces.md` records
what the runs found and points here.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled. Steps 2
and 3 need a vault with **no** PNG, JPEG or PDF anywhere in it, so run them before copying
anything out of [`docs/tests/fixtures/`](../fixtures/), or move that folder aside first.
Steps 13 onward need a plan with zones, which `Create sample renovation project` seeds.

## Why this case is manual, specifically

Not "because appearance matters" — because of four named gaps, each one a measurement
nothing in `npm run check` performs.

- **The browser harness cannot draw a notice at all.** `tests/harness/obsidian.css` carries
  no `.notice` and no `.notice-container` rule — its reduction came from another plugin's
  driven states and that plugin never raised one. So `npm run harness` and
  `npm run harness-shot` are both blind here, which makes this the first rendered surface in
  this repository with no capture to read by eye. A vault is the only instrument.
- **jsdom paints nothing and lays nothing out.** A focus ring drawn from `var(--text-accent)`
  against a theme that redefines it, and three inline children separated only by a flex
  `gap`, are invisible to every assertion the suite can make. `styles/notices.css` says so
  where the code is.
- **Obsidian's `Notice` is undocumented at one point this host used to rest on.**
  `obsidian.d.ts` declares `containerEl` and `messageEl` and says what neither one IS. Every
  per-notice concern is keyed on `messageEl` now, which is per-notice under both readings, so
  the answer costs a hover target rather than a working queue. Step 3 is still that question.
- **No axe scan reaches a notice.** `tests/harness/accessibility.test.ts` scans `contentEl` —
  the plugin's own subtree — and a `Notice` renders on `document.body` under
  `.notice-container`, outside every view. So **the surface carrying the most new ARIA in this
  slice is the one surface no accessibility instrument grades**: the two live regions (which
  `activateNotices` appends to `document.body` directly, so they are outside a view twice over),
  and the dismiss control's accessible name, are asserted one attribute at a time by jsdom tests
  and by nothing that reasons about them together. `docs/components/Toast.md`
  predicted this consequence in its own Open question 1 before the decision was taken, and it
  is recorded there as the settled price of using `Notice`. Widening the scan is not a fix that
  belongs to this slice: scanning the whole document would pull in the landmark rules that
  file's header records as out of reach.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could
discharge it as written. [[Smoke Test the Editor]]'s *The triage column* section defines
the five values and what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | Run `Open plan editor` in a vault with no plan notes | A notice reading "This vault has no renovation plans yet." appears, prefixed by the word "Information", and disappears on its own after about six seconds | The `info` tier end to end. `AUTO_DISMISS_MS.info` is 6000 and this plugin owns that timer rather than Obsidian, which is what `duration: 0` buys. This is the ONLY auto-dismissing notice a user can raise — `notifySuccess` has no production caller, and its own header says why |
| 2 | `obsidian` | Run `Set plan background` in a vault with no PNG, JPEG or PDF | A notice reading "Only PNG, JPEG and PDF files can be a plan background." appears, prefixed by "Warning", and is still there a minute later | `AUTO_DISMISS_MS.warning` is `null`. A warning about something the user asked for that did not happen, whose remedy is outside the plugin, must not expire while they work out what to do |
| 3 | `obsidian` | **With that warning showing, open the developer console (`Ctrl+Shift+I`) and inspect it.** Find the element carrying the class `rp-notice`, then look at its PARENT — the element Obsidian's `Notice.containerEl` points at. Raise three notices at once (step 8) and look again | There is one `rp-notice` per notice either way; this step asks whether its PARENT is also one per notice, or a single shared stack container | **The one Obsidian claim left in this host, and `obsidian.d.ts` documents it neither way.** Nothing FAILS on the unfavourable answer any more: every per-notice concern — the severity class, the four hover listeners and the `isConnected` read behind `handle.live` — is keyed on `messageEl`, which is per-notice under both readings, and the `role`/`aria-live` pair left the notice entirely for the two live regions of step 3a. What the answer decides is a COST: the hover target is the message box rather than the whole notice, so a pointer resting on Obsidian's own padding does not pause the timer, and a click landing there dismisses natively without prompting a sweep. If `containerEl` turns out to be per-notice, that padding can be won back by moving the listeners onto it. If it is the shared container, this host is already correct and there is nothing to do. An earlier version of this step was the file's most important, because an unfavourable answer wedged the queue permanently at three notices |
| 3a | `obsidian` | **In that same inspector, search the document for `rp-notice-live-region`.** Raise a warning and watch the two elements | There are exactly TWO, both direct children of `<body>`, one `role="status" aria-live="polite"` and one `role="alert" aria-live="assertive"`. They are present with the plugin loaded and NO notice on screen, both empty. Raising the warning writes `Warning <the sentence>` into the alert one and leaves the other empty. Disabling the plugin removes both | `Toast.md`'s live-region rule, which is the one mechanism detail it says "decides whether this component works at all for the users it exists for". A region inserted together with its content often does not announce, so these two are created empty by `activateNotices` and a notice writes INTO one rather than becoming one. The empty-at-rest half is the whole point: if they only appear alongside a notice, this is the refused shape again under a new name. `disposeNotices` removing them is the other half — two elements left on `document.body` by an unloaded plugin |
| 4 | `obsidian` | Read the warning from step 2 as text | It reads `Warning`, then a clear gap, then the sentence — never `WarningOnly PNG, JPEG and PDF…` run together — and the `×` sits clear of the sentence's last word | The flex `gap` on `.rp-notice-body`. The three children are adjacent inline elements with no whitespace between them, so the separator is CSS and nothing else. jsdom's `textContent` reads the concatenation happily and `toContain('Warning')` passes against it. This repository has already shipped this exact defect once — the harness index's rows read `ZonePanelprototype` — and it took a PNG read by eye to find |
| 5 | `obsidian` | Raise the `info` notice from step 1, hover it and hold the pointer there for ten seconds, then move away | It stays while hovered, and goes about six seconds after the pointer leaves — not immediately, and not one second later | Hover-pause, and that `resume` restarts a FULL duration rather than a remainder. Obsidian's own timer is internal and cannot be paused, which is the whole reason this plugin owns it |
| 6 | `obsidian` | Raise it again and press `Tab` until the `×` inside it is focused | Focus reaches it, the ring is clearly visible, the notice does NOT disappear while it is focused, and `Enter` dismisses it | Two things at once. The ring is `outline: 2px solid var(--text-accent)` under a reset that removes both of Obsidian's own focus channels — WCAG 2.2 2.4.7 at AA, which `PRODUCT.md` binds by name. And `focused` is a hold condition beside `hovered`, so a timed notice cannot vanish out from under a keyboard user reaching for its dismiss |
| 7 | `judgement` | Repeat step 6 in a light theme, a dark theme, and one third-party theme | The ring is visible against the notice's own background in all three | A theme may set `--text-accent` to something with no contrast against the notice's background. Nothing in this repository resolves a `var()` to a colour |
| 8 | `obsidian` | Raise four notices in quick succession — run `Set plan background` in a background-less vault four times, changing nothing between | Exactly THREE are on screen. Dismiss one with its `×`: the fourth appears | `MAX_VISIBLE_NOTICES` and promotion. A notice past the cap is held, not dropped. **And HIDE TIMING, which is a vault-only measurement.** The fake's `hide()` detaches synchronously; Obsidian's `Notice` is animated and may detach after a transition, in which case the notice's element is still connected when the sweep that follows this click runs. Neither dismissal gesture depends on the answer any more — `notify.ts` latches `handle.live` to false on our `×` AND on a click anywhere on the notice — so this step passing says the latch works, not that hide is synchronous. What still rests on connectedness is a dismissal neither listener sees, and a vault is the only instrument that can confirm hide timing either way |
| 9 | `obsidian` | Raise the same notice twice — run `Set plan background` twice | ONE notice, reading `… (×2)` | Dedup on the `(severity, message)` pair. Watch that the count updates in place rather than a second notice appearing beside it |
| 10 | `obsidian` | Hover a repeated notice and raise it again while hovering | The count goes up and no countdown starts underneath the pointer | `arm` withholds a timer from a PAUSED entry. Three separate review findings in this slice were all "this call site should not have armed a timer", which is why the rule lives in one function and every caller calls it unconditionally |
| 11 | `obsidian` | Set up step 8 again, then dismiss one notice by clicking its **body** — Obsidian's own gesture — rather than the `×`. Then immediately re-raise that SAME message | It goes, the fourth held notice appears in its place, and the re-raised message opens a FRESH notice rather than being swallowed | **Both halves of a dismissal this host can see.** Obsidian dismisses a clicked notice without telling us and exposes no callback, so the click listener latches `handle.live` to false rather than waiting for `isConnected` — which, on an animated `Notice`, is still true while it fades. Without the latch the first half degrades to "the slot frees on the next push", which the sweep survives; the second half does not, because `push` sweeps and then DEDUPS, so the repeat found the dying entry, bumped a count nobody would see and opened nothing. `isConnected` remains the authority for a dismissal neither listener sees — a future Obsidian gesture, a notice the host clears — and that residue is still hide-timing-bound |
| 12 | `judgement` | Look at the four severity labels in a light theme, a dark theme and one third-party theme. `success` cannot be raised by hand — see "Deliberately NOT checked" — so this is three of the four | Each label is legible and the severities are distinguishable from one another | SDD §84: every colour here is an Obsidian variable, so the build refuses a literal one — but only a themed vault says whether the variables chosen were the right ones |
| 13 | `suite` | Open a plan and look at the status bar's third region | It reads **Saved** | `SaveStateIndicator` mounted inside `StatusBar`'s one `role="status"` region, at its initial value. §60's third region held nothing from slice 5 until now |
| 13a | `suite` | With a plan open, assign an asset to a zone, then assign **the same asset to the same zone again**. Watch the save-state region through both | The first shows *Saving* then *Saved*. The second returns to *Saved* too — but if a **Save error** was standing before you started, the second assignment must LEAVE it standing | **A success that wrote nothing must not clear a save error**, which is the rule `SaveStateStore`'s header states and which this slice shipped broken. `AssignAssetCommand` answers `ok` from a READ when the link already exists, having saved nothing, and the tracker read that as a successful write. The command reports a `DispatchOutcome` now. Reproducing the standing error needs step 16's failure injection first, which is why this step is written as a conditional rather than a sequence — the node tests prove the settlement, and what a vault adds is that the second assignment really does take the idempotent path |
| 14 | `suite` | Draw a zone and watch that region | It shows **Saving**, then settles on **Saved** | The tracked dispatcher. `withSaveStateTracking` sits inside `wrapDispatcher` and outside the refresh decorator, so **Saved** never appears while the canvas still shows the pre-command state. A fast write may make **Saving** hard to catch; the contract's own Open question 2 asks whether that state should be shown at all |
| 15 | `suite` | Press Undo, then Redo | The region passes through **Saving** each way | An undo is a write like any other — slice 8's reversible delete writes a snapshot back through the repository. A decorator over `run` alone would leave the indicator reading **Saved** through an in-flight undo |
| 16 | `desktop` | Make a write fail: with the plan open, make the plugin's `Geometry/` folder unwritable from outside Obsidian, then move a zone | The region reads **Save error**, in the error colour, and stays there | Two things. `affectsSaveState` answering true for a `PersistenceError` — and the colour applying at all, which it did not: the selector shipped one word short (`rp-save-state-error` against the emitted `rp-save-state-save-error`) and no gate here could see it, because jsdom resolves no CSS |
| 17 | `desktop` | Make the folder writable again and move a zone | The region returns to **Saved** | The error clearing on the one thing entitled to clear it |
| 18 | `obsidian` | Open two plans in two leaves (split the workspace), then draw a zone in one | Only that leaf's indicator moves; the other stays **Saved** | One `SaveStateStore` per view's own Pinia instance, which follows from `CommandHistory` being per-Plan. A plugin-global store would report one plan's write on both |
| 19 | `obsidian` | Set Obsidian's language to German and repeat steps 1, 2 and 13 | The severity words, the dismiss control's accessible name and all four save states read in German | `de.ts` answers all nine keys this slice added. `tests/presentation/i18n/strings.test.ts` checks that every `en.ts` key HAS a German value and pins two terms; the words themselves are read here |
| 20 | `obsidian` | Toggle the plugin off with a notice showing, then on again and raise another | The showing notice goes with the unload, and a notice raised after re-enabling appears normally | Disposal is TERMINAL, and `activateNotices()` is what brings the queue back. A `disposeNotices` that recreated the queue would let a fire-and-forget promise — the cascade and the recovery pass both run that way — attach a notice to a vault with no plugin left to remove it |

## Deliberately NOT checked

- **A `success` notice, its four-second timeout and its colour.** `notifySuccess` has no
  production caller in this slice, on the precedent slice 15 set with
  `DeleteReferenceDialog`: the routing that decides which operations announce a success is
  slice 17's, and inventing a call site would mean inventing copy for an operation nobody
  asked to have announced. There is no way to raise one by hand and that is not a defect.
  The 4000 ms policy is covered by node tests in TWO files rather than one —
  `grep -n 4000 tests/presentation/notices/*.test.ts` prints four lines in `queue.test.ts` and
  two in `notify.test.ts`, the latter pushing through the real door — and step 1 covers the
  auto-dismiss MECHANISM through the reachable `info` tier.
- **The store's third settlement outcome, `resolveNeutral`, and this is a step that USED to be
  here.** It read "with **Save error** showing, clear a Requirement's override field to a value
  the domain rejects — the region does NOT return to **Saved**", and it could not prove what it
  claimed: a domain refusal settles the indicator at `save-error` under BOTH `resolveErr` and
  `resolveNeutral`, so the pass condition cannot tell the two apart. Distinguishing them needs
  the same refusal from a resting **Saved** state, where `resolveNeutral` leaves **Saved** and
  `resolveErr` would show **Save error**. **No hand-reachable trigger for that is known in a
  vault this build can produce**, measured rather than assumed: every pre-write refusal the
  editor's dispatcher can raise sits behind a Requirement — the two override commands and the
  assign adapter — and nothing in this build creates an Asset or a Requirement.
  `create-sample-project` seeds a project, a plan and five zones and no more; the creation
  forms are slice 16's. A refused polygon never reaches the dispatcher at all (`createPolygon`
  refuses inside the tool), and a geometry refusal is category `Geometry`, which affects the
  indicator by design. So the outcome is proven by node tests alone —
  `tests/presentation/editor/saveState/saveStateStore.test.ts` and
  `withSaveStateTracking.test.ts` — and a step here would read as more evidence than it is.
- **`Unsaved changes`.** Unreachable through `SaveStateStore`'s action surface by design —
  slice 6's transaction boundary leaves no moment where an edit is decided and no command
  dispatched. `saveStateStore.test.ts` walks the transitions exhaustively and proves it, so
  there is nothing to do by hand.
- **Whether a screen reader actually announces a notice.** Step 3a checks that the mechanism
  `Toast.md` asks for is in place — two regions, in the document, empty, written into — and
  stops there. A pass on the announcement itself would be a pass on one screen reader in one
  browser engine, and the contract's claim is about the class, so a step here would read as
  more evidence than it is.
- **Contrast ratios and hit-target sizes as NUMBERS.** Steps 7 and 12 are a legibility
  judgement. `.rp-notice-dismiss` declares a `var(--size-4-6)` floor against WCAG 2.2 2.5.8's
  24px; whether that variable resolves to 24px in a given theme is not asked here.

## Three contract gaps this slice knowingly ships

`docs/components/Toast.md` and `docs/components/Save-state indicator.md` both name this slice
in their own frontmatter, and this slice does not satisfy three of their requirements. They
are recorded here so a run of this case does not file three defects against decisions that
were taken deliberately, and so the next slice inherits them rather than rediscovering them
by reading the contracts again from scratch.

There were FOUR. The live-region one is closed — a review found it, and the fix was not the
one recorded here as likely: rather than reordering when the attributes go on the notice,
the regions left the notice altogether. `activateNotices` appends two empty ones to
`document.body` and a notice writes into the one its severity names, which is what "already
in the DOM" asks for without putting a timer between a notice appearing and its
announcement. Step 3a is where it is checked by hand.

1. **No mark beside the word, on either surface.** Both contracts ask for a mark AND a word
   ("Both, always, never one"). This slice ships the translated word plus colour, which
   satisfies SDD §85's "status not colour-only" and does NOT satisfy the contracts. The
   design refused an icon because this plugin has never called `setIcon` and the harness has
   no icon renderer; a CSS-drawn glyph would discharge the contracts without introducing
   `setIcon`, and is the likely answer. It changes markup, stylesheet and accessibility
   assertions in three separate places, which is why it was not done here.
2. **No moving indicator for *Saving*.** `Save-state indicator.md` cites the Design System's
   *Loading* row: a moving indicator **and** text. This ships text.
3. **No retry emit on *Save error*.** The contract says the component "Emits, in the Save
   Error case only, a retry request." **This one is undesigned rather than merely unbuilt**,
   and the distinction is the point: `SaveStateStore` retains no re-runnable operation — the
   tracker sees a dispatch OUTCOME, not a command — and re-running a failed `undo` is not
   idempotent, so a naive retry could corrupt the history stack. Supplying one is real design
   work, not wiring.
4. **~~The live-region insertion order.~~** Closed — see above. The residual, which is
   narrower and is written down where the code is: a live region announces when its content
   CHANGES, so an identical message at the same severity, raised again after the first was
   dismissed, writes the same string and says nothing. A repeat arriving while the first
   notice is still up does not have that problem — the queue folds it into a `(×N)` suffix,
   so the string differs. The usual remedy is to clear the region and write the text back in
   a later task, which is the timing this slice declined once already.

## Runs

| Date | Result | Findings |
| --- | --- | --- |

Anything on this list which does not work is a slice 13 defect, except the three gaps above,
which are known and deliberate, and step 16's failure injection, which depends on what your
filesystem lets you do to a folder inside an open vault.

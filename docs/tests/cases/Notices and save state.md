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
- **Obsidian's `Notice` is undocumented at the point every claim here rests on.**
  `obsidian.d.ts` declares `containerEl` and `messageEl` and says what neither one IS. Step 3
  is that question, and it is the most important step in this file.
- **No axe scan reaches a notice.** `tests/harness/accessibility.test.ts` scans `contentEl` —
  the plugin's own subtree — and a `Notice` renders on `document.body` under
  `.notice-container`, outside every view. So **the surface carrying the most new ARIA in this
  slice is the one surface no accessibility instrument grades**: the `role`/`aria-live` pair
  per severity, and the dismiss control's accessible name, are asserted one attribute at a time
  by jsdom tests and by nothing that reasons about them together. `docs/components/Toast.md`
  predicted this consequence in its own Open question 1 before the decision was taken, and it
  is recorded there as the settled price of using `Notice`. Widening the scan is not a fix that
  belongs to this slice: scanning the whole document would pull in the landmark rules that
  file's header records as out of reach.

## Steps

| # | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- |
| 1 | Run `Open plan editor` in a vault with no plan notes | A notice reading "This vault has no renovation plans yet." appears, prefixed by the word "Information", and disappears on its own after about six seconds | The `info` tier end to end. `AUTO_DISMISS_MS.info` is 6000 and this plugin owns that timer rather than Obsidian, which is what `duration: 0` buys. This is the ONLY auto-dismissing notice a user can raise — `notifySuccess` has no production caller, and its own header says why |
| 2 | Run `Set plan background` in a vault with no PNG, JPEG or PDF | A notice reading "Only PNG, JPEG and PDF files can be a plan background." appears, prefixed by "Warning", and is still there a minute later | `AUTO_DISMISS_MS.warning` is `null`. A warning about something the user asked for that did not happen, whose remedy is outside the plugin, must not expire while they work out what to do |
| 3 | **With that warning showing, open the developer console (`Ctrl+Shift+I`) and inspect it.** Find the element carrying `role="alert"` and the class `rp-notice`. Then raise three notices at once (step 8) and look again | There is ONE such element **per notice**, each a child of a single shared stack container. If instead one element wraps every notice, this step FAILS | **The claim the whole host rests on, and `obsidian.d.ts` documents neither way.** `notify.ts` treats `Notice.containerEl` as the per-notice element: it scopes `role`/`aria-live` to it, puts the severity class on it, and reads `containerEl.isConnected` as `handle.live`. If `containerEl` is the shared `.notice-container`, then every notice announces as one region at whatever severity arrived first, the severity colours collide — and, the serious half, `isConnected` never goes false, so `sweep` frees nothing and **the queue wedges permanently at three notices**. Step 11 is the behavioural symptom; this step is the cause. **If it answers unfavourably, the recommended remedy is recorded rather than taken:** read `handle.live` from `messageEl` instead of `containerEl` — `messageEl` is the per-notice element under BOTH readings of the typings, so that one change makes a permanent wedge impossible at no cost — and, to be correct under either reading rather than merely unwedgeable, move the `role`/`aria-live` attributes, the severity class and the four hover listeners there too, at the cost of shrinking the hover target from the whole notice to its message box. Slice 13 did not take it: it is a behaviour change to shipped code resting on an assumption about an Obsidian API nothing in this repository can check. Whoever runs this step knows the answer and can take it with eyes open |
| 4 | Read the warning from step 2 as text | It reads `Warning`, then a clear gap, then the sentence — never `WarningOnly PNG, JPEG and PDF…` run together — and the `×` sits clear of the sentence's last word | The flex `gap` on `.rp-notice-body`. The three children are adjacent inline elements with no whitespace between them, so the separator is CSS and nothing else. jsdom's `textContent` reads the concatenation happily and `toContain('Warning')` passes against it. This repository has already shipped this exact defect once — the harness index's rows read `ZonePanelprototype` — and it took a PNG read by eye to find |
| 5 | Raise the `info` notice from step 1, hover it and hold the pointer there for ten seconds, then move away | It stays while hovered, and goes about six seconds after the pointer leaves — not immediately, and not one second later | Hover-pause, and that `resume` restarts a FULL duration rather than a remainder. Obsidian's own timer is internal and cannot be paused, which is the whole reason this plugin owns it |
| 6 | Raise it again and press `Tab` until the `×` inside it is focused | Focus reaches it, the ring is clearly visible, the notice does NOT disappear while it is focused, and `Enter` dismisses it | Two things at once. The ring is `outline: 2px solid var(--text-accent)` under a reset that removes both of Obsidian's own focus channels — WCAG 2.2 2.4.7 at AA, which `PRODUCT.md` binds by name. And `focused` is a hold condition beside `hovered`, so a timed notice cannot vanish out from under a keyboard user reaching for its dismiss |
| 7 | Repeat step 6 in a light theme, a dark theme, and one third-party theme | The ring is visible against the notice's own background in all three | A theme may set `--text-accent` to something with no contrast against the notice's background. Nothing in this repository resolves a `var()` to a colour |
| 8 | Raise four notices in quick succession — run `Set plan background` in a background-less vault four times, changing nothing between | Exactly THREE are on screen. Dismiss one with its `×`: the fourth appears | `MAX_VISIBLE_NOTICES` and promotion. A notice past the cap is held, not dropped. **And HIDE TIMING, which is a vault-only measurement.** The fake's `hide()` detaches synchronously; Obsidian's `Notice` is animated and may detach after a transition, in which case `containerEl.isConnected` is still true when the sweep that follows this click runs. Our own dismiss control no longer depends on the answer — `notify.ts` latches `handle.live` to false on that path — so this step passing says the latch works, not that hide is synchronous. Step 11 is the path that still rests on connectedness, and a vault is the only instrument that can confirm hide timing either way |
| 9 | Raise the same notice twice — run `Set plan background` twice | ONE notice, reading `… (×2)` | Dedup on the `(severity, message)` pair. Watch that the count updates in place rather than a second notice appearing beside it |
| 10 | Hover a repeated notice and raise it again while hovering | The count goes up and no countdown starts underneath the pointer | `arm` withholds a timer from a PAUSED entry. Three separate review findings in this slice were all "this call site should not have armed a timer", which is why the rule lives in one function and every caller calls it unconditionally |
| 11 | Set up step 8 again, then dismiss one notice by clicking its **body** — Obsidian's own gesture — rather than the `×` | It goes, and the fourth held notice appears in its place | `handle.live` rather than a dismissal callback. Obsidian dismisses a notice without telling us and exposes no callback either way, so the click listener on `containerEl` is only a prompt to sweep and `isConnected` is the authority. If the fourth never appears, that is step 3's question answering the wrong way |
| 12 | Look at the four severity labels in a light theme, a dark theme and one third-party theme. `success` cannot be raised by hand — see "Deliberately NOT checked" — so this is three of the four | Each label is legible and the severities are distinguishable from one another | SDD §84: every colour here is an Obsidian variable, so the build refuses a literal one — but only a themed vault says whether the variables chosen were the right ones |
| 13 | Open a plan and look at the status bar's third region | It reads **Saved** | `SaveStateIndicator` mounted inside `StatusBar`'s one `role="status"` region, at its initial value. §60's third region held nothing from slice 5 until now |
| 14 | Draw a zone and watch that region | It shows **Saving**, then settles on **Saved** | The tracked dispatcher. `withSaveStateTracking` sits inside `wrapDispatcher` and outside the refresh decorator, so **Saved** never appears while the canvas still shows the pre-command state. A fast write may make **Saving** hard to catch; the contract's own Open question 2 asks whether that state should be shown at all |
| 15 | Press Undo, then Redo | The region passes through **Saving** each way | An undo is a write like any other — slice 8's reversible delete writes a snapshot back through the repository. A decorator over `run` alone would leave the indicator reading **Saved** through an in-flight undo |
| 16 | Make a write fail: with the plan open, make the plugin's `Geometry/` folder unwritable from outside Obsidian, then move a zone | The region reads **Save error**, in the error colour, and stays there | Two things. `affectsSaveState` answering true for a `PersistenceError` — and the colour applying at all, which it did not: the selector shipped one word short (`rp-save-state-error` against the emitted `rp-save-state-save-error`) and no gate here could see it, because jsdom resolves no CSS |
| 17 | Make the folder writable again and move a zone | The region returns to **Saved** | The error clearing on the one thing entitled to clear it |
| 18 | Open two plans in two leaves (split the workspace), then draw a zone in one | Only that leaf's indicator moves; the other stays **Saved** | One `SaveStateStore` per view's own Pinia instance, which follows from `CommandHistory` being per-Plan. A plugin-global store would report one plan's write on both |
| 19 | Set Obsidian's language to German and repeat steps 1, 2 and 13 | The severity words, the dismiss control's accessible name and all four save states read in German | `de.ts` answers all nine keys this slice added. `tests/presentation/i18n/strings.test.ts` checks that every `en.ts` key HAS a German value and pins two terms; the words themselves are read here |
| 20 | Toggle the plugin off with a notice showing, then on again and raise another | The showing notice goes with the unload, and a notice raised after re-enabling appears normally | Disposal is TERMINAL, and `activateNotices()` is what brings the queue back. A `disposeNotices` that recreated the queue would let a fire-and-forget promise — the cascade and the recovery pass both run that way — attach a notice to a vault with no plugin left to remove it |

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
- **Whether a screen reader actually announces a notice.** See gap 4 below. A pass would be a
  pass on one screen reader in one browser engine, and the contract's claim is about the
  class, so a step here would read as more evidence than it is.
- **Contrast ratios and hit-target sizes as NUMBERS.** Steps 7 and 12 are a legibility
  judgement. `.rp-notice-dismiss` declares a `var(--size-4-6)` floor against WCAG 2.2 2.5.8's
  24px; whether that variable resolves to 24px in a given theme is not asked here.

## Four contract gaps this slice knowingly ships

`docs/components/Toast.md` and `docs/components/Save-state indicator.md` both name this slice
in their own frontmatter, and this slice does not satisfy four of their requirements. They
are recorded here so a run of this case does not file four defects against decisions that
were taken deliberately, and so the next slice inherits them rather than rediscovering them
by reading the contracts again from scratch.

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
4. **The live-region insertion order.** `Toast.md` requires `role="status"`/`role="alert"` on
   a live region **already in the DOM**, and explicitly *not* "on a container that appears",
   because a live region inserted along with its content often does not announce.
   `notify.ts` constructs `new Notice(text, 0)` — a populated element — and sets the
   attributes afterwards, which is exactly the shape the contract refuses. The contract calls
   this "the one that decides whether this component works at all for the users it exists
   for". The likely fix is to construct, clear `messageEl`, set the attributes while the
   element is empty, and populate on a microtask; it changes timing that several of this
   slice's tests assert synchronously, and **no jsdom test can observe an announcement either
   way**, so it was not changed blind.

## Runs

| Date | Result | Findings |
| --- | --- | --- |

Anything on this list which does not work is a slice 13 defect, except the four gaps above,
which are known and deliberate, and step 16's failure injection, which depends on what your
filesystem lets you do to a folder inside an open vault.

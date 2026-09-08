---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 105
sources:
  - Bound the mobile surface to what it can actually do
  - PRODUCT.md (Capabilities and Constraints — device scope)
  - SDD §85
status: Ready
---

# Read projects on mobile

The device scope `PRODUCT.md` states — **desktop-first, mobile read-only** — met in a real mobile
vault. `manifest.json` keeps `isDesktopOnly: false`, which is what makes that a promise rather
than a preference: the plugin loads on Obsidian mobile, so whatever it draws there is what it
claims to support.

**This case is the measurement the requirement note asks for before anything else.**
`docs/requirements/Bound the mobile surface to what it can actually do.md` says in writing that
*"which surfaces mobile can actually render is a question no gate in this repository can
answer"* — jsdom has no platform, the browser harness's `?phone` sets a body class rather than
reporting a device, and `Platform` is Obsidian's. The enforcement now shipped was written
against `Platform.isMobile` as the mock reports it; **what a phone actually renders, and what a
touch gesture actually reaches, has never been observed.** Every row below is therefore an
expectation, not a finding.

Preconditions: a **real iOS or Android device** running Obsidian, syncing a vault that holds

- **at least two** renovation projects, **one of them holding at least one plan**, and
- **at least one asset with a catalogue price and a project override**, for step 5, and
- a Plan Editor and an Asset Designer leaf **left open on desktop before the sync**, so the
  mobile app restores them (step 7). This is the one step the desktop machine has to set up
  first, and it is the state extension 2a is actually about — nothing on mobile can open either
  surface any more, so a restored leaf is the only way to arrive at one.

The plugin cannot be built on the device. Install it the way a user does: build with
`npm run build` (or `npm run test-build`), sync `main.js`, `manifest.json` and `styles.css` into
the vault's `.obsidian/plugins/renovation-planner/`, and enable it in the mobile app.

**What is already discharged elsewhere, so a runner does not re-derive it.**
`tests/presentation/views/mobileReadOnly.test.ts` holds that every formerly hidden control is
drawn, disabled and pointing at the one notice; `mobileDesktopOnly.test.ts` holds that neither
canvas mounts; `tests/plugin/` holds the four palette guards; and
`tests/harness/accessibility.test.ts` runs axe over the read-only surface. All five run in jsdom
against `Platform.isMobile` as the mock reports it, which is a boolean this repository sets
itself. **None of them is evidence about a phone.**

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could discharge it as
written. [[Smoke Test the Editor]]'s *The triage column* section defines the five values and
what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | Open the Renovation project pane from the ribbon | The pane draws, and **one** notice sits above everything else reading *"Available for viewing on mobile. Changes need a desktop."* The project list, its rows, their statuses and facts are all readable | Whether this surface renders on a phone AT ALL — the note's *"what has to be measured first"*. One notice, not one per control: a sentence about the device repeated beside five buttons is that sentence read aloud five times |
| 2 | `obsidian` | Read the list's own controls: **`New project`** in the header, **`New asset`** in the foot line, and (with a query matching nothing typed into the filter) **`Create "…"`** | Every one is **visible and disabled**, never absent. **`Assets`** in the foot line and **`Clear filter`** are NOT disabled — they read rather than write | Extension 4a: *"a control that vanishes on one device and appears on another reads as a bug in whichever one the user is holding"*. And the other half of it — an over-eager guard that disables the two controls a read-only surface is entitled to keep |
| 3 | `obsidian` | With VoiceOver (iOS) or TalkBack (Android) on, move to `New project` | The screen reader announces the button, that it is dimmed/disabled, **and reads the notice's sentence** as its description | The `aria-describedby` actually resolving on a mobile screen reader. `tests/harness/accessibility.test.ts` grades the attribute in jsdom and can say nothing about what a phone's assistive technology does with it — and a described-by that resolves to nothing looks identical to one that works |
| 4 | `obsidian` | Tap a project row | It **navigates** into that project's detail state. The notice is still there. `Open note`, `‹ back`, `Schedule` and `Quotes` all work; **`New plan`**, the plan rows and the first entry card's action are all present and disabled | Navigation and reading surviving the guard. A row is a `<button>` and a plan row is a `<button>`; disabling the second must not disable the first |
| 5 | `obsidian` | Open **`View prices`** | The catalogue price and this project's own price are readable. The price **field** is drawn and disabled; **`Clear`** is drawn and disabled; no `Apply`/`Cancel` pair appears | The price row, whose read is the thing a phone is genuinely useful for. The draft actions cannot appear because a read-only row can never become dirty — this is where that reasoning is checked rather than argued |
| 6 | `obsidian` | Open the command palette and search for `Renovation` | **`Open plan editor`**, **`Set plan background`**, **`Open asset designer`**, **`New project`** and **`Create sample renovation project`** are all **absent**. `Open renovation project` **is** there | The four palette guards this task added, plus the one `new-project` already had. A command that opens a leaf saying it cannot be used is a second, quieter surface for the one fact mobile is read-only |
| 7 | `obsidian` | With the Plan Editor and Asset Designer leaves restored from the desktop session, switch to each | Each draws **one sentence** — *"This surface is not available on mobile. Open it on a desktop."* — and **no canvas, no toolbar and no empty stage**. Switching away and back does not stack a second sentence | Extension 2a, on the only route left to those surfaces. The guard sits in each view's `sync()` rather than in `onOpen`, because Obsidian's order between `setState` and `onOpen` is not a plugin's to assume — a restore is exactly the path that would mount the canvas anyway if it sat in the wrong one |
| 8 | `obsidian` | Close both restored leaves | Neither faults, and neither leaves a stale shell behind | `onClose` unmounting an app that was never mounted — the one thing a refusal that skips `mount()` can break, and it breaks one gesture after the mistake |
| 9 | `obsidian` | Switch the mobile app to German and reload | The two sentences read *"Auf Mobilgeräten zum Ansehen verfügbar. Änderungen brauchen einen Desktop."* and *"Diese Ansicht ist auf Mobilgeräten nicht verfügbar. Öffnen Sie sie auf einem Desktop."*, and neither wraps off the pane | The formal register `strings.test.ts` enforces, and the width — a phone is the narrowest surface this plugin has, and neither sentence has been drawn at that width by anything |
| 10 | `obsidian` | Open one of the project notes in Obsidian's **own** Markdown editor and change a word | It edits normally | Extension 4b, stated so a runner does not report it as a defect: this item bounds *this plugin's own surfaces*, never what the host can do to a Markdown file |
| 11 | `obsidian` | Return to a desktop, open the same vault, and open the pane, a plan and an asset | **No notice. Nothing disabled. Every command back in the palette.** Both canvases draw | The note's third acceptance criterion, and the one an over-eager guard breaks. A refusal keyed on something other than the platform would follow the vault across the sync |

## Acceptance criteria

1. Steps 1, 4 and 5 show that everything the product scope calls readable is readable on a phone.
2. Steps 2 and 5 show every write control present and refused, never hidden.
3. Step 3 shows the reason reaching a screen reader, which is the whole difference between a
   refusal and a silently dead button.
4. Steps 6, 7 and 8 leave no route to a surface mobile cannot draw, and no fault on the way out.
5. Step 11 shows desktop unchanged.
6. The Runs table below records what a real device actually rendered — including anything that
   did not render at all, which is the finding this case exists for.

## Deliberately NOT checked

- **The Asset library's write controls.** They have their own design package and their own hook,
  and are recorded as still open in the requirement note rather than guarded here.
- **Hit-target size and contrast on a phone.** Real, and not this case's: they are properties of
  every surface at every width, and [[Find and resume a project]] step 4 already owns the
  measurement on the pane this one reads.
- **Whether the plugin is USABLE on a phone** — how the pane behaves under a soft keyboard, how
  a long project name wraps at 390px, whether a two-finger scroll reaches the plan list. Those
  are a design question this item does not answer; it bounds what is OFFERED, not how well it
  reads.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | **Not yet run on a device.** Every row above is an expectation derived from the requirement note and the shipped source. No mobile vault has opened this plugin, which is the measurement the note demands and the reason it is still open. |

## Outcome

Written after the first walk on a real device: which steps passed, what did not render, and what
the enforcement guessed wrong about.

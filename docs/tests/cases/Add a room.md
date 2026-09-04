---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 90
sources:
  - Plan editor Add Room design spec §3 (the draft store)
  - Plan editor Add Room design spec §4 (the tool)
  - Plan editor Add Room design spec §5 (the shell, the two doors, the sketch, the live region)
  - Plan editor Add Room design spec §6 (the one creation action)
  - Plan editor Add Room design spec §7 (one door, and Room never Zone)
  - M03-add-room
  - VS-04, scenarios A–C
status: Ready
---

# Add a room

The Add Room increment — the vertical-slice plan's checkpoint C2. Add → Room enters a temporary
creation task, a drag on the floor sizes a rectangle whose width, depth and area follow the hand,
the Inspector's form names it, and ONE press writes ONE reversible Room: a zone note and its
sidecar geometry under one id, selected, with Select active again. Escape and Cancel write
nothing; undo removes it and redo restores it under the same id; reopening the floor shows the
same room. `docs/superpowers/specs/2026-09-03-plan-editor-add-room-design.md` is the design and
`docs/superpowers/plans/2026-09-03-plan-editor-add-room.md` the plan this case's wave belongs to.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a
project with a floor open in the Standard Plan View. **Create sample renovation project** seeds
exactly that — three Rooms and two Areas on a backgroundless Ground floor — which is also why the
default name in step 1 counts from the zones already there rather than reading "Room 1".

## Why a human is the only instrument for six of these

Every clause below has a driver in `tests/presentation/editor/**`, in
`tests/infrastructure/persistence/editorRoundTrip.test.ts` or in `tests/harness/accessibility.test.ts`
— the design spec's §10 table names them one by one, and the e2e file
`roomCreation.e2e.test.ts` drives the whole gesture through the real mounted editor. Six things
sit outside all of it:

1. **The feel of the drag itself.** jsdom synthesizes pointer events; it cannot say whether a
   real mouse produces one smooth rectangle, whether the dashed preview keeps up, or whether the
   click epsilon (`CLICK_EPSILON_PX`, four screen pixels) is the right size for a real hand.
   Steps 2 and 9 are where that is judged.
2. **Whether focus really lands where `.focus()` was called, in Electron.** Both unmounting
   surfaces recover focus for themselves — the form hands it to the Inspector `<aside>`, the
   banner to the canvas container — and jsdom's `activeElement` proves only that the call was
   MADE. Step 6 is where it is watched, and it is the same gap
   [[Open a floor and select a room]] records for the overlay's close path.
3. **Whether one settled announcement is one announcement.** The `role="status"` element's text
   changes exactly once per drag, which a jsdom `MutationObserver` can count; whether a screen
   reader speaks it once, and speaks nothing during the moves, is a fact about the reader.
   Step 3.
4. **The reload.** `editorRoundTrip.test.ts` round-trips a rectangle created through the real
   command against the fixture vault; only a real vault closes and reopens a leaf with
   Obsidian's own asynchronous `MetadataCache` in between — the defect class this suite's own
   header tabulates. Step 8.
5. **The drawer at a real sidebar's width.** `layoutMode.ts`'s 400 is a picked number over a
   `ResizeObserver` reading; `npm run harness-shot`'s `plan-editor-add-room-narrow` capture reads
   it at 460 px in a headless Chromium, and neither says what Obsidian's own leaf chrome leaves.
   Step 10.
6. **What the banner and the form look like beside each other in a themed vault.** The two
   captures were taken against the vendored `tests/harness/obsidian.css` in Obsidian's DEFAULT
   colours; a themed vault is a first look. Steps 1 and 10.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could
discharge it as written. [[Smoke Test the Editor]]'s *The triage column* section defines
the five values and what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | With the floor open and nothing selected, click **Add** and choose **Room** | The menu closes and a banner appears across the top of the canvas: **Adding a room**, the instruction "Drag on the floor to size the room, or type its width and depth.", a **Create room** button reading `aria-disabled` (dimmed, still focusable) and a **Cancel**. The Inspector is replaced by the **New room** form — a **Name** field pre-filled "Room 6" on the sample floor, "What room is this?" above six suggestion buttons, empty **Width (m)** and **Depth (m)** fields, **Area** reading an en dash, an unticked **Keep adding rooms**, and **Create room** / **Cancel**. The canvas shows no rectangle yet | The Add entry still routing to the polygon tool (design spec §2.1 — the catalogue's Room entry activates `'draw-room'` now, and nothing in the editor reaches the polygon tool at all); the banner capped at half the pane, which is exactly what the first capture of it showed; and a default name counting from the wrong number, or saying "Zone" |
| 2 | `browser` | Press on empty floor and drag out a rectangle, watching the canvas and the Inspector as the pointer moves | A dashed rectangle follows the pointer with a width label above its top edge and a depth label beside its right edge, both in metres; the form's Width, Depth and Area update continuously with it; releasing leaves the rectangle drawn and the two fields holding the released size. Dragging in any direction — up and left included — gives one rectangle rather than an inverted or empty one | `RoomDraftSketch` reading a stale rect or projecting through the wrong camera, and `normalised()` not taking the absolute sides, which jsdom asserts as numbers and cannot show as a picture |
| 3 | `desktop` | Repeat the drag with a screen reader running | The reader announces the settled size ONCE, on release — "4.2 m by 3.8 m, 15.96 m²" or whatever the rectangle came out as — and says nothing at all during the moves | A live region written on every `pointermove` (design spec §5.4): the suite counts text changes across twenty moves and asserts one, but only a reader says whether one change is one announcement |
| 4 | `suite` | Press the **Kitchen** suggestion button | The Name field reads "Kitchen"; nothing else in the form moves, and the rectangle is untouched | A suggestion that sets a translation key or an internal type rather than the visible name, and one that overwrites a name the renovator has already edited |
| 5 | `suite` | Type `abc` into **Width (m)** and press Tab; then select the field, type `4.2` and press Tab again | The first commit shows an inline error under the field — "Enter a length in metres, such as 4.2" — with the text `abc` still in the field and Create still blocked; the correction clears the error and the rectangle resizes from its top-left corner, keeping its min corner and changing only that side | A refusal that reverts the user's own typing (the rule slice 16 settled for every field in the plugin), and a numeric commit that re-centres the rectangle instead of keeping the corner it already has |
| 6 | `obsidian` | Press **Create room** in the form | One new room appears on the canvas and is selected; the Inspector shows the Room Inspector for it, name "Kitchen", Type "Room", an Area matching the two lengths; the banner is gone, **Select** reads pressed, and focus is visibly somewhere inside the Inspector — not lost to the page. Pressing Tab moves within the editor rather than starting from the top of the document | Focus falling to `<body>` when the pressed control unmounts with the form — jsdom proves `.focus()` was called and cannot prove Electron honoured it |
| 7 | `obsidian` | Press **Undo** in the context bar, then **Redo** | Undo removes the room from the canvas and from the vault's zone notes; Redo restores it, under the same id — the same note file, not a second one | A reversible create whose redo mints a fresh id, which would leave the first note orphaned and every reference to it dangling |
| 8 | `obsidian` | Close the plan editor leaf and reopen the same floor | The room is there, with its name, its Room type and the same area; the vault holds one zone note for it and one sidecar entry under the same id | The write-and-read-back defect class this suite's own header tabulates: Obsidian's `MetadataCache` populates asynchronously, so a note read in the tick it was created has no cache entry, and no fake here reproduces a real reload |
| 9 | `browser` | Add → Room again, drag a rectangle, then press **Escape**; press **Escape** a second time | The first Escape clears the rectangle from the canvas and leaves the task running — the banner stays, the form stays, and no room was written; the second Escape ends the task and returns to Select. Then repeat with a plain CLICK on the floor rather than a drag: the click writes no rectangle and leaves whatever rectangle was there before it alone | Escape's precedence collapsing into one answer (`routeEscape` steps back one interaction at a time), and a click that a hand could not hold perfectly still being read as a drag — the epsilon is four screen pixels and only a real hand says whether that is enough |
| 10 | `obsidian` | Drag the leaf as narrow as Obsidian's own sidebar, then Add → Room. Press **Details** in the rail; close it and press **Create room** on the banner instead | At sidebar width the banner is a compact strip across the pane — a task name, an instruction and two buttons, not a slab of chrome over the canvas it is describing — and the Inspector column is gone. **Details** opens the drawer holding the same New room form; closing it leaves the banner's own **Create room** live once the draft is valid, and pressing it writes the room without the drawer ever being opened again. Focus lands on the canvas afterwards | The banner wrapping to eleven lines of one and two words, which is what the 460 px capture showed before `left: 50%` + a transform was replaced by two insets and `width: fit-content`; and a narrow layout where the only door to Create is behind a drawer |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the design spec, the component source and its English copy — never from memory of either. Steps 1 and 10's layout clauses have been read once in a headless Chromium (`npm run harness-shot`'s `plan-editor-add-room` and `plan-editor-add-room-narrow`, taken with the pinned browser), which is where the banner defect they name was found and fixed. |

## Outcome

Written after the first walk: which steps passed, and anything only a live vault showed.

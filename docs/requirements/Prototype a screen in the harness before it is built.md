---
type: PBI
parent: "[[User Interface]]"
order: 70
status: New
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: "[[1 - Iteration]]"
---

# Prototype a screen in the harness before it is built

A design that has never been drawn against the stylesheet it will ship on is a design nobody
has actually seen. Today the drawing happens in [`docs/user-experience/concepts/`](../user-experience/concepts/README.md),
where six hand-written pages are styled by `concept.css` — a **proposal** sheet, deliberately
separate from the assembled `styles/` the plugin ships. That separation is what makes a mock
cheap to write and it is also what makes it a dead end: turning an approved mock into a
component means redrawing it against the other sheet, so the prototype is thrown away rather
than promoted and every spacing, state and hierarchy decision is made twice.

The waste is the point rather than the inaccuracy. `concept.css` is not *wrong* — it is a
proposal, and the concepts README records six findings those pages produced that nothing else
would have. What it cannot do is hand its output forward.

So this use case moves the drawing to where the real components already live: a mock is a
**template-only Vue SFC**, which is pure HTML to write and is already a real component the
harness mounts like any other. Promotion adds a `<script setup>` block. The markup is never
redrawn.

## Actors

- **The designer** — the person deciding what a screen should look like before anybody commits
  to building it. Judges the result; does not necessarily write it.
- **The coding agent** — a system actor, the same kind as [[Obsidian]] and
  [[The renovator's task tooling]] rather than a human. It writes the mocks the designer
  iterates on, and it works **without a browser**, which is the constraint most of this note's
  shape follows from.

Neither exists in `docs/actors/` today; see *What this forces elsewhere*.

## Preconditions

- The harness runs (`npm run harness`), or `npm run harness-shot` can reach it headlessly.

Nothing about the plugin's own state is a precondition: the harness supplies its own world,
per *One seeded fixture* below.

## Main flow

1. The designer describes a screen that does not exist. Some of its parts are real components
   already; some are not.
2. The coding agent writes the missing parts as **template-only SFCs** under `src/prototypes/`,
   and a prototype SFC that composes them beside the real components it needs.
3. The agent runs `npm run harness-shot <name>` and looks at the PNG it just produced — one per
   colour scheme. It iterates against its own output.
4. The designer opens the harness. Its **index** lists every prototype and every component,
   discovered from the tree; they open the one in question, or go straight to its URL.
5. What they are looking at is styled by the **same assembled stylesheet the plugin ships**, so
   the judgement is about the thing that will exist.
6. When the design settles, a mock is promoted: a `<script setup>` is added and the file moves
   into the presentation tree. Its template goes unchanged.

## Extensions

- **2a** — The prototype needs a component that cannot mount against the shared fixture. The
  index shows the failure and which entry produced it, rather than a blank page or a silently
  missing region. A prototype that half-drew itself is worse than one that says what is missing.
- **3a** — The agent has no browser and no capture (a container without the Chromium binary
  `scripts/chromium.mjs` resolves). The mock is still writable — a template-only SFC needs no
  runtime — but the agent cannot verify it, and says so rather than reporting a design it has
  not seen.
- **4a** — `src/prototypes/` is empty. The index still lists the real components, and says the
  prototypes tree is empty rather than rendering nothing.
- **4b** — A prototype fails to compile. Vite's own overlay is the report; the index does not
  swallow it. The other entries stay reachable.
- **6a** — A promoted component's template needs to change after all. That is ordinary component
  work and this use case is over; the point of the guarantee below is that the *markup* did not
  have to be re-derived, not that it is frozen.

## Guarantee

**No mock, no prototype and no fixture is ever in a built plugin.** A renovator's vault receives
none of it, whatever is in `src/prototypes/` and whatever imports what.

That is enforced **twice, in different places**:

- **`no-restricted-imports` makes `src/prototypes/` a one-way door.** Nothing outside it may
  import from it. Checked at the forbidden thing rather than by driving the paths somebody
  thought of, so it holds for code nobody has written yet — the same shape as `eslint.config.mjs`'s
  layer bans and `WRITE_BOUNDARY`.
- **A bundle test is the backstop.** Lint reads imports; a dynamic specifier or a route nobody
  anticipated is what the built artifact catches. It asserts against `dist/` — the thing that
  actually reaches a user — not against the source it was built from.

Neither alone is sufficient and the note does not pretend otherwise: lint refuses the import in
the edit loop, the bundle test refuses the outcome, and the second exists because the first
cannot see every route in.

## One seeded fixture

Real components read Pinia stores — `StatusBar` alone reads `useProjectStore` and
`useEditorStore` — so mounting one in isolation needs a world behind it.

The harness creates **one** seeded set: a plan, some zones, a viewport. Every entry mounts
against it, which buys two things worth more than expressiveness. What the designer sees is
**reproducible** — the same entry looks the same next week. And two components on one screen
**agree with each other**, because they are reading the same plan rather than two invented ones
that differ in a way nobody notices until production.

The cost is stated rather than hidden: a component state the fixture does not cover cannot be
shown without extending the fixture, and extending it changes what every other entry draws.

## What this forces elsewhere

1. **A new tree under `src/` is billed in six places**, and CLAUDE.md's record of the Vue
   arrival is the evidence that this is the real price rather than a formality:
   `vite.config.ts`, `vite.harness.config.ts` and `vitest.config.ts` each transform source
   independently; `tsconfig.json` decides whether it is type-checked; `eslint.config.mjs` owns
   the one-way-door rule; `.fallowrc.json` must be told the tree is not dead code, since nothing
   ships imports it. **Coverage is the seventh and the one most likely to be forgotten**:
   `src/` carries floors near 100%, and an unshipped prototype either drags them or is excluded
   by name.
2. **Two actor notes are owed** under `docs/actors/` — the designer and the coding agent. This is
   the register's first item whose actors are neither a renovator nor a store, and the folder's
   `standing` vocabulary (`primary persona`, `host application`, `canonical store`, …) gains its
   first entries for a party that *builds* the product rather than uses it.
3. **`npm run harness-shot` gains an argument.** It writes a fixed set of pages today. Taking an
   entry name is what turns the agent's loop from write-and-hope into write-and-look, and it is
   the reason step 3 of the main flow exists at all.
4. **[`docs/user-experience/concepts/`](../user-experience/concepts/README.md) takes no new
   pages.** Its six existing ones stay, frozen, as the record of what was proposed and of the
   six findings its README documents — several of which no other instrument could have produced.
   New prototyping happens in `src/prototypes/`. Two mock homes with one rule for which is which
   is a boundary; two with no rule is the drift this note exists to end.

## Out of scope

- **Retiring `concept.css` or migrating the six concept pages.** Named because it is the obvious
  next thought and is deliberately not this: the pages are a record, and a record that is
  rewritten stops being one.
- **Replacing `npm run concept-shots`.** The PNGs in `docs/components/` are shot from the
  gallery's drawings, and whether a component note should instead embed its *real* rendering is a
  question about those notes rather than about this harness.
- **Asserting anything about what a prototype draws.** The harness draws; it does not check, and
  this note does not change that. The bundle test is a build test living with the others in
  `tests/build/`, not a harness assertion.
- **A prototype that outlives its promotion.** Nothing here says a mock must be deleted once its
  component exists. Whether a stale prototype is debt or a fixture worth keeping is a decision
  for whoever has two of them.

## Acceptance criteria

1. A template-only `.vue` file added under `src/prototypes/` appears in the index with no
   registration step — proven by adding one in a test and asserting the discovered set, not by
   reading the glob.
2. The built plugin contains no file from `src/prototypes/` and no fixture, asserted against the
   build output. The case that must fail is a prototype reachable through a dynamic import.
3. An import of `src/prototypes/` from anywhere else in `src/` fails lint. Asserted by linting a
   planted file, per `CLAUDE.md`'s rule that a category invariant is checked at the forbidden
   thing.
4. Every entry the index lists is reachable at its own URL, and `npm run harness-shot <name>`
   writes a PNG for it in each colour scheme. The failing case is an entry that the index can
   open and the shot command cannot.
5. Mocks and real components in one prototype are styled by the **same** assembled stylesheet —
   there is no second sheet in the harness page for prototypes to opt into.
6. A real component mounts in the index with no per-entry setup, because the fixture is already
   there. Checkable by opening any component entry in under a minute.
7. Two components mounted from one prototype read the same plan: a value shown by both matches.
8. An entry that throws names itself in the index rather than blanking the page (**2a**), and an
   empty prototypes tree still lists the components (**4a**).
9. `npm run check` passes with `src/prototypes/` populated — coverage floors, fallow's dead-code
   pass and both linters included. The case that must fail is a tree that only passes while empty.
10. A promoted mock's template is byte-identical to the mock's, proven by promoting one in a test
    fixture and diffing the template block. This is the criterion the whole note is for: if it
    cannot hold, the rewrite this replaces has only moved.

## Assumptions

1. **`horizon: "MVP"` and `iteration: "[[1 - Iteration]]"`**, matching [[Shared UI vocabulary]].
   Stated as an assumption because this is developer tooling and MVP is a *product* scope scale —
   the honest reading is that it serves the MVP rather than being in it.
2. **`dependsOn` is left empty**, though the sibling names [[Design System]]. Nothing here needs
   the design system decided first; a prototype is how some of its open questions get answered.
3. **A template-only SFC is a valid Vue component** and needs no script block to mount. True of
   Vue 3 SFCs and of `@vitejs/plugin-vue` as configured, unverified against this repository's
   exact toolchain because `node_modules` was not installed when this note was written.
4. **The index lives at the harness root**, where the project view is drawn today. Whether that
   displaces the current default or sits beside it is a design decision this note leaves open.
5. **`src/prototypes/` is the path.** Named for what it holds rather than for who writes it —
   `src/mocks/` would read as test doubles, which these are not.
6. **The note carries acceptance criteria**, following [[Start a renovation project]]'s precedent
   rather than `docs/README.md`'s bare PBI shape.

## Sources

Read from this repository rather than from the received documents, which is unusual for a note
in this folder and is stated so nobody looks for a PRD section behind it:

- [`CLAUDE.md`](../../CLAUDE.md) — what `npm run check` refuses, what the harness is and is not,
  the layer bans and `WRITE_BOUNDARY` as the shape a category invariant takes here, and the
  record of what the Vue arrival cost in configuration.
- [`docs/user-experience/concepts/README.md`](../user-experience/concepts/README.md) — the six
  pages, `concept.css` as a proposal sheet, and the six findings the mocks measured.
- [`docs/setup/quality-harness.md`](../setup/quality-harness.md) — the gates this note has to
  survive.
- `vite.harness.config.ts`, `tests/harness/`, `scripts/harness-shot.mjs` and
  `src/presentation/editor/shell/StatusBar.vue` — read for what the harness mounts today and for
  what a real component needs behind it.

PRD §39 (the editor's regions) and ADR-004 (Vue 3 for the plugin UI) are the two received
positions this rests on; neither addresses prototyping, which is why the rest is derived here.

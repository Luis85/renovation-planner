# Renovation Planner — swap pdf.js for Obsidian's, and make the plugin reviewable in a vault

Repo: `C:\Projects\renovation-planner` (Obsidian plugin). Branch `main`, tree clean,
HEAD = `9f92e9a` "feat: design slice 5 — canvas rendering and the editor shell".
`npm run check` is green there: 843 tests, 86 files, coverage 99.66 / 98.64 / 99.78 / 99.81.

## Read first, in this order

1. `CLAUDE.md` — the agent guide. Non-negotiable; it OVERRIDES default behaviour.
2. `docs/sdds/obsidian-renovation-planner-SDD.md` — the authority. Where it and CLAUDE.md
   disagree, the SDD wins and CLAUDE.md is the bug.
3. `docs/tasks/05-canvas-rendering-and-editor-shell.md` — slice 5, `status: Done`. Its
   **Implementation Notes** section (near the end) records every place the built thing
   differs from the design and why; read it before touching the canvas.
4. `src/presentation/editor/layers/background/pdfRaster.ts` — the file task A rewrites. Its
   header carries the three measured pdf.js facts that are about to become obsolete.

## State

Slices 1–5 are `status: Done`. There is a slice 6 plan already committed at
`docs/superpowers/plans/2026-08-24-slice-06-editor-tool-framework.md` — **this work comes
first**, because slice 6 builds on a canvas nobody has yet seen inside Obsidian.

---

## Task A — replace bundled `pdfjs-dist` with Obsidian's own pdf.js

### Why: measured, not estimated

| Release bundle (`vite build`, minified, cjs) | Size |
| --- | --- |
| Everything | 2216 KB |
| Without pdf.js | **488 KB** |
| **pdf.js alone** | **1728 KB — 78% of the plugin** |

Because the plugin is one bundled `main.js`, that is parse cost on **every Obsidian start
for every user**, whether they ever open a PDF or not.

### Why it is safe: verified in a live vault, not assumed

`loadPdfJs()` is `@public` in `node_modules/obsidian/obsidian.d.ts`:

```ts
/**
 * Load PDF.js and return a promise to the global pdfjsLib object.
 * Can also use `window.pdfjsLib` after this promise resolves to get the same reference.
 * @public
 */
export function loadPdfJs(): Promise<any>;
```

The `obsidian` devDependency is pinned to exactly `1.13.0`, which IS `manifest.json`'s
`minAppVersion` (`tests/release/manifest.test.ts` holds that pairing) — so the existing
compiler gate already proves this API is promised at our floor. No new risk.

**Checked in a real vault's dev console.** `window.pdfjsLib` resolves and reports:

- `version: "6.2.108"` — **identical to the `pdfjs-dist@^6.2.108` we bundle today.**
- `getDocument: ƒ getDocument(src = {})` — present.
- `GlobalWorkerOptions: class GlobalWorkerOptions` — present, and Obsidian has already
  configured its own worker.

That last point retires the ugliest thing in `pdfRaster.ts`: the
`globalThis.pdfjsWorker = { WorkerMessageHandler }` single-bundle escape hatch, and the
main-thread parsing it forced, both go away.

### What to change

- **`src/presentation/editor/layers/background/pdfRaster.ts`**
  - Drop both `pdfjs-dist` imports, `installWorker()`, and the whole worker docblock.
  - `await loadPdfJs()` from `'obsidian'` instead. `presentation/` may name `obsidian`
    (the layer bans in `eslint.config.mjs` only forbid it in `core/`, `domain/`,
    `application/`), so no layer change is needed.
  - `loadPdfJs()` returns `Promise<any>`. Declare a **narrow local interface** for the four
    members this module actually uses — `getDocument`, the loading task's `promise` and
    `destroy`, `getPage`, `getViewport`, `render` — and cast once at the boundary. This
    replaces `pdf-worker.d.ts`, which should be **deleted**; its docblock already explains
    that it exists only because upstream ships no worker types, and the day we stop
    importing the worker is the day it becomes a lie.
  - `@typescript-eslint/no-unsafe-*` runs type-aware on `.ts` and WILL bite the `any`.
    One narrowing cast in one place, not a suppression — `noInlineConfig` means there is
    no suppression available anyway.
  - **Re-test `useWasm: false`.** It exists because pdf.js 6 fetches WebAssembly from a URL
    a bundled plugin cannot serve. Obsidian's copy is not bundled by us and may have its
    own `wasmUrl` configured, so the flag may now be wrong (it disables image-decoding
    acceleration for nothing). Decide by measurement in a live vault, and write down which
    way it went and why.
  - Keep everything else: the buffer copy before `getDocument` (pdf.js detaches the array
    it is given), the `finally { await task.destroy() }` — read its comment, it records a
    defect that turned every successful render into "unreadable" — and the
    `MM_PER_POINT / RASTER_SCALE` world scale.

- **`tests/helpers/obsidian-mock.ts`** — add `loadPdfJs()`, returning the REAL
  `pdfjs-dist/legacy/build/pdf.mjs`. Two things make this the right shape rather than a
  convenient one, and both belong in its docblock:
  - The mock is **not kinder than the real thing**: it hands back a genuine pdf.js, so
    `tests/presentation/editor/background.test.ts` keeps rasterizing a real page and
    asserting sampled pixels.
  - The **legacy** build specifically, because the standard one constructs a `DOMMatrix` at
    module scope and cannot be imported under jsdom at all. That constraint now applies
    only to the suite; production never imports `pdfjs-dist`.

- **`package.json`** — move `pdfjs-dist` from `dependencies` to `devDependencies`.

- **`.fallowrc.json`** — `pdfjs-dist` now genuinely IS a test-only dependency, so fallow's
  advice about it becomes correct and no ignore entry is needed. **Leave the `konva` entry
  alone** and leave its comment intact: konva is `vue-konva`'s peer dependency, is required
  at runtime, and moving it would build here and fail in a vault.

- **`vitest.config.ts`** — re-measure coverage and record it in the measurement log. Ratchet
  only if the rounded-down figures genuinely exceed the floors in force; slice 5 ratcheted
  nothing for exactly that reason, and that file carries the policy.

- **`CLAUDE.md`** — the "Deliberately absent" bullet currently records what the canvas stack
  cost, naming `pdfjs-dist` among the arrived dependencies and quoting the 2.3 MB bundle.
  Both halves change. Also the two paragraphs about the legacy build and the in-process
  worker: what survives is a TEST-only fact, and the sentence has to say so rather than
  keeping the wider claim.

- **`docs/tasks/05-canvas-rendering-and-editor-shell.md`** — its Implementation Notes have a
  "What pdf.js actually cost" section that is about to be historical. Rewrite it as what was
  tried and why it was replaced; do not delete the measurement, because the next dependency
  should be able to read what this one cost.

### How to know it worked

- `npm run check` green.
- **Re-measure the bundle and state the number.** Expect roughly 2216 KB → 488 KB. Measure
  it the way this session did — a throwaway vite config with a different `outDir`, so
  nothing in `dist/` or `.obsidian/plugins/` is disturbed, and delete it afterwards.
- `npm run test-build`, then in the vault: set a **real PDF** as a plan background and
  confirm the page renders. This is the only place the production path exists at all now,
  because the suite exercises the mock's pdf.js and production uses Obsidian's.
- **State the residual gap honestly** in `pdfRaster.ts`: the suite runs OUR pdf.js version
  and production runs Obsidian's. They are the same version today (6.2.108, verified) and
  nothing guarantees they stay that way. That is the same class of gap as the pinned
  `obsidian` devDependency, and a live vault is the only thing that closes it.

---

## Task B — make the plugin reviewable from inside Obsidian

### The problem, stated exactly

**Slices 3, 4 and 5 are all unreachable from inside the app.** Verified:

- `CreateProjectCommand`, `CreatePlanCommand` and `CreateZoneCommand` exist in
  `src/application/commands/` with full test coverage and **no caller anywhere outside
  `application/`** — nothing wires them to an Obsidian command, a ribbon, or any UI.
- So a vault contains no project, plan or zone notes.
- The Plan Editor's `open-plan-editor` command uses a `checkCallback` that requires the
  ACTIVE FILE to be a plan note (resolved through the Project Index). With no plan notes it
  never appears in the palette.
- `set-plan-background` requires an active Plan Editor, which therefore cannot be opened.
- The Renovation Project view draws an empty root.

Net effect: a human can install the plugin and see a settings pane and one empty pane. Slice
5's thirteen Definition-of-Done items are all verified by the suite and by
`npm run harness-shot`, and **none of them has been seen inside Obsidian.** That is the gap
to close.

### Constraints — read these before choosing an approach

1. **Use the real command paths.** Anything that creates a project, plan or zone must go
   through `CreateProjectCommand` / `CreatePlanCommand` / `CreateZoneCommand`. Writing notes
   directly would prove nothing about the persistence layer and would breach
   `WRITE_BOUNDARY` in `eslint.config.mjs` besides.
2. **Do not pre-empt later slices' designs.** Slice 6 owns tools, the Inspector and
   `CommandHistory`; slice 14 owns empty states; slice 15 owns modals and confirmation
   dialogs; slice 16 owns form validation. Read those task docs before inventing UI they
   will have to unpick. A `FuzzySuggestModal` is already established here
   (`src/presentation/modals/PlanBackgroundSuggestModal.ts`) and is cheap to reuse; a
   bespoke form is not.
3. **If it is scaffolding, say so in its name and its docblock**, and name the slice that
   replaces it. The browser harness is the precedent: it is loudly a tool for looking, not a
   feature, and CLAUDE.md describes it that way.
4. **Everything a user reads goes through `t`/`tr`** in `src/presentation/i18n/`, English and
   German both. `I18N_LITERAL_BAN` only catches four call sites — read its docblock in
   `eslint.config.mjs` for what it cannot see, and do not rely on it.
5. **A command id is DATA** (Obsidian binds hotkeys to it); the display name beside it is
   text.
6. `npm run check` green, coverage floors respected, both linters, fallow clean.

### Three approaches. Weigh them, then decide and say why

- **(a) Wire the three existing create commands to Obsidian commands.** Smallest change that
  uses real paths, and plausibly product-real rather than scaffolding — a plugin that cannot
  create a project is not finished. The open question is where a NAME comes from: a modal is
  slice 15, so either a suggester, or a derived default the user renames afterwards.
- **(b) One "create a sample project" command** that seeds a project, a plan and a few zones
  in one call through those same commands. Fastest route to a reviewable canvas, needs no
  input and no new UI vocabulary, and is honestly scaffolding — the vault-side equivalent of
  `npm run harness`. Must be explicitly marked and must name what removes it.
- **(c) Give the Renovation Project view a real list of projects and plans**, each opening
  the Plan Editor. Most product-real and the best end state — and closest to slice 14's
  territory, so read that doc first.

**Recommendation, to be argued with rather than followed:** (b) now, plus one product-real
piece — make the Plan Editor reachable **without** a plan note being active, via a plan
picker over the Project Index, reusing the `FuzzySuggestModal` pattern already built. (b)
gets the canvas on screen this session; the picker is something slice 14 will want anyway
and replaces the awkward active-file requirement. Do (a) or (c) only if the argument for
them is stronger than this one.

Whatever is chosen, `revealPlanEditor` stays the single decider of what opening a Plan
Editor means — read the "one action, every input" reasoning in
`src/infrastructure/obsidian/workspace/revealPlanEditor.ts` before adding an entry point.

### What a human must be able to do at the end

Write this list into the change's own commit message or the plan doc, and confirm each item
by hand in `npm run test-build`. These map to slice 5's Definition of Done, which has never
been exercised in the app:

1. Create a project, a plan and at least two zones, from inside Obsidian.
2. Open the Plan Editor for that plan.
3. See §60's five shell regions: toolbar, layers panel, canvas, inspector, status bar.
4. See the zones drawn, each with its name and a status caption, with fills that differ by
   zone type and dash patterns that differ by status.
5. Toggle a layer off in the Layers panel and watch it disappear.
6. Pan by dragging, zoom by wheel **and** by `+`/`-`, and watch the zoom percentage and the
   world-millimetre pointer readout in the status bar.
7. Set a **PNG** background through `Set plan background` and see it under the zones.
8. Set a **PDF** background and see the page rendered — the one thing only a vault can prove
   after task A.
9. Switch Obsidian's theme, and confirm the zone colours follow **without a reload**.
10. Open two different plans in two tabs at once; confirm each has its own camera and that
    opening the same plan twice reveals one leaf rather than two.
11. Close a Plan Editor tab and reopen it; confirm the zones render identically.
12. Restart Obsidian and confirm each Plan Editor leaf reopens onto the plan it was showing.

Anything on that list which does NOT work is a slice 5 defect and should be fixed in this
work, not deferred — the suite passing is exactly why it would otherwise go unnoticed.

---

## Per-task workflow

1. Implement task A, `npm run check` green, commit.
2. Implement task B, `npm run check` green, commit.
3. `npm run test-build` and walk the twelve-item list by hand. Fix what it finds.
4. Update `CLAUDE.md` and the affected task docs in the same commit as the code they
   describe — never after.
5. Commit messages end with:
   `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Gotchas carried forward

- **Never edit files via PowerShell content cmdlets** — PS 5.1 writes a BOM and `JSON.parse`
  refuses it. Use the Edit/Write tools, or node scripts in the scratchpad directory.
  `tests/build/encoding.test.ts` refuses a BOM either way.
- **Backticks and `$` inside a `node -e '…'` string get eaten by bash.** Several comments
  were silently mangled that way this session. Use the Edit tool for prose, or a heredoc.
- **`tests/**` is NOT type-checked.** A missing type import there passes the suite silently.
- The `PostToolUse` hook runs oxlint on every Edit/Write and exits 2. It fires mid-refactor
  on intentionally incomplete states; it does not block or roll back the write.
- **`no-use-before-define` is on**: helper functions must be declared above their callers.
- **jsdom lays nothing out and has no canvas.** `tests/helpers/canvas.ts` backs it with a
  real rasterizer and `tests/helpers/layout.ts` supplies a controllable `ResizeObserver`.
  `tests/helpers/editor.ts` mounts the real editor; read all three before writing a canvas
  test.
- **Anything about appearance or layout needs `npm run harness-shot` or `test-build`.** That
  is not advice: four defects this session were green in the whole suite and obvious in a
  browser, and CLAUDE.md now lists them.
- **Prove the instrument sees something before trusting what it denies.** Two tests this
  session passed for the wrong reason and were caught only by reading — one asserted a save
  failure against a repository whose read had already refused.
- Obsidian cannot run here. `npm run harness` (`?view=plan-editor`, `?theme=light`,
  `?phone`), `npm run harness-shot`, and `npm run test-build` each cover something the
  others do not. Only `test-build` verifies appearance and any assumed API.

## Ground rules

- Do NOT use subagents, workflows, or deep research unless asked.
- Architecture layer bans are lint-enforced: `presentation → application → domain → core`;
  `infrastructure → application → domain → core`; only `plugin/` may reach everything.
  `vue`/`pinia`/`konva`/`vue-konva`/`obsidian` are banned by name in `core/`, `domain/`,
  `application/`. Nothing writes to the vault outside `infrastructure/`.
- No comment in a linted file may turn a rule off — both linters refuse suppressions, and
  `tests/build/suppressions.test.ts` plus `lint-scope.test.ts` check that claim.
- Write the guarantee to the check, never ahead of it. If a check cannot reach the whole
  claim, narrow the sentence.

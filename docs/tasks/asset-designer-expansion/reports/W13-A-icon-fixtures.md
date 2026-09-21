# Task report — W13-A (harness fixtures for the three unrendered glyphs)

Outcome: implemented
Owner / worktree / branch: W13-A / `.worktrees/ad11` / `w13a-icon-fixtures`
Base commit / candidate commit: `758e91d56` / see the integrator hand-off
Accepted contract revision: wave 13 base, `r1`
Allowed scope and shared-file leases: CREATE the three SVG fixtures; EDIT `tests/fixtures/editor-icons/README.md`, `tests/helpers/editorIconNodes.ts`, `tests/presentation/designer/designerIconToolbar.test.ts`; EDIT `src/presentation/designer/tools/designerToolIcons.ts` COMMENT TEXT ONLY; CREATE any test file under `tests/`. Nothing outside that was touched.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/fixtures/editor-icons/circle.svg` | New pinned Lucide fixture, bytes supplied by the integrator and written verbatim | yes (CREATE) |
| `tests/fixtures/editor-icons/squircle.svg` | Same | yes (CREATE) |
| `tests/fixtures/editor-icons/anchor.svg` | Same | yes (CREATE) |
| `tests/helpers/editorIconNodes.ts` | The executable half: three entries transcribed by hand from those bytes. Without it the SVG files render nothing | yes (EDIT) |
| `tests/presentation/designer/designerIconToolbar.test.ts` | The exact-set assertion re-sited, not deleted: the set is now empty and the subject is "this surface asks for no glyph the harness cannot draw" | yes (EDIT) |
| `tests/fixtures/editor-icons/README.md` | Provenance note for the three, narrowed to what the vault walk actually establishes; plus the both-halves rule and the new transcription check | yes (EDIT) |
| `src/presentation/designer/tools/designerToolIcons.ts` | Two falsified sentences corrected. **Comment text only** — proved below | yes (EDIT, comment-only) |
| `tests/helpers/editorIconNodes.test.ts` | NEW. Checks that every fixture's map entry reproduces its SVG, in both directions | yes (CREATE any test file under `tests/`) |

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| Three SVGs written verbatim, LF, no BOM, trailing newline | pass | `wc -c` gave `244 circle.svg`, `276 squircle.svg`, `334 anchor.svg`, matching the briefed counts exactly. A carriage-return count gave `0` for each. The first three bytes of `circle.svg` are `3c 73 76` (`<sv`) — no BOM | none |
| Both halves land (fixture AND map entry) | pass | The baseline run BEFORE the map entries, with all three SVG files already on disk, was **green on the old three-missing assertion** — direct evidence that an SVG alone renders nothing | none |
| The inverted assertion watched RED before and GREEN after | pass | Verbatim, both, under "Executed checks" | none |
| The re-sited case is not vacuous | pass | It asserts `icons` has `TOOLBAR_LABELS.length + SHAPE_TOOLS.length` members before asserting the missing set is empty, so a selector that reached nothing fails rather than passing green | none |
| `designerToolIcons.ts` changed comments only | pass | `git diff -U0` prints no changed line that is not a ` *` comment line; and the TypeScript compiler agrees independently — see below | none |
| Transcription is faithful to the SVG bytes | pass | `tests/helpers/editorIconNodes.test.ts`, 66 cases green, both arms watched red first; plus an independent throwaway probe over all 64 files reporting `mismatches=0` | none |
| README follows its own house style and does not overstate | pass | The new paragraph names the same pinned revision, states the walk, and narrows it to one catalogue / one machine / one date with the Obsidian version explicitly absent | none |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| Byte count of the three new fixtures | worktree | `244` / `276` / `334` | exact match to the briefed counts |
| Carriage-return count and leading bytes | worktree | `0` CRs each; first bytes `3c 73 76` | LF, no BOM |
| `npx vitest run tests/presentation/designer/designerIconToolbar.test.ts` — BASELINE (SVGs present, map entries absent, OLD assertion) | worktree | `Test Files  1 passed (1)` / `Tests  9 passed (9)` | proves the SVG half alone changes nothing |
| Same file — **RED** (NEW assertion, map entries still absent) | worktree | `AssertionError: expected [ 'anchor', 'squircle', 'circle' ] to deeply equal []` / `Test Files  1 failed (1)` / `Tests  1 failed \| 8 passed (9)` | the new assertion binds |
| Same file — **GREEN** (map entries added) | worktree | `Test Files  1 passed (1)` / `Tests  9 passed (9)` | |
| `npx vitest run tests/helpers/editorIconNodes.test.ts` | worktree | `Test Files  1 passed (1)` / `Tests  66 passed (66)` | 64 fixtures + 2 structural cases |
| Mutation: `anchor`'s `"d":"M9 11h6"` changed to `"M9 11h5"` | worktree | `FAIL … transcribes anchor.svg into the entry the renderer reads` showing `- "d": "M9 11h6"` / `+ "d": "M9 11h5"`, `Tests  1 failed \| 65 passed (66)` | the transcription arm watched red |
| Mutation: the `"circle"` entry deleted | worktree | two failures — `expected undefined to deeply equal [ { tag: 'circle', …(1) } ]` and `holds no entry without a fixture behind it`, `Tests  2 failed \| 64 passed (66)` | both directions watched red |
| Both mutations reverted | worktree | `Tests  66 passed (66)` | restored |
| `npx vitest run` over the 11 `data-icon-missing` bearers and node-map consumers (`tests/build/encoding.test.ts`, `tests/harness/indexChrome.test.ts`, `contextMenuActions`, `draftingMenu`, `shell/floatingPrimaryActions`, `stairsArrows`, `structuralCreation`, `usability/i08-taskbar`, `editorIcons`, `evidencePinSymbols`, `rotationHandleGlyph`) | worktree | `Test Files  11 passed (11)` / `Tests  101 passed (101)` | the bearer set came from a `icon-missing` / `iconMissing` grep over `tests/`, read rather than assumed |
| `npx vitest run` over `designerIconToolbar`, `designerAddRail`, `designerToolbar`, `assetDesignerRoot`, `editorIconNodes.test.ts`, `tests/harness/accessibility.test.ts` | worktree | `Test Files  6 passed (6)` / `Tests  200 passed (200)` | the accessibility scan included because three buttons now contain an `<svg>` that was previously absent |
| `npx oxlint` on the four changed `.ts` files | worktree | exit `0`, after fixing one finding it reported first: `unicorn(no-array-callback-reference)` on `FILES.map(keyOf)`, now `FILES.map((file) => keyOf(file))` | oxlint prints nothing on a clean run, so the exit code is the evidence |
| `npx eslint` on the same four | worktree | exit `0` | |
| Comment-only proof, by the TypeScript compiler rather than by a grep | worktree | `IDENTICAL after comment removal (executable text unchanged)` | `ts.transpileModule(src, { removeComments: true })` applied to `git show 758e91d56:src/presentation/designer/tools/designerToolIcons.ts` and to the working copy, outputs compared as strings |
| Independent probe: every fixture SVG against its map entry | worktree | `files=64 mapKeys=64 mismatches=0 mapKeysWithNoFile=[]` | run BEFORE the map edit it reported `mismatches=3`, all three `NO MAP ENTRY` — so the instrument was seen to fail first, then seen to pass |

## Verification not performed

- **`npm run check`, `npm run check:fast`, `npm run test:coverage`, `npm run analyze`, `npm run build`** — the brief reserves all of these for the integrator; the machine has 7.8 GB of shared RAM and a second concurrent gate produces a wrong red rather than a slow one. Coverage is CI's. **Consequence worth stating:** `eslint .` over the whole tree, the coverage floors and fallow's dead-file, duplication and dependency passes are unrun here. The four files I linted were linted individually, which is not the same claim.
- **`npm run harness` and `npm run harness-shot`** — not run, and this is the sharpest gap in the report: this card's entire visible product is what those two draw, and nobody has LOOKED at the three glyphs rendering. The suite proves the map entry is reached and that it reproduces the upstream file's nodes; it does not prove the resulting picture is a circle. `tests/helpers/editorIconNodes.test.ts` narrows the claim to exactly that, which is as far as jsdom can carry it.
- **`npm run test-build` / a live vault** — Obsidian cannot run here. The vault claim this card records was made by the repository owner on 2026-09-21 at `c6d0f893c`; I did not re-verify it and could not.
- **Fetching the SVG bytes from Lucide** — deliberately not done; the brief states the integrator fetched and verified all three at the pinned revision (HTTP 200 each) and instructed me not to repeat it. Provenance in this report therefore rests on the integrator's fetch. The new test checks internal consistency only — that the map matches the file on disk, never that the file matches what Lucide serves.
- **The Obsidian version behind the vault walk** — not captured by the walker and not recoverable here. Both the README paragraph and the `designerToolIcons.ts` docblock say so in those words rather than implying a pinned claim.
- **Whether `data-icon-missing` disappearing changes any captured PNG** — unchecked, for the same reason `harness-shot` is unrun. The three buttons previously rendered empty and now render a glyph, so at least the asset-designer captures will differ; there is no baseline to diff against in this repository, so that is a visual review at the integrator's discretion rather than a gate.

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: `tests/helpers/obsidianIcons.ts`'s test-only `setIcon` is the only reader of the node map; production `HostIcon.vue` calls Obsidian's own `setIcon` and is untouched. No fixture path is bundled, and no executable line of `src/` changed.
Undo/no-op/conflict/failure coverage: not applicable — no command and no reversible write in this change.
Identity/unit/quantity/calibration invariants: untouched.
Shared root/runtime/locales wiring still required: none. No new string, no registration, no dependency.
Rollback/recovery considerations: the change is additive and test-only apart from one docblock. Reverting the three map entries restores the previous missing set, and `designerIconToolbar.test.ts` would then fail loudly rather than silently — which is the property the re-siting was careful to preserve.

### One judgement the reviewer should weigh

`tests/helpers/editorIconNodes.test.ts` is **not** in the card's enumerated file list; it is created under the blanket "CREATE any test file under `tests/`" grant. It exists because the README's "mechanically transcribed" was an intention with nothing re-running it, there is no generator, and I transcribed three entries by hand — which is precisely the shape of work this repository's rules say gets a check watched failing first.

It was cheap to add only because the measurement came first: all 61 pre-existing entries already matched their SVG exactly, so the check went in green over the whole directory rather than dragging pre-existing drift into this card. Had it come out dirty I would have scoped it to the three and said so.

If the reviewer judges it out of scope it can be dropped without affecting anything else — but the docblock in `designerIconToolbar.test.ts` cites it by name, so that citation has to go with it.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

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
| `tests/helpers/obsidianIcons.test.ts` | NEW, fix round F1. Pins the fake's `data-icon-missing` write, which this change had left as the tree's only unpinned producer | yes (CREATE any test file under `tests/`) |

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| Three SVGs written verbatim, LF, no BOM, trailing newline | pass | `wc -c` gave `244 circle.svg`, `276 squircle.svg`, `334 anchor.svg`, matching the briefed counts exactly. A carriage-return count gave `0` for each. The first three bytes of `circle.svg` are `3c 73 76` (`<sv`) — no BOM | none |
| Both halves land (fixture AND map entry) | pass | The baseline run BEFORE the map entries, with all three SVG files already on disk, was **green on the old three-missing assertion** — direct evidence that an SVG alone renders nothing | none |
| The inverted assertion watched RED before and GREEN after | pass | Verbatim, both, under "Executed checks" | none |
| The re-sited case is not vacuous | pass, after F1 | It asserts the element count before asserting the missing set is empty, which covers the selector axis; the ATTRIBUTE axis was still open and is now pinned by `tests/helpers/obsidianIcons.test.ts` | none |
| `designerToolIcons.ts` changed comments only | pass | `git diff -U0` prints no changed line that is not a ` *` comment line; and the TypeScript compiler agrees independently — see below | none |
| Transcription is faithful to the SVG bytes | pass | `tests/helpers/editorIconNodes.test.ts`, 65 cases green after F3 removed its redundant floor case (66 before), both arms watched red first; plus an independent throwaway probe over all 64 files reporting `mismatches=0` | none |
| README follows its own house style and does not overstate | pass | The new paragraph names the same pinned revision, states the walk, and narrows it to one catalogue / one machine / one date with the Obsidian version explicitly absent | none |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| Byte count of the three new fixtures | worktree | `244` / `276` / `334` | exact match to the briefed counts |
| Carriage-return count and leading bytes | worktree | `0` CRs each; first bytes `3c 73 76` | LF, no BOM |
| `npx vitest run tests/presentation/designer/designerIconToolbar.test.ts` — BASELINE (SVGs present, map entries absent, OLD assertion) | worktree | `Test Files  1 passed (1)` / `Tests  9 passed (9)` | proves the SVG half alone changes nothing |
| Same file — **RED** (NEW assertion, map entries still absent) | worktree | `AssertionError: expected [ 'anchor', 'squircle', 'circle' ] to deeply equal []` / `Test Files  1 failed (1)` / `Tests  1 failed \| 8 passed (9)` | the new assertion binds |
| Same file — **GREEN** (map entries added) | worktree | `Test Files  1 passed (1)` / `Tests  9 passed (9)` | |
| `npx vitest run tests/helpers/editorIconNodes.test.ts` | worktree | `Test Files  1 passed (1)` / `Tests  66 passed (66)`, now 65 after F3 | 64 fixtures + structural cases |
| Mutation: `anchor`'s `"d":"M9 11h6"` changed to `"M9 11h5"` | worktree | `FAIL … transcribes anchor.svg into the entry the renderer reads` showing `- "d": "M9 11h6"` / `+ "d": "M9 11h5"`, `Tests  1 failed \| 65 passed (66)` | the transcription arm watched red |
| Mutation: the `"circle"` entry deleted | worktree | two failures — `expected undefined to deeply equal [ { tag: 'circle', …(1) } ]` and `holds no entry without a fixture behind it`, `Tests  2 failed \| 64 passed (66)` | both directions watched red |
| Both mutations reverted | worktree | `Tests  66 passed (66)` | restored |
| `npx vitest run` over the 11 `data-icon-missing` bearers and node-map consumers | worktree | `Test Files  11 passed (11)` / `Tests  101 passed (101)` | the bearer set came from an `icon-missing` / `iconMissing` grep over `tests/`, read rather than assumed |
| `npx vitest run` over `designerIconToolbar`, `designerAddRail`, `designerToolbar`, `assetDesignerRoot`, `editorIconNodes.test.ts`, `tests/harness/accessibility.test.ts` | worktree | `Test Files  6 passed (6)` / `Tests  200 passed (200)` | the accessibility scan included because three buttons now contain an `<svg>` that was previously absent |
| `npx oxlint` on the changed `.ts` files | worktree | exit `0`, after fixing one finding it reported first: `unicorn(no-array-callback-reference)` on `FILES.map(keyOf)` | oxlint prints nothing on a clean run, so the exit code is the evidence |
| `npx eslint` on the same files | worktree | exit `0` | |
| Comment-only proof, by the TypeScript compiler rather than by a grep | worktree | `IDENTICAL after comment removal (executable text unchanged)` | `ts.transpileModule(src, { removeComments: true })` applied to `git show 758e91d56:src/presentation/designer/tools/designerToolIcons.ts` and to the working copy, outputs compared as strings |
| Independent probe: every fixture SVG against its map entry | worktree | `files=64 mapKeys=64 mismatches=0 mapKeysWithNoFile=[]` | run BEFORE the map edit it reported `mismatches=3`, all three `NO MAP ENTRY` — so the instrument was seen to fail first, then seen to pass |

## Verification not performed

- **`npm run check`, `npm run check:fast`, `npm run test:coverage`, `npm run analyze`, `npm run build`** — the brief reserves all of these for the integrator; the machine has 7.8 GB of shared RAM and a second concurrent gate produces a wrong red rather than a slow one. Coverage is CI's. **Consequence worth stating:** `eslint .` over the whole tree, the coverage floors and fallow's dead-file, duplication and dependency passes are unrun here. The files I did lint were linted individually, which is not the same claim.
- **`npm run harness` and `npm run harness-shot`** — not run, and this is the sharpest gap in the report: this card's entire visible product is what those two draw, and nobody has LOOKED at the three glyphs rendering. The suite proves the map entry is reached and that it reproduces the upstream file's nodes; it does not prove the resulting picture is a circle.
- **`npm run test-build` / a live vault** — Obsidian cannot run here. The vault claim this card records was made by the repository owner on 2026-09-21 at `c6d0f893c`; I did not re-verify it and could not.
- **Fetching the SVG bytes from Lucide** — deliberately not done; the brief states the integrator fetched and verified all three at the pinned revision (HTTP 200 each) and instructed me not to repeat it. Provenance therefore rests on the integrator's fetch. The new tests check internal consistency only — that the map matches the file on disk and that the renderer replays the map — never that the file matches what Lucide serves.
- **The Obsidian version behind the vault walk** — not captured by the walker and not recoverable here. Both the README paragraph and the `designerToolIcons.ts` docblock say so in those words rather than implying a pinned claim.
- **Whether `data-icon-missing` disappearing changes any captured PNG** — unchecked, for the same reason `harness-shot` is unrun. The three buttons previously rendered empty and now render a glyph, so at least the asset-designer captures will differ; there is no baseline to diff against here, so that is a visual review at the integrator's discretion rather than a gate.

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: `tests/helpers/obsidianIcons.ts`'s test-only `setIcon` is the only reader of the node map; production `HostIcon.vue` calls Obsidian's own `setIcon` and is untouched. No fixture path is bundled, and no executable line of `src/` changed.
Undo/no-op/conflict/failure coverage: not applicable — no command and no reversible write in this change.
Identity/unit/quantity/calibration invariants: untouched.
Shared root/runtime/locales wiring still required: none. No new string, no registration, no dependency.
Rollback/recovery considerations: the change is additive and test-only apart from one docblock. Reverting the three map entries restores the previous missing set, and `designerIconToolbar.test.ts` would then fail loudly rather than silently — which is the property the re-siting was careful to preserve.

### The judgement flagged for the reviewer, and how it was settled

`tests/helpers/editorIconNodes.test.ts` was created under the blanket "CREATE any test file under `tests/`" grant rather than being enumerated, and was flagged here rather than slipped in. The independent reviewer judged it on merit and kept it: it duplicates no existing instrument (`editorIcons.test.ts` checks name-to-entry existence, `HostIcon.test.ts` checks rendering, and neither compares an entry to its file), `tests/helpers/*.test.ts` is an established siting with twelve siblings, it parses rather than greps, and both reported mutations genuinely bind because `toEqual` on arrays checks order.

## Fix round (six items)

**F1 — CODE, and the only one that was a defect rather than wording.** Emptying the expected set in `designerIconToolbar.test.ts` was correct, and it also removed the tree's LAST positive producer of `data-icon-missing`. Every remaining assertion about that marker anywhere in `tests/**` is a negative — `toBeUndefined()`, `exists()).toBe(false)`, `toEqual([])` — so deleting `parent.dataset.iconMissing = canonicalName` from `tests/helpers/obsidianIcons.ts` (keeping the `return`, so the fake still draws nothing) left the coordinator's 10-file batch at `Tests  197 passed (197)`. Eight cases vacuous at once, nothing red. My own comment claimed the selector guard was "the one way this case could go green by failing", which was a false "only": it covers the selector axis and not the attribute axis.

Fixed at **`tests/helpers/obsidianIcons.test.ts`**, a new file beside the module that produces the marker — not inside `editorIconNodes.test.ts`, which the reviewer offered. Reasoning: the claim is about what the RENDERER does with a name the map does not answer, and the mirror convention means the next person to touch that line opens the file named after it; siting it in the map's test would bind the check to the producing code by luck rather than by name. It also puts the guard on the PRODUCING side, where a later wave that legitimately empties a consumer cannot carry it off again — which is exactly how this hole opened.

Two cases. An unknown name must be marked AND draw nothing — both halves in one case, since either alone passes against a fake that breaks the other. And a known name on the SAME element must clear the mark and replay the map entry; the same element deliberately, because that pins `delete parent.dataset.iconMissing`, the producer's other half, which a fresh element cannot see. What it renders is compared against `editorIconNodes` rather than a transcribed literal, so this file says "the renderer replays the entry" and `editorIconNodes.test.ts` says "the entry is the SVG": the two chain from the pinned file to the DOM, and neither alone does.

The comment in `designerIconToolbar.test.ts` now names the axis it does NOT cover and points at the new file, and its docblock records that this case reads an absence and what that cost.

**F2** — `tests/fixtures/editor-icons/README.md` still said "the generated node map". It is line-wrapped between "node" and "map", which is why my own grep missed it. Dropped. `grep -rn "editorIconNodes" scripts/` exits 1 with no output, and the word now appears nowhere in any file this diff touches.

**F3** — `reaches the fixture directory at all` deleted. It was redundant against `holds no entry without a fixture behind it`, which compares the full key set to the full file list and so already fails loudly for any under-reaching glob, including the one-survivor case the deleted docblock argued about. The argument moved into that case's docblock, where it is true of an assertion that exists; the hand-maintained `>= 64` is gone.

**F4** — the by-hand claim was wider than the command under it. `grep -rn editorIconNodes scripts/` is scoped to `scripts/` and cannot see the METHOD. Repository-wide there IS a throwaway `node -e` recipe in `docs/superpowers/plans/2026-09-10-editor-copy-paste.md`, verified at that path, and it is regex-based. So "mechanically" named something real. The docblock says that now, says what the word still did not name — anything that re-runs — and says that the recipe's instrument is the regex-over-source-text this repository bans.

**F5** — two stated-but-unheld properties named as blind spots. `toEqual` compares plain objects by key SET, so attribute ORDER is not checked; harmless, because SVG attribute order is semantically inert and `setIcon` replays through `setAttribute` either way, but the property was stated and not held. And the comparison is one level deep, so a fixture carrying a nested `<g>` would compare equal while `setIcon` dropped its contents; all 64 fixtures are flat, so that is latent, and the docblock says the day it stops being latent is the day `setIcon` needs the recursion first. `fixtureNodes`'s own docblock no longer claims source order.

**F6** — taken. `basename(file, '.svg')` replaces two `file.replace()` calls; that file now contains no regular expression at all.

## Fix-round checks

| Command or manual action | Result | Evidence |
|---|---|---|
| The coordinator's exact mutation (delete the `dataset.iconMissing` write, keep the `return`), then `npx vitest run tests/helpers/obsidianIcons.test.ts` | **RED** | `FAIL … the harness setIcon > marks a name the map does not answer, and draws nothing in its place` / `AssertionError: expected undefined to be 'not-a-pinned-fixture' // Object.is equality` / `Tests  1 failed \| 1 passed (2)` |
| The same mutation against the coordinator's own 10-file batch plus the new file | **RED, in exactly one place** | `Test Files  1 failed \| 10 passed (11)` / `Tests  1 failed \| 197 passed (198)` — their all-green 197 is now 197 passed and 1 failed, and the failure is the new guard |
| Mutation reverted with `git checkout --`, same 11 files | green | `Test Files  11 passed (11)` / `Tests  198 passed (198)`; `git status` clean for `tests/helpers/obsidianIcons.ts` and the line back in place |
| `npx vitest run` over the three touched test files | green | `Test Files  3 passed (3)` / `Tests  76 passed (76)` — 65 + 2 + 9, the 65 reflecting F3 |
| `npx oxlint` and `npx eslint` over the five changed or created `.ts` files | exit `0` each | |
| Comment-only proof re-run after the fix round | holds | `IDENTICAL after comment removal (executable text unchanged)` |

**Unchanged from the first round:** every item under "Verification not performed" still stands, and the fix round added no new gate. `harness` and `harness-shot` remain unrun and remain the sharpest gap — nobody has looked at the three glyphs rendering.

## Reviewer and integrator acceptance

Reviewer outcome and findings: APPROVE WITH CONDITIONS (first round) — transcription exact including node order, counts exact, encoding clean, lease held; six items returned, all addressed above.
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

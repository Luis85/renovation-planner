# Task report — W15-B (AD15 matrix row U05)

Outcome: implemented, with one U05 clause narrowed and its refusal written down
Owner / worktree / branch: W15-B / `.worktrees/ad10` / `w15b-recover-not-lose`
Base commit / candidate commit: `098067d3c` / see the wave-15 integration queue
Accepted contract revision: `r1`
Allowed scope and shared-file leases: two files, both CREATE, both named after this card. No
`src/`, no `tests/`, no suite file, no matrix, no `DECISIONS.md`, no `state.json`.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `docs/tests/cases/Recover an asset design rather than lose it.md` | The manual case discharging AD15 scenario U05 | Yes — CREATE, named in the lease |
| `docs/tasks/asset-designer-expansion/reports/W15-B-recover-not-lose.md` | This report | Yes — CREATE, named in the lease |

Nothing else was written. `git diff --name-only 098067d3c..HEAD` prints exactly these two paths.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| U05 — "open the same definition in two leaves, make conflicting changes" | Deferred to W15-A by design | The case names [[Two designers on one asset]] and states plainly that it does not repeat it, on the `Calibrate a sheet and reserve space` precedent | None. Step 17 reaches the same conflict machinery through a hand edit rather than a second leaf, which is stated in the row and in *Deliberately NOT checked* |
| U05 — "fail a write" | Walkable, three distinct pictures | Fault 1, steps 2 to 6. Primary is the OS read-only attribute on the `.rpgeo`; two alternatives produce different outcomes and are recorded as such | The primary rests on an unverified host claim: whether Windows' read-only bit makes `Vault.modify` throw. Named in the case's *Why a human* list, item 1 |
| U05 — "separately fail post-write refresh" | **NARROWED** — the sequence is unwalkable, the state is walkable | Fault 2's derivation; steps 7 to 13 | The exact sequence (our write lands, our read-back fails) has no hand-applied fault. Reasons below |
| U05 — "attempt undo while an earlier write is unsettled" | Walkable | Steps 14 to 16 | None |
| U05 — "close/reopen a leaf" | Walkable | Steps 21 to 24 | None. Step 24 covers `rebind`, which is the same mechanism a settings save reaches |
| U05 — "delete/move a note externally" | Walkable, and the two are different pictures | Steps 26 (move: nothing changes) and 27 to 30 (delete: the missing panel, and the orphan) | None |
| U05 — "verify visible outcomes, stable IDs, no repeated mutations" | Walkable | Steps 31 and 32, counted on disk | None |
| U05 — "recovery instructions" | Walkable, and the finding is that there mostly are none | Steps 18 (one path has copy, the other has two words) and 20 (a judgement) | None. Step 20 is deliberately `judgement` |
| C08 — "plugin unload" (not in U05's own sentence) | **In scope**, one step | Step 25, with the in-scope decision and its two reasons stated in the case's own prose | None |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/designerRefresh.test.ts tests/presentation/designer/designerWriteChain.test.ts tests/presentation/designer/assetDesignerRoot.test.ts` | `098067d3c`, Windows, worktree `ad10` | 0 — 3 files, 57 tests passed | Every `suite` row citing those three files |
| `npx vitest run tests/infrastructure/obsidian/repositories/assetGeometrySidecar.test.ts tests/presentation/designer/assetDesignerView.test.ts tests/application/editor/reversibleAssetDesignWindows.test.ts tests/presentation/designer/designerCrossLeaf.test.ts` | same | 0 — 4 files, 77 tests passed | The remaining cited cases |
| Read each cited case body rather than only its name | same | The assertion in each matches what its row claims | `designerRefresh` 233/312/343/555/652, `designerWriteChain` 167, `assetDesignerRoot` 483, `assetGeometrySidecar` 189/200/595 were read in full |
| `ls tests/infrastructure/obsidian/repositories/` | same | 41 files; no orphan-after-external-delete case among them | Step 30's "asserted by nothing" claim |
| Verdict census over the finished file | same | 32 steps: `suite` 8, `browser` 1, `obsidian` 22, `desktop` 0, `judgement` 1 | `grep -c` over the step table |

## Verification not performed

- **No step in the case has been walked in a vault.** `npm run test-build` was not run, Obsidian
  was not opened, and no fault was applied to a real file. Every `obsidian` row is an expectation
  derived from module source and its English copy. The Runs table says so in those words.
- **The OS read-only attribute was not tried against Obsidian's vault adapter.** Three steps (2, 3
  and 19) rest on `Vault.modify` throwing for a read-only file. `AssetGeometryStore.writeText`
  catches whatever it throws; that it throws at all is unverified on either platform, and the
  attribute does not mean the same thing on Windows and macOS.
- **Whether Obsidian raises `modify` for an externally edited `.rpgeo` was not tried.** The whole
  of fault 2 and step 17 depend on it. `registerExtensions(['rpgeo'], GEOMETRY_SIDECAR_VIEW)` shows
  Obsidian knows the extension; it does not show the file watcher reports it.
- **The 500 ms debounce was not timed.** The case says "about two seconds" throughout, from
  `VaultChangeAdapter`'s `debounceMs ?? 500` plus a read. Nobody has measured what it feels like.
- **No harness capture was taken.** `npm run harness-shot` was not run. It could not discharge any
  of these rows anyway: the vendored `app.css` declares no `.notice` and no `.notice-container`
  rule at all, so every toast this case expects is outside it, and the stale notice has no harness
  fixture that sets `stale`.
- **`npm run check`, `check:fast`, `test:coverage`, `analyze` and `lint` were not run**, per the
  brief. This card wrote Markdown only; no linter or gate covers `docs/`.
- **No accessibility check of the stale notice or the missing-asset panel.** Both are inside
  `contentEl` and therefore inside `accessibility*.test.ts`'s scope in principle; whether any
  fixture reaches them was not measured, and no row claims it.
- **Step 32's revision arithmetic was not simulated.** The step tells the walker to count landed
  writes from the steps; the expected number was not computed here, because it depends on how many
  drags the walker actually makes in steps 14 and 16.
- **The two `.rpgeo` corruption variants were not applied to a real file.** Their error codes and
  categories come from reading `AssetGeometryStore.readUnlocked` and from
  `assetGeometrySidecar.test.ts`'s two matching cases, which were run.

## The U05 clause that was narrowed, and the code that narrows it

**"Separately fail post-write refresh" has no hand-reproducible fault for the SEQUENCE it names.**

- `GetAssetDesignQuery.execute` reads exactly two resources: `assets.getById(assetId)` and
  `geometry.read(assetId)`. Nothing else.
- Every geometry write reads **both of them first**. `updateAssetShape` opens with the asset-first
  `assets.getById` check (the function `CalibrateAsset` shares since Task B6), and
  `AssetGeometryStore.write` opens with `readUnlocked` inside the asset's own queue. The second
  half is pinned by `assetGeometrySidecar.test.ts` *"refuses to overwrite a sidecar it cannot
  read"*, which was run.
- Therefore **there is no resource the read-back touches that the write has not already read**.
  Any fault applied to either one refuses the write, and what you observe is C08's "failed"
  outcome, not its "written but stale" one.
- The remaining theoretical door is `GetAssetDesign`'s own `dimensionsOf` derivation, which can
  refuse a clearance whose span overflows while `validateAssetShape` accepts it. That is not
  hand-applicable: the shape was validated by the write moments earlier.
- And there is no window to reach into between the two: `withStateRefresh` makes the write and its
  read-back one queued unit, wrapped into the chain in `runtime.ts`.

**What IS walkable is the STATE.** `createAssetDesignChangeSource`'s fourth arm subscribes the leaf
to `GeometrySidecarChanged`, which `VaultChangeAdapter.announceSidecar` publishes for any `.rpgeo`
write this plugin did not make. A hand edit that makes the file unreadable provokes `refresh()`
over a design that is still drawn, `keepPreviousOnFailure` holds it, and `AssetDesignStore` sets
`stale` — the same field, the same notice, the same header. Steps 7 to 12 walk that, and the case
says in its own fault-setup section that the sequence is not being tested and that no row claims it
was.

**This is not the route the integrator's brief suggested.** The brief proposed the peer-provoked
re-read (`runtime.ts`'s `onDesignChanged`) and noted it "would make this clause depend on two
leaves after all". It does not have to: the sidecar arm of that same subscription is reached by a
text editor, so the clause stays in one leaf and off W15-A's lease.

## Where I disagree with the brief

Two corrections and one addition. Both corrections were reached by reading the code the brief
pointed at.

1. **"A failed sidecar write produces exactly one visible change: the header label reads
   `Save error`. No toast" is true of ONE of the three write failures, not of write failures.**
   `reportDispatchFailure` asks `affectsSaveState` after `isTechnicalFault`, and `affectsSaveState`
   treats `Validation`, `Domain`, `Reference` and `Calculation` as pre-write. Of the faults a hand
   can apply to an asset's two resources:
   - read-only `.rpgeo` → `asset-geometry.write-failed`, `Persistence` → **`Save error`, no
     toast**. This is the brief's picture.
   - corrupt JSON → `asset-geometry.corrupt`, `Persistence` → same picture.
   - `"schemaVersion": 99` → `asset-geometry.schema-invalid`, category **`Validation`** (read it at
     `AssetGeometryStore.readUnlocked` — it is a bare object literal, not a `persistenceError`) →
     **a toast** reading `error.category.validation`, "This data is not in the expected form.", and
     **no `Save error` at all**.
   - deleted note → `asset.not-found`, `Reference` → a toast, as the brief says.
   The brief named the `schemaVersion` variant as a candidate for the READ fault and did not
   mention that it also changes the WRITE picture. Step 5 walks it for exactly that reason.

2. **`runtime.ts`'s `writesBlocked` comment carries a false premise, and the brief was right to ask
   me to check it.** The option is `writesBlocked: () => false` under a comment reading *"this
   surface has no `ProjectStore` and no re-read that can go stale over an asset's own design"*. The
   first half is true. The second is false: `assetDesignStore.stale` exists, is set on the
   keep-previous arm, and `AssetDesignerRoot` draws `designer.refresh-failed` from it. **The
   BEHAVIOUR is correct and deliberate** — this surface is not meant to pause writes, and
   `designerRefresh.test.ts` *"answers false for writesBlocked, which this surface builds but never
   asks"* pins it — so the defect is the sentence, not the value. Recorded in step 10's *exists to
   catch* column as belonging to the package's findings rather than to the step. **This is a `src/`
   comment fix and is the integrator's, not mine.**

3. **A third observation the brief did not name, offered as a finding rather than a hole.** The
   mapped sentence for a conflicted write is unreachable on both editing surfaces.
   `asset-geometry.external-modification` and `asset-geometry.revision-conflict` are
   `WRITE_BOUNDARY_CODES`, so `affectsSaveState` answers true and `reportDispatchFailure` routes
   them to `surfaceError(..., { kind: 'autosave-write' }, AUTOSAVE_SINKS)` — whose `saveState` door
   is `() => undefined`. So `error.suffix.external-modification`, *"This entry was edited outside
   the plugin. Reload and try again."*, exists in the locale table and reaches nobody; the user
   gets two words. This is design slice 17's deliberate one-widget rule and I am **not** proposing
   it be changed — but it is the direct answer to U05's "recovery instructions" clause, so step 18
   records it as what the build does and step 20 asks a human whether two words are enough.

**Everything else in the brief that I relied on, I re-verified and it held**: the two VERIFIED
items (the `SaveStateIndicator` hole and `unrecoveredWrite` being drawn nowhere), the queued-undo
behaviour, the press-and-hold buffering, `getState` persisting `{ assetId }` and nothing else, the
move-versus-delete asymmetry, the `undo.superseded` path, and the orphan. On the orphan I did run
`ls` on `tests/infrastructure/obsidian/repositories/` as instructed: 41 files, none asserting that
an externally deleted note leaves its `.rpgeo`. The claim is a derivation from two modules
(`ObsidianAssetRepository.delete`'s `alsoRemove`, and `VaultChangeAdapter` writing no files at all)
and step 30 says so.

## Things belonging to the integrator

- **A `src/` comment fix**: `runtime.ts`'s `writesBlocked` premise, item 2 above. One sentence.
- **Suite file**: `docs/tests/suites/Smoke Test the Editor.md`'s `## Cases` list needs
  `[[Recover an asset design rather than lose it]]`, and its five-tier census needs re-deriving by
  grep. This card's contribution is **32 rows: `suite` 8, `browser` 1, `obsidian` 22, `desktop` 0,
  `judgement` 1** — re-derive it rather than adding these numbers, per that file's own rule.
- **Matrix**: `reports/AD15-validation-matrix.md`'s U05 row now has a case file. Note when grading
  it that U05's "fail post-write refresh" clause is **narrowed, not discharged** — the state is
  walkable, the sequence is not, and the case says so in its own words.
- **Cross-card**: this file wikilinks `[[Two designers on one asset]]` (W15-A). If that card ships
  the file under a different name the link needs updating; the two also both touch step 17's
  subject from opposite sides and it may be worth one look that they do not contradict each other.
- **Possible future step**: whether `unrecoveredWrite` should be drawn on this surface at all.
  `save-state-store.ts` additionally records that `rebind` discards the flag on any settings save,
  which step 24 names — so even on the Plan Editor, where it IS drawn, the warning can vanish with
  the vault unrepaired. Not authorized work and not proposed here.

## Data and integration implications

Schema/migration change: none — documentation only.
Relevant renderer/export/revision consumers: none.
Undo/no-op/conflict/failure coverage: this file is entirely about that surface; nothing was added
to it. Steps 14, 16, 17 and 19 exercise the queued-undo, held-press, superseded-undo and
uncompensated-undo paths respectively, each against an existing test named in the row.
Identity/unit/quantity/calibration invariants: step 31 is U05's stable-id clause; step 19 is the one
place a calibration is observed failing to come back with its note.
Shared root/runtime/locales wiring still required: none.
Rollback/recovery considerations: the case's faults 1 and 2 both damage a real vault deliberately.
Its preconditions say to walk it on a vault you are willing to break; both faults are one attribute
or one character to reverse, which is why they were chosen over renaming or deleting files.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status:

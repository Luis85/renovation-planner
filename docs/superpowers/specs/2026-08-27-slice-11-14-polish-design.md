# Improvement and polishing pass — slice 11 + slice 14 review findings

**Date:** 2026-08-27
**Range reviewed:** `origin/main...HEAD` (36 commits, slice 11 error handling/diagnostics + slice 14 empty states)
**Baseline:** `npm run check` exits 0. 2515 tests pass. Statements 99.35% (4324/4352), branches 98.14% (2120/2160).

## Purpose

Close the eight defects a `/code-review` pass over the slice 11 + slice 14 range surfaced, held
as six work items (Item 6 carries the German copy), without widening any slice's surface. Five
came from the review — its four findings and its second caveat; three were found while verifying
those. Every item is either a behaviour defect or a claim promising more than its check delivers
— the class `CLAUDE.md` names first among its rules.

**All three this pass adds were found the same way**, and it is the way the review could not: by
reading the file no gate reads. `de.ts` has no automated reader at all, and the first time anyone
looked it held a reintroduced wrong word, a garbled word, and a gender disagreement between two
keys naming the same noun. That is the argument for Item 6's gate, and it is evidence rather than
assertion.

## What the review got right, and what it did not

All four findings and the second caveat confirm against the code. Two corrections:

- **The suite is not broken.** The first caveat ("all 195 test files fail with
  `__vitest_worker__` undefined") does not reproduce. There is exactly one `vitest` in
  `node_modules` (4.1.11) and the suite runs green. The reported symptom is what a
  `.worktrees/` checkout produces: a worktree carries `src/`, `tests/` and `styles/` but no
  `node_modules`, so `npx vitest` resolves a stranger and every file dies at its top-level
  `describe`. This is recorded because it dictates the execution topology below.
- **Finding 4 has two sites.** The disproved premise appears in `selectors.ts` AND in
  `content.ts`.

## The six items

### Item 1 — The Renovation Project view renders a blank pane on failure

`src/presentation/views/ViewRoot.vue` has one conditional child, `<EmptyState v-if="empty !== null">`,
and `emptyStateKey` is correctly `null` for `failed`, `loading` and `idle`. So an unreadable
project note, a vault fault, or `settings.unrecovered` produces an empty `<div>`: no message, no
notice, and `store.error` read by nobody. `PlanEditorRoot.vue`, in the same range, renders
`editor.plan-missing` / `editor.plan-failed` / `editor.loading` for exactly those statuses.

**What the view can and cannot show.** `ViewRoot` renders no project list today — there is no
`v-for` anywhere in it, because slice 17 owns the list. So this item adds message regions to a
pane that is otherwise blank, and a successful read of three projects still draws nothing. That
is unchanged and correct; it is stated here so the item is not mistaken for "render the list".

**Branch shape**, mirroring `PlanEditorRoot`: `failed` gets its own message, and everything else
that is not `ready` (`loading` and `idle`) falls to the loading copy under a `v-else`. Not a
separate arm for `idle`: it is the pre-`onMounted` tick, indistinguishable to a user from
loading, and a third arm would be an untested branch bought for nothing at this coverage
headroom.

**Done when:** `ViewRoot` branches on `failed` and not-`ready` mirroring `PlanEditorRoot`; the new
copy exists in `en.ts` and `de.ts`; `store.error` has a reader; each new arm has a test.

### Item 2 — One unreadable project note hides every project

`ObsidianProjectRepository.listAll` does `if (!one.ok) return one;`, so a single note with
`schema-version: 2` fails the whole list. This contradicts the per-entity scoping claim
`migrateNote`'s own docblock makes ("the rest of the project loads on", SDD §92 item 13). The
fail-fast is already half-inconsistent: a *vanished* note is skipped silently by `if (one.value)`.

**Chosen resolution: partial list, with the refusal surfaced.** Not the cheaper "narrow the
claim" option: the Renovation Project view is the plugin's central surface and a single stale
note must not cost the user all of it, with hand-editing YAML as the only recovery.

**The diagnostics half needs no new wiring.** `getById` already records every refusal into the
`DiagnosticsLedger` (`ObsidianProjectRepository.ts:51`), and `listAll` calls `getById`. The
refusal is recorded before `listAll` decides what to do with it.

**The trap this design exists to avoid.** If `listAll` merely skips, a vault whose only three
project notes are unreadable returns `ok([])`, and the view renders "No renovation projects yet.
Create one to get started." That is a real problem hidden behind cheerful onboarding — the
failure three separate docblocks in this codebase warn against. The partial result must
therefore carry the fact that something was skipped.

**Shape:**

- `ProjectRepository.listAll(): Promise<Result<{ loaded: Loaded<Project>[]; refused: number }, RepositoryError>>`
- The `Result` stays. No implementation produces the error arm today; the port keeps it for a
  wholesale failure, and `ListProjects`' passthrough is already covered by an existing fake
  (`tests/application/queries/listProjects.test.ts:54`). `refused` is the loop's natural
  output — increment where the code currently returns.
- Both implementations take it (`ObsidianProjectRepository`, `InMemoryProjectRepository`), and
  the behaviour is pinned in `tests/contracts/project-repository.contract.ts`, so neither
  implementation can drift from it.
- `ListProjects`, `RenovationProjectQueryServices.listProjects` and `RenovationProjectStore`
  carry `unreadable` through to the view.
- `selectRenovationProjectEmptyState` gains `unreadable` and returns `null` when it is
  non-zero: zero readable projects plus a refusal is not an empty state. This stays within
  slice 14's own rule that a selector is a function of query results — `unreadable` is one,
  unlike the `activeToolId` that rule refused.

**One existing test inverts.** `tests/infrastructure/obsidian/repositories/completion.test.ts:76`
("listAll propagates read failures") pins today's fail-fast. It becomes "skips an unreadable
note and reports it", joining the sibling case at line 85 that already skips a vanished note.
That inversion is the deliberate signal that behaviour changed.

**Deliberate narrowing: the warning is count-free.** "Some projects could not be read", not
"3 projects could not be read". A counted sentence needs interpolation, and
`t(language, key, params?)` does not exist — `strings.ts` declares two parameters and every
`en.ts` string is fixed text. That is slice 15's open item 6a, and building it here would pull
another slice's contract into a polishing pass. The per-entity detail already lives in the
diagnostics report. The store still carries a count, because `> 0` is a free read off it and a
lossy conversion to boolean buys nothing.

**Done when:** the port, both implementations, the contract test, the query, the bundle, the
store, the selector and the view all carry it; `completion.test.ts:76` is inverted; a vault of
three unreadable notes renders an error, never an empty state, and that case is tested.

### Item 3 — The schema gate blocks deletes, and the docblock denies it

`noteIo.ts`'s `migrateNote` docblock says the gate is "READ-side only" and that "every save path
... never comes through here". `trashNoteBackedEntity` (`noteEntityWrite.ts:100`) calls
`openNoteById` before `checkExpectedVersion`, so Asset and Requirement deletes do come through
it: a future-version note can be neither read nor removed from inside the plugin.

**Resolution: narrow the claim, pin it with a test. Do not change the behaviour.** Refusing to
trash a note this build cannot parse is defensible on its own terms, and the delete-resolution
abort the review worries about is unreachable anyway — the flow reads the requirement through
`getById` first and fails earlier. The defect is the false sentence, not the refusal.

**Done when:** the docblock says deletes reach the gate and are refused; a case in
`errorPaths.test.ts` pins that a future-version asset note refuses deletion, so the behaviour
is asserted rather than described.

### Item 4 — A precedence justified by a premise the repo disproves

"A plan with no background necessarily has no zones either" is false for
`create-sample-project` (five zones, no background) and for the browser harness, which refuses
a background outright on SDD §55 grounds — the two scenes this project ships. The behaviour is
intended; the stated reason is not the real one (PRD §93's onboarding order is), and no node
test covers a background-less plan *with* zones, so a "simplification" here would fail silently.

Two sites: `src/presentation/emptyStates/selectors.ts:26-28` and
`src/presentation/emptyStates/content.ts:41-45`.

**Done when:** both sentences name PRD §93 ordering as the reason and drop the false premise;
a node test asserts `noBackground` wins for a background-less plan that HAS zones.

### Item 5 — A fallow comment describing a mechanism no longer in force

`src/plugin/planEditorCommands.ts:57-62` says the explicit annotation is what keeps
`execute`/`undo` alive for fallow. The annotation is a bare `Command`, which declares only
`execute`; `guardCommand` returns only `{ execute }`; and what actually keeps the members alive
is the `fallow-ignore-next-line unused-class-member` mark inside
`ReversibleSetPlanBackground.ts`. `undo` has no production caller at all — only tests.

**Done when:** the comment describes the mark that is actually in force and states that `undo`
is test-driven only. No code change.

### Item 6 — Two defects in unchecked German copy

Both share one root cause: nothing renders `de.ts` in any gate, so its only reader is a human
who happens to look. That is why the vocabulary regression below survived the slice that
forbade it, and why the typo beside it has survived every gate since it was written.

#### 6a — A vocabulary regression, reintroduced under the note forbidding it

`de.ts:145` (slice 14's new empty-state body) calls an Asset **"Materialien"**. Forty lines
above, `de.ts:104-109` is a comment — written in German by the slice that fixed this — recording
that "Material" was wrong and that the German UI says **"Objekt"**
(`editor.inspector.requirement.asset`). Slice 14 reintroduced the exact word slice 11 removed,
in the same file, beneath the note explaining why not to. Nothing renders `de.ts` in any gate,
which is why neither the suite nor the review saw it.

**Resolution: fix the word, and add the missing gate.** A narrow test pinning the German
spelling of the domain terms against `de.ts`. This is "write the guarantee to the check" applied
to the one user-facing surface here that has no check — cheap, because it is a string scan and
not a rendering harness.

Five pinned terms, each verified against `de.ts` rather than assumed, each with the synonym the
check refuses:

| Term | Verified at | Refused synonym |
|------|-------------|-----------------|
| Objekt | `editor.inspector.requirement.asset` | Material |
| Zone | `editor.zone.default-name` | — |
| Grundriss | `editor.loading` | — |
| Anforderung | `entity.requirement.plural` | — |
| Vault | 6b's decision | Tresor |

The two terms with no refused synonym are pinned by presence, not by exclusion: there is no wrong
word in circulation for them, and inventing one to forbid would be a check written against
nothing. Stated so a later reader does not read the blank as an omission.

**Done when:** line 145 says Objekte; the check refuses each forbidden synonym; and it is watched
failing before each fix is restored — per `CLAUDE.md`'s rule that a test for an asserted
invariant is seen red first.

#### 6b — Vault is translated, and should not be

`de.ts:19` (`settings.project-folder.desc`) begins **"Tresnornder, in dem Projekt-, Grundriss-
und Zonennotizen liegen"** — a corruption of "Tresorordner", in copy a user reads in the settings
pane. It predates the reviewed range and was found while verifying 6a's terms.

**The fix is not to repair the spelling.** *Vault* is the name Obsidian itself gives the thing, so
it stays **Vault** in German rather than being translated at all — a product noun, like Obsidian
does not become Obsidian's German equivalent. That decision is the user's, taken during review of
this spec, and it widens the item from one word to five:

| Line | Key | Today |
|------|-----|-------|
| 19 | `settings.project-folder.desc` | `Tresnornder, …` |
| 27 | `plan.none` | `In diesem Tresor …` |
| 75 | `editor.plan-failed` | `… aus dem Tresor gelesen …` |
| 99 | `vault.unexpected-failure` | `Das Tresor …` |
| 130 | `error.category.persistence` | `Der Tresor …` |

Each corresponds to an `en.ts` string saying "vault", so the five are one decision, not five.

**A second defect falls out of the table, and it is why the table exists.** Line 99 says **"Das
Tresor"** and line 130 says **"Der Tresor"** for the same noun — one of them is wrong, since
*Tresor* is masculine. Fixing the spelling at line 19 alone would have left a gender error two
keys away, unnoticed for the same reason as everything else in this item: nobody reads `de.ts`.
Adopting *Vault* rewrites both articles rather than correcting one and preserving the other.

**Done when:** no German string translates Vault; the five sites above read consistently; the
`Das`/`Der` disagreement is gone as a consequence rather than as a separate patch.

**This one IS coverable — but not by the mechanism 6a uses, and the difference is measured.**
Adding *Tresor* to 6a's forbidden-synonym list catches four of these five sites and sails past
the fifth: `'Tresnornder…'.includes('Tresor')` is `false`, so the garbled word — the one that
started this item — is invisible to the row written to forbid it. A ban on a synonym only
refuses the wrong word somebody thought of.

The check that does hold it asks from the English side instead: **wherever `en.ts` says "vault",
`de.ts` must say "Vault".** That refuses any translation of the term, including a misspelled one
and including one nobody predicted, and it reports all five sites. Both cases go in — the
synonym row names the specific wrong word for a clear failure message, the English-side row is
what actually closes the class.

An earlier draft of this section claimed the synonym row covered 6b. It did not, and the claim
was written before the check was measured — the exact defect this pass exists to close, one
level up.

## Execution topology

**Two agents. Not six.** Items 1, 2 and 4 all touch `selectors.ts`, and item 6's fix is the very
line item 1 edits the neighbourhood of. Fanning them out is four agents racing on two files.

- **Agent 1 — the behaviour change.** Items 2 -> 1 -> 4 -> 6, strictly in that order; each
  step's contract is the next step's input. Owns: `ProjectRepository.ts`,
  `ObsidianProjectRepository.ts`, `InMemoryProjectRepository.ts`, `ListProjects.ts`,
  `renovationProjectQueries.ts`, `RenovationProjectStore.ts`, `emptyStates/selectors.ts`,
  `emptyStates/content.ts`, `views/ViewRoot.vue`, `locales/en.ts`, `locales/de.ts`, and the
  tests for all of them.
- **Agent 2 — the honesty fixes.** Items 3 and 5, concurrent with Agent 1. Owns: `noteIo.ts`,
  `noteEntityWrite.ts`, `errorPaths.test.ts`, `planEditorCommands.ts`. Disjoint from Agent 1.

**No worktrees.** A worktree has no `node_modules`, which is precisely the phantom broken suite
the review reported. The two file sets are disjoint, so the isolation a worktree buys is not
needed and its cost is a whole agent's test run reporting nonsense.

## Gate discipline

Branches sit at **98.14% against a floor of 98.00** — about three uncovered branches of headroom
across the entire pass, at 0.046pp each. Item 1 alone adds three or four arms.

- Neither agent runs `npm run check`. A partial change measured against the floors answers a
  question only the assembled result can answer, and four gate runs cost twenty minutes to do it
  wrongly.
- Each agent runs targeted `npx vitest run <paths>` and `npx vue-tsc --noEmit`.
- The full `npm run check` runs **once**, at integration, by the orchestrator.
- **Every new conditional arm ships with its test in the same task.** At this headroom an
  untested arm does not dent coverage, it fails the build.
- Coverage ratchet decided at integration, per `vitest.config.ts`'s policy: floors rise only to
  what a finished increment measures.

## Verification beyond the gate

- **`tests/harness/accessibility.test.ts`** grades the project surface. Item 1's new error and
  warning regions are the first non-empty-state markup that view has had; the warning region
  takes the same `role="status"` `PlanEditorRoot` uses, and the case awaits `flushPromises()`
  before scanning, as slice 14 established.
- **No harness capture covers the new states.** The bare harness root draws the project view,
  but `failed` and `unreadable > 0` are not reachable there without a new URL knob, which this
  pass does not add. Stated rather than implied: appearance of the two new regions is unverified
  by any automated instrument, and `npm run test-build` in a live vault is where it gets looked
  at.

## Out of scope

- String interpolation (`t(language, key, params?)`) — slice 15's open item 6a. See Item 2's
  narrowing.
- `EntityId` format validation at the index boundary — named in `diagnostics.ts` as a separate
  change and not claimed here.
- Running the schema gate on the save side (four call sites) — `noteIo.ts` already scopes this
  as a narrowing rather than a live defect; Item 3 does not close it.
- Any harness URL knob for the new project-view states.

## Amendments made during execution

Recorded here rather than by rewriting the sections above, so the design and what the
measurement did to it stay separately readable.

1. **The selector's widening moved from Item 1's task to Item 2's.** `RenovationProjectStore`
   calls `selectRenovationProjectEmptyState(projects, unreadable)`, so leaving the second
   parameter to the view task would have committed a `TS2554`. Item 2's own Shape list already
   placed the selector change with the carry-through, so this follows the spec rather than
   departing from it.

2. **"`tests/harness/accessibility.test.ts` grades the project surface" was FALSE of the new
   regions when written, and is now half true.** That case pins its scanned DOM to the
   `ready`/no-projects path (it asserts `.rp-empty-state` is present), so neither
   `.rp-view-message` nor `.rp-view-notice` was in any scanned subtree — a green true of a
   subtree that does not contain the markup, which is the same shape slice 14 recorded. A case
   scanning the FAILED state was added, with a presence assertion on `.rp-view-message` and
   watched failing. **`.rp-view-notice` is still graded by nothing**: it lives inside
   `<template v-if="status === 'ready'">` while the message is its `v-else` sibling, so one
   mount cannot render both and covering it needs a second fixture. Not added.

3. **Item 3's docblock repair exposed one more false claim, one file away.** The new
   `strings.ts` docblock said `currentLanguage()` is the one resolution point and "no call
   site re-decides it", while `notifyError` in `presentation/notices/notify.ts` called
   `getLanguage()` itself — `trError`'s body, inlined. Closed by making the sentence true
   (`notifyError` dispatches through `trError`) rather than by narrowing it; `strings.ts` now
   holds the only live `getLanguage()` call in `src/`.

4. **Item 4's deliberate-red step named the wrong case, and the plan's prediction was wrong
   for a reason worth keeping.** Reordering the two `if`s in `selectPlanEditorEmptyState`
   changes the outcome only when BOTH conditions hold — the `zones: []` input — so
   `it('still asks for a background when the plan already has zones')` cannot redden under a
   reorder. The mutation that matches the claim is DROPPING the background arm, which is the
   simplification the false premise actually licenses. Both facts are now written into the
   test comments, from the measurement rather than from the prediction.

5. **Item 6's `trError` test shadowed a helper and failed the lint gate.** The spec's own
   verbatim test code declared `const error` beside the file's existing `error()` factory;
   `oxlint --deny-warnings` fires `no-shadow` on it at the repository root, which the
   per-file edit-loop invocation does not reach. Renamed to `refusal`.

6. **Item 6a specified FIVE pinned terms and TWO shipped.** `tests/presentation/i18n/strings.test.ts`
   holds *Objekt* (by refusing the synonym *Material*) and *Vault* (by requiring the term wherever
   `en.ts` says "vault"). **Zone, Grundriss and Anforderung are pinned by nothing.** The table above
   assigns them "pinned by presence, not by exclusion", and that half of the design was never built:
   presence needs a key-to-substring assertion per term, and only the two rows carrying a refused
   synonym got a row in the shipped table. Recorded here because the section's own next sentence
   says it is stated "so a later reader does not read the blank as an omission" — leaving three of
   the five silently unbuilt is exactly that blank, one level up. `CLAUDE.md` already describes the
   delivered check honestly ("pins TWO terms and nothing else"); only this spec was stale. The three
   are cheap to add, and adding them is a decision for whoever wants them rather than a debt this
   pass is claiming to have paid.

7. **Item 6b's "two keys away" was never measured, and it is wrong.** `vault.unexpected-failure`
   and `error.category.persistence` are 42 lines and 17 keys apart in `de.ts`. The claim reached
   three more files before anyone counted; all three now say what is load-bearing and true —
   two keys naming the same noun gave it two different genders — with no distance at all. The
   sentence in Item 6b above is left standing as the record of what was believed while the
   design was written, which is what this section is for.

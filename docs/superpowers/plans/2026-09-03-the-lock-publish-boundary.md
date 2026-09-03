# The lock/publish boundary, and three prose defects

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the one latent hazard the publishing increment left standing before increment 2 can safely add the first subscriber to `RequirementDeleted`/`RequirementRestored`, and make four documented claims true.

**Architecture:** The hazard is that `EventBus.publish` awaits its subscribers while a `ReferenceLocks` lock is held, so a subscriber that acquires a reference lock over an id the publishing sequence holds deadlocks unrecoverably. A pre-planning sweep (recorded below) established that publishing under a lock is the NORM in this codebase — 13 distinct publish source lines across 18 (publish x locked region) pairs — so moving publishes out of the locked region is not an available fix; it would close 3 pairs of 18 while reading exactly like a complete one. What ships instead is the RULE, stated where the lock module already states its other two, plus a two-part instrument: a behavioural pin that the constraint is live, and a discovery tripwire over subscriber modules.

**Tech Stack:** TypeScript, vitest, the existing `ReferenceLocks` / `EventBus` / delete-resolution engines.

**Spec:** `.superpowers/sdd/2026-09-03-every-undo-and-redo-announces/progress.md` (the increment ledger — its closing paragraph records this hazard as the one deliberate latent observation), plus this plan's own Measurements section, which is binding where it disagrees with any earlier framing.

---

## Global Constraints

Every one of these was learned the hard way on this branch. They apply to every task.

- **The full gate is a single-holder resource.** `npm run check` builds and tests the WHOLE tree; file-disjointness does NOT make two concurrent gates safe (two runs destroy each other's `coverage/.tmp/coverage-N.json`). Iterate with `npm run check:fast -- <subtree>` (~12s vs ~200s). Run the full gate only when the controller says `GATE`, on a quiet clean tree.
- **Never `git add -A`.** Stage explicit paths, always, including for docs-only commits. This spelling swept a concurrent agent's work into an unrelated commit on this branch.
- **Read the EXIT CODE, never the summary line.** `npm run analyze` prints `✗` glyphs on a PASSING run, and a piped gate (`| tee`) reports the PIPE's status. Capture with `; echo "EXIT:$?"`, unpiped.
- **An absence assertion must COLLECT, never THROW inside a subscriber.** `createEventBus`'s `deliver` wraps every handler in `.catch` and swallows it, so a throwing subscriber passes in both worlds. Push into an array and assert the array.
- **When a mutation reddens by CRASHING, ask what a mutation that keeps the program running would do.** A crash proves the path is reached; only a clean assertion failure proves the assertion is doing work.
- **Coverage floors are 99/99/99/98** (statements/functions/lines/branches). Functions has ~1 unit of headroom and branches ~9, so an untested arm in a slack metric hides completely — this increment shipped two that way. Read `coverage/coverage-final.json` for the CHANGED FILES rather than trusting the summary percentages.
- **Line caps count non-blank, non-comment lines** (`max-lines`, `skipBlankLines: true, skipComments: true`): 400 for `src/**`, 450 for `tests/**`. Count what the rule counts, not physical lines.
- **Do not fix anything outside your task's Files block.** Report it instead.

---

## Measurements taken before this plan was written

Every one verified at the source. An implementer may rely on these without re-deriving them, and should report it if any turns out false.

**M1 — The three sites named in the original scope, confirmed:**
- `undoDeleteResolution.ts` acquires :123, publishes :151, releases :155 (`finally`).
- `runDeleteResolution` begins its session :499, publishes :533, releases :571 (`finally`).
- `compensate` publishes :482 and is called from *inside* `runDeleteResolution`'s try (:523, :526).

**M2 — The class is far larger than three, and that is what decides this plan.** A dedicated sweep found **13 distinct `.publish(` source lines that execute under a reference lock**, in **18 (publish x locked region) pairs**. Beyond M1: `AssignAsset.ts:185` (via `createAndSave`, called inside `execute`'s locked try), `reversible-assign-asset-command.ts:177` (`redoCreate`, acquires :134 / releases :182), `UpdateAsset.ts:89`, `SetAssetPriceOverride.ts:217`, `ClearAssetPriceOverride.ts:134`, `SetAssetBackground.ts:234` and `:242`, `SetRequirementQuantityOverride.ts:143` (reached from three different locked regions), `RecalculateRequirement.ts:144`, and `cascade.ts:51`.

**M3 — One of those cannot be moved, and a prior ruling already says so.** `deleteResolution.ts:222` binds `recalculateInline` to `recalculate.execute(...)`, so `RecalculateRequirement.ts:144` and `:155` publish from *inside* the delete resolution's own locked region. Ruling 24 (V) in the ledger DECLINED buffering that command's events: it serves the geometry cascade, the price cascade and the asset-update handler, and giving it a suppressible bus for one caller changes a shared contract from inside a resolution. So publish-after-release cannot close the class even in principle.

**M4 — Only three paths deliberately publish outside the region they just held**, and each carries a comment saying why: `updateAssetShape.ts:303` (rule stated at :298-301), `CalibrateAsset.ts:195` (rule stated at :192-194), `reversible-delete-zone-command.ts:207`.

**M5 — The deadlock is real, not mere serialization.** `EventBus.publish` "is Promise-aware and AWAITS its handlers" (`EventBus.ts:18-19`, delivery at :72-79). A subscriber blocked in `LockSessionImpl.acquire` awaits `waitForRelease()`, which resolves only from `releaseAll` — which the publisher reaches only after `publish` returns. Neither side can advance.

**M6 — The rule is already universally honored and nothing states or checks it.** `grep -rn "locks\|Locks" src/application/event-handlers/ src/application/events/` returns **nothing**: no subscriber module in `src/` references `ReferenceLocks` at all. `RecalculateRequirement.ts` mentions no lock either — and CLAUDE.md already records the reason ("the resolution calls it inline while holding that very lock"). There are 19 `.subscribe(` call sites in `src/`, in exactly two directories.

**M7 — Headroom, measured with the rule's own counting (blank and comment lines skipped):**
- `src/application/reference/deleteResolution.ts` — **380 / 400**, 20 lines of headroom.
- `tests/harness/harness.test.ts` — **444 / 450**, 6 lines of headroom.
- `src/application/reference/undoDeleteResolution.ts` — 90 / 400.
- `src/application/commands/requirement/reversible-assign-asset-command.ts` — 106 / 400.
- `tests/application/reference/deleteResolutions.test.ts` — 204 / 450.

**M8 — Item 4's premise is half wrong.** The scope says the seam pointer is absent in "neither direction". Measured: `deleteResolutionAnnouncements.test.ts:14` DOES point back to `deleteResolutions.test.ts`. Only the FORWARD pointer is missing. The other split (`deleteResolutionEngine.test.ts:534` <-> `requirementResolutionSteps.test.ts:14`) is pointed at BOTH ends, and the census trio (`reversibleWritePathCensus.test.ts`, `reversibleWritePathDiscovery.test.ts`, `tests/helpers/reversibleWriteCensusTable.ts`) is fully cross-pointed. So this is ONE pointer, not two, and not four.

**M9 — Item 3's premise confirmed.** `harness.test.ts:1187` excludes `*.test.ts` from `sources()`, while `escapesTheRoots` accepts a specifier resolving inside the roots — so a scanned module importing a `*.test.ts` helper that imports a stylesheet passes vacuously. `find src tests/harness tests/helpers -name "*.test.ts" | wc -l` = **17**, none under `src/`, and none imported by a non-test module. Latent, not live.

**M10 — F4's mechanism, traced end to end.** `checkExpectedVersion` compares "revision-then-token" (`checkExpected.ts:8-9`). `noteEntityWrite.ts:98` computes `nextRevision = (currentVersion?.revision ?? 0) + 1`, and `VersionedStore.save` (:50) uses the identical expression — so the *revision* resets to 1 after a delete in BOTH stores. The two stores differ in the OBSERVATION TOKEN: `VersionedStore.mint()` is a monotonic counter, so a redo's write always mints a fresh token and a stale expected pair differs; the Obsidian repository derives `observed` from the note's own frontmatter digest, and a redo writes byte-identical frontmatter, so both halves coincide and the stale pair compares EQUAL. That is why the unfixed second undo would have SUCCEEDED in a vault and refuses only against `VersionedStore`.

---

## Not in scope — report, do not fix

Named here so that meeting one of them reads as a known exclusion rather than as this plan's defect.

- **The `recalculateInline` rollback defect** (ledger Ruling 26, finding X): a successfully-recalculated reassignment cannot be rolled back at all, because `recalculateInline` returns no revision while `applyResolutionToRequirement` records `repointAndMarkStale`'s, and the inline recalculation then saves again past it. PRE-EXISTING, raised to the user, unanswered. Its fix changes a shared `ResolutionOps` signature and the engine's progress accounting.
- **`undo.superseded` pinning the `CommandHistory` stack** — a refused undo stays on the stack and every later press refuses for the leaf's life.
- **`MigrationRunner` unproven on a real chain** — every migration table is still empty.
- **NEW, found by this plan's sweep and not previously recorded:** `SetAssetBackground.ts:234` and `:242` publish INSIDE `withLevel1`, contradicting the rule its two sibling design commands state in comments (`updateAssetShape.ts:298-301`, `CalibrateAsset.ts:192-194`). Pre-existing and out of scope; Task 1's documentation names it as a known exception rather than silently implying uniformity.
- **NEW, same sweep:** both price-override commands drag an entire awaited recalculation cascade (`cascade.ts:51` plus `RecalculateRequirement.ts:144`/`:155`) under a level-1 lock. A contention cost rather than a deadlock, pre-existing, out of scope.

---

### Task 1: The publish-under-lock rule — decide it, state it, check it

**Decision, made deliberately and recorded here rather than left to the implementer:** establish and document that **a subscriber must never acquire a reference lock**. Publish-after-release is REJECTED as the remedy, on M2/M3/M4: it would move 3 of 18 pairs, cannot touch the one inside `RecalculateRequirement` at all, and would leave a partial fix that reads exactly like a complete one at the precise moment increment 2 adds its first subscriber. The rule is also already universally honored (M6), so this states and checks an existing invariant rather than imposing a new one.

**Files:**
- Modify: `src/application/reference/ReferenceLocks.ts` — header docblock only, no behaviour change.
- Create: `tests/application/reference/lockPublishBoundary.test.ts` — the behavioural half.
- Create: `tests/application/events/subscriberLockBoundary.test.ts` — the discovery tripwire.

**Interfaces:**
- Consumes: `runDeleteResolution(ops, input, locks, markers?)` from `src/application/reference/deleteResolution.ts`; `ReferenceLocks` with its existing public `isHeld(level: 1 | 2, id: string): boolean` test seam (`ReferenceLocks.ts:166-168`); `makeOps(overrides?)` and `REQUIREMENT_IDS` — the existing rig in `tests/application/reference/deleteResolutionEngine.test.ts` (`makeOps` at :74, `entityId: 'entity-1'`, `entityKind: 'zone'`, `events: createEventBus()` at :91, `REQUIREMENT_IDS = ['requirement-1', 'requirement-2']` at :57).
- Produces: nothing any later task consumes. Adds NO production function (deliberate — functions coverage has ~1 unit of headroom).

**Rig note, binding:** `makeOps` lives in `deleteResolutionEngine.test.ts`, which is a `.test.ts`. Importing it from another `.test.ts` RE-REGISTERS and RE-RUNS that whole suite under vitest — measured on this branch (one file produced 23 tests: 1 + a full re-registration of 22). So **do not import it.** Build a local ops literal in the new file, or extract to `tests/helpers/` if you prefer sharing; do not cross-import test files.

- [ ] **Step 1: Write the failing behavioural test**

Create `tests/application/reference/lockPublishBoundary.test.ts`. The subject is that a subscriber runs while the sequence's locks are still held — which is what makes the rule load-bearing rather than theoretical. Collect readings; never throw in a subscriber.

```ts
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../../src/core/events/EventBus';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { runDeleteResolution } from '../../../src/application/reference/deleteResolution';
import { expectOk } from '../../helpers/domain';

// Build the ops literal LOCALLY — see the rig note in the plan. Importing `makeOps` from
// `deleteResolutionEngine.test.ts` would re-register that whole suite.
// Model it on that file's `makeOps` (:74): entityId 'entity-1', entityKind 'zone', and the
// per-referent closures it scripts.

describe('the reference-lock / publish boundary', () => {
  it('delivers a resolution announcement while the sequence still holds its locks', async () => {
    const locks = new ReferenceLocks();
    const events = createEventBus();
    const heldAtDelivery: { entity: boolean; referent: boolean }[] = [];
    events.subscribe('RequirementInvalidated', () => {
      // COLLECTED, not asserted here: `deliver` swallows a handler throw, so an
      // assertion inside this callback would pass in both worlds.
      heldAtDelivery.push({
        entity: locks.isHeld(1, 'entity-1'),
        referent: locks.isHeld(2, 'requirement-1'),
      });
    });

    const ops = makeLocalOps({ events });
    expectOk(
      await runDeleteResolution(
        ops,
        { resolution: 'delete-anyway', resolvedReferents: REQUIREMENT_IDS },
        locks,
      ),
    );

    expect(heldAtDelivery.length).toBeGreaterThan(0);
    expect(heldAtDelivery.every((r) => r.entity && r.referent)).toBe(true);
  });
});
```

Write the same case for `undoDeleteResolution`, whose publish loop sits at `undoDeleteResolution.ts:146-152` between the `acquire` at :123 and the `release()` at :155.

Then add the case that makes the hazard a demonstrated fact rather than an argument — a subscriber that actually reaches for the lock does not get it, bounded by a deadline so the failure is a named assertion rather than vitest's anonymous 5000ms timeout:

```ts
  it('deadlocks if a subscriber acquires a lock the sequence holds — the rule this pins', async () => {
    const locks = new ReferenceLocks();
    const events = createEventBus();
    let acquired = false;
    events.subscribe('RequirementInvalidated', async () => {
      // Exactly what the rule forbids. It never resolves: `waitForRelease` fires only
      // from `releaseAll`, which the publisher reaches only after `publish` returns.
      await locks.acquire(['entity-1'], []);
      acquired = true;
    });

    const ops = makeLocalOps({ events });
    const sequence = runDeleteResolution(
      ops,
      { resolution: 'delete-anyway', resolvedReferents: REQUIREMENT_IDS },
      locks,
    );
    const settled = await Promise.race([
      sequence.then(() => 'settled' as const),
      new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 50)),
    ]);

    expect(settled).toBe('blocked');
    expect(acquired).toBe(false);
  });
```

- [ ] **Step 2: Run them and read what fails**

Run: `npm run check:fast -- tests/application/reference/lockPublishBoundary.test.ts`

The first two cases are expected to PASS immediately — they pin behaviour that already holds, which is the point (M6: the rule is already honored; nothing stated or checked it). **That means Step 4's mutation check is the whole of their value.** Report honestly if a case passes on first run; do not present a passing case as evidence until Step 4 has shown it can fail.

The deadline case must also pass. If it reports `'settled'`, STOP and report: that would mean M5 is wrong and the whole task's premise needs re-deriving.

- [ ] **Step 3: Write the discovery tripwire**

Create `tests/application/events/subscriberLockBoundary.test.ts`. It answers the one question text can settle reliably — which modules register subscribers — and asserts none of them names the lock.

```ts
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The rule: a subscriber must never acquire a reference lock. `EventBus.publish` awaits its
 * handlers and publishing under a lock is the NORM here (13 publish sites, 18 publish x
 * locked-region pairs — see `ReferenceLocks`'s header), so a subscriber that reaches for a
 * lock the publishing sequence holds deadlocks unrecoverably.
 *
 * **What this tripwire can and cannot see.** It reads module TEXT, so it catches a subscriber
 * module that names `ReferenceLocks` directly. It is blind to a lock reached through an
 * INJECTED collaborator — a handler handed a command that locks would not name the lock
 * itself — which is the likelier shape and is why the behavioural deadline case in
 * `tests/application/reference/lockPublishBoundary.test.ts` is the backstop rather than this.
 * Stated rather than implied: an undocumented residue reads as ground nobody walked.
 */
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });

describe('subscriber modules and the reference locks', () => {
  it('finds the subscriber modules at all', () => {
    // A scan that reaches nothing looks exactly like a clean tree.
    const registrars = sources('src').filter((f) => readFileSync(f, 'utf8').includes('.subscribe('));
    expect(registrars.length).toBeGreaterThan(5);
  });

  it('no module registering a subscriber reaches ReferenceLocks', () => {
    const offenders = sources('src')
      .filter((f) => readFileSync(f, 'utf8').includes('.subscribe('))
      .filter((f) => /ReferenceLocks|withLevel1|withLevel2/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 4: Mutation-check every case — this is where their value is**

Run each mutation, record the exact failure text, then restore the tree.

1. Move `undoDeleteResolution`'s publish loop (:146-152) below the `finally`, so it publishes after release. Expected: the `undoDeleteResolution` behavioural case reddens at its assertion (`expected false to be true`), NOT by crashing. Record the message.
2. In the tripwire, add a temporary `src/application/events/probe.ts` containing both `.subscribe(` and `ReferenceLocks`. Expected: the second case reddens naming that file. Delete the probe afterwards — verify with `git status` that it is gone.
3. Break the first tripwire case's filter (search for a string no file contains). Expected: `finds the subscriber modules at all` reddens. This proves the scan is not vacuous.

If any mutation reddens by CRASHING rather than by a clean assertion failure, say so plainly and find the mutation that keeps the program running.

- [ ] **Step 5: State the rule where the lock module states its others**

Edit `src/application/reference/ReferenceLocks.ts`'s header docblock only. It currently says "The two rules the hierarchy lives on are enforced HERE, at the lock, rather than by reviewing every command that uses it — so they hold for sequences not yet written." Add a THIRD rule beneath those two, and be honest that it is the one rule NOT enforced at the lock:

- State it: **a subscriber must never acquire a reference lock.**
- State the mechanism: `EventBus.publish` awaits its handlers, so a subscriber blocked in `acquire` awaits `waitForRelease`, which fires only from `releaseAll`, which the publisher reaches only after `publish` returns. A deadlock, not contention.
- State the measured breadth as the reason the alternative is unavailable: publishing under a lock is the NORM — 13 publish source lines, 18 publish x locked-region pairs — and one of them (`RecalculateRequirement.ts:144`/`:155`, reached through `recalculateInline`, bound at `deleteResolution.ts:222`) sits inside a shared command whose event buffering was already declined. So the publishes cannot be moved out; the rule is what closes the hazard.
- State why it is NOT enforced here like its two siblings: the lock cannot see that it is inside a publish, and coupling `ReferenceLocks` to the `EventBus` to find out would be worse than the rule. Name the two instruments that do check it, by path.
- Name the known exceptions rather than implying uniformity: `updateAssetShape.ts:298-301` and `CalibrateAsset.ts:192-194` state the publish-outside-lock rule and follow it, while `SetAssetBackground.ts:234`/`:242` publishes inside `withLevel1` and does not — pre-existing, out of this increment's scope.

Do NOT overstate. The guarantee is that no subscriber module *names* a lock and that the constraint is *live*; it is not that no subscriber can ever reach one through an injected collaborator.

- [ ] **Step 6: Coverage, then gate, then commit**

The task adds no production function and no production branch, so the floors should not move. Confirm rather than assume: read `coverage/coverage-final.json` for `ReferenceLocks.ts` and check nothing regressed.

Message the controller and WAIT for the word `GATE`. Do not start `npm run check` on your own — it is a single-holder resource. When told:

```bash
npm run check ; echo "EXIT:$?"
```

Read the `EXIT:` line, not the summary glyphs. Then:

```bash
git add src/application/reference/ReferenceLocks.ts \
        tests/application/reference/lockPublishBoundary.test.ts \
        tests/application/events/subscriberLockBoundary.test.ts
git commit -m "Establish the rule that a subscriber never takes a reference lock

Publishing under a reference lock is the norm here rather than the exception
— 13 publish sites across 18 publish x locked-region pairs — and one of them
publishes from inside a shared command whose event buffering was already
declined, so moving the publishes out cannot close the class. The rule is
what closes it, stated where the lock module states its other two and pinned
two ways: a behavioural case that the constraint is live, and a tripwire
over the modules that register subscribers."
```

---

### Task 2: Four documented claims that are not true

Pure prose. No behaviour changes anywhere in this task — if you find yourself changing an expression, stop and report it.

**Files:**
- Modify: `src/application/commands/requirement/reversible-assign-asset-command.ts` (comments only, at :124-125, :167, :170-175)
- Modify: `tests/application/reference/deleteResolutions.test.ts` (docblock at :15-17 only)

**Interfaces:** Consumes nothing, produces nothing. Independent of Tasks 1 and 3.

- [ ] **Step 1: F1 — a comment implying a behavioural guard that a TYPE actually holds**

`reversible-assign-asset-command.ts:124-125` reads:

```ts
		// Only in this arm: a 'found' outcome wrote nothing, so there is nothing this
		// undo removed, and announcing here would report a deletion that never happened.
```

The reasoning is right and the framing is wrong. Verify first, then write: the `outcome` union (:82-85) gives `{ kind: 'found' }` NO `snapshot` member, and `undo` returns at :119 for that arm — so the narrowing is what makes `recorded.snapshot` legal at :122 and :127. Moving the publish above that early return does not merely fail a test, it **does not compile**. Rewrite the comment to say the guarantee is held by the discriminated union rather than by any behavioural guard — which is stronger than a test, and is the honest reason no test covers it.

Confirm the claim before writing it: `npx vue-tsc --noEmit` after temporarily hoisting the publish above :119 should report the missing property. Restore the file, and report the exact error text.

- [ ] **Step 2: F3 — a rule stated in another file's docblock and invisible at the publish site**

`reversible-assign-asset-command.ts:177-179` publishes `requirementCreated` in `redoCreate`. Why it is Created rather than Restored lives in `RequirementRestored`'s own docblock and nowhere near this code. Add one sentence at the publish site naming the rule and the evidence beside it: the save at :168 presents `'absent'`, so this is a re-creation rather than a restore of a row that was merely edited — the same split `deleteResolution.compensate` and `undoDeleteResolution` both compute.

- [ ] **Step 3: F4 — a production consequence that is unreachable in the store it implies**

`reversible-assign-asset-command.ts:170-175` currently claims the second undo's delete "would refuse as an external modification, and no RequirementDeleted would follow it". Measured (plan M10) that is true of `VersionedStore` and FALSE of the Obsidian repository. Rewrite it to name the store it was measured against, and to say why the two differ:

- `checkExpectedVersion` compares revision **then observation token** (`checkExpected.ts:8-9`).
- The *revision* resets to 1 after a delete in BOTH stores — `noteEntityWrite.ts:98` and `VersionedStore.save:50` use the identical `(current?.version.revision ?? 0) + 1`.
- They differ in the TOKEN: `VersionedStore.mint()` is a monotonic counter, so a redo always mints a fresh one and the stale expected pair differs — which is what the four-operation test actually drives. The Obsidian repository derives `observed` from the note's own frontmatter digest, and a redo writes byte-identical frontmatter, so both halves coincide and the stale pair compares EQUAL.
- So keep the fix and narrow the sentence: the unfixed second undo would have SUCCEEDED in a vault, refusing only against `VersionedStore`. The fix stays because it is the invariant `reversible-delete-zone-command.ts:200` already states and because the coincidence breaks on a stale index.

This is "write the guarantee to the check, never ahead of it" applied to a comment.

- [ ] **Step 4: The missing forward seam pointer**

Correcting the scope's premise (plan M8): the pointer is **one-way, not absent**. `deleteResolutionAnnouncements.test.ts:14` already points back. What is missing is the FORWARD pointer.

Add one sentence to `deleteResolutions.test.ts`'s docblock (:15-17) naming `deleteResolutionAnnouncements.test.ts` and what moved there (the event-announcement half), so a reader opening the reference-integrity file learns the seam exists. Match the shape `deleteResolutionEngine.test.ts:534-535` already uses for the other split — that pair is pointed at both ends and is the precedent.

Do NOT touch the census trio (`reversibleWritePathCensus.test.ts`, `reversibleWritePathDiscovery.test.ts`, `tests/helpers/reversibleWriteCensusTable.ts`) — verified fully cross-pointed already.

- [ ] **Step 5: Verify, gate, commit**

Nothing here changes behaviour, so the whole suite should be unchanged. Prove it:

```bash
npm run check:fast -- tests/application/reference
```

Then confirm the diff is comments-only:

```bash
git diff --stat
git diff | grep -E '^\+' | grep -vE '^\+\s*(\*|//|/\*)' | grep -v '^+++'
```

That last command should print NOTHING but the docblock's own added lines. If it prints an expression, you have changed behaviour in a prose task — stop and report.

Message the controller and wait for `GATE`, then:

```bash
npm run check ; echo "EXIT:$?"
git add src/application/commands/requirement/reversible-assign-asset-command.ts \
        tests/application/reference/deleteResolutions.test.ts
git commit -m "Make four documented claims true

Three in the assign adapter: an 'only in this arm' comment implying a
behavioural guard the discriminated union actually holds; a Created-over-
Restored reason that lived in another event's docblock; and a stale-revision
consequence measured against VersionedStore and untrue of the Obsidian
repository, which the sentence now names. Plus the forward half of a seam
pointer that was one-way."
```

---

### Task 3: The vacuous-pass hole in the harness closure check

**Files:**
- Modify: `tests/harness/harness.test.ts` — **budget: 444 / 450 counted lines, so SIX lines of headroom** (M7). If your tripwire does not fit, extract to `tests/helpers/` rather than compacting the file; this branch has already been through that exact decision once (ledger Ruling 10) and compaction was reversed in review.

**Interfaces:** Consumes `ROOTS` (`harness.test.ts:550`), `sources()` (:1182-1188), `scanned` (:1200) and the assertion at :1219-1226. Produces nothing.

- [ ] **Step 1: Write the failing tripwire**

The hole (M9): `sources()` excludes `*.test.ts` from `scanned`, while `escapesTheRoots` accepts any specifier resolving INSIDE the roots. So a scanned module importing a `*.test.ts` helper that itself imports a stylesheet is loaded by Vite, absent from `importers`, and the reachability assertion passes vacuously.

Build the **tripwire**, not the full import traversal that was originally proposed: fail if any file under `ROOTS` ending `.test.ts` is imported by a scanned module. Add it as one more key in the existing `toEqual` at :1219 — that assertion already reports five named lists at once and a sixth costs one line each side:

```ts
		const testHelpers = named(({ file, scans }) =>
			scans.some((scan) =>
				scan.relative.some((specifier) => importsATestFile(file, specifier)),
			),
		);
```

with the predicate resolving the specifier the same way `escapesTheRoots` does and asking whether the resolved path ends `.test.ts`. Reuse `resolvesOutsideRoots`'s resolution rather than writing a second one — a second resolver is a second chance to get the separator handling wrong, which this file has already been bitten by on Windows.

Add `testHelpers: []` to the expected object.

- [ ] **Step 2: Prove it can fail — plant a probe**

The hole is LATENT (M9: 17 such files, none imported by a non-test module), so this case passes on first run and is worth nothing until you have seen it red. Temporarily add to a scanned module under `tests/harness/` an import of one of the 17 (for example `tests/helpers/globBranches.test.ts`), run the case, and confirm it reports that importer by name.

Restore the file and confirm with `git status` that the probe is gone. Record the exact failure text in your report.

- [ ] **Step 3: Document what the tripwire does and does not close**

This file's convention is that every guard states its own blind spots — six are already written out for the discovery scan. Add the honest bound: this catches a `*.test.ts` under the ROOTS imported by a scanned module; it does not perform the full transitive traversal, so a `*.test.ts` importing a second `*.test.ts` that imports a stylesheet is still outside it. Say which, rather than implying completeness — this predicate has been found unbounded in four consecutive review rounds and an enumeration that goes stale is the same defect as no enumeration.

- [ ] **Step 4: Check the budget before gating**

```bash
npx eslint tests/harness/harness.test.ts
```

A `max-lines` failure here is the expected outcome if the tripwire ran long, and the remedy is extraction to `tests/helpers/`, never raising the cap and never deleting cases.

- [ ] **Step 5: Gate and commit**

Message the controller and wait for `GATE`.

```bash
npm run check ; echo "EXIT:$?"
git add tests/harness/harness.test.ts
git commit -m "Close the vacuous pass in the harness closure check

A *.test.ts under the roots is excluded from the scan while the closure
check accepts imports targeting one, so a stylesheet it imported would be
loaded by Vite, absent from importers, and the reachability assertion would
pass having checked nothing. A tripwire rather than a full traversal, with
the bound it does not reach written down beside it."
```

---

## Self-review

**Spec coverage.** Item 1 -> Task 1 (decided against the original default, on M2/M3/M4, with the reasoning recorded). Item 2's three findings -> Task 2 Steps 1-3. Item 3 -> Task 3. Item 4 -> Task 2 Step 4, corrected to one pointer by M8. The three out-of-scope items are named in "Not in scope" with the two new pre-existing findings the sweep added.

**Placeholder scan.** No TBDs. Every code step carries real code or a named file-and-line to edit. The one deliberate omission is the local ops literal in Task 1 Step 1 (`makeLocalOps`), which the plan cannot spell without duplicating 60 lines of an existing rig — the rig note names the model (`deleteResolutionEngine.test.ts:74`), its field values, and the reason it must not be imported.

**Type consistency.** `isHeld(level: 1 | 2, id: string): boolean` matches `ReferenceLocks.ts:166`. `runDeleteResolution(ops, input, locks, markers?)` matches `deleteResolution.ts:490-495` and the existing four-argument call at `deleteResolutionEngine.test.ts:255`. `REQUIREMENT_IDS` is `readonly RequirementId[]` (:57), which is what `resolvedReferents` takes. `createEventBus()` and `.subscribe(type, handler)` match `EventBus.ts:41`.

**Ordering.** The three tasks share no file and may be reviewed independently, but the gate is a single-holder resource, so they are dispatched and gated one at a time.

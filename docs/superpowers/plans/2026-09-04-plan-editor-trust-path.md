# Plan Editor Foundation, Increment 3 — The Trust Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Checkpoint C3 of the vertical slice: a write that lands and a read-back that fails leaves the last valid floor drawn and marked stale, refuses NEW writes at the one dispatcher (undo and redo pass), retries through the same refresh the post-command path uses, reads *Saved · refresh needed*, offers the plan's source note, and gives a failed compensation a code of its own so an unrecovered write stops calling itself compensated — closing the three Release-hardening PBIs (Recover safely, Undo and redo, Reload).

**Architecture:** `ProjectStore.stale` already exists and nothing new writes it. A fifth decorator in the dispatcher chain (`withStaleGate`) refuses `run` while stale and passes `undo`/`redo`; the post-command refresh closure becomes a named `refreshProjection` that the strip's Try again also calls, so a retry cannot carry a command by construction. *Saved · refresh needed* is derived in the indicator from `saved` plus `stale`, never a fifth `SaveState`. One `runtime.writesBlocked` and one minted reason id pause every write control as `aria-disabled` + `aria-describedby`. `ObsidianZoneRepository` returns distinct `*-uncompensated` codes (stamped `markUncompensated`) when its note restore fails; the save-state store records that as `unrecoveredWrite` and the strip draws it.

**Tech Stack:** TypeScript, Vue 3 + Pinia, Konva via vue-konva, Obsidian 1.13.0 API, vitest + jsdom + axe-core, playwright-core for captures, ESLint + oxlint, lightningcss-checked stylesheets.

**Spec:** [`docs/superpowers/specs/2026-09-04-plan-editor-trust-path-design.md`](../specs/2026-09-04-plan-editor-trust-path-design.md) — the authority when a task and a reading of the code disagree about intent; then `CLAUDE.md` ("Claims, and the checks under them", "Testing", the three plan-editor-foundation sections).

## Global Constraints

- **`npm run check` passes before every commit** (build + oxlint + ESLint + `test:coverage` + fallow), in the FOREGROUND with `timeout: 600000`, on a QUIET tree. Between edits run `npm run check:fast -- <paths>`. Two known artifacts: a single 5000 ms timeout in a `src/`-walking test, and a 60 s `beforeAll` timeout in ESLint-booting `tests/build/*` files under default parallelism — re-run the file alone before believing either.
- **Layer bans are lint rules.** `presentation → application → domain → core`; only `src/plugin/` composes. `infrastructure/` may import `application/` (it does so for `markUncompensated`). Nothing under `presentation/` names a repository class.
- **No new vault write path, no schema key, no event, no repository method.** The only `infrastructure/` change is the CODE a failed compensation returns.
- **Every dispatch funnels through the leaf's wrapped dispatcher** (`EditorRuntime.dispatcher`). The gate lives INSIDE that chain; no control checks `stale` to decide whether to dispatch — controls only decide how they LOOK, the gate decides what RUNS.
- **No user-facing string literal.** Every editor key lands in `src/presentation/i18n/locales/en/editor.ts` AND `de/editor.ts` in the same edit (`de/editor.ts` is `Record<keyof typeof editorEn, string>`); `save-state.*` and error-code copy land in `en.ts` AND `de.ts`. German is formal (Sie). Sentence case in English; a capitalised word mid-sentence fails the build.
- **`aria-disabled`, never `:disabled`, on a PAUSED control**, and always with `aria-describedby` naming the paused reason. A paused control stays focusable so its reason can be read. (Existing `:disabled` on Undo/Redo and on the reference layer's checkbox are not paused controls and stay.)
- **`max-lines` is 400** (blank and comment lines skipped) for every `src/**` file and `styles/*.css` partial. `runtime.ts` is at its cap; Task 5 MEASURES before it adds and extracts if needed.
- **Coverage floors 99/99/99/98**, headroom about one unit on functions. Every new arm ships with its test in the SAME task; read `coverage/coverage-final.json` for the changed files before calling a task done. No guard whose other arm is unreachable.
- **A test is watched failing before the code that passes it**; where a step says "mutation-check", apply the mutation, run, observe the red AT THE ASSERTION, revert, and record it in the task report.
- **Write files with Write/Edit, never PowerShell** (`Set-Content`/`Out-File` write a BOM). **Stage explicit paths**; never `git add -A` or `commit -a`.
- **Commit messages end with** `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Room, never Zone**, in every string a user reads on this surface.

## Prerequisite gate (orchestrator, not a subagent)

```bash
gh pr list --state merged --search "plan-editor-add-room" --json number,mergedAt   # expect one merged PR
git fetch origin && git checkout main && git pull
git checkout claude/plan-editor-trust-path && git rebase main    # the spec commit rides on top of the merge
grep -rn "canCreateRoom" src/presentation/editor/runtime.ts | head -2          # expect: present (add-room merged)
grep -rn "'draw-room'" src/presentation/editor/tools/editor-tool.ts | wc -l    # expect: 1
ls src/presentation/editor/tools/registerEditorTools.ts                        # expect: exists
grep -rn "withStaleGate\|refreshProjection\|writesBlocked" src | wc -l         # expect: 0
```

If the add-room pull request is not merged, **STOP and report**. Tasks 5, 8, 9, 11 edit `runtime.ts`, `NewRoomInspector.vue`, `TemporaryToolBanner.vue`, `AddMenu.vue` and `PlanEditorRoot.vue`, all of which that branch changes. If any add-room NAME this plan relies on differs on `main` (`canCreateRoom`, `rp-new-room__create`, `rp-task-banner__finish`, `registerEditorTools`), the executor follows `main` and records the rename in the task report; the plan's intent is the spec's.

## File Structure

**Wave 1 — pure and jsdom, no shell**

| File | Responsibility |
|---|---|
| `tests/helpers/vault.ts` (modify) | `FakeVault.failOnce` — a one-shot injected failure beside the permanent `failures` set |
| `src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts` (modify) | `compensateFailedSidecarWrite` returns `zone.sidecar-insert-uncompensated` / `zone.sidecar-update-uncompensated`, stamped, when the restore refuses |
| `src/presentation/i18n/locales/en.ts`, `de.ts` (modify) | copy for the two codes; `save-state.saved-refresh-needed` |
| `src/presentation/stores/ProjectStore.ts` (modify) | `refreshing`, `retriesFailed` |
| `src/presentation/editor/save-state/save-state-store.ts` (modify) | `unrecoveredWrite`, `markUnrecovered` |
| `src/presentation/editor/save-state/with-save-state-tracking.ts` (modify) | stamps `unrecoveredWrite` on a `leftWritesBehind` refusal |
| `src/presentation/editor/tools/with-stale-gate.ts` (new) | `withStaleGate`, `STALE_WRITE_REFUSED` |
| `src/presentation/editor/tools/with-editor-state-refresh.ts` (modify) | exports `createProjectionRefresh` |
| `src/presentation/editor/tools/editor-context.ts` (modify) | `EditorContext.writesBlocked: () => boolean` |
| `src/presentation/editor/tools/select-tool.ts` (modify) | no move preview while blocked |
| `src/presentation/editor/runtime.ts` (modify) | gate in the chain; `refreshProjection`, `writesBlocked`, `pausedReasonId`, `openPlanNote` |
| `src/presentation/editor/deleteZoneAction.ts` (new, CONDITIONAL) | `createDeleteZoneAction` moved out of `runtime.ts` if the cap requires it |

**Wave 2 — shell**

| File | Responsibility |
|---|---|
| `src/presentation/i18n/locales/en/editor.ts`, `de/editor.ts` (modify) | every new `editor.*` key |
| `src/presentation/editor/PlanEditorContext.ts`, `src/presentation/views/PlanEditorView.ts`, `src/plugin/planEditorDeps.ts`, `src/plugin/renovationProjectOpenSeams.ts` (modify) | the `openNote` / `openPlanNote` door |
| `src/presentation/editor/shell/warnings.ts` (modify) | `WarningAction`, `unrecovered` row, stale row's actions and message |
| `src/presentation/editor/shell/PersistentWarningStrip.vue` (modify) | action buttons, `aria-busy`, focus recovery on unmount |
| `src/presentation/editor/save-state/SaveStateIndicator.vue`, `styles/editor-status.css` (modify) | fifth label and mark |
| `src/presentation/editor/shell/StatusBar.vue` (modify) | `editor.hint.paused` |
| `src/presentation/editor/PlanEditorRoot.vue` (modify) | reason sentence, warning inputs, unrecovered row, empty-state pause |
| `src/presentation/components/EmptyState.vue` (modify) | optional `actionDisabled` / `actionDescribedBy` props |
| `src/presentation/editor/add/AddMenu.vue`, `shell/NewRoomInspector.vue`, `shell/TemporaryToolBanner.vue`, `shell/RoomInspector.vue`, `shell/RequirementRow.vue`, `shell/LayerList.vue`, `shell/PropertyLayerPanel.vue`, `layers/layerCatalogue.ts` (modify) | paused surfaces |
| `styles/visually-hidden.css` (new), `styles/asset-prices.css`, `styles/editor.css`, `styles/index.css` (modify) | the hidden-text class promoted to its own partial (its second caller); strip button rules |

**Wave 3 — proof and record**

| File | Responsibility |
|---|---|
| `tests/helpers/planEditorRig.ts` (modify) | `rig(seed, { wrapQueries })` |
| `tests/presentation/editor/stalePath.e2e.test.ts` (new) | Scenario D end to end |
| `tests/presentation/editor/history.e2e.test.ts` (new) | Undo/redo PBI criteria |
| `tests/infrastructure/persistence/editorRoundTrip.test.ts`, `tests/presentation/views/planEditorView.test.ts` (modify) | reopen cases |
| `tests/harness/accessibility.test.ts` (modify) | three scans |
| `tests/harness/planEditor.ts`, `tests/harness/page.ts`, `scripts/harness-shot.mjs`, `tests/build/harness-shot.test.ts` (modify) | `?stale` knob; two shots |
| `docs/tests/cases/Recover from a stale read.md`, `Reload a room.md` (new); `docs/tests/suites/Smoke Test the Editor.md` (modify) | the manual cases |
| `docs/requirements/…`, `docs/tasks/…`, `CLAUDE.md` (modify) | statuses, amendments, the increment's section |

---

### Task 1: a failed compensation stops calling itself compensated

**Files:**
- Modify: `tests/helpers/vault.ts` (`FakeVault`), `src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts`, `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`
- Test: `tests/infrastructure/obsidian/repositories/errorPaths.test.ts`, `tests/presentation/i18n/toUserMessage.test.ts`

**Interfaces:**
- Consumes: `markUncompensated` from `src/application/commands/DispatchOutcome.ts`; `persistenceError` from `src/application/errors.ts`; `FakeVault.failures: Set<string>` (permanent injected failures keyed `<op>:<path>`).
- Produces: `FakeVault.failOnce: Set<string>` (consumed on first hit); codes `zone.sidecar-insert-uncompensated`, `zone.sidecar-update-uncompensated` (category `Persistence`, stamped `uncompensatedWrite: true`); locale keys of the same names in `en.ts`/`de.ts`.

- [ ] **Step 1: Give the fake a one-shot failure.** In `tests/helpers/vault.ts`, beside `readonly failures = new Set<string>();` add:

```ts
	/**
	 * One-shot injected failures, keyed like `failures` and DELETED on first hit. Exists for
	 * the update-path compensation: step 3 of a zone update and the restore that follows both
	 * write the note through `modify`, so a permanent failure cannot reach the second without
	 * having already failed the first. `failOnce` fails the first `modify` and lets the restore
	 * through — or, added twice with `failures`, fails both.
	 */
	readonly failOnce = new Set<string>();
```

and in `op(name, path)`:

```ts
	private op(name: string, path: string): void {
		const key = `${name}:${path}`;
		this.operations.push(key);
		const once = this.failOnce.delete(key);
		if (once || this.failures.has(key)) {
			this.failedOps.push(key);
			throw new Error(`Injected failure: ${name} ${path}`);
		}
	}
```

- [ ] **Step 2: Write the failing tests** in `errorPaths.test.ts`, inside `describe('zone repository failure branches', …)`, after the existing 'a delete whose note restore also fails…' case. Use the file's own helpers (`createRepositoryStack`, `makeProjectEntity`, `makePlanEntity`, `makeZoneEntity` or the zone factory the file already imports — read its imports first; `projectFolderOf`, `sidecarPathOf`, `expectOk`, `leftWritesBehind` from `src/application/commands/DispatchOutcome`):

```ts
	it('an INSERT whose sidecar write fails AND whose note trash refuses reports itself as uncompensated', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const planId = createPlanId();
		expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId, name: 'Ground' }), 'absent'));
		const zone = makeZoneEntity({ planId, projectId, name: 'Kitchen' });
		const folder = projectFolderOf(stack.index, projectId);
		if (folder === undefined) throw new Error(`no folder indexed for project ${projectId}`);
		const notePath = `${folder}/Zones/Kitchen.md`;
		stack.vault.failures.add(`modify:${sidecarPathOf(stack, projectId, planId)}`);
		stack.vault.failures.add(`delete:${notePath}`);

		const saved = await stack.zones.save(zone, 'absent');
		expect(saved.ok).toBe(false);
		if (saved.ok) return;
		expect(saved.error.code).toBe('zone.sidecar-insert-uncompensated');
		expect(leftWritesBehind(saved.error)).toBe(true);
		expect(saved.error.message).not.toContain('was compensated');
		// The note is still on disk: the whole reason the code has to say so.
		expect(stack.vault.getAbstractFileByPath(notePath)).not.toBeNull();
	});

	it('an INSERT whose sidecar write fails but whose note trash succeeds keeps the compensated code and no stamp', async () => {
		// same seed as above, WITHOUT the delete failure
		// …
		expect(saved.error.code).toBe('zone.sidecar-insert-failed');
		expect(leftWritesBehind(saved.error)).toBe(false);
		expect(stack.vault.getAbstractFileByPath(notePath)).toBeNull();
	});

	it('an UPDATE whose sidecar write fails AND whose note restore refuses reports itself as uncompensated', async () => {
		// seed project, plan, and SAVE the zone once successfully so it is an update
		const first = expectOk(await stack.zones.save(zone, 'absent'));
		const notePath = /* the saved note's path: */ stack.index.getPath(zone.id)!;
		stack.vault.failures.add(`modify:${sidecarPathOf(stack, projectId, planId)}`);
		// The update's own frontmatter write is a `modify` too; let it through and fail the RESTORE.
		// `failOnce` fails the FIRST modify on the note path — so arm it AFTER the update's write by
		// making the sidecar fail first: sidecar mutate runs after the note write, so the restore is
		// the second `modify:${notePath}`. Add the note-path key to `failOnce` and consume the first
		// hit deliberately:
		stack.vault.failOnce.add(`modify:${notePath}`);
		// …(read `saveQueued` to confirm the order: note write (modify #1) → sidecar mutate (fails) →
		// restoreNoteText (modify #2). If #1 is what `failOnce` catches, the test asserts
		// `zone.write-failed`-shaped refusal instead; the executor confirms the order and picks the
		// arming that reaches the restore. Record which in the task report.)
		const saved = await stack.zones.save(first.entity.withName('Pantry'), first.version);
		expect(saved.ok).toBe(false);
		if (saved.ok) return;
		expect(saved.error.code).toBe('zone.sidecar-update-uncompensated');
		expect(leftWritesBehind(saved.error)).toBe(true);
	});
```

If the update arm cannot be reached with `failOnce` after reading `saveQueued`, DROP the update-uncompensated CODE from Step 4 and keep only the insert one — an unreachable arm is not free — and say so in the report and in the spec's §2.7 (an amendment line).

- [ ] **Step 3: Run red.** `npx vitest run tests/infrastructure/obsidian/repositories/errorPaths.test.ts -t uncompensated` — expect failures at the `code` assertions (`'zone.sidecar-insert-failed'` received).

- [ ] **Step 4: Implement.** In `ObsidianZoneRepository.ts`, import `markUncompensated` from `'../../../application/commands/DispatchOutcome'` and rewrite the return of `compensateFailedSidecarWrite`:

```ts
		if (!compensated.ok) {
			this.deps.logger.error(wasUpdate ? 'zone.update-compensation-failed' : 'zone.insert-compensation-failed', {
				id: zoneId,
				cause: compensated.error,
			});
			// The note is on disk in a state the sidecar does not match, and nothing here can put
			// it back. A DIFFERENT code, because `affectsSaveState` and the strip read the stamp,
			// and a message that tells the truth: the previous one said "was compensated" here.
			return err(
				markUncompensated(
					persistenceError(
						wasUpdate ? 'zone.sidecar-update-uncompensated' : 'zone.sidecar-insert-uncompensated',
						`The geometry entry for zone ${zoneId} could not be written, and the note could NOT be restored; inspect it by hand.`,
						cause,
					),
				),
			);
		}
		return err(
			persistenceError(
				wasUpdate ? 'zone.sidecar-update-failed' : 'zone.sidecar-insert-failed',
				`The geometry entry for zone ${zoneId} could not be written; the note was compensated.`,
				cause,
			),
		);
```

Update the docblock above the method: the two arms and why the codes differ.

- [ ] **Step 5: Copy, both locales.** `en.ts`, beside `'error.requirement.quantity.unparseable'`'s neighbours (the code IS the key — `toUserMessage` checks `hasLocaleKey(error.code)` first):

```ts
	// A write that landed half-way and could not be put back. Names the manual action, because
	// the vault is the only thing that knows its own state now.
	'zone.sidecar-insert-uncompensated':
		'A room was written but its shape could not be saved, and the note could not be removed again. Inspect the room’s note before editing further.',
	'zone.sidecar-update-uncompensated':
		'A room was changed but its shape could not be saved, and the note could not be restored. Inspect the room’s note before editing further.',
```

`de.ts`:

```ts
	'zone.sidecar-insert-uncompensated':
		'Ein Raum wurde geschrieben, aber seine Form konnte nicht gespeichert werden, und die Notiz konnte nicht wieder entfernt werden. Prüfen Sie die Notiz des Raums, bevor Sie weiter bearbeiten.',
	'zone.sidecar-update-uncompensated':
		'Ein Raum wurde geändert, aber seine Form konnte nicht gespeichert werden, und die Notiz konnte nicht wiederhergestellt werden. Prüfen Sie die Notiz des Raums, bevor Sie weiter bearbeiten.',
```

Add two rows to `MINTED` in `toUserMessage.test.ts`:

```ts
	['zone.sidecar-insert-uncompensated', 'Persistence', 'error.category.persistence', 'infrastructure/obsidian/repositories/ObsidianZoneRepository.ts'],
	['zone.sidecar-update-uncompensated', 'Persistence', 'error.category.persistence', 'infrastructure/obsidian/repositories/ObsidianZoneRepository.ts'],
```

- [ ] **Step 6: Run green.** `npm run check:fast -- tests/infrastructure/obsidian/repositories/errorPaths.test.ts tests/presentation/i18n tests/helpers` — all pass. Mutation-check: revert the `markUncompensated` wrapper only; the `leftWritesBehind` assertion goes red. Restore.

- [ ] **Step 7: Commit.**

```bash
git add tests/helpers/vault.ts src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts src/presentation/i18n/locales/en.ts src/presentation/i18n/locales/de.ts tests/infrastructure/obsidian/repositories/errorPaths.test.ts tests/presentation/i18n/toUserMessage.test.ts
git commit -m "fix(zones): a failed compensation reports its own code and stamp, not the compensated one"
```

---

### Task 2: the store knows when a refresh is in flight, and how many retries failed

**Files:**
- Modify: `src/presentation/stores/ProjectStore.ts`
- Test: `tests/presentation/stores/projectStore.test.ts` (find the existing file: `ls tests/presentation/stores/`; if the store's tests live under another name, add to that file)

**Interfaces:**
- Consumes: `hydrate(queries, planId, options?)`, `stale`, `latestHydration` ticket.
- Produces: `refreshing: Ref<boolean>` (true from a hydrate's first line until the read holding the LATEST ticket settles; a superseded read never clears it); `retriesFailed: Ref<number>` (incremented when a keep-on-failure read fails while `stale` is ALREADY true; reset to 0 by a successful hydrate and by `reset()`).

- [ ] **Step 1: Write the failing tests** (the file's existing `fakeQueries`/`defer` helpers; `defer` from `tests/helpers/async`):

```ts
describe('refreshing and failed retries', () => {
	it('is refreshing from the first line of a hydrate until its read settles', async () => {
		const store = useProjectStore();
		const gate = defer<Awaited<ReturnType<PlanEditorQueryServices['getPlan']>>>();
		const queries = { ...fakeQueries(FIXTURE_PLAN), getPlan: () => gate.promise };
		const run = store.hydrate(queries, FIXTURE_PLAN.id);
		expect(store.refreshing).toBe(true);
		gate.resolve(ok(FIXTURE_PLAN));
		await run;
		expect(store.refreshing).toBe(false);
	});

	it('stays refreshing while a LATER read is still open, even after an earlier one settles', async () => {
		const store = useProjectStore();
		const first = defer<…>(); const second = defer<…>();
		let call = 0;
		const queries = { ...fakeQueries(FIXTURE_PLAN), getPlan: () => (++call === 1 ? first.promise : second.promise) };
		const a = store.hydrate(queries, FIXTURE_PLAN.id);
		const b = store.hydrate(queries, FIXTURE_PLAN.id);
		first.resolve(ok(FIXTURE_PLAN));
		await a;
		expect(store.refreshing).toBe(true);   // the superseded read must not clear it
		second.resolve(ok(FIXTURE_PLAN));
		await b;
		expect(store.refreshing).toBe(false);
	});

	it('counts a failed RETRY, not the failure that made the canvas stale', async () => {
		const store = useProjectStore();
		let call = 0;
		const queries = { ...fakeQueries(FIXTURE_PLAN), getPlan: () => Promise.resolve(++call === 1 ? ok(FIXTURE_PLAN) : err(HYDRATION_FAULT)) };
		await store.hydrate(queries, FIXTURE_PLAN.id);
		await store.hydrate(queries, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		expect(store.stale).toBe(true);
		expect(store.retriesFailed).toBe(0);
		await store.hydrate(queries, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		expect(store.retriesFailed).toBe(1);
		await store.hydrate(queries, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		expect(store.retriesFailed).toBe(2);
	});

	it('resets the failed-retry count on the read that succeeds', async () => {
		// stale + one failed retry, then a success
		expect(store.retriesFailed).toBe(0);
		expect(store.stale).toBe(false);
	});
});
```

- [ ] **Step 2: Run red.** `npx vitest run tests/presentation/stores -t "refreshing and failed"` — `refreshing`/`retriesFailed` undefined.

- [ ] **Step 3: Implement.** In `ProjectStore.ts`:

```ts
	/**
	 * Is a hydration in flight for the LATEST ticket? Set on a hydrate's first line, cleared
	 * only when the read that holds the current ticket settles — a superseded read leaves it
	 * alone, because the canvas is still waiting on the later one. The strip's Try again is
	 * `aria-busy` on this and nothing else; a per-caller busy flag would be a second answer.
	 */
	const refreshing = ref(false);
	/**
	 * How many keep-on-failure reads have failed since the canvas went stale. The failure that
	 * SET `stale` is not a retry, so it does not count; the read that clears `stale` resets it.
	 * `PersistentWarningStrip` swaps the stale row's message on the first failed retry.
	 */
	const retriesFailed = ref(0);
```

In `handleFailedRead`, the keep-on-failure arm becomes:

```ts
	if (keepOnFailure && refs.status.value === 'ready') {
		if (refs.stale.value) refs.retriesFailed.value += 1;
		refs.error.value = cause;
		refs.stale.value = true;
		return;
	}
```

(`HydrationFailureRefs` gains `readonly retriesFailed: Ref<number>`.) In `hydrate`: after `const superseded = …`, add `refreshing.value = true;` and wrap every `if (superseded()) return;` so the clearing is one helper:

```ts
		const done = (): void => {
			if (!superseded()) refreshing.value = false;
		};
```

called before EVERY return past the first await (the three superseded returns simply return; every non-superseded path — failure, missing, success — calls `done()` first). Success arm additionally `retriesFailed.value = 0;`. `fail()` and `markMissing` leave `retriesFailed` alone (stale is false there and the count is meaningless; `reset()` zeroes it). Return `refreshing, retriesFailed` from the store.

- [ ] **Step 4: Run green.** `npm run check:fast -- tests/presentation/stores tests/presentation/editor/planEditorFailure.test.ts`. Mutation-check: make `done()` unconditional; the "stays refreshing while a LATER read is open" case goes red at `expect(store.refreshing).toBe(true)`. Restore.

- [ ] **Step 5: Commit.**

```bash
git add src/presentation/stores/ProjectStore.ts tests/presentation/stores/
git commit -m "feat(store): the project store says when a refresh is in flight and counts failed retries"
```

---

### Task 3: an unrecovered write is a fact the save-state store holds

**Files:**
- Modify: `src/presentation/editor/save-state/save-state-store.ts`, `src/presentation/editor/save-state/with-save-state-tracking.ts`
- Test: `tests/presentation/editor/saveState/saveStateStore.test.ts`, `tests/presentation/editor/saveState/withSaveStateTracking.test.ts`

**Interfaces:**
- Consumes: `leftWritesBehind` (`DispatchOutcome.ts`), `SaveStateTracker` pick.
- Produces: `useSaveStateStore().unrecoveredWrite: ComputedRef<boolean>`, `markUnrecovered(): void`; `SaveStateTracker` gains `'markUnrecovered'`; `withSaveStateTracking` calls it when `isErr(result) && leftWritesBehind(result.error)`.

- [ ] **Step 1: Failing store tests** (append to `saveStateStore.test.ts`):

```ts
	it('records an unrecovered write, and only a write that later SUCCEEDS clears it', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.markUnrecovered();
		store.resolveErr();
		expect(store.state).toBe('save-error');
		expect(store.unrecoveredWrite).toBe(true);
		store.beginSaving();
		store.resolveNeutral();          // a refusal that wrote nothing
		expect(store.unrecoveredWrite).toBe(true);
		store.beginSaving();
		store.resolveOk();               // a write that landed whole
		expect(store.unrecoveredWrite).toBe(false);
	});
```

Extend the exhaustive transition test in that file (read it: it walks every `(state, action)` pair from the initial state): add `markUnrecovered` to its action list and assert `unrecoveredWrite` is `false` after any sequence that ends in `resolveOk` and `true` after any sequence containing `markUnrecovered` with no later `resolveOk`.

- [ ] **Step 2: Failing tracker test** (`withSaveStateTracking.test.ts`, using its existing recording tracker fake — widen the fake with a `markUnrecovered` counter):

```ts
	it('stamps an unrecovered write on the store when the refusal left writes behind', async () => {
		const tracker = recordingTracker();
		const history = { run: () => Promise.resolve(err(markUncompensated(persistenceFault()))), undo: …, redo: … };
		await withSaveStateTracking(history, tracker).run(command);
		expect(tracker.calls).toEqual(['beginSaving', 'markUnrecovered', 'resolveErr']);
	});
	it('does not stamp an ordinary persistence refusal', async () => { /* same, no stamp → ['beginSaving', 'resolveErr'] */ });
```

- [ ] **Step 3: Run red.** Both files — `markUnrecovered` is not a function.

- [ ] **Step 4: Implement.** Store:

```ts
	/**
	 * A write landed half-way and its compensation refused (`leftWritesBehind`). Distinct from
	 * `save-error`, which any refused write raises and which the NEXT successful write clears
	 * for the ordinary reason — this one is about the vault's coherence, and the only evidence it
	 * is coherent again is a write that landed WHOLE, so `resolveOk` is the one clearer. A
	 * successful REFRESH does not clear it: reading a half-written vault back does not mend it.
	 */
	const unrecoveredWrite = ref(false);
	…
	return {
		state: computed(() => state.value),
		unrecoveredWrite: computed(() => unrecoveredWrite.value),
		markUnrecovered(): void { unrecoveredWrite.value = true; },
		…
		resolveOk(): void {
			pendingCount.value -= 1;
			hasWriteInBatch.value = true;
			unrecoveredWrite.value = false;
			settle();
		},
```

Tracker: `SaveStateTracker = Pick<…, 'beginSaving' | 'resolveOk' | 'resolveErr' | 'resolveNeutral' | 'markUnrecovered'>`, and in `track`:

```ts
			else if (affectsSaveState(result.error)) {
				if (leftWritesBehind(result.error)) saveState.markUnrecovered();
				saveState.resolveErr();
			}
```

`markUnrecovered` BEFORE `resolveErr`, so a consumer watching `state` finds the flag already set.

- [ ] **Step 5: Run green** (`npm run check:fast -- tests/presentation/editor/saveState`). Every `SaveStateTracker` fake in `tests/` gains `markUnrecovered` — `vue-tsc` (`npm run build`) lists them; fix each. Mutation-check: clear `unrecoveredWrite` in `resolveNeutral` too; the store case goes red at the second `toBe(true)`. Restore.

- [ ] **Step 6: Commit.**

```bash
git add src/presentation/editor/save-state/ tests/presentation/editor/saveState/ <any fixture files vue-tsc named>
git commit -m "feat(save-state): an unrecovered write is recorded, and only a whole write clears it"
```

---

### Task 4: the stale gate

**Files:**
- Create: `src/presentation/editor/tools/with-stale-gate.ts`
- Test: `tests/presentation/editor/tools/withStaleGate.test.ts`

**Interfaces:**
- Consumes: `RefreshedHistory` (`with-state-refresh.ts`), `DispatchResult`, `ValidationError` (`core/errors/AppError.ts`, `BaseError<'Validation'>`), `err`.
- Produces: `withStaleGate(dispatcher: RefreshedHistory, isStale: () => boolean): RefreshedHistory`; `STALE_WRITE_REFUSED = 'editor.stale-write-refused'`; `staleWriteRefusal(): ValidationError`.

- [ ] **Step 1: Failing tests:**

```ts
import { describe, expect, it } from 'vitest';
import { ok, err } from '../../../../src/core/result/Result';
import { STALE_WRITE_REFUSED, withStaleGate } from '../../../../src/presentation/editor/tools/with-stale-gate';
import { affectsSaveState } from '../../../../src/presentation/editor/save-state/affects-save-state';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';

const command: UndoableCommand = { execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) };

function recording() {
	const calls: string[] = [];
	const history = {
		run: () => { calls.push('run'); return Promise.resolve(ok('wrote' as const)); },
		undo: () => { calls.push('undo'); return Promise.resolve(ok('wrote' as const)); },
		redo: () => { calls.push('redo'); return Promise.resolve(ok('wrote' as const)); },
	};
	return { calls, history };
}

describe('withStaleGate', () => {
	it('refuses a run while stale, without reaching the history', async () => {
		const { calls, history } = recording();
		const result = await withStaleGate(history, () => true).run(command);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe(STALE_WRITE_REFUSED);
		expect(result.error.category).toBe('Validation');
		expect(calls).toEqual([]);
	});
	it('passes a run through when not stale', async () => {
		const { calls, history } = recording();
		expect((await withStaleGate(history, () => false).run(command)).ok).toBe(true);
		expect(calls).toEqual(['run']);
	});
	it('lets undo and redo through in BOTH states', async () => {
		const { calls, history } = recording();
		const gated = withStaleGate(history, () => true);
		await gated.undo(); await gated.redo();
		expect(calls).toEqual(['undo', 'redo']);
	});
	it('reads the flag at dispatch time, not at construction', async () => {
		let stale = true;
		const { calls, history } = recording();
		const gated = withStaleGate(history, () => stale);
		await gated.run(command);
		stale = false;
		await gated.run(command);
		expect(calls).toEqual(['run']);
	});
	it('is neutral to the save indicator: the refusal is pre-write', () => {
		expect(affectsSaveState(staleWriteRefusal())).toBe(false);
	});
});
```

- [ ] **Step 2: Run red** — module not found.

- [ ] **Step 3: Implement** `with-stale-gate.ts`:

```ts
import type { ValidationError } from '../../../core/errors/AppError';
import { err } from '../../../core/result/Result';
import type { RefreshedHistory } from './with-state-refresh';

/** The one code a stale gate refuses with; the locale key of the same name is its copy. */
export const STALE_WRITE_REFUSED = 'editor.stale-write-refused';

/**
 * Validation on purpose: `affectsSaveState` classes it pre-write, so the indicator settles
 * neutral and the badge cannot move — nothing was written, and "Save error" over a refusal
 * would be the false badge four measurements of that predicate went to avoid. Minted here as
 * a literal the way `deleteZoneFlow.ts` mints its own; there is no `validationError` factory.
 */
export function staleWriteRefusal(): ValidationError {
	return {
		category: 'Validation',
		code: STALE_WRITE_REFUSED,
		message: 'The last read-back failed; new writes are refused until a re-read succeeds.',
	};
}

/**
 * The trust path's gate (design spec §2.2), one decorator on the one dispatcher. `run` is
 * refused while `isStale()`; `undo` and `redo` pass — their inverse is the ledger's snapshot,
 * presented with the version the history recorded and refused by the repository on a
 * conflict, none of which reads the stale projection. A function rather than the store so a
 * node test drives both arms with a flag.
 */
export function withStaleGate(dispatcher: RefreshedHistory, isStale: () => boolean): RefreshedHistory {
	return {
		run: (command) => (isStale() ? Promise.resolve(err(staleWriteRefusal())) : dispatcher.run(command)),
		undo: () => dispatcher.undo(),
		redo: () => dispatcher.redo(),
	};
}
```

- [ ] **Step 4: Run green.** `npm run check:fast -- tests/presentation/editor/tools/withStaleGate.test.ts`. Mutation-check: change the category to `'Persistence'`; the neutrality case goes red. Restore.

- [ ] **Step 5: Commit.**

```bash
git add src/presentation/editor/tools/with-stale-gate.ts tests/presentation/editor/tools/withStaleGate.test.ts
git commit -m "feat(editor): a stale gate refuses new writes at the dispatcher and lets undo and redo through"
```

---

### Task 5: the runtime — gate in the chain, one refresh, the paused facts

**Files:**
- Modify: `src/presentation/editor/tools/with-editor-state-refresh.ts`, `src/presentation/editor/runtime.ts`, `src/presentation/editor/tools/editor-context.ts`, `tests/helpers/tool-context.ts`, `tests/helpers/calibrateHarness.ts`, `tests/presentation/editor/type-safety.test-d.ts`
- Create (conditional): `src/presentation/editor/deleteZoneAction.ts`
- Test: `tests/presentation/editor/runtime.test.ts`, `tests/presentation/editor/tools/withEditorStateRefresh.test.ts` (find or create beside the decorator's existing tests: `ls tests/presentation/editor/tools | grep -i refresh`)

**Interfaces:**
- Consumes: Task 4's `withStaleGate`; `ProjectStore.stale`; `useId` from Vue.
- Produces: `createProjectionRefresh(deps: EditorStateRefreshDeps): () => Promise<void>` (exported); `EditorRuntime.refreshProjection: () => Promise<void>`, `EditorRuntime.writesBlocked: Readonly<Ref<boolean>>`, `EditorRuntime.pausedReasonId: string`; `EditorContext.writesBlocked: () => boolean` and `EditorContextDeps.writesBlocked: () => boolean`. (`openPlanNote` is Task 8's.)

- [ ] **Step 1: MEASURE `runtime.ts` first.**

```bash
grep -cv '^\s*$\|^\s*/\*\|^\s*\*\|^\s*//' src/presentation/editor/runtime.ts
```

If the count is above **380**, extract `createDeleteZoneAction` (its whole function, imports `deleteZoneWithReferences`, `DeleteZoneFlowDeps`, `notifyFault`, `notifyOperationFailure`, `tr`, `useDialogStore`, `useSelectionStore`, `InspectorEdit`, `DispatchResult`, `ZoneId`, `PlanEditorContext`) to `src/presentation/editor/deleteZoneAction.ts` FIRST, as its own commit (`refactor(editor): the delete action leaves runtime.ts, which is at its cap`), with `runtime.ts` importing it. Run `npm run check:fast -- tests/presentation/editor/runtime.test.ts tests/presentation/editor/shell/deleteZoneWithReferences.test.ts` before continuing.

- [ ] **Step 2: Failing refresh-identity test** (in the refresh decorator's test file):

```ts
	it('exposes the refresh as one function the queued path calls, so a retry is the same read', async () => {
		const hydrate = vi.fn().mockResolvedValue(undefined);
		const refresh = vi.fn().mockResolvedValue(undefined);
		const deps = { projectStore: { hydrate }, inspectorStore: { refresh }, queries: fakeQueries(FIXTURE_PLAN), planId: FIXTURE_PLAN.id };
		const refreshProjection = createProjectionRefresh(deps);
		await refreshProjection();
		expect(hydrate).toHaveBeenCalledWith(deps.queries, deps.planId, { keepPreviousOnFailure: true });
		expect(refresh).toHaveBeenCalledTimes(1);
	});
```

And in `type-safety.test-d.ts`:

```ts
import type { createProjectionRefresh } from '../../../src/presentation/editor/tools/with-editor-state-refresh';
// The retry cannot replay a write: the refresh takes NO command. Held as a type.
type RefreshParameters = Parameters<ReturnType<typeof createProjectionRefresh>>;
declare const noParameters: RefreshParameters;
const _checked: [] = noParameters;
```

- [ ] **Step 3: Failing runtime tests** (`runtime.test.ts`, using `mountPlanEditorCanvas`, `runtimeOf`, `useProjectStore`):

```ts
	it('refuses a NEW write while stale and lets undo through, at the runtime dispatcher', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		useProjectStore(harness.pinia).stale = true;
		const result = await runtime.dispatcher.run(noopWriteCommand());
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('editor.stale-write-refused');
		expect(runtime.writesBlocked.value).toBe(true);
		useProjectStore(harness.pinia).stale = false;
		await settle();
		expect(runtime.writesBlocked.value).toBe(false);
	});
	it('mints one paused-reason id per leaf', async () => {
		const harness = await mountPlanEditorCanvas();
		expect(runtimeOf(harness).pausedReasonId).toMatch(/^v-/);   // Vue's useId prefix; adapt to app.config.idPrefix if set
	});
	it('refreshProjection re-reads and never dispatches', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		const before = harness.zonesRepo?.saveCount ?? 0;   // if the harness has no repo counter, spy on queries.getPlan instead
		await runtime.refreshProjection();
		// assert getPlan was called once more and no command ran
	});
```

- [ ] **Step 4: Run red.**

- [ ] **Step 5: Implement.** `with-editor-state-refresh.ts`:

```ts
export function createProjectionRefresh(deps: EditorStateRefreshDeps): () => Promise<void> {
	return async () => {
		await deps.projectStore.hydrate(deps.queries, deps.planId, { keepPreviousOnFailure: true });
		await deps.inspectorStore.refresh();
	};
}

export function withEditorStateRefresh(history: RefreshedHistory, deps: EditorStateRefreshDeps): RefreshedHistory {
	return withStateRefresh(history, createProjectionRefresh(deps));
}
```

`runtime.ts`, in `buildRuntime`:

```ts
	const refreshProjection = createProjectionRefresh({ projectStore, inspectorStore: { refresh: () => inspectorRef.current?.refresh() ?? Promise.resolve() }, queries: context.queries, planId: context.planId });
	const dispatcher = withStateRefresh(history, refreshProjection);
	const tracked = withSaveStateTracking(dispatcher, useSaveStateStore());
	// The trust path's gate, AFTER the tracker so a refusal opens no saving batch, BEFORE
	// wrapDispatcher so the undo/redo flags still refresh (design spec §2.2).
	const gated = withStaleGate(tracked, () => projectStore.stale);
	const { dispatcher: wrappedDispatcher, canUndo, canRedo } = wrapDispatcher(history, gated);
	…
	const writesBlocked = computed(() => projectStore.stale);
	const pausedReasonId = useId();
```

`EditorRuntime` gains the three members with docblocks; `createEditorContext` deps gain `writesBlocked: () => projectStore.stale`. `editor-context.ts`: `readonly writesBlocked: () => boolean;` on both `EditorContext` and `EditorContextDeps`, threaded in `createEditorContext`. Fixtures: `tool-context.ts` context literal gains `writesBlocked: () => options.writesBlocked ?? false` (and `ToolContextOptions.writesBlocked?: boolean`); `calibrateHarness.ts` gains `writesBlocked: () => false`. `vue-tsc` names any other builder.

- [ ] **Step 6: Run green** (`npm run check:fast -- tests/presentation/editor`), then `npm run build` for the type test. Mutation-check: swap `gated` and `tracked` in the chain (gate BEFORE the tracker); the existing withSaveStateTracking neutrality holds either way, so instead assert in the runtime case that `useSaveStateStore(harness.pinia).state` is `'saved'` after the refused run and watch it read `'saving'`→`'saved'` flicker… if the indicator cannot distinguish, note in the report that the ORDER is held by the docblock and by reading; do not invent a discriminating test that does not discriminate.

- [ ] **Step 7: Commit.**

```bash
git add src/presentation/editor/runtime.ts src/presentation/editor/tools/with-editor-state-refresh.ts src/presentation/editor/tools/editor-context.ts tests/helpers/tool-context.ts tests/helpers/calibrateHarness.ts tests/presentation/editor/type-safety.test-d.ts tests/presentation/editor/runtime.test.ts tests/presentation/editor/tools/
git commit -m "feat(runtime): the stale gate sits in the dispatcher chain, and retry is the post-command refresh itself"
```

---

### Task 6: a Select drag while blocked draws no ghost

**Files:**
- Modify: `src/presentation/editor/tools/select-tool.ts`
- Test: `tests/presentation/editor/tools/selectTool.test.ts` (find the existing file: `ls tests/presentation/editor/tools | grep -i select`)

**Interfaces:**
- Consumes: `EditorContext.writesBlocked()` (Task 5).
- Produces: `SelectTool.pointerDown` selects but starts NO gesture while blocked; `pointerMove` draws no preview; `pointerUp` dispatches nothing.

- [ ] **Step 1: Failing test** (the file's `toolContext({ writesBlocked: true })`, `pointerAt`):

```ts
	it('selects but starts no move gesture while writes are blocked, so no ghost and no dispatch', () => {
		const { context, dispatched } = toolContext({ writesBlocked: true });
		const tool = new SelectTool(depsWith(zoneA));
		tool.activate(context);
		tool.pointerDown(pointerAt(inside(zoneA)));
		expect(context.selection.selectedIds).toEqual([zoneA.id]);
		tool.pointerMove(pointerAt(farAway()));
		expect(context.renderState.previewPolygon).toBeNull();
		tool.pointerUp(pointerAt(farAway()));
		expect(dispatched).toHaveLength(0);
	});
```

- [ ] **Step 2: Run red** — `previewPolygon` is a translated polygon.

- [ ] **Step 3: Implement.** In `pointerDown`, after `context.selection.select([hit.id …])`:

```ts
		// While the canvas is stale the gate would refuse the commit anyway; a ghost the release
		// cannot keep is a promise, so no gesture begins. Selection still happens — inspecting
		// stays available (design spec §2.9).
		if (context.writesBlocked()) return;
```

(Also before the `handle` gesture branch, so a vertex drag is refused the same way.)

- [ ] **Step 4: Run green**; mutation-check by deleting the guard. Commit:

```bash
git add src/presentation/editor/tools/select-tool.ts tests/presentation/editor/tools/
git commit -m "feat(select): no move ghost while writes are blocked"
```

---

### Task 7: the strings

**Files:**
- Modify: `src/presentation/i18n/locales/en/editor.ts`, `src/presentation/i18n/locales/de/editor.ts`, `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`

**Interfaces:**
- Produces the keys every later task uses: `editor.stale-write-refused`, `editor.paused.reason`, `editor.hint.paused`, `editor.refresh-failed.again`, `editor.warning.retry`, `editor.warning.open-source-note`, `editor.unrecovered`, `editor.source-note-missing`; `save-state.saved-refresh-needed`.

- [ ] **Step 1: English** (`en/editor.ts`, after `editor.warning.severity.error`):

```ts
	// The trust path (checkpoint C3). `editor.stale-write-refused` IS an error code: the gate
	// refuses with it and `toUserMessage` resolves the code as its own key.
	'editor.stale-write-refused': 'Editing is paused until the floor is re-read.',
	'editor.paused.reason': 'Editing is paused: the floor could not be re-read after the last change. Use Try again above.',
	'editor.hint.paused': 'Editing paused until the floor is re-read',
	'editor.refresh-failed.again': 'Re-reading failed again; what you see may still be out of date.',
	'editor.warning.retry': 'Try again',
	'editor.warning.open-source-note': 'Open source note',
	'editor.unrecovered': 'A change was written but could not be completed or undone. Inspect the floor’s note before editing further.',
	'editor.source-note-missing': 'The floor’s note could not be found.',
```

`en.ts`, after `'save-state.save-error'`:

```ts
	// Derived, not a fifth state: `saved` AND `ProjectStore.stale`. The middle dot is the
	// component library's own spelling of this label.
	'save-state.saved-refresh-needed': 'Saved · refresh needed',
```

- [ ] **Step 2: German** (`de/editor.ts`):

```ts
	'editor.stale-write-refused': 'Die Bearbeitung ist angehalten, bis der Grundriss neu gelesen wurde.',
	'editor.paused.reason': 'Die Bearbeitung ist angehalten: Der Grundriss konnte nach der letzten Änderung nicht neu gelesen werden. Verwenden Sie oben „Erneut versuchen“.',
	'editor.hint.paused': 'Bearbeitung angehalten, bis der Grundriss neu gelesen wurde',
	'editor.refresh-failed.again': 'Das erneute Lesen ist wieder fehlgeschlagen; die Anzeige ist möglicherweise weiterhin nicht aktuell.',
	'editor.warning.retry': 'Erneut versuchen',
	'editor.warning.open-source-note': 'Quellnotiz öffnen',
	'editor.unrecovered': 'Eine Änderung wurde geschrieben, konnte aber weder abgeschlossen noch rückgängig gemacht werden. Prüfen Sie die Notiz des Grundrisses, bevor Sie weiter bearbeiten.',
	'editor.source-note-missing': 'Die Notiz des Grundrisses wurde nicht gefunden.',
```

`de.ts`: `'save-state.saved-refresh-needed': 'Gespeichert · Aktualisierung nötig',`.

- [ ] **Step 3: Run** `npm run check:fast -- tests/presentation/i18n` (completeness and the interpolation-hole test), then `npm run lint` (sentence case: no capital mid-sentence — "Try again" as a full label is fine; "Use Try again above" in the reason sentence WILL fail the sentence-case rule if the linter reads `Try` as a capitalised word mid-sentence; if it does, reword to 'Editing is paused: the floor could not be re-read after the last change. Retry from the warning above.' and record it).

- [ ] **Step 4: Commit.**

```bash
git add src/presentation/i18n/locales/
git commit -m "i18n(editor): the trust path's copy, in both locales"
```

---

### Task 8: Open source note — one door from the leaf to its note

**Files:**
- Modify: `src/presentation/editor/PlanEditorContext.ts`, `src/presentation/views/PlanEditorView.ts`, `src/plugin/planEditorDeps.ts`, `src/plugin/renovationProjectOpenSeams.ts`, `src/presentation/editor/runtime.ts`, `tests/helpers/editor.ts`, `tests/harness/planEditor.ts`, `tests/presentation/views/planEditorView.test.ts`
- Test: `tests/plugin/planEditorWiring.test.ts`, `tests/presentation/views/planEditorView.test.ts`

**Interfaces:**
- Consumes: `openProjectNote(deps, entityId)` from `src/infrastructure/obsidian/workspace/openNote.ts` (resolves ANY entity id through `index.getPath`); `ProjectNoteOpenOutcome`; `notifyFault`, `notifyWarning`.
- Produces: `PlanEditorDeps.openNote: (entityId: string) => Promise<ProjectNoteOpenOutcome>`; `PlanEditorContext.openPlanNote(): Promise<void>`; `EditorRuntime.openPlanNote: () => Promise<void>`; `planEditorOpenNote(workspace, vault, index, logger)` in `renovationProjectOpenSeams.ts`.

- [ ] **Step 1: Failing wiring test** (`planEditorWiring.test.ts`, following 'hands over the mapped query services…'):

```ts
	it('binds openNote to the real index-resolving opener when persistence is composed', async () => {
		const root = composedRoot();                 // the file's own helper
		const workspace = new FakeWorkspace();
		const stack = vaultStack();
		const deps = planEditorDeps(root, workspace as never, stack.vault);
		expect(await deps.openNote('no-such-id')).toBe('missing');    // resolves through the index, answers missing
	});
	it('answers failed and notifies when settings were never recovered', async () => {
		const root = unrecoveredRoot();
		const deps = planEditorDeps(root, new FakeWorkspace() as never, vaultStack().vault);
		expect(await deps.openNote('any')).toBe('failed');
		expect(Notice.shown.at(-1)).toBe(t('en', 'settings.unrecovered'));
	});
```

And in `planEditorView.test.ts`, in the `deps()` factory add `openNote: vi.fn().mockResolvedValue('opened')`, plus:

```ts
	it('openPlanNote asks the deps for THIS leaf’s plan note', async () => {
		const opened: string[] = [];
		const view = new PlanEditorView(leaf as never, { ...deps(), openNote: (id) => { opened.push(id); return Promise.resolve('opened'); } });
		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
		await view.onOpen();
		await runtimeOfView(view).openPlanNote();     // reach the runtime the way the file already reaches provides, or drive the strip in Task 9's test instead
		expect(opened).toEqual([FIXTURE_PLAN.id]);
	});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement.**

`renovationProjectOpenSeams.ts`:

```ts
/**
 * `PlanEditorDeps.openNote`: the SAME `openProjectNote` the project view uses, because that
 * function resolves any entity id through the index — a plan's note needs no second opener.
 */
export function planEditorOpenNote(
	workspace: Workspace,
	vault: Vault,
	index: ProjectIndex,
	logger: Logger,
): (entityId: string) => Promise<ProjectNoteOpenOutcome> {
	return (entityId) =>
		openProjectNote(
			{ workspace, vault, index, reportFault: (cause: unknown): void => { notifyFault(cause, logger, 'plan-editor.open-note-failed'); } },
			entityId,
		);
}
```

`planEditorDeps.ts`:

```ts
		openNote: persistence
			? planEditorOpenNote(workspace, vault, persistence.index, root.logger)
			: () => { notifyWarning(tr('settings.unrecovered')); return Promise.resolve('failed' as const); },
```

(Check how the sibling `unavailable*` bundles notify `settings.unrecovered` and copy that spelling exactly.)

`PlanEditorView.ts` (`PlanEditorDeps` gains `readonly openNote: (entityId: string) => Promise<ProjectNoteOpenOutcome>;`; context gains):

```ts
			openPlanNote: async () => {
				const outcome = await this.deps.openNote(planId);
				if (outcome === 'missing') notifyWarning(tr('editor.source-note-missing'));
				// 'failed' has already been reported once, inside the opener.
			},
```

`PlanEditorContext.ts`: `openPlanNote(): Promise<void>;`. `runtime.ts`: `openPlanNote: () => context.openPlanNote()` on the returned object and interface. `tests/helpers/editor.ts`: context gains `openPlanNote: () => { openedNote += 1; return Promise.resolve(); }` and `EditorHarness.openedNote: () => number`. `tests/harness/planEditor.ts` `harnessDeps()`: `openNote: () => Promise.resolve('opened')`.

- [ ] **Step 4: Run green** (`npm run check:fast -- tests/plugin/planEditorWiring.test.ts tests/presentation/views tests/presentation/editor/runtime.test.ts`; `npm run build` names any other `PlanEditorDeps` builder).

- [ ] **Step 5: Commit.**

```bash
git add src/presentation/editor/PlanEditorContext.ts src/presentation/views/PlanEditorView.ts src/plugin/planEditorDeps.ts src/plugin/renovationProjectOpenSeams.ts src/presentation/editor/runtime.ts tests/helpers/editor.ts tests/harness/planEditor.ts tests/presentation/views/planEditorView.test.ts tests/plugin/planEditorWiring.test.ts
git commit -m "feat(editor): the leaf can open its plan's source note through one context door"
```

---

### Task 9: the strip gets actions — Try again, Open source note, and the unrecovered row

**Files:**
- Modify: `src/presentation/editor/shell/warnings.ts`, `src/presentation/editor/shell/PersistentWarningStrip.vue`, `src/presentation/editor/PlanEditorRoot.vue`, `styles/editor.css`
- Test: `tests/presentation/editor/shell/warnings.test.ts`, `tests/presentation/editor/shell.test.ts`, `tests/presentation/editor/planEditorFailure.test.ts`

**Interfaces:**
- Consumes: `ProjectStore.refreshing`, `retriesFailed` (Task 2); `useSaveStateStore().unrecoveredWrite` (Task 3); `runtime.refreshProjection`, `runtime.openPlanNote` (Tasks 5, 8); keys from Task 7.
- Produces:

```ts
export interface WarningAction {
	readonly id: 'retry' | 'open-source-note';
	readonly labelKey: StringKey;
	readonly run: () => void;
	readonly busy: boolean;
}
export type WarningId = 'unrecovered' | 'stale' | 'unreadable-zones' | 'background-missing' | 'background-unreadable';
export interface EditorWarning { …; readonly actions?: readonly WarningAction[]; }
export interface EditorWarningInput {
	readonly unrecoveredWrite: boolean;
	readonly stale: boolean;
	readonly refreshing: boolean;
	readonly retriesFailed: number;
	readonly unreadableZones: number;
	readonly backgroundStatus: BackgroundStatus;
	readonly retry: () => void;
	readonly openSourceNote: () => void;
}
```

Classes: `rp-warning-strip__actions`, `rp-warning-strip__action`.

- [ ] **Step 1: Failing model tests** (`warnings.test.ts`; update the existing fixed-order case to the new input shape with `unrecoveredWrite: false, refreshing: false, retriesFailed: 0, retry: noop, openSourceNote: noop`):

```ts
	it('orders unrecovered first, then stale, unreadable-zones, background-*', () => {
		const w = editorWarnings({ ...clear, unrecoveredWrite: true, stale: true, unreadableZones: 1, backgroundStatus: 'missing' });
		expect(w.map((x) => x.id)).toStrictEqual(['unrecovered', 'stale', 'unreadable-zones', 'background-missing']);
	});
	it('gives the stale row Try again and Open source note, busy while refreshing', () => {
		const retry = vi.fn(); const open = vi.fn();
		const [stale] = editorWarnings({ ...clear, stale: true, refreshing: true, retry, openSourceNote: open });
		expect(stale.actions?.map((a) => [a.id, a.labelKey, a.busy])).toStrictEqual([
			['retry', 'editor.warning.retry', true], ['open-source-note', 'editor.warning.open-source-note', true],
		]);
		stale.actions?.[0].run(); expect(retry).toHaveBeenCalledTimes(1);
	});
	it('moves the stale message to .again after the first failed retry', () => {
		expect(editorWarnings({ ...clear, stale: true })[0].messageKey).toBe('editor.refresh-failed');
		expect(editorWarnings({ ...clear, stale: true, retriesFailed: 1 })[0].messageKey).toBe('editor.refresh-failed.again');
	});
	it('the unrecovered row is an error with Open source note only — nothing to re-read would change it', () => {
		const [row] = editorWarnings({ ...clear, unrecoveredWrite: true });
		expect(row.severity).toBe('error');
		expect(row.messageKey).toBe('editor.unrecovered');
		expect(row.actions?.map((a) => a.id)).toStrictEqual(['open-source-note']);
	});
```

- [ ] **Step 2: Failing strip tests** (`shell.test.ts`, beside the four strip cases):

```ts
	it('renders each action as a button inside its row, aria-busy while refreshing, and Try again re-reads only', async () => {
		const harness = await mountCanvas();
		const store = useProjectStore(harness.pinia);
		store.stale = true;
		await settle();
		const row = harness.wrapper.find('[data-rp-warning="stale"]');
		const buttons = row.findAll('button.rp-warning-strip__action');
		expect(buttons.map((b) => b.text())).toEqual([t('en', 'editor.warning.retry'), t('en', 'editor.warning.open-source-note')]);
		const getPlan = vi.spyOn(/* the harness's queries */ …, 'getPlan');
		await buttons[0].trigger('click');
		expect(getPlan).toHaveBeenCalledTimes(1);
		// no command ran: the harness commands are the refusing bundle and Notice.shown did not grow
		store.refreshing = true; await settle();
		expect(row.attributes('aria-busy')).toBe('true');
		expect(buttons[0].attributes('aria-disabled')).toBe('true');
	});
	it('Open source note asks the context for THIS plan’s note', async () => {
		const harness = await mountCanvas();
		useProjectStore(harness.pinia).stale = true; await settle();
		await harness.wrapper.find('[data-rp-warning="stale"] button[data-rp-action="open-source-note"]').trigger('click');
		expect(harness.openedNote()).toBe(1);
	});
	it('keeps the stale row’s DOM node while its message changes after a failed retry', async () => {
		const harness = await mountCanvas();
		const store = useProjectStore(harness.pinia);
		store.stale = true; await settle();
		const node = harness.wrapper.find('[data-rp-warning="stale"]').element;
		store.retriesFailed = 1; await settle();
		expect(harness.wrapper.find('[data-rp-warning="stale"]').element).toBe(node);
		expect(harness.wrapper.find('[data-rp-warning="stale"]').text()).toContain(t('en', 'editor.refresh-failed.again'));
	});
	it('draws the unrecovered row from the save-state store, and a successful refresh does not clear it', async () => {
		const harness = await mountCanvas();
		useSaveStateStore(harness.pinia).markUnrecovered(); await settle();
		expect(harness.wrapper.find('[data-rp-warning="unrecovered"]').exists()).toBe(true);
		await runtimeOf(harness).refreshProjection(); await settle();
		expect(harness.wrapper.find('[data-rp-warning="unrecovered"]').exists()).toBe(true);
	});
	it('moves focus to the strip when the focused Try again unmounts with a successful retry', async () => {
		// stale → focus the retry button → store.stale = false → settle → document.activeElement is .rp-warning-strip
	});
```

- [ ] **Step 3: Run red.**

- [ ] **Step 4: Implement.** `warnings.ts`:

```ts
export function editorWarnings(input: EditorWarningInput): readonly EditorWarning[] {
	const warnings: EditorWarning[] = [];
	const openSourceNote: WarningAction = { id: 'open-source-note', labelKey: 'editor.warning.open-source-note', run: input.openSourceNote, busy: input.refreshing };
	if (input.unrecoveredWrite) {
		warnings.push({ id: 'unrecovered', severity: 'error', messageKey: 'editor.unrecovered', actions: [{ ...openSourceNote, busy: false }] });
	}
	if (input.stale) {
		warnings.push({
			id: 'stale',
			severity: 'warning',
			messageKey: input.retriesFailed > 0 ? 'editor.refresh-failed.again' : 'editor.refresh-failed',
			actions: [{ id: 'retry', labelKey: 'editor.warning.retry', run: input.retry, busy: input.refreshing }, openSourceNote],
		});
	}
	… (unchanged rows)
```

Update the header docblock: the model now HAS actions and busy; the producer arrived. `PersistentWarningStrip.vue`:

```vue
		<p
			v-for="w in warnings"
			:key="w.id"
			class="rp-warning-strip__item"
			:class="`rp-warning-strip__item--${w.severity}`"
			:data-rp-warning="w.id"
			:data-rp-severity="w.severity"
			:aria-busy="w.actions?.some((a) => a.busy) ? 'true' : undefined"
		>
			<span class="rp-warning-strip__severity">{{ tr(SEVERITY_LABEL[w.severity]) }}</span>
			{{ tr(w.messageKey, w.params) }}
			<span
				v-if="w.actions !== undefined"
				class="rp-warning-strip__actions"
			>
				<button
					v-for="a in w.actions"
					:key="a.id"
					type="button"
					class="rp-warning-strip__action"
					:data-rp-action="a.id"
					:aria-disabled="a.busy ? 'true' : undefined"
					@click="a.busy ? undefined : a.run()"
				>{{ tr(a.labelKey) }}</button>
			</span>
		</p>
```

The container gains `ref="strip"` and `tabindex="-1"`; an `onBeforeUpdate`/watcher on `warnings` records whether `document.activeElement` is inside a row about to disappear and, in `onUpdated`, focuses `strip.value` if `document.activeElement === document.body` (the add-room banner's own recovery pattern). `PlanEditorRoot.vue`:

```ts
const { stale, refreshing, retriesFailed, unreadableZones, status } = storeToRefs(projectStore);
const { unrecoveredWrite } = storeToRefs(useSaveStateStore());
const warnings = computed(() =>
	editorWarnings({
		unrecoveredWrite: unrecoveredWrite.value,
		stale: staleAfterRefresh.value,
		refreshing: refreshing.value,
		retriesFailed: retriesFailed.value,
		unreadableZones: unreadableZones.value,
		backgroundStatus: backgroundStatus.value,
		retry: () => void runtime.refreshProjection(),
		openSourceNote: () => void runtime.openPlanNote(),
	}),
);
```

CSS (`styles/editor.css`, after `.rp-warning-strip__item--warning`):

```css
.rp-warning-strip__actions {
	display: inline-flex;
	gap: var(--size-4-1);
	margin-left: var(--size-4-2);
}

.rp-warning-strip__action {
	font-size: var(--font-ui-smaller);
	padding: 0 var(--size-4-2);
}
```

- [ ] **Step 5: Run green** (`npm run check:fast -- tests/presentation/editor/shell tests/presentation/editor/shell.test.ts tests/presentation/editor/planEditorFailure.test.ts`); update `planEditorFailure.test.ts`'s existing stale-text assertion (`.text()` now includes button labels — assert on the message span or use `toContain`). Mutation-check: hoist `retry` to call `runtime.dispatcher.run(...)`; the Try-again case's "no command ran" assertion goes red.

- [ ] **Step 6: Commit.**

```bash
git add src/presentation/editor/shell/warnings.ts src/presentation/editor/shell/PersistentWarningStrip.vue src/presentation/editor/PlanEditorRoot.vue styles/editor.css tests/presentation/editor/shell/warnings.test.ts tests/presentation/editor/shell.test.ts tests/presentation/editor/planEditorFailure.test.ts
git commit -m "feat(strip): Try again re-reads only, Open source note, and the unrecovered row"
```

---

### Task 10: Saved · refresh needed, and the status bar's paused hint

**Files:**
- Modify: `src/presentation/editor/save-state/SaveStateIndicator.vue`, `styles/editor-status.css`, `src/presentation/editor/shell/StatusBar.vue`
- Test: `tests/presentation/editor/saveState/saveStateIndicator.test.ts`, `tests/presentation/editor/shell/statusBar.test.ts`

**Interfaces:**
- Consumes: `ProjectStore.stale`; `runtime.writesBlocked` (the status bar already takes `activeToolId` as a prop and reads stores; it may read `useProjectStore().stale` directly rather than the runtime, keeping it mountable standalone in the harness index).
- Produces: class `rp-save-state-saved-refresh-needed`; key `save-state.saved-refresh-needed`; class `rp-editor-paused-hint`.

- [ ] **Step 1: Failing tests.** Indicator:

```ts
	it('reads Saved · refresh needed when saved AND the project store is stale, with its own mark class', async () => {
		const wrapper = mount(SaveStateIndicator);
		useProjectStore().stale = true;
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toBe('Saved · refresh needed');
		expect(wrapper.find('.rp-save-state-saved-refresh-needed').exists()).toBe(true);
	});
	it('does not say refresh needed over a save error', async () => { /* resolveErr + stale → 'Save error' */ });
```

Extend `MARK_RULE` with `'saved-refresh-needed': 'own'` and make the "covers every state" case compare against `SAVE_STATE_KEYS` PLUS the derived label — i.e. change `MARK_RULE`'s key type to `SaveState | 'saved-refresh-needed'` and the equality to `[...Object.keys(SAVE_STATE_KEYS), 'saved-refresh-needed'].toSorted()`. Status bar (`statusBar.test.ts`):

```ts
	it('shows the paused hint while the store is stale', async () => {
		const wrapper = mountStatusBar({ activeToolId: 'select' });
		useProjectStore().stale = true; await nextTick();
		expect(wrapper.find('.rp-editor-paused-hint').text()).toBe(t('en', 'editor.hint.paused'));
	});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement.** Indicator:

```ts
const { state } = storeToRefs(useSaveStateStore());
const { stale } = storeToRefs(useProjectStore());
/** Derived, not stored: the write landed, so `saved` is still the truth; `stale` is the qualifier. */
const shown = computed(() => (state.value === 'saved' && stale.value ? 'saved-refresh-needed' : state.value));
const label = computed(() => tr(shown.value === 'saved-refresh-needed' ? 'save-state.saved-refresh-needed' : SAVE_STATE_KEYS[shown.value]));
```

Template class `rp-save-state-${shown}`. CSS (`editor-status.css`, after the unsaved-changes rule — a settled disc with the ring's gap, distinct from all four held still):

```css
/*
 * Saved · refresh needed: the write landed (a filled disc) and the picture may be behind the
 * vault (a gap cut from it). Held still, it is the only mark that is both filled and open.
 */
.rp-save-state-saved-refresh-needed .rp-save-state-mark {
	background-color: currentColor;
	clip-path: polygon(0 0, 100% 0, 100% 45%, 55% 45%, 55% 55%, 100% 55%, 100% 100%, 0 100%);
}
```

Status bar: `const { plan, status, stale } = storeToRefs(useProjectStore());` and a `<span v-if="stale" class="rp-editor-hint rp-editor-paused-hint">{{ tr('editor.hint.paused') }}</span>` after the pan hint.

- [ ] **Step 4: Run green**; `npm run build` (the stylesheet colour check). Commit:

```bash
git add src/presentation/editor/save-state/SaveStateIndicator.vue styles/editor-status.css src/presentation/editor/shell/StatusBar.vue tests/presentation/editor/saveState/saveStateIndicator.test.ts tests/presentation/editor/shell/statusBar.test.ts
git commit -m "feat(status): Saved · refresh needed is derived beside the save state, and the bar says editing is paused"
```

---

### Task 11: every write control pauses, and says why

**Files:**
- Create: `styles/visually-hidden.css`
- Modify: `styles/asset-prices.css` (remove the rule), `styles/index.css` (import), `src/presentation/editor/PlanEditorRoot.vue`, `src/presentation/components/EmptyState.vue`, `src/presentation/editor/add/AddMenu.vue`, `src/presentation/editor/shell/NewRoomInspector.vue`, `src/presentation/editor/shell/TemporaryToolBanner.vue`, `src/presentation/editor/shell/RoomInspector.vue`, `src/presentation/editor/shell/RequirementRow.vue`, `src/presentation/editor/layers/layerCatalogue.ts`, `src/presentation/editor/shell/PropertyLayerPanel.vue`, `src/presentation/editor/shell/LayerList.vue`
- Test: `tests/presentation/editor/pausedSurfaces.test.ts` (new), `tests/presentation/editor/layers/layerCatalogue.test.ts` (find the existing name), `tests/build/prototype-styles.test.ts` only if it enumerates partials

**Interfaces:**
- Consumes: `runtime.writesBlocked`, `runtime.pausedReasonId` (Task 5); `EmptyState` props.
- Produces: `EmptyStateProps` gains `actionDisabled?: boolean`, `actionDescribedBy?: string`; `layerCatalogue(plan, writesBlocked = false)`; `LayerAction.reasonKey` becomes the paused reason when blocked; the hidden sentence `<p :id="runtime.pausedReasonId" class="rp-visually-hidden">` rendered in the root's `warnings` region while blocked.

- [ ] **Step 1: Failing tests** (`pausedSurfaces.test.ts`; `mountPlanEditorCanvas`, `runtimeOf`, `useProjectStore`, `useSelectionStore`, `settle`, `t`):

```ts
async function stalePane(select = false) {
	const harness = await mountPlanEditorCanvas({ commands: defaultPlanEditorCommands(FIXTURE_ZONES) });
	if (select) useSelectionStore(harness.pinia).select(['zone-a' as never]);
	useProjectStore(harness.pinia).stale = true;
	await settle();
	return harness;
}
const reasonOf = (harness, el) => harness.wrapper.find(`#${el.attributes('aria-describedby')!.split(' ').at(-1)}`).text();

describe('write controls while the floor is stale', () => {
	it('renders ONE paused-reason sentence, hidden, with the runtime’s id', async () => {
		const harness = await stalePane();
		const reasons = harness.wrapper.findAll(`#${runtimeOf(harness).pausedReasonId}`);
		expect(reasons).toHaveLength(1);
		expect(reasons[0].classes()).toContain('rp-visually-hidden');
		expect(reasons[0].text()).toBe(t('en', 'editor.paused.reason'));
	});
	it('Add menu entries are aria-disabled with the reason, and activating one does nothing', async () => {
		const harness = await stalePane();
		await harness.wrapper.find('button[data-rp-action="add"]').trigger('click'); await settle();
		const room = harness.wrapper.find('[data-rp-entry="room"]');
		expect(room.attributes('aria-disabled')).toBe('true');
		expect(room.attributes('disabled')).toBeUndefined();
		expect(reasonOf(harness, room)).toBe(t('en', 'editor.paused.reason'));
		await room.trigger('click');
		expect(runtimeOf(harness).activeToolId.value).toBe('select');
	});
	it('the Room Inspector’s Delete, assign and override fields are paused with the reason', async () => {
		const harness = await stalePane(true);
		for (const sel of ['.rp-editor-inspector-delete', '.rp-editor-requirement-assign button', 'input[data-field="quantity"]', 'input[data-field="cost"]']) {
			const el = harness.wrapper.find(sel);
			if (!el.exists()) continue;           // the override fields exist only with a requirement row; seed one in a second case
			expect(el.attributes('aria-disabled')).toBe('true');
			expect(el.attributes('disabled')).toBeUndefined();
			expect(reasonOf(harness, el)).toBe(t('en', 'editor.paused.reason'));
		}
	});
	it('Delete while paused opens no dialog', async () => { /* click .rp-editor-inspector-delete; useDialogStore(harness.pinia).current is null */ });
	it('Set scale is paused with the paused reason even when the plan HAS a background', async () => {
		const harness = await mountPlanEditorCanvas({ plan: { ...FIXTURE_PLAN, background: FIXTURE_BACKGROUND } });
		useProjectStore(harness.pinia).stale = true; await settle();
		const set = harness.wrapper.find('button[data-rp-action="set-scale"]');
		expect(set.attributes('aria-disabled')).toBe('true');
		expect(reasonOf(harness, set)).toBe(t('en', 'editor.paused.reason'));
	});
	it('the no-rooms empty state action is paused', async () => {
		const harness = await mountPlanEditorCanvas({ zones: [], plan: { ...FIXTURE_PLAN, background: FIXTURE_BACKGROUND } });
		useProjectStore(harness.pinia).stale = true; await settle();
		const action = harness.wrapper.find('.rp-empty-state__action');
		expect(action.attributes('aria-disabled')).toBe('true');
		await action.trigger('click');
		expect(runtimeOf(harness).activeToolId.value).toBe('select');
	});
	it('the new-room Create and the banner Finish are paused with BOTH reasons described', async () => {
		const harness = await stalePane();
		runtimeOf(harness).setTool('draw-room'); await settle();
		for (const sel of ['button.rp-new-room__create', 'button.rp-task-banner__finish']) {
			const el = harness.wrapper.find(sel);
			expect(el.attributes('aria-disabled')).toBe('true');
			expect(el.attributes('aria-describedby')!.split(' ')).toContain(runtimeOf(harness).pausedReasonId);
		}
	});
	it('everything is live again when stale clears', async () => {
		const harness = await stalePane(true);
		useProjectStore(harness.pinia).stale = false; await settle();
		expect(harness.wrapper.find('.rp-editor-inspector-delete').attributes('aria-disabled')).toBeUndefined();
		expect(harness.wrapper.findAll(`#${runtimeOf(harness).pausedReasonId}`)).toHaveLength(0);
	});
});
```

Layer catalogue test: `layerCatalogue(planWithBackground, true)[0].action` has `enabled: false, reasonKey: 'editor.paused.reason'`; with `false` the existing shape is unchanged.

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement**, surface by surface.

*Root.* In the `warnings` slot, before `<SelectionGuidance />`:

```vue
				<p
					v-if="runtime.writesBlocked.value"
					:id="runtime.pausedReasonId"
					class="rp-visually-hidden"
				>{{ tr('editor.paused.reason') }}</p>
```

`onEmptyStateAction` returns early when `runtime.writesBlocked.value`; `<EmptyState … :action-disabled="runtime.writesBlocked.value" :action-described-by="runtime.writesBlocked.value ? runtime.pausedReasonId : undefined">`.

*EmptyState.vue.* Props gain `actionDisabled?: boolean; actionDescribedBy?: string`; the button gains `:aria-disabled="actionDisabled ? 'true' : undefined" :aria-describedby="actionDescribedBy"` and `@click="actionDisabled ? undefined : $emit('action')"`. Check `tests/build/prototype-promotion.test.ts` — it holds `ZoneSummary.vue` only, so this template may change.

*AddMenu.vue.* `const runtime = useEditorRuntime();` is already there. Item: `:aria-disabled="entry.availability.kind === 'unsupported' || runtime.writesBlocked.value"`, `:aria-describedby="describedBy(entry)"` where `describedBy` returns the unsupported reason id, else `runtime.pausedReasonId` when blocked, else `undefined`. `activate` gains `if (runtime.writesBlocked.value) return;` first.

*NewRoomInspector.vue / TemporaryToolBanner.vue.* `:aria-disabled="String(!runtime.canCreateRoom.value || runtime.writesBlocked.value)"` and `:aria-describedby="[hintId, runtime.writesBlocked.value ? runtime.pausedReasonId : null].filter(Boolean).join(' ')"` (banner: `instructionId` in place of `hintId`); `onCreate`/`onFinish` return early while blocked.

*RoomInspector.vue.* Delete and the assign button: `:aria-disabled="runtime.writesBlocked.value ? 'true' : undefined" :aria-describedby="runtime.writesBlocked.value ? runtime.pausedReasonId : undefined"`; the handlers guard. `RequirementRow` receives `:paused="runtime.writesBlocked.value" :paused-reason-id="runtime.pausedReasonId"`.

*RequirementRow.vue.* Props gain `paused?: boolean; pausedReasonId?: string`. Each input: `:readonly="paused"`, `:aria-disabled="paused ? 'true' : undefined"`, `:aria-describedby="[aria['aria-describedby'], paused ? pausedReasonId : undefined].filter(Boolean).join(' ') || undefined"` (spread `aria` WITHOUT its own `aria-describedby` — `v-bind="{ 'aria-invalid': aria['aria-invalid'] }"`). Both Reset buttons: the same pair; `resetQuantity`/`resetCost` return early while paused.

*layerCatalogue.ts.*

```ts
export function layerCatalogue(plan: PlanDto | null, writesBlocked = false): readonly LayerEntry[] {
	…
			action: {
				labelKey: 'editor.layer.reference-plan.set-scale',
				toolId: 'calibrate',
				enabled: hasReference && !writesBlocked,
				reasonKey: !hasReference ? 'editor.layer.reference-plan.none' : 'editor.paused.reason',
			},
```

`LayerEntry.reasonKey` for the reference row stays about the background; `LayerList.vue`'s Set scale button becomes `:aria-disabled="!entry.action.enabled ? 'true' : undefined"` (was `:disabled`) with `:aria-describedby` pointing at a NEW per-action reason span rendered from `entry.action.reasonKey` when `!entry.action.enabled` (ids: `ids[entry.id].actionReason = useId()`), and the click handler guards on `enabled`. `PropertyLayerPanel.vue`: `layerCatalogue(props.plan, runtime.writesBlocked.value)` — it will need `useEditorRuntime()`; if the panel is mounted standalone in the harness index without a runtime, read `useProjectStore().stale` instead and say so in a comment.

*Styles.* Move `.rp-visually-hidden` from `asset-prices.css` to a new `styles/visually-hidden.css` (its docblock said "promote it to a partial of its own at the second" caller; this is the second), import it in `index.css` before `asset-prices.css`; update the comment in `asset-prices.css`.

- [ ] **Step 4: Run green** (`npm run check:fast -- tests/presentation/editor`); then `npm run build`. Mutation-check: drop the `activate` guard in AddMenu; the menu case goes red at `activeToolId`.

- [ ] **Step 5: Commit.**

```bash
git add styles/visually-hidden.css styles/asset-prices.css styles/index.css src/presentation/components/EmptyState.vue src/presentation/editor/PlanEditorRoot.vue src/presentation/editor/add/AddMenu.vue src/presentation/editor/shell/NewRoomInspector.vue src/presentation/editor/shell/TemporaryToolBanner.vue src/presentation/editor/shell/RoomInspector.vue src/presentation/editor/shell/RequirementRow.vue src/presentation/editor/layers/layerCatalogue.ts src/presentation/editor/shell/PropertyLayerPanel.vue src/presentation/editor/shell/LayerList.vue tests/presentation/editor/pausedSurfaces.test.ts tests/presentation/editor/layers/
git commit -m "feat(editor): every write control pauses while the floor is stale, and says why"
```

---

### Task 12: Scenario D, undo/redo and reload, end to end

**Files:**
- Modify: `tests/helpers/planEditorRig.ts`
- Create: `tests/presentation/editor/stalePath.e2e.test.ts`, `tests/presentation/editor/history.e2e.test.ts`
- Modify: `tests/infrastructure/persistence/editorRoundTrip.test.ts`, `tests/presentation/views/planEditorView.test.ts`

**Interfaces:**
- Consumes: `rig(seed)`; `createPlanEditorQueries`; `InMemoryZoneRepository`; `mountPlanEditor`; `runtimeOf`; `click`, `pointer`, `actionButton`.
- Produces: `rig(seed?, options?: { wrapQueries?: (queries: PlanEditorQueryServices) => PlanEditorQueryServices })`.

- [ ] **Step 1: Widen the rig.** Add the second parameter; after `const queries = createPlanEditorQueries({…})`, `const wired = options?.wrapQueries?.(queries) ?? queries;` and pass `wired` to `mountPlanEditor`. Existing 45 callers are unchanged.

- [ ] **Step 2: Write `stalePath.e2e.test.ts`** (watch each `it` fail against a build with the gate removed, then restore):

```ts
function flakyAfterFirstReadBack(): { wrap: (q: PlanEditorQueryServices) => PlanEditorQueryServices; fail: () => void; heal: () => void } {
	let failing = false;
	return {
		fail: () => { failing = true; },
		heal: () => { failing = false; },
		wrap: (q) => ({ ...q, getPlan: (id) => (failing ? Promise.resolve(err(HYDRATION_FAULT)) : q.getPlan(id)) }),
	};
}

async function drawRoom(harness) { /* Add → Room → drag 4.2 × 3.8 → name → Create, exactly as roomCreation.e2e.test.ts does — copy its helper */ }

describe('Scenario D — write succeeded, refresh failed', () => {
	it('keeps the pre-command scene, marks stale, pauses new writes, lets undo through, and Try again re-reads only', async () => {
		const flaky = flakyAfterFirstReadBack();
		const { harness, zonesRepo } = await rig(undefined, { wrapQueries: flaky.wrap });
		const runtime = runtimeOf(harness);
		flaky.fail();
		await drawRoom(harness);                                      // the write LANDS, the read-back fails
		expect((await zonesRepo.listByPlan(PLAN_DTO.id as never)).ok && zonesRepo.size).toBe(2);
		expect(harness.wrapper.findAll('.rp-zone-shape')).toHaveLength(1);   // pre-command scene still drawn (use the layer's own selector)
		expect(useProjectStore(harness.pinia).stale).toBe(true);
		expect(harness.wrapper.find('.rp-save-state-label').text()).toBe('Saved · refresh needed');
		expect(harness.wrapper.find('[data-rp-warning="stale"]').exists()).toBe(true);
		// a Select drag draws no ghost and commits nothing
		const saves = zonesRepo.operations.filter((op) => op === 'save').length;   // or count via a spy on zonesRepo.save
		await moveZoneA(harness);
		expect(runtime.renderState.previewPolygon).toBeNull();
		expect(zonesRepo.saveCalls).toBe(saves);
		// Delete is paused
		expect(harness.wrapper.find('.rp-editor-inspector-delete').attributes('aria-disabled')).toBe('true');
		// undo is LIVE while stale
		await runtime.undo(); await settle();
		expect(zonesRepo.size).toBe(1);
		// a retry that fails again
		await harness.wrapper.find('[data-rp-warning="stale"] button[data-rp-action="retry"]').trigger('click'); await settle();
		expect(harness.wrapper.find('[data-rp-warning="stale"]').text()).toContain(t('en', 'editor.refresh-failed.again'));
		// a retry that succeeds clears everything
		flaky.heal();
		await harness.wrapper.find('[data-rp-warning="stale"] button[data-rp-action="retry"]').trigger('click'); await settle();
		expect(harness.wrapper.find('[data-rp-warning="stale"]').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-save-state-label').text()).toBe('Saved');
		expect(harness.wrapper.find('.rp-editor-inspector-delete').attributes('aria-disabled')).toBeUndefined();
		expect(zonesRepo.saveCalls).toBe(saves);                      // three retries, zero writes
	});
	it('redo while stale is live too', async () => { /* stale → undo → redo → 2 zones, same id */ });
});
```

Wrap `InMemoryZoneRepository.save` with a counting spy in the test (`vi.spyOn(zonesRepo, 'save')`) rather than adding a `saveCalls` member to production code.

- [ ] **Step 3: Write `history.e2e.test.ts`** (rig, no flakiness):

```ts
describe('one history per leaf', () => {
	it('one Undo runs one inverse, counted at the repository', …);           // spy on zonesRepo.delete: exactly 1 after undoing a create
	it('a new action after Undo empties the redo branch', …);               // create, undo, move zone-a → canRedo false
	it('a no-write success creates no history entry and moves no badge', …); // assign an already-assigned asset through commitEdit → canUndo unchanged, state 'saved'
	it('a revision conflict on Undo surfaces once and leaves the stack coherent', …); // externallyTouchZoneA then undo the move → Notice.shown grows by 1, canUndo still true (pinned as the recorded undo.superseded behaviour)
	it('an Undo whose refresh fails marks stale, and Try again re-reads only (4b)', …); // wrapQueries flaky; undo; stale true; retry heals; no delete/save re-run
});
```

- [ ] **Step 4: Reload cases.** `editorRoundTrip.test.ts`: reopen through `PlanEditorView` in `planEditorView.test.ts` is where a VIEW mounts; add there:

```ts
	it('reopening the same plan shows the same room: id, name, type, points and area', async () => {
		// mount view A over deps whose queries read the fixture stack; unmount (view.onClose); mount view B over the same deps; compare the RoomSummaryList rows and the Room Inspector fields to the first mount's
	});
	it('a restored view state naming a deleted zone opens in Select with every valid room drawn', async () => { /* setState({planId}) after the zone is gone from the queries; activeToolId 'select'; rows = remaining zones */ });
```

And in `editorRoundTrip.test.ts`, one case: a zone saved through the REAL `CreateZoneCommand` (the add-room increment added one; if present, extend it) read back after `rebuildIndex()` — a second `createRepositoryStack` over the same `FakeVault` bytes — carries the same id, name, `'Room'`, four points and area.

- [ ] **Step 5: Run green** (`npm run check:fast -- tests/presentation/editor/stalePath.e2e.test.ts tests/presentation/editor/history.e2e.test.ts tests/presentation/views tests/infrastructure/persistence/editorRoundTrip.test.ts`). Mutation-check Scenario D by removing `withStaleGate` from the chain: the "commits nothing" and "Delete is paused" assertions go red.

- [ ] **Step 6: Commit.**

```bash
git add tests/helpers/planEditorRig.ts tests/presentation/editor/stalePath.e2e.test.ts tests/presentation/editor/history.e2e.test.ts tests/infrastructure/persistence/editorRoundTrip.test.ts tests/presentation/views/planEditorView.test.ts
git commit -m "test(editor): Scenario D end to end, the history's PBI criteria, and reload"
```

---

### Task 13: accessibility scans

**Files:**
- Modify: `tests/harness/accessibility.test.ts`

- [ ] **Step 1: Three cases**, after 'reports no semantic violations on the Room Inspector in the full layout…', each following the banner case's shape (mount, drive, ASSERT PRESENCE, `axe.run`, `[]`):

```ts
	it('reports no semantic violations on the stale strip with its two actions', async () => {
		mounted = await mountPlanEditor();
		useProjectStore(mounted.pinia).stale = true; await settle();
		expect(mounted.wrapper.findAll('[data-rp-warning="stale"] button')).toHaveLength(2);
		…
	});
	it('reports no semantic violations on the Room Inspector with every write control paused', async () => {
		mounted = await mountPlanEditor(); select zone-a; stale = true; settle;
		expect(mounted.wrapper.find('.rp-editor-inspector-delete').attributes('aria-disabled')).toBe('true');
		…
	});
	it('reports no semantic violations on the constrained Inspector drawer while paused', async () => { /* resizeTo constrained, open Details, stale, presence of the paused delete, scan */ });
```

- [ ] **Step 2: Run** `npx vitest run tests/harness/accessibility.test.ts`. Fix any violation in the COMPONENT, never by narrowing the scan. Commit:

```bash
git add tests/harness/accessibility.test.ts
git commit -m "test(a11y): the stale strip, the paused Inspector and the paused drawer are scanned"
```

---

### Task 14: the harness knob and two captures

**Files:**
- Modify: `tests/harness/planEditor.ts`, `tests/harness/page.ts`, `scripts/harness-shot.mjs`, `tests/build/harness-shot.test.ts`

- [ ] **Step 1: The knob.** `PlanEditorHarnessOptions` gains `readonly stale?: boolean`. In `harnessDeps()` make `getPlan` consult a module-level `let staleAfterFirst = false; let reads = 0;` — when the knob is on, the SECOND `getPlan` (the read-back) and every later one answer `err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'harness: stale knob' })`. `mountPlanEditorHarness` with `options.stale`: after `onOpen`, `settleUntil` the floor state renders, then call `runtimeOf`-equivalent `view`'s store hydrate with `keepPreviousOnFailure: true` — the harness does not expose the runtime; instead expose `HARNESS_STALE_KNOB` that `harnessDeps` reads and trigger the second read by dispatching `changePlan` (the plan-change listener the view subscribed) — read `tests/harness/planEditor.ts` for the listener set it already keeps and call it. `page.ts`: `const wantsStale = params.has('stale');` → `{ …, stale: wantsStale }`.

- [ ] **Step 2: Two shots** in `harness-shot.mjs`, after `plan-editor-add-room-narrow` (add-room's):

```js
	{ name: 'plan-editor-stale', query: '?view=plan-editor&select=harness-kitchen&stale&theme=light', selector: '[data-rp-warning="stale"] button' },
	{ name: 'plan-editor-stale-narrow', query: '?view=plan-editor&select=harness-kitchen&stale', selector: '[data-rp-warning="stale"] button', width: 460 },
```

Add both names to the inventory in `tests/build/harness-shot.test.ts` (sorted). Run `npx vitest run tests/build/harness-shot.test.ts`.

- [ ] **Step 3: Capture and READ.** `npm run harness-shot plan-editor-stale` (or the fixed set); open both PNGs with the Read tool. Look for: the strip's two buttons on one line with the sentence; the fifth save-state label not wrapping at 460; the paused Delete visibly dimmed (the harness CSS dims `[aria-disabled="true"]`). Fix layout defects in `styles/editor.css`, recapture, re-read. Record what was seen in the task report.

- [ ] **Step 4: Commit.**

```bash
git add tests/harness/planEditor.ts tests/harness/page.ts scripts/harness-shot.mjs tests/build/harness-shot.test.ts styles/editor.css
git commit -m "harness: a ?stale knob and two captures of the paused editor"
```

---

### Task 15: the record — manual cases, statuses, CLAUDE.md

**Files:**
- Create: `docs/tests/cases/Recover from a stale read.md`, `docs/tests/cases/Reload a room.md`
- Modify: `docs/tests/suites/Smoke Test the Editor.md`; `docs/requirements/Recover safely from failed writes and stale reads.md`, `Undo and redo.md`, `Reload the editor without losing room data.md`, `Release hardening.md`, `Editor foundation.md`; the ten task notes under those PBIs; `docs/tasks/Preserve room inspection across layout and read changes.md`, `docs/tasks/Render independent simultaneous persistent warnings.md`; `docs/superpowers/specs/2026-09-04-plan-editor-trust-path-design.md` (Amendment 1 if Task 1 dropped the update code); `CLAUDE.md`

- [ ] **Step 1: Manual cases**, in the shape of `Open a floor and select a room.md` (frontmatter `type: Test case`, `parent: "[[Smoke Test the Editor]]"`, `order: 95` and `100`, `status: Ready`; a "Why a human is the only instrument" section; a Steps table with `Reachable by` verdicts; a Runs table reading "Not yet run in a vault"). `Recover from a stale read.md` steps: open the sample floor; make the plan note unreadable by the plugin after the next write (rename the plan's `Plan.md` to a name Obsidian keeps open — or set it read-only at the OS — record the fault setup used); draw a room; observe the strip, the label, the paused Add entries and Delete (`obsidian`); press Undo (`obsidian`); press Try again with the fault still in place (`obsidian`); remove the fault, Try again (`obsidian`); Open source note (`obsidian`); confirm exactly one room note was written (`obsidian`). `Reload a room.md` steps: create a room; close the leaf and reopen the plan; restart Obsidian and let the workspace restore; both times the same room, id, area (`obsidian`); no duplicate note or sidecar object (`obsidian`). Add both to the census list in the smoke suite with one line each.

- [ ] **Step 2: Statuses.** Each of the three PBIs: `status: Done`, `finished: 2026-09-XX` (the date of the commit), plus a dated `## Amendments` naming the holding test per criterion — and for `Undo and redo` criterion 2, that keyboard reach is the two context-bar buttons and no hotkey; for `Recover safely` criterion 4 (2b), that the unrecovered row is drawn from the stamp and what the stamp cannot see (a post-write refusal in a pre-write category anywhere else — CLAUDE.md's own residue). Each of the ten task notes: `status: Done` with a dated `## Outcome` line naming the test. The two Active tasks: append a dated paragraph closing the half this increment closes (`Preserve…` criterion 4: writes are paused, `pausedSurfaces.test.ts`; `Render…` criterion 3 heading/busy and 6 keyboard: the heading clause stays OPEN — no warning has a heading and none was asked for here — say so). `Release hardening.md`: `status: Active`, a `## Progress` paragraph. `Editor foundation.md`: replace "Checkpoint C2 … is the next increment" with the C2 and C3 landings.

- [ ] **Step 3: CLAUDE.md.** After the add-room increment's section, a section titled **"The trust path has landed: a stale read is a state you can act on."** covering, in this file's register: what shipped (gate, refresh identity, derived label, source-note door, the repository code split); the rules that came out of building it (fill from the task reports — every "measured", every mutation that did or did not discriminate, every fake widened); and the residues by name (§11 of the spec). Update the sentence in the slice-13 section that describes `SaveState` as four states only if it now reads false; leave the `MIGRATION_SET` grep sentences alone (nothing here touches a table).

- [ ] **Step 4: Commit.**

```bash
git add docs/tests/cases/Recover\ from\ a\ stale\ read.md docs/tests/cases/Reload\ a\ room.md docs/tests/suites/ docs/requirements/ docs/tasks/ docs/superpowers/specs/2026-09-04-plan-editor-trust-path-design.md CLAUDE.md
git commit -m "docs: the trust path's record — two manual cases, three PBIs closed, the increment's section"
```

---

### Task 16: finish

- [ ] **Step 1: Full gate on a quiet tree.** `npm run check` (foreground, `timeout: 600000`). Read `coverage/coverage-final.json` for every file this branch changed; any `0` count in a new arm is fixed here, not noted.
- [ ] **Step 2: Bundle size.** `npm run build` and record `dist/main.js`'s size in the CLAUDE.md section beside the previous figure.
- [ ] **Step 3: Whole-branch review** (`superpowers:requesting-code-review`): the reviewer reads the spec's §2.9 table against `pausedSurfaces.test.ts`, and the "Residues" list against what the code does.
- [ ] **Step 4: Pull request** via `gh pr create`, body from the spec's §1, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Self-review against the spec

- §2.1 → nothing writes `stale` (Tasks 2–11 read it; grep `stale = ` in the diff before Task 16). §2.2 → Task 4, 5. §2.3 → Task 5 (`createProjectionRefresh`, type test). §2.4 → Tasks 2, 9. §2.5 → Task 10. §2.6 → Task 8. §2.7 → Task 1. §2.8 → Tasks 3, 9. §2.9 → Tasks 6, 10, 11. §2.10 → no task changes a schema (Task 12 proves the round trip). §7 → Task 1 (cases 1–2) and Task 12 (case 3). §8 → Task 12. §9 → Tasks 1–14 by row. §10 → Task 9 (strip focus). §11 → Task 15. §12 gate → Prerequisite.
- Names used consistently: `withStaleGate`, `STALE_WRITE_REFUSED`, `staleWriteRefusal`, `createProjectionRefresh`, `refreshProjection`, `writesBlocked`, `pausedReasonId`, `openPlanNote`/`openNote`/`planEditorOpenNote`, `refreshing`, `retriesFailed`, `unrecoveredWrite`/`markUnrecovered`, `WarningAction`, `failOnce`, `zone.sidecar-insert-uncompensated`/`-update-uncompensated`, `save-state.saved-refresh-needed`, `rp-save-state-saved-refresh-needed`, `rp-warning-strip__action`, `rp-editor-paused-hint`, `rp-visually-hidden`.
- Known soft spots, stated: Task 1's update arm depends on the `modify` ordering in `saveQueued` and may be dropped with an amendment; Task 5's chain-order mutation may not discriminate and says so; Task 14's knob needs the harness's plan-change listener, which the executor reads rather than this plan asserting its name.

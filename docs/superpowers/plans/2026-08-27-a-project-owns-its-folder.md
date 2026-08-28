# Design Slice 18 — A Project Owns Its Folder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a project's folder the folder its `Project.md` sits in, so each project owns
its own folder, and bound the Project Index by what a note declares rather than by where it
sits.

**Architecture:** Two deletions and one conversion. The Project Index and the vault-change
pipeline stop filtering by a path prefix and ask the note's frontmatter instead, through one
shared function. `NoteVaultDeps.projectFolder` — a folder cached in five repository
constructors — is deleted; each save resolves its folder from the entity being written, via
the Project Index. The plugin setting survives as the root a NEW project's folder is created
under, and nothing else. No entity, no command, no rendering, no schema change, no migration.

**Tech Stack:** TypeScript, Obsidian API 1.13.0, Vitest, ESLint + oxlint, fallow.

**Spec:** [`docs/superpowers/specs/2026-08-27-a-project-owns-its-folder-design.md`](../specs/2026-08-27-a-project-owns-its-folder-design.md)

## Global Constraints

- **Definition of done is `npm run check`** — build + lint + coverage-thresholded tests +
  fallow. All four must pass before every commit. Run it as
  `npm run check > /tmp/check.log 2>&1; echo $?` and read the code — a piped run reports the
  status of the last stage, so `npm run check 2>&1 | tail` always says 0.
- **Coverage floors are 99/99/99/98** (statements/functions/lines/branches). Branches sat at
  98.14 at the last recorded measurement, roughly three branches of headroom at 0.046pp each.
  **Every new branch arm gets its test in the commit that adds it** — an untested arm does not
  lower coverage, it fails the gate.
- **A dead export fails `npm run analyze`.** Never commit an exported function whose only
  callers are tests. If a task's export has no `src/` caller yet, that task also lands its
  caller.
- **Layer rule:** `infrastructure → application (its ports) → domain → core`. `infrastructure/`
  may name `obsidian`; `core/`, `domain/` and `application/` may not.
- **Never write to the vault outside `infrastructure/`** — `WRITE_BOUNDARY` in
  `eslint.config.mjs` enforces it at the write calls.
- **No `eslint-disable` / `oxlint-disable` comments anywhere.** `linterOptions.noInlineConfig`
  refuses the whole class, and `tests/build/suppressions.test.ts` scans for oxlint's.
- **The linter runs after every Edit and Write** (`scripts/lint-edited.mjs`) and hands you its
  findings as a tool error. Fix them before moving on; it does not roll the edit back.
- **Tabs, not spaces**, matching every file in `src/`.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **Branch:** `slice/18-a-project-owns-its-folder`, already created and holding the spec.

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `docs/adrs/0013-a-project-folder-is-derived-from-its-note.md` | The decision, and why `Identity is the id…` does not forbid it |
| `tests/infrastructure/persistence/index/entityRef.test.ts` | `entityRefOf`'s arms, and its exact caller set |
| `tests/infrastructure/obsidian/repositories/perProjectFolders.test.ts` | Two projects in different folders; every entity at its own project's path |

**Modified:**

| File | Change |
|---|---|
| `src/infrastructure/persistence/index/buildProjectIndexEntries.ts` | `entityRefOf` added; `ScanInput.projectFolder` and both prefix bounds removed |
| `src/infrastructure/persistence/index/VaultChangeAdapter.ts` | `deps.projectFolder` and both prefix bounds removed; sidecar plan id from the basename |
| `src/infrastructure/obsidian/repositories/paths.ts` | `joinFolder`, `freshProjectFolder`, `projectFolderOf` added; the five `*FolderFor` helpers use `joinFolder` |
| `src/infrastructure/obsidian/repositories/NoteVaultDeps.ts` | `projectFolder` deleted |
| `src/infrastructure/obsidian/repositories/ObsidianProjectRepository.ts` | Takes `newProjectRoot`; existence via the index; insert derives its own folder |
| `src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts` | Folder per save, from the owning project |
| `src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts` | Folder per save, from the owning project |
| `src/infrastructure/obsidian/repositories/ObsidianAssetRepository.ts` | Folder per save, from the owning project |
| `src/infrastructure/obsidian/repositories/ObsidianRequirementRepository.ts` | Folder per save, from the owning project |
| `src/plugin/composition-root.ts` | Stops passing `projectFolder` into deps and the change adapter; passes `newProjectRoot` to the project repository |
| `src/plugin/RenovationPlannerPlugin.ts` | `startPersistence` stops passing `projectFolder` to the scan |
| `src/plugin/settings/SettingsTab.ts` | The setting's copy says "where a new project is created" |
| `tests/helpers/vault.ts` | Stack drops `deps.projectFolder`; `newProjectRoot` for the project repository; `rebuildIndex` takes no folder |
| `docs/tasks/18-a-project-owns-its-folder.md` | The five corrections, and the ADR number |
| `CLAUDE.md` | What the index is bounded by, and what the setting still does |
| `vitest.config.ts` | A fresh coverage measurement |

**Deliberately NOT created:** `foldersOverlap`, `IndexRoots`, and any file mover. All three
belong to slice 19, where they have callers. See the spec's *No migration* section.

---

### Task 1: ADR-0013 — a project's folder is derived

**Files:**
- Create: `docs/adrs/0013-a-project-folder-is-derived-from-its-note.md`
- Modify: `docs/tasks/18-a-project-owns-its-folder.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the decision every later task is written against. No code.

Write the ADR before the code, because the two candidate shapes produce different schemas and
the ADR is the artefact that survives the choice.

- [ ] **Step 1: Read the precedent**

Read `docs/adrs/0011-project-scoped-geometry-sidecar-folder-and-file-extension.md` in full,
and copy its front-matter shape (status, date, context/decision/consequences headings) exactly
— the new ADR must look like its siblings.

- [ ] **Step 2: Write the ADR**

Create `docs/adrs/0013-a-project-folder-is-derived-from-its-note.md`. **The number is 0013, not
0012** — `0012-price-component-placement-in-the-cost-pipeline.md` already exists.

It must contain, in the repository's voice:

1. **The decision.** A project's folder is `parentOf(<its Project.md>.path)`. Nothing is
   persisted, no schema version moves.
2. **ADR-011's precedent.** ADR-011 chose a project-scoped sidecar folder so that "a project
   moves as one folder"; the derived shape is what preserves that property. PRD §36's
   2026-08-26 amendment restates it: "The project folder still moves, backs up and deletes as
   one unit."
3. **The rejected alternative**, a stored `folder:` field on `Project`, with ADR-011's own
   argument turned against it — *"there is no setting left holding a path that has quietly gone
   stale."* A stored folder goes stale the first time a user drags the folder in Obsidian's
   file explorer, and every subsequent write then lands beside their work rather than in it. It
   also buys nothing on discovery: finding the projects means finding the `Project.md` notes
   either way.
4. **Why [[Identity is the id, never the filename, title or path]] does not forbid this.** That
   rule governs *identity* — which project this is, which note answers to an id, what a read
   resolves through. A derived folder uses the note's path to answer a different question:
   *where do this project's other notes go*. Reads still resolve through the index by id. Say
   this explicitly; the rule's name reads as though it settles the question and it does not.
5. **The deviation from PRD §83.** §83 lists "project folder" under Project Settings. The
   derived shape makes it not a setting at all — it is a property of location. State the
   deviation plainly rather than letting the code quietly disagree with the PRD.
6. **What remains a setting:** the default projects folder, the root a NEW project's folder is
   created under. It is a real setting, it stays configurable, and it stops being the answer to
   "where is this entity".

- [ ] **Step 3: Correct the slice document**

In `docs/tasks/18-a-project-owns-its-folder.md`, make five edits. Do not rewrite the document;
each edit is a correction with its reason attached, in the style the repository already uses
for superseded claims.

1. Every "ADR-012" becomes "ADR-0013", with a parenthetical saying 0012 is slice 9's
   price-component ADR.
2. The performance sentence — "`frontmatterOf` is what costs, and it is called on the same set
   either way" — is corrected: `collectNotes` filters by path prefix *before* calling
   `frontmatterOf`, so the call count is not unchanged. It is a `MetadataCache` map lookup plus
   an `EchoWindow` check rather than a file read, which is why the cost is acceptable — but the
   sentence as written was false and cited §102.
3. "A single-project vault — which is every vault this plugin has ever produced" is corrected:
   `create-sample-project` run twice seeds two projects into one folder, because
   `freshNotePath` dedupes the second `Project.md` with an id suffix.
4. The "Staying green" commit 1 — "`foldersOverlap` and the root-list types, with nobody
   calling them" — is corrected: a `src/` export with no `src/` caller fails `npm run analyze`.
   `foldersOverlap` and `IndexRoots` move to slice 19.
5. The migration section and the orphan-diagnostic Definition of Done item are marked
   **withdrawn**, each with its reason (the derived shape leaves nothing to move; a declared
   bound leaves no orphan to report), pointing at the spec.

- [ ] **Step 4: Run the gate**

Run: `npm run check > /tmp/check.log 2>&1; echo $?`
Expected: `0`. Documentation-only, so nothing should move — but `docs/` has already reddened
CI once (a new `docs/` stylesheet fallow could not reach), so run it.

- [ ] **Step 5: Commit**

```bash
git add docs/adrs/0013-a-project-folder-is-derived-from-its-note.md docs/tasks/18-a-project-owns-its-folder.md
git commit -m "$(cat <<'EOF'
docs: ADR-0013 derives a project's folder from its note

A project's folder is the folder its Project.md sits in. Nothing is stored, so
nothing goes stale, and moving a project in Obsidian's file explorer moves the
project — ADR-011's own property, which PRD §36's amendment restates.

The rejected stored field is refused with ADR-011's own argument: a setting
holding a path that has quietly gone stale. It also buys nothing on discovery,
since finding the projects means finding the Project.md notes either way.

The slice document carries five corrections in the same commit: the ADR number
(0012 is slice 9's), the false performance sentence, the untrue single-project
claim, the commit-1 ordering that would have failed analyze, and the two
withdrawn deliverables.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `entityRefOf` — one answer to "is this note ours"

**Files:**
- Modify: `src/infrastructure/persistence/index/buildProjectIndexEntries.ts`
- Modify: `src/infrastructure/persistence/index/VaultChangeAdapter.ts`
- Create: `tests/infrastructure/persistence/index/entityRef.test.ts`

**Interfaces:**
- Consumes: `ENTITY_TYPES`, `EntityType` from `src/application/ports/ProjectIndex.ts`.
- Produces:
  ```ts
  export function entityRefOf(
      frontmatter: Record<string, unknown>,
  ): { type: EntityType; id: string } | undefined;
  ```
  Exported from `buildProjectIndexEntries.ts`, beside `stringField`, which is exported from
  there for exactly the same reason.

`collectNotes` and `processNote` each hand-spell the same "`type` is one of ours and `id` is a
non-empty string" test today — two copies of one invariant, the shape `stringField` was
extracted to prevent, one level up. The full scan and the incremental run disagreeing about a
note is the defect being guarded.

Note the asymmetry to preserve: `entityRefOf` answers `undefined` both for "not ours" and for
"ours but declares no id", and the two callers must still tell those apart, because only the
second logs a diagnostic. So `entityRefOf` returns `undefined` and each caller re-asks the
cheap question it needs. Model it as a two-step: `entityTypeOf` is not a second function —
instead `entityRefOf` returns a discriminated answer.

- [ ] **Step 1: Write the failing test**

Create `tests/infrastructure/persistence/index/entityRef.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { entityRefOf } from '../../../../src/infrastructure/persistence/index/buildProjectIndexEntries';

describe('entityRefOf', () => {
	it('answers the declared type and id for a note of ours', () => {
		expect(entityRefOf({ type: 'renovation-zone', id: 'z1' })).toEqual({
			kind: 'ours',
			type: 'renovation-zone',
			id: 'z1',
		});
	});

	it('answers not-ours for empty frontmatter', () => {
		expect(entityRefOf({})).toEqual({ kind: 'not-ours' });
	});

	it('answers not-ours for a type this plugin does not own', () => {
		expect(entityRefOf({ type: 'daily-note', id: 'x' })).toEqual({ kind: 'not-ours' });
	});

	it('answers not-ours for a non-string type', () => {
		expect(entityRefOf({ type: 7, id: 'x' })).toEqual({ kind: 'not-ours' });
	});

	it('distinguishes ours-but-idless from not-ours, because only one is a diagnostic', () => {
		expect(entityRefOf({ type: 'renovation-plan' })).toEqual({ kind: 'no-id' });
		expect(entityRefOf({ type: 'renovation-plan', id: '' })).toEqual({ kind: 'no-id' });
		expect(entityRefOf({ type: 'renovation-plan', id: 42 })).toEqual({ kind: 'no-id' });
	});
});

/**
 * The claim is "one function answers this, and exactly two callers ask it". A docblock
 * saying so is worth nothing without the measurement, so the measurement is the test.
 *
 * The instrument's blind spot, stated rather than implied: this reads source TEXT, so a
 * call reached through a re-export under another name is invisible to it. Nothing
 * re-exports this module today.
 */
function sourceFilesUnder(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sourceFilesUnder(path);
		return path.endsWith('.ts') || path.endsWith('.vue') ? [path] : [];
	});
}

describe('entityRefOf callers', () => {
	it('is named by exactly two modules in src/, and they are the scan and the pipeline', () => {
		const naming = sourceFilesUnder('src').filter((path) =>
			readFileSync(path, 'utf8').includes('entityRefOf'),
		);
		expect(naming.map((path) => path.replaceAll('\\', '/')).sort()).toEqual([
			'src/infrastructure/persistence/index/VaultChangeAdapter.ts',
			'src/infrastructure/persistence/index/buildProjectIndexEntries.ts',
		]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/infrastructure/persistence/index/entityRef.test.ts`
Expected: FAIL — `entityRefOf` is not exported from `buildProjectIndexEntries`.

- [ ] **Step 3: Add `entityRefOf`**

In `src/infrastructure/persistence/index/buildProjectIndexEntries.ts`, beside `stringField`:

```ts
/**
 * What a note DECLARES itself to be — the one answer both the full scan and the
 * incremental pipeline resolve, so the two cannot disagree about a note. Same reason
 * `stringField` above is exported, one level up.
 *
 * Three answers rather than two, because the callers need three: `not-ours` is silent
 * and correct, while `no-id` is a note of ours that cannot be indexed and is therefore a
 * diagnostic. The two used to be told apart by each caller re-spelling the whole test.
 */
export type EntityRef =
	| { kind: 'ours'; type: EntityType; id: string }
	| { kind: 'no-id' }
	| { kind: 'not-ours' };

export function entityRefOf(frontmatter: Record<string, unknown>): EntityRef {
	const type = frontmatter['type'];
	if (typeof type !== 'string' || !ENTITY_TYPES.includes(type as EntityType)) {
		return { kind: 'not-ours' };
	}
	const id = stringField(frontmatter['id']);
	return id === undefined ? { kind: 'no-id' } : { kind: 'ours', type: type as EntityType, id };
}
```

`ENTITY_TYPES` is already imported in this file. `stringField` is declared above it — move
`entityRefOf` below `stringField` so the declaration order reads.

- [ ] **Step 4: Convert `collectNotes`**

Replace the type/id block in `collectNotes` (the `const type = …` through the
`entries.set(id, …)` call) with:

```ts
		const ref = entityRefOf(frontmatter);
		if (ref.kind === 'not-ours') continue;
		if (ref.kind === 'no-id') {
			input.logger.warn('persistence.index.note-excluded', {
				path: file.path,
				reason: 'a note of this plugin must declare a non-empty id',
			});
			continue;
		}

		warnOnDuplicate(input.logger, entries.get(ref.id), ref.id, file.path);
		entries.set(ref.id, {
			id: ref.id as EntityId<string>,
			type: ref.type,
			path: file.path,
			projectId: stringField(frontmatter['project']) as ProjectId | undefined,
			planId: stringField(frontmatter['plan']) as PlanId | undefined,
		});
		input.echo.markFrontmatter(file.path, frontmatter);
```

Delete the now-redundant `if (Object.keys(frontmatter).length === 0) continue;` — empty
frontmatter has no `type`, so `entityRefOf` answers `not-ours` and the behaviour is identical.
**Removing a branch is what keeps coverage from moving**; do not leave it in as a fast path.

- [ ] **Step 5: Convert `processNote`**

In `src/infrastructure/persistence/index/VaultChangeAdapter.ts`, replace the type block and the
id block in `processNote` with:

```ts
		const ref = entityRefOf(frontmatter);
		if (ref.kind !== 'ours') {
			if (ref.kind === 'no-id') {
				this.deps.logger.warn('persistence.pipeline.note-excluded', {
					path,
					reason: 'a note of this plugin must declare a non-empty id',
				});
			}
			// Not ours — but if it USED to be, it changed into something we cannot index.
			if (existing) {
				this.deps.index.remove(existing.id);
				this.deps.echo.forget(path);
			}
			return;
		}
```

Then use `ref.id` and `ref.type` in the `upsert` below it, replacing the `id as …` and
`type as …` casts.

**Behaviour note to preserve deliberately:** the old code removed the echo record only on the
not-ours arm, and removed the index entry on both. The block above forgets the echo on both
arms. That is the correction, not a slip — a note of ours that lost its id is exactly as
unindexable as a note that stopped being ours, and leaving its echo record behind makes the
next write to that path suppress itself. Import `entityRefOf` beside the existing
`stringField` import.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/infrastructure/persistence/index/`
Expected: PASS, all five files.

- [ ] **Step 7: Run the gate**

Run: `npm run check > /tmp/check.log 2>&1; echo $?`
Expected: `0`. If branches moved, read the coverage report — `entityRefOf`'s arms are all
driven by Step 1's test, and the two callers each lost arms rather than gaining any.

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/persistence/index tests/infrastructure/persistence/index/entityRef.test.ts
git commit -m "$(cat <<'EOF'
refactor: one answer to whether a note is ours

collectNotes and processNote each hand-spelled the same "type is one of ours
and id is a non-empty string" test — two copies of one invariant, which is the
shape stringField was extracted to prevent one level up, and the defect being
guarded is the full scan and the incremental run disagreeing about a note.

entityRefOf answers three cases rather than two, because the callers need
three: not-ours is silent and correct, no-id is a note of ours that cannot be
indexed and is therefore a diagnostic.

The caller count is measured rather than asserted, and the instrument's blind
spot — it reads source text, so a re-export under another name is invisible —
is written beside it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The Project Index scans the whole vault

**Files:**
- Modify: `src/infrastructure/persistence/index/buildProjectIndexEntries.ts`
- Modify: `src/plugin/RenovationPlannerPlugin.ts:326-333`
- Modify: `tests/helpers/vault.ts:355-370`
- Modify: `tests/infrastructure/persistence/index/index.test.ts`

**Interfaces:**
- Consumes: `entityRefOf` from Task 2.
- Produces:
  ```ts
  interface ScanInput {
      vault: Vault;
      metadataCache: MetadataCache;
      echo: EchoWindow;
      logger: Logger;
  }                                      // `projectFolder` deleted
  export function buildProjectIndexEntries(input: ScanInput): ProjectIndexEntry[];
  ```
  `RepositoryStack.rebuildIndex(): void` keeps its signature; its body drops the folder.

- [ ] **Step 1: Write the failing test**

Append to `tests/infrastructure/persistence/index/index.test.ts` (match the file's existing
fixture style — read it first and reuse its helpers rather than inventing new ones):

```ts
	it('indexes a note of ours that sits outside the configured folder', () => {
		const stack = createRepositoryStack('Renovation');
		stack.vault.entries.set(
			'Somewhere Else/Kitchen/Project.md',
			serializeFrontmatter({ type: 'renovation-project', id: 'p-outside', 'schema-version': 1 }),
		);
		stack.catchUp();

		stack.rebuildIndex();

		expect(stack.index.getPath('p-outside' as never)).toBe('Somewhere Else/Kitchen/Project.md');
	});

	it('joins a sidecar that sits outside the configured folder', () => {
		const stack = createRepositoryStack('Renovation');
		stack.vault.entries.set(
			'Elsewhere/Plans/Ground floor.md',
			serializeFrontmatter({ type: 'renovation-plan', id: 'pl-outside', 'schema-version': 1 }),
		);
		stack.vault.entries.set('Elsewhere/Geometry/pl-outside.rpgeo', '{}');
		stack.catchUp();

		stack.rebuildIndex();

		expect(stack.index.getGeometrySidecarPath('pl-outside' as never)).toBe(
			'Elsewhere/Geometry/pl-outside.rpgeo',
		);
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/infrastructure/persistence/index/index.test.ts`
Expected: FAIL — both assertions get `undefined`, because `collectNotes` filters by
`Renovation/` and `listSidecars` filters by `Renovation/Geometry/`.

- [ ] **Step 3: Remove the scan's bounds**

In `buildProjectIndexEntries.ts`:

```ts
function listSidecars(vault: Vault): TFile[] {
	return vault.getFiles().filter((file) => file.path.endsWith('.rpgeo'));
}

interface ScanInput {
	vault: Vault;
	metadataCache: MetadataCache;
	echo: EchoWindow;
	logger: Logger;
}
```

`collectNotes` loses its `folder` parameter and its first line
(`if (!file.path.startsWith(...)) continue;`). `joinSidecars` loses its `geometryPrefix`
parameter. The body becomes:

```ts
export function buildProjectIndexEntries(input: ScanInput): ProjectIndexEntry[] {
	const entries = new Map<string, ProjectIndexEntry>();

	collectNotes(input, entries);
	joinSidecars(input, entries);

	input.logger.info('persistence.index.rebuilt', { entries: entries.size });

	return [...entries.values()];
}
```

Delete the now-unused `normalizeFolder` and `GEOMETRY_FOLDER` imports.

- [ ] **Step 4: Rewrite the module docblock**

The header currently says the index is bounded by the project folder. Replace that claim with
what is now true, and state the cost honestly rather than repeating the slice document's
withdrawn sentence:

```ts
/**
 * …
 * **The scan is bounded by what a note DECLARES, not by where it sits.** Every note this
 * plugin owns carries `type` and `id`, and every child entity carries `project:` — the
 * frontmatter is what makes the index correct, and the path prefix this used to filter on
 * never was. A prefix also could not see a second root at all, which is why slice 4
 * recorded a library outside the scanned folder as invisible to both this scan and the
 * vault-change pipeline. Nothing is registered, so nothing has to be.
 *
 * **What that costs, stated rather than discovered:** `frontmatterOf` is called for every
 * markdown file in the vault, not for the handful under one folder. It is a
 * `MetadataCache` map lookup plus an `EchoWindow` digest check — not a file read and not a
 * parse — which is why the cost is acceptable at §102's budgets. It is NOT, as slice 18's
 * document first claimed, "the same set either way": the prefix used to be tested before
 * this call, and a 10,000-note vault with twenty notes under `Renovation/` cost twenty
 * calls and now costs ten thousand lookups.
 *
 * A hand-written note carrying one of our types anywhere in the vault is therefore
 * indexed. That is the intended behaviour of a declared bound; a template note carrying a
 * literal id becomes a duplicate-id finding, which `warnOnDuplicate` already reports.
 */
```

- [ ] **Step 5: Fix the two callers the deletion breaks**

`src/plugin/RenovationPlannerPlugin.ts` — drop `projectFolder: persistence.vaultDeps.projectFolder,`
from the `buildProjectIndexEntries({ … })` call in `startPersistence`. Then correct that
method's own docblock: it says "a new root's index starts empty and its folder may have
changed". The folder no longer bounds the scan, so the reason the build repeats is only that a
new root's index starts empty.

`tests/helpers/vault.ts` — drop `projectFolder,` from the `buildProjectIndexEntries({ … })`
call inside `rebuildIndex`. Leave `RepositoryStack.projectFolder` and the constructor default
in place; they become the default root for new projects and Task 7 rewires them.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/infrastructure tests/plugin`
Expected: PASS. If a test asserted that a note outside the folder is *ignored*, it is asserting
the bound this task removes — update it to assert the new behaviour and say so in the commit,
rather than working around it.

- [ ] **Step 7: Run the gate**

Run: `npm run check > /tmp/check.log 2>&1; echo $?`
Expected: `0`.

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/persistence/index/buildProjectIndexEntries.ts src/plugin/RenovationPlannerPlugin.ts tests/
git commit -m "$(cat <<'EOF'
feat: the index is bounded by what a note declares, not by where it sits

Every note this plugin owns carries type and id, and every child entity carries
project: — the frontmatter is what makes the index correct, and the path prefix
never was. A prefix also cannot see a second root at all, which is the
prerequisite slice 4 recorded and deliberately did not build: a library outside
the scanned folder was invisible to this scan and to the vault-change pipeline.

Nothing is registered, so nothing has to be — which closes that prerequisite
more completely than a root list would have.

The cost is in the docblock rather than dismissed: frontmatterOf now runs for
every markdown file, which is a MetadataCache lookup plus an echo check rather
than a file read. Slice 18's document claimed the call count was unchanged; the
prefix used to be tested before that call, so it was not.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: The vault-change pipeline scans the whole vault

**Files:**
- Modify: `src/infrastructure/persistence/index/VaultChangeAdapter.ts:33, 103, 171`
- Modify: `src/plugin/composition-root.ts:469-477`
- Modify: `tests/infrastructure/persistence/index/pipeline.test.ts`

**Interfaces:**
- Consumes: `entityRefOf` (Task 2).
- Produces: the `VaultChangeAdapter` constructor's deps object without `projectFolder`:
  ```ts
  new VaultChangeAdapter({
      vault: Vault; metadataCache: MetadataCache; index: ProjectIndex;
      echo: EchoWindow; logger: Logger; debounceMs?: number;
  })
  ```

- [ ] **Step 1: Write the failing test**

Append to `tests/infrastructure/persistence/index/pipeline.test.ts`, matching its existing
adapter-construction helper:

```ts
	it('indexes a note of ours created outside the configured folder', () => {
		const { adapter, stack } = createPipeline();   // the file's existing helper
		stack.vault.entries.set(
			'Elsewhere/Bathroom/Project.md',
			serializeFrontmatter({ type: 'renovation-project', id: 'p-out', 'schema-version': 1 }),
		);
		stack.catchUp();

		adapter.onCreate({ path: 'Elsewhere/Bathroom/Project.md' } as never);

		expect(stack.index.getPath('p-out' as never)).toBe('Elsewhere/Bathroom/Project.md');
	});

	it('maps a sidecar outside the configured folder onto its plan', () => {
		const { adapter, stack } = createPipeline();
		stack.vault.entries.set(
			'Elsewhere/Plans/Ground.md',
			serializeFrontmatter({ type: 'renovation-plan', id: 'pl-out', 'schema-version': 1 }),
		);
		stack.catchUp();
		adapter.onCreate({ path: 'Elsewhere/Plans/Ground.md' } as never);

		stack.vault.entries.set('Elsewhere/Geometry/pl-out.rpgeo', '{}');
		adapter.onCreate({ path: 'Elsewhere/Geometry/pl-out.rpgeo' } as never);

		expect(stack.index.getGeometrySidecarPath('pl-out' as never)).toBe(
			'Elsewhere/Geometry/pl-out.rpgeo',
		);
	});
```

If `createPipeline` does not exist under that name, read the file and use whatever it does.
Do not add a second construction helper beside an existing one.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/infrastructure/persistence/index/pipeline.test.ts`
Expected: FAIL — `processPath` returns early on the prefix test, so neither assertion sees an
entry.

- [ ] **Step 3: Remove the pipeline's bounds**

In `VaultChangeAdapter.ts`:

Delete `projectFolder: string;` from the constructor deps type.

In `processPath`, delete these two lines:

```ts
		const folder = normalizeFolder(this.deps.projectFolder);
		if (!path.startsWith(`${folder}/`)) return;
```

`processNote` already runs the full frontmatter test, so the prefix was a fast path over a
question the next call answers properly.

In `processSidecar`, replace the prefix slice with the basename:

```ts
	private processSidecar(path: string): void {
		// The plan id is the sidecar's basename (ADR-011), which is what `joinSidecars`
		// reads too. It used to be recovered by slicing a configured prefix off the front,
		// and that is the same bound the scan just lost: a sidecar under a second root
		// answered no plan at all.
		const planId = path.slice(path.lastIndexOf('/') + 1).replace(/\.rpgeo$/, '');
```

Delete the `geometryPrefix` local and the `if (!path.startsWith(geometryPrefix)) return;`
line. Delete the now-unused `normalizeFolder` and `GEOMETRY_FOLDER` imports.

- [ ] **Step 4: Fix the composition root**

In `src/plugin/composition-root.ts`, delete `projectFolder: settings.projectFolder,` from the
`new VaultChangeAdapter({ … })` call. Leave the `deps` object's `projectFolder` alone — Task 7
removes it.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/infrastructure tests/plugin`
Expected: PASS.

- [ ] **Step 6: Run the gate**

Run: `npm run check > /tmp/check.log 2>&1; echo $?`
Expected: `0`.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/persistence/index/VaultChangeAdapter.ts src/plugin/composition-root.ts tests/
git commit -m "$(cat <<'EOF'
feat: the vault-change pipeline is bounded by declaration too

processPath's prefix test was a fast path over a question processNote answers
properly one call later, and processSidecar recovered the plan id by slicing a
configured prefix off the front — the same bound the scan just lost, so a
sidecar under a second root answered no plan at all. The id is the basename,
which is what joinSidecars already reads.

Both halves now answer "is this note ours" through the one function, which is
what keeps a full scan and an incremental run from disagreeing about a note.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The pure path functions, and the Project repository that calls them

**Files:**
- Modify: `src/infrastructure/obsidian/repositories/paths.ts`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianProjectRepository.ts`
- Modify: `src/plugin/composition-root.ts:330-346`
- Modify: `tests/helpers/vault.ts`
- Modify: `tests/infrastructure/obsidian/repositories/contract.test.ts`

**Interfaces:**
- Consumes: `ProjectIndex`, `ProjectId`, `parentOf`, `fileNameFor` (all existing).
- Produces:
  ```ts
  // paths.ts
  export function joinFolder(folder: string, child: string): string;
  export function freshProjectFolder(vault: Vault, root: string, name: string, id: string): string;
  export function projectFolderOf(index: ProjectIndex, projectId: ProjectId): string | undefined;

  // ObsidianProjectRepository
  constructor(deps: NoteVaultDeps, newProjectRoot: string)
  ```
  Tasks 6 and 7 call `projectFolderOf`. Task 8's test drives `newProjectRoot`.

The three functions ship **with** their caller in one commit, because a `src/` export whose
only callers are tests fails `npm run analyze`.

- [ ] **Step 1: Write the failing tests for the pure functions**

Create `tests/infrastructure/obsidian/repositories/perProjectFolders.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	freshProjectFolder,
	joinFolder,
	plansFolderFor,
	projectFolderOf,
} from '../../../../src/infrastructure/obsidian/repositories/paths';
import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { createRepositoryStack } from '../../../helpers/vault';

describe('joinFolder', () => {
	it('joins a folder and a child with one separator', () => {
		expect(joinFolder('Renovation/Kitchen', 'Plans')).toBe('Renovation/Kitchen/Plans');
	});

	it('answers the child alone at the vault root, rather than a leading slash', () => {
		// A Project.md at the vault root derives the empty folder, and `/Plans` is a path
		// Obsidian refuses. This arm is why the join is a function rather than a template.
		expect(joinFolder('', 'Plans')).toBe('Plans');
		expect(plansFolderFor('')).toBe('Plans');
	});
});

describe('projectFolderOf', () => {
	it('answers the folder the project note sits in', () => {
		const index = new InMemoryProjectIndex();
		index.upsert({
			id: 'p1' as never,
			type: 'renovation-project',
			path: 'Renovation/Kitchen Refit/Project.md',
		});
		expect(projectFolderOf(index, 'p1' as never)).toBe('Renovation/Kitchen Refit');
	});

	it('answers undefined for a project the index does not hold', () => {
		expect(projectFolderOf(new InMemoryProjectIndex(), 'nope' as never)).toBeUndefined();
	});
});

describe('freshProjectFolder', () => {
	it('derives the folder from the project name, under the configured root', () => {
		const stack = createRepositoryStack('Renovation');
		expect(freshProjectFolder(stack.vault as never, 'Renovation', 'Kitchen Refit', 'p1')).toBe(
			'Renovation/Kitchen Refit',
		);
	});

	it('appends the id when the plain name is taken', () => {
		const stack = createRepositoryStack('Renovation');
		stack.vault.entries.set('Renovation/Kitchen Refit/Project.md', '');
		expect(freshProjectFolder(stack.vault as never, 'Renovation', 'Kitchen Refit', 'p2')).toBe(
			'Renovation/Kitchen Refit p2',
		);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/infrastructure/obsidian/repositories/perProjectFolders.test.ts`
Expected: FAIL — none of the three functions is exported.

- [ ] **Step 3: Add the three functions**

In `src/infrastructure/obsidian/repositories/paths.ts`:

```ts
/**
 * A folder and a child, with exactly one separator — and the child alone when the folder
 * is the vault ROOT. A project's folder is derived from where its note sits (ADR-0013), so
 * a `Project.md` at the root derives `''`, and `` `${''}/Plans` `` is `/Plans`, which
 * Obsidian refuses. That case is why this is a function rather than a template literal in
 * five places.
 */
export function joinFolder(folder: string, child: string): string {
	return folder ? `${folder}/${child}` : child;
}
```

Rewrite the five `*FolderFor` helpers plus `geometryFolderFor` to use it:

```ts
function geometryFolderFor(projectFolder: string): string {
	return joinFolder(projectFolder, GEOMETRY_FOLDER);
}

export function plansFolderFor(projectFolder: string): string {
	return joinFolder(projectFolder, PLANS_FOLDER);
}
```

…and the same for `zonesFolderFor`, `assetsFolderFor`, `requirementsFolderFor`. Also change
`freshNotePath`'s first line to `const base = joinFolder(folder, fileNameFor(name));`.

Then:

```ts
/**
 * A project's folder: the folder its `Project.md` sits in (ADR-0013). Resolved through the
 * index, which is the single answer to "where is entity X" (SDD §47) — never by rescanning
 * the vault, and never from the plugin setting, which names only where a NEW project goes.
 *
 * `undefined` is a REFUSAL, not a prompt to fall back: writing to a defaulted path when the
 * real one is unknown is how a note lands in a parallel tree beside the user's work.
 */
export function projectFolderOf(index: ProjectIndex, projectId: ProjectId): string | undefined {
	const path = index.getPath(projectId);
	return path === undefined ? undefined : parentOf(path);
}

/**
 * Where a NEW project's folder goes: the configured root, the name, and the project id when
 * a folder of that name already sits there. `freshNotePath`'s rule, one level up — filename
 * is never identity (§83), so this only has to produce a free path, not a predictable one.
 */
export function freshProjectFolder(vault: Vault, root: string, name: string, id: string): string {
	const base = joinFolder(normalizeFolder(root), fileNameFor(name));
	return vault.getAbstractFileByPath(base) ? `${base} ${id}` : base;
}
```

Add the two imports at the top: `ProjectIndex` from `'../../../application/ports/ProjectIndex'`
and `ProjectId` from `'../../../domain/project/ProjectId'`. Both are allowed —
`infrastructure/` may reach `application/`'s ports and `domain/`.

Update the module header: it opens "The project folder is THE one location setting
(ADR-011)". Replace with the ADR-0013 shape — the plugin setting names where a NEW project's
folder is created, and every other path derives from the per-project folder.

- [ ] **Step 4: Convert `ObsidianProjectRepository`**

Add the constructor parameter and delete the cached folder:

```ts
	/**
	 * `newProjectRoot` is the plugin setting — where a NEW project's folder is created, and
	 * nothing else. It is this repository's alone rather than a shared `NoteVaultDeps`
	 * field, because it is the only one that ever writes a note whose folder does not
	 * already exist to be derived from.
	 */
	constructor(
		private readonly deps: NoteVaultDeps,
		private readonly newProjectRoot: string,
	) { … }
```

Delete `private readonly folder: string;` and its assignment.

In `saveQueued`, replace the existence lookup:

```ts
		// Through the INDEX, not a folder scan. Under ADR-0013 a project's folder is where
		// its note sits, so scanning "the project's folder" for the project's own note
		// presumes the answer. The index is also the more reliable half of what the folder
		// scan's own comment worried about — `save` upserts synchronously before returning,
		// so a note created moments ago is known here before any MetadataCache has parsed it.
		const existing = fileAt(this.deps.vault, this.deps.index.getPath(project.id));
```

`fileAt` is already exported from `NoteVaultDeps.ts`; import it. Then in the insert arm:

```ts
			const folder = freshProjectFolder(this.deps.vault, this.newProjectRoot, project.name, project.id);
			path = freshNotePath(this.deps.vault, folder, project.name, project.id);
			try {
				await ensureFolder(this.deps.vault, folder);
```

- [ ] **Step 5: Wire the constructor argument**

`src/plugin/composition-root.ts` — `composeRepositories` gains a parameter:

```ts
function composeRepositories(
	deps: NoteVaultDeps,
	vault: VaultStack,
	index: ProjectIndex,
	migrations: MigrationRunner,
	echo: EchoWindow,
	newProjectRoot: string,
) {
	…
		projects: new ObsidianProjectRepository(deps, newProjectRoot),
```

and its call site passes `settings.projectFolder`.

`tests/helpers/vault.ts` — `projects: new ObsidianProjectRepository(deps, projectFolder),`.

- [ ] **Step 6: Add the repository test**

Append to `tests/infrastructure/obsidian/repositories/perProjectFolders.test.ts`. Read
`contract.test.ts` first for how a `Project` is constructed in this suite and reuse that
exactly:

```ts
describe('a project owns its folder', () => {
	it('creates each project in its own folder under the configured root', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = /* build a Project named 'Kitchen Refit', id 'p1' — see contract.test.ts */;
		const bathroom = /* build a Project named 'Bathroom', id 'p2' */;

		await stack.projects.save(kitchen, { kind: 'absent' });
		await stack.projects.save(bathroom, { kind: 'absent' });

		expect(stack.index.getPath('p1' as never)).toBe('Renovation/Kitchen Refit/Project.md');
		expect(stack.index.getPath('p2' as never)).toBe('Renovation/Bathroom/Project.md');
	});

	it('takes the configured root, so changing the setting moves where a new project goes', async () => {
		const stack = createRepositoryStack('Somewhere Else');
		const kitchen = /* Project named 'Kitchen Refit', id 'p1' */;

		await stack.projects.save(kitchen, { kind: 'absent' });

		expect(stack.index.getPath('p1' as never)).toBe('Somewhere Else/Kitchen Refit/Project.md');
	});
});
```

Replace each `/* … */` with the real construction. **Do not leave a comment in the committed
test** — a placeholder in a test is a test that does not run.

The second case is the DoD item about the setting staying live: asserting only that the key
survives would pass against a build that reads the value and ignores it.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/infrastructure/obsidian/repositories tests/plugin`
Expected: PASS. Existing tests that expected `Renovation/Project.md` now expect
`Renovation/<name>/Project.md` — update them, and say so in the commit body rather than
loosening an assertion.

- [ ] **Step 8: Run the gate**

Run: `npm run check > /tmp/check.log 2>&1; echo $?`
Expected: `0`.

- [ ] **Step 9: Commit**

```bash
git add src/infrastructure/obsidian/repositories/paths.ts src/infrastructure/obsidian/repositories/ObsidianProjectRepository.ts src/plugin/composition-root.ts tests/
git commit -m "$(cat <<'EOF'
feat: a new project is created in its own folder

freshProjectFolder applies freshNotePath's rule one level up: the configured
root, the project name, and the id when a folder of that name is already there.
projectFolderOf resolves an existing project's folder through the index, and
answers undefined as a REFUSAL rather than a prompt to fall back — writing to a
defaulted path when the real one is unknown is how a note lands in a parallel
tree beside the user's work.

Project existence moves from a folder scan onto the index, and that is forced
rather than opportunistic: under ADR-0013 a project's folder is where its note
sits, so scanning that folder for that note presumes the answer.

joinFolder exists for one arm: a Project.md at the vault root derives the empty
folder, and `${''}/Plans` is a path Obsidian refuses.

The plugin setting keeps exactly one job — where a NEW project's folder is
created — and it is this repository's own constructor argument rather than a
shared NoteVaultDeps field, because no other repository ever writes a note
whose folder cannot be derived.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Plan and Zone resolve their folder per save

**Files:**
- Modify: `src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts:70, 120, 140`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts:83, 147`
- Modify: `tests/infrastructure/obsidian/repositories/perProjectFolders.test.ts`

**Interfaces:**
- Consumes: `projectFolderOf` (Task 5), `persistenceError` (existing).
- Produces: no new exported signature. Both repositories keep their public `save` contract.

- [ ] **Step 1: Write the failing tests**

Append to `perProjectFolders.test.ts`:

```ts
describe('plans and zones land in their own project folder', () => {
	it('writes two projects\' plans into two different folders', async () => {
		const stack = createRepositoryStack('Renovation');
		/* save Project 'Kitchen Refit' id 'p1' and Project 'Bathroom' id 'p2' */
		/* save Plan 'Ground floor' id 'pl1' projectId 'p1' */
		/* save Plan 'Upstairs'     id 'pl2' projectId 'p2' */

		expect(stack.index.getPath('pl1' as never)).toBe('Renovation/Kitchen Refit/Plans/Ground floor.md');
		expect(stack.index.getPath('pl2' as never)).toBe('Renovation/Bathroom/Plans/Upstairs.md');
	});

	it('puts a plan\'s geometry sidecar in its own project folder', async () => {
		/* as above, one project */
		expect(stack.index.getGeometrySidecarPath('pl1' as never)).toBe(
			'Renovation/Kitchen Refit/Geometry/pl1.rpgeo',
		);
	});

	it('refuses a save whose project folder cannot be resolved, and writes nothing', async () => {
		const stack = createRepositoryStack('Renovation');
		/* save Project 'Kitchen Refit' id 'p1'; save Plan 'Ground floor' id 'pl1' */
		const before = [...stack.vault.entries.keys()];

		// The read happened; the index entry disappears between it and the save. This is
		// the only way to reach the arm, and it is the arm that must never fall back to the
		// configured root.
		stack.index.remove('p1' as never);
		const result = await stack.plans.save(/* a second revision of that plan */, { kind: 'absent' });

		expect(result.ok).toBe(false);
		expect(result.ok === false && result.error.category).toBe('Persistence');
		expect([...stack.vault.entries.keys()]).toEqual(before);
	});
});
```

Fill in each `/* … */` from `contract.test.ts`'s own construction helpers. **No comment
placeholders survive into the commit.**

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/infrastructure/obsidian/repositories/perProjectFolders.test.ts`
Expected: FAIL — both plans land under `Renovation/Plans/`, and the third case succeeds
instead of refusing.

- [ ] **Step 3: Convert `ObsidianPlanRepository`**

Delete `private readonly folder: string;` and its assignment. In `saveQueued`, before the
existence lookup:

```ts
		const folder = projectFolderOf(this.deps.index, plan.projectId);
		if (folder === undefined) {
			return Promise.resolve(
				err(persistenceError('plan.project-folder-unresolved', `Could not resolve the folder of project ${plan.projectId} for plan ${plan.id}.`)),
			);
		}
		const notesFolder = plansFolderFor(folder);
```

`insertNew` takes the resolved folder rather than reading a field. Change its signature to
`private async insertNew(plan: Plan, dto: Record<string, unknown>, notesFolder: string, projectFolder: string)`
and its first line to `const sidecarPath = sidecarPathFor(projectFolder, plan.id);`. Pass both
from `saveQueued`.

- [ ] **Step 4: Convert `ObsidianZoneRepository`**

Delete `private readonly folder: string;` and its assignment. In `saveQueued`, replace
`const notesFolder = zonesFolderFor(this.folder);` with:

```ts
		const folder = projectFolderOf(this.deps.index, zone.projectId);
		if (folder === undefined) {
			return err(persistenceError('zone.project-folder-unresolved', `Could not resolve the folder of project ${zone.projectId} for zone ${zone.id}.`));
		}
		const notesFolder = zonesFolderFor(folder);
```

`saveQueued` is already `async` here, so this returns directly rather than through
`Promise.resolve`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/infrastructure tests/application tests/presentation`
Expected: PASS. Any test asserting `Renovation/Plans/…` or `Renovation/Zones/…` now expects the
per-project path; update it.

- [ ] **Step 6: Run the gate**

Run: `npm run check > /tmp/check.log 2>&1; echo $?`
Expected: `0`. Two new branch arms landed (the two `undefined` refusals) and Step 1 drives one
of them; **drive the zone one too** — add the mirror case rather than accepting a
99-branch-of-headroom hit.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/obsidian/repositories tests/
git commit -m "$(cat <<'EOF'
feat: plans and zones resolve their folder from their own project

Each save resolves the owning project's folder through the index rather than
reading one cached in the constructor. A project whose folder cannot be
resolved is a PersistenceError and writes nothing — never a fallback to the
configured root, which is slice 1's reasoning applied unchanged: a setting that
names a path is not a preference.

The plan's geometry sidecar follows the same folder, so ADR-011's rule is
unchanged and only the string "project folder" resolves to something else.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Asset and Requirement, and the deletion that steers the slice

**Files:**
- Modify: `src/infrastructure/obsidian/repositories/ObsidianAssetRepository.ts:37-40, 58`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianRequirementRepository.ts:43-46, 75, 119-122`
- Modify: `src/infrastructure/obsidian/repositories/NoteVaultDeps.ts:25`
- Modify: `src/plugin/composition-root.ts:418-428`
- Modify: `tests/helpers/vault.ts:330-360`
- Modify: `tests/infrastructure/obsidian/repositories/perProjectFolders.test.ts`

**Interfaces:**
- Consumes: `projectFolderOf` (Task 5).
- Produces:
  ```ts
  interface NoteVaultDeps {          // `projectFolder` deleted — the compile-error surface
      vault; fileManager; metadataCache; index; echo; migrations; logger; ledger;
  }
  ```

`NoteVaultDeps.projectFolder` is deleted **last**, after the five repositories have stopped
reading it, so the tree compiles at every commit.

- [ ] **Step 1: Write the failing tests**

Append to `perProjectFolders.test.ts` — assets and requirements for two projects, asserted on
the resulting path, plus the unresolvable refusal for each. Same shape as Task 6's block; build
the entities the way `slice10ErrorPaths.test.ts` builds them.

```ts
		expect(stack.index.getPath('a1' as never)).toBe('Renovation/Kitchen Refit/Assets/Tiles.md');
		expect(stack.index.getPath('r1' as never)).toBe('Renovation/Bathroom/Requirements/…');
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/infrastructure/obsidian/repositories/perProjectFolders.test.ts`
Expected: FAIL — both land under the shared root.

- [ ] **Step 3: Convert `ObsidianAssetRepository`**

Delete `private readonly folder: string;` and its assignment. At the `spec` construction:

```ts
		const folder = projectFolderOf(this.deps.index, asset.projectId);
		if (folder === undefined) {
			return err(persistenceError('asset.project-folder-unresolved', `Could not resolve the folder of project ${asset.projectId} for asset ${asset.id}.`));
		}
		const spec: NoteWriteSpec<Asset> = { ...SPEC, notesFolder: assetsFolderFor(folder) };
```

Check the enclosing method's return type — if it is not already `Promise<Result<…>>` returning
directly, wrap in `Promise.resolve` as its siblings do.

- [ ] **Step 4: Convert `ObsidianRequirementRepository`**

Same shape, at both sites — line 75's `notesFolder: requirementsFolderFor(this.folder)` and
line 122's `requirementsFolderFor(this.folder)` argument. Resolve the folder once per method
and pass it, rather than calling `projectFolderOf` twice in one call path.

- [ ] **Step 5: Delete the field**

In `NoteVaultDeps.ts`, delete:

```ts
	/** The one location setting (ADR-011); the user's raw string, normalized on use. */
	readonly projectFolder: string;
```

Update the interface's docblock: it says the repositories take these collaborators and never
reach `app`. Add that a project's folder is **not** among them — it derives from where the
project's note sits (ADR-0013), so it cannot be a constructor field.

- [ ] **Step 6: Follow the compile errors**

Run: `npx vue-tsc --noEmit`
Expected: errors at `src/plugin/composition-root.ts` (the `deps` object literal) and
`tests/helpers/vault.ts` (its `deps` object literal). Delete `projectFolder` from both. In
`tests/helpers/vault.ts`, keep `RepositoryStack.projectFolder` — it is now the default root the
stack was constructed with, and Task 5's project repository already receives it. Update its
doc comment to say so.

Run again until clean.

- [ ] **Step 7: Add the no-migration test**

The claim that today's vaults need no migration is behaviour, so it is pinned as behaviour.
Append to `perProjectFolders.test.ts`:

```ts
	it('reads and writes a project in the old single-folder layout unchanged', async () => {
		// Every vault this plugin has produced looks like this: the project note and the
		// per-kind folders directly under the configured root. Under ADR-0013 that IS a
		// valid project — its folder is `Renovation` — so nothing has to move, and this is
		// the test under that claim rather than a paragraph asserting it.
		const stack = createRepositoryStack('Renovation');
		stack.vault.entries.set(
			'Renovation/Project.md',
			serializeFrontmatter({ type: 'renovation-project', id: 'p-old', 'schema-version': 1, name: 'Old Layout' }),
		);
		stack.catchUp();
		stack.rebuildIndex();

		/* save a Plan id 'pl-old' projectId 'p-old' */

		expect(stack.index.getPath('pl-old' as never)).toBe('Renovation/Plans/…');
	});
```

Fill in the plan construction and the exact expected filename. **No comment placeholders in the
commit.**

- [ ] **Step 8: Run the whole suite**

Run: `npx vitest run --no-file-parallelism`
Expected: PASS. Use `--no-file-parallelism` — on Windows the `tests/build/` files that each
boot a type-aware ESLint contend and can exceed even the 60s `ESLINT_BOOT_MS`, and that is a
parallelism artifact rather than a broken gate.

- [ ] **Step 9: Run the gate**

Run: `npm run check > /tmp/check.log 2>&1; echo $?`
Expected: `0`. Two more refusal arms landed; Step 1 drives both.

- [ ] **Step 10: Commit**

```bash
git add src/infrastructure/obsidian/repositories src/plugin/composition-root.ts tests/
git commit -m "$(cat <<'EOF'
feat: delete NoteVaultDeps.projectFolder

Assets and Requirements resolve the owning project's folder per save, like
Plans and Zones, and the shared field five repositories cached in their
constructors is gone. A per-project folder cannot be a constructor field, and
the deletion is what makes that a build failure rather than a convention.

The old single-folder layout keeps working and now has a test saying so: under
ADR-0013 a Project.md directly under the configured root derives that root as
its folder, which is a valid project rather than a legacy one. That is the
claim under building no migration, so it is pinned as behaviour.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: The setting says what it now does

**Files:**
- Modify: `src/plugin/settings/SettingsTab.ts:60-75`
- Modify: `src/plugin/settings/settings.ts:30-50, 86-88`
- Modify: `src/presentation/i18n/en.ts`, `src/presentation/i18n/de.ts` (only if the setting's
  copy is held there — read `SettingsTab.ts` first; if the strings are inline, they stay inline,
  because today's settings copy reaches none of `I18N_LITERAL_BAN`'s four call sites)
- Modify: `tests/plugin/` — whichever file covers `settingsFrom`

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature change. **The stored `data.json` key stays `projectFolder`.**

- [ ] **Step 1: Write the failing test**

Find the existing `settingsFrom` test and append:

```ts
	it('round-trips a configured projects folder under the key it has always used', () => {
		// The key is NOT renamed. `settingsFrom` drops keys this version does not declare,
		// on the way in and on the way out, so renaming it would silently reset every
		// existing user's configured folder to the default — and writing to a defaulted
		// path is the exact failure this slice refuses everywhere else.
		expect(settingsFrom({ projectFolder: 'Somewhere Else' }).projectFolder).toBe('Somewhere Else');
	});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/plugin`
Expected: PASS already — this is a characterization test pinning a decision, not a change. If
it fails, the key has been renamed somewhere and that is the defect.

- [ ] **Step 3: Change the copy, not the key**

In `SettingsTab.ts`, the `projectFolder` definition's name and description become "Default
projects folder" and a description saying it is **where a new project's folder is created**,
and that an existing project keeps the folder it is in. Sentence case, per the marketplace
rules.

In `settings.ts`, update the field's docblock and `DEFAULT_PROJECT_FOLDER`'s comment: the value
is the root new projects are created under, not the folder every entity lives in.

Leave the key, the default value, and `projectFolderFrom` exactly as they are.

- [ ] **Step 4: Run the gate**

Run: `npm run check > /tmp/check.log 2>&1; echo $?`
Expected: `0`.

- [ ] **Step 5: Commit**

```bash
git add src/plugin/settings tests/plugin
git commit -m "$(cat <<'EOF'
feat: the projects folder setting says it is where a new project goes

The setting keeps exactly one job and its copy now says which one. Its stored
key is deliberately unchanged: settingsFrom drops keys this version does not
declare, in both directions, so renaming it would silently reset every existing
user's configured folder to the default — and a write landing at a defaulted
path is the failure this slice refuses everywhere else.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Record what changed, and measure

**Files:**
- Modify: `CLAUDE.md`
- Modify: `vitest.config.ts`
- Modify: `docs/tasks/18-a-project-owns-its-folder.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the record. No code.

- [ ] **Step 1: Measure**

Run: `npm run test:coverage > /tmp/coverage.log 2>&1; echo $?`
Read the four figures and the uncovered set from the report — do not copy a number from any
document, including this plan.

- [ ] **Step 2: Record the measurement**

Append a dated entry to `vitest.config.ts`'s coverage block, in the style every entry above it
uses: what the slice added, the four raw fractions and their percentages, and whether anything
ratchets. **Floors rise only if the finished increment measures above them, rounded down.** Name
every new uncovered arm, or say the uncovered set is unchanged.

- [ ] **Step 3: Update `CLAUDE.md`**

Three edits, each replacing a sentence that this slice made false:

1. The persistence paragraph names "the project index and its vault-change pipeline". Add what
   bounds them now: **what a note declares, not where it sits** — and that this closes slice 4's
   recorded multi-root prerequisite without registering anything.
2. The settings paragraph says the pane offers "units, project folder, and slice 11's verbose
   logging". The second is now the **default projects folder** — where a new project's folder is
   created — and an existing project's folder derives from where its `Project.md` sits
   (ADR-0013).
3. Add slice 18 to the slice record, in the voice the others use, carrying the two rules worth
   remembering:
   - **A prefix bound cannot see a second root, and a bound that reads the note can.** The
     index filtered by path and the frontmatter was already the thing making it correct; the
     prefix was a fast path over a question the next call answered properly. Slice 4 recorded
     the consequence — a library outside the scanned folder invisible to both the scan and the
     pipeline — and handed it to whoever next touched the pipeline.
   - **A pure export with no `src/` caller fails `npm run analyze`**, which is why
     `foldersOverlap` ships in slice 19 rather than here, and why the slice document's own
     "staying green" commit order would not have stayed green.

- [ ] **Step 4: Tick the slice document**

In `docs/tasks/18-a-project-owns-its-folder.md`, tick the Definition of Done items this slice
satisfied and leave the three withdrawn/deferred ones marked as such, with their reasons —
withdrawn, not ticked. Follow slice 11's Definition of Done item 1 as the precedent for how a
withdrawal is written.

- [ ] **Step 5: Run the gate one final time**

Run: `npm run check > /tmp/check.log 2>&1; echo $?`
Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md vitest.config.ts docs/tasks/18-a-project-owns-its-folder.md
git commit -m "$(cat <<'EOF'
docs: record slice 18, and measure what it cost

Two rules worth keeping: a prefix bound cannot see a second root while a bound
that reads the note can, and a pure export with no src/ caller fails
npm run analyze — which is why foldersOverlap ships in slice 19 and why this
slice's own documented commit order would not have stayed green.

Three Definition of Done items are marked withdrawn or deferred rather than
ticked, each with its reason.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Verify in a real vault

**Files:** none — this task writes no code.

Every one of the four defects the first walkthrough of slice 5 found was a fake accepting what
Obsidian refuses, and `npm run check` was green for all of them. This slice changes where notes
are written and how the vault is scanned, which is exactly the surface `FakeVault` has already
been too kind about twice (a parent folder that does not exist; an asynchronously-populated
`MetadataCache`).

- [ ] **Step 1: Build into the vault**

Run: `npm run test-build`

- [ ] **Step 2: Seed two projects**

In Obsidian, reload the plugin, then run `create-sample-project` **twice**.

Expected: two folders under `Renovation/`, each holding its own `Project.md`, `Plans/`,
`Zones/` and `Geometry/`. Not two `Project.md` files in one folder.

- [ ] **Step 3: Open both plan editors and draw**

Open the plan editor on each project's plan (`open-plan-editor` offers a picker), draw a zone
in each, and confirm each zone note lands under its own project's `Zones/` folder.

- [ ] **Step 4: Change the setting and seed again**

Set the projects folder to a second root, run `create-sample-project`, and confirm the new
project lands under the new root while both existing projects keep working.

- [ ] **Step 5: Move a project folder in the file explorer**

Drag one project folder somewhere else in the vault. Reload the plugin. Expected: the project
still opens, and a new zone drawn in it lands under the folder's **new** location. This is the
property the derived shape was chosen for, and it is the one no test in this repository can
demonstrate.

- [ ] **Step 6: Report**

Write up anything that behaved differently from the expectations above. A defect found here is
a fake being too kind, and it gets fixed in the fake as well as in the code — that is the rule
`tests/helpers/vault.ts` already carries three instances of.

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: ADR-0013 → Task 1; the index's
lost bound and `entityRefOf` → Tasks 2–3; the pipeline → Task 4; write-time folder resolution,
`freshProjectFolder`, `projectFolderOf`, project existence on the index, the refusal → Tasks
5–7; the `data.json` key → Task 8; no migration → Task 7 Step 7; the testing strategy →
distributed across Tasks 2–8; the coverage record → Task 9. The spec's "deliberately not here"
list (`foldersOverlap`, `IndexRoots`, the mover) appears in the File Structure section as an
explicit non-goal, with the reason.

**Two known gaps, named rather than left to be discovered.**

1. **Tasks 5–7 contain `/* … */` markers** where a test must construct a `Project`, `Plan`,
   `Zone`, `Asset` or `Requirement`. Those constructors are long and differ per entity, and
   transcribing them here from `contract.test.ts` would produce a second copy that goes stale.
   Each step says to read the existing suite and reuse its construction, and each says the
   marker must not survive into the commit. **This is the one place this plan asks the
   implementer to look something up rather than showing it.**
2. **The `EntityRef` shape in Task 2 is a three-case union**, not the
   `{type, id} | undefined` the spec's Interfaces block sketched. The spec's shape loses the
   distinction between "not ours" and "ours but idless", and only the second is a diagnostic —
   the union preserves what both callers already do. The spec is the earlier sketch; this plan
   is the later measurement.

**Type consistency.** `projectFolderOf(index, projectId)` returns `string | undefined` and is
called in Tasks 5, 6 and 7 with that exact shape. `freshProjectFolder(vault, root, name, id)`
returns a folder path with no trailing slash, consumed by `freshNotePath(vault, folder, …)` and
`ensureFolder(vault, folder)`, both of which already take a folder in that form. `joinFolder`
is used by all five `*FolderFor` helpers and by `freshNotePath`. `ObsidianProjectRepository`'s
second constructor argument is named `newProjectRoot` in Tasks 5 and 7 and at both call sites.

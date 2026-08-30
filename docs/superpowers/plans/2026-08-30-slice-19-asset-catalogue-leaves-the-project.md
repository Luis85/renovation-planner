# Slice 19: The Asset Catalogue Leaves the Project — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Asset` a vault-level catalogue entry owned by no project, so any project may reference any asset, and give §83's library/project overlap rule the enforcement its three sites can actually support.

**Architecture:** `Asset` loses `projectId` from its domain type, its schema, its mapper, its index axis and its folder; the catalogue moves to a configurable **library folder** whose change is a move-and-rebuild migration. `foldersOverlap` is written here and refuses at the two sites that have a door; the third site — a folder dragged in Obsidian's file explorer — has no door since ADR-0013, so the affected project's row in the Renovation Project view carries a marker instead. `ListRequirementsReferencing` starts answering groups per project, which is the first interpolated string in the plugin and therefore the trigger for `t`'s third parameter.

**Tech Stack:** TypeScript, Vue 3 + Pinia (presentation only), Zod (frontmatter schemas), Vitest, Obsidian plugin API 1.13.0.

**Spec:** [`docs/superpowers/specs/2026-08-30-slice-19-asset-catalogue-leaves-the-project-design.md`](../specs/2026-08-30-slice-19-asset-catalogue-leaves-the-project-design.md) — the delta. The design proper is [`docs/tasks/19-the-asset-catalogue-leaves-the-project.md`](../../tasks/19-the-asset-catalogue-leaves-the-project.md), and **both travel with this plan**: the task document owns *what done means* (its Definition of Done plus the seven open criteria in `docs/tasks/10`), the spec owns *what changed since it was written*.

## Global Constraints

- **`npm run check` must pass before every commit** — build (`vue-tsc` + Vite + the stylesheet assembler), lint (oxlint then ESLint, `--max-warnings 0` on both), `test:coverage`, and `analyze` (fallow). CI runs the identical command on Ubuntu 22/24/26 and Windows 22.
- **Coverage floors are 99/99/99/98** (statements/functions/lines/branches). Measured on `main` at `f94ce6e`: 99.24 / 99.05 / — / **98.08 (2660/2712)**. That is **2.24 branches of headroom**. Every new arm gets its test *in the commit that adds it*; an untested arm does not lower a number, it fails the gate.
- **Layer bans are lint rules.** `presentation → application → domain → core`; `infrastructure → application → domain → core`; only `src/plugin/` may reach all of them. `vue`, `pinia`, `konva` and `obsidian` may not be named in `core/`, `domain/` or `application/`.
- **Nothing writes to the vault outside `infrastructure/`** — `WRITE_BOUNDARY` in `eslint.config.mjs`.
- **No user-facing literal at a notice or `setText`/`createEl` door.** Every string goes through `t`/`tr` with a `StringKey` declared in `en.ts`; `de.ts` must translate every key `en.ts` declares (`tests/presentation/i18n/strings.test.ts`).
- **Sentence-case UI text** (`obsidianmd/ui/sentence-case-locale-module` fails the build otherwise).
- **A view type or command id is DATA** — never renamed. Display names beside them are text.
- Line budget: `src/**` files cap at 400 lines (`max-lines`); `tests/**` has a larger cap.

---

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `src/infrastructure/obsidian/repositories/foldersOverlap.ts` | The §83 predicate: equal, or either contains the other. Pure. |
| `src/plugin/settings/libraryMigration.ts` | Validate → move → rebuild → persist, in that order, for a `libraryFolder` change. |
| `src/application/ports/LibraryOverlaps.ts` | The port `ListProjectsQuery` asks "which listed projects overlap the library". |
| `src/infrastructure/obsidian/repositories/IndexLibraryOverlaps.ts` | Its implementation: `projectFolderOf` + `foldersOverlap` over the index. |
| `tests/infrastructure/obsidian/repositories/foldersOverlap.test.ts` | The predicate's cases, including the two containment directions. |
| `tests/plugin/settings/libraryMigration.test.ts` | Ordering: a failed move leaves `data.json` untouched. |
| `tests/application/queries/listProjectsOverlaps.test.ts` | The overlap ids reach `ProjectListResult`. |
| `tests/presentation/views/projectListOverlap.test.ts` | The row renders a mark **and** a word. |

**Modified**

| File | Change |
| --- | --- |
| `src/presentation/i18n/strings.ts` | `t(language, key, params?)`; `tr` forwards. |
| `src/presentation/i18n/locales/en.ts`, `de.ts` | New keys: the grouped row label, the library-folder setting, the overlap marker, the three refusals. |
| `src/plugin/settings/settings.ts` | `libraryFolder` field, its validator, its default, both ends of `settingsFrom`. |
| `src/plugin/settings/SettingsTab.ts` | One more definition. |
| `src/plugin/RenovationPlannerPlugin.ts` | `saveSettings` routes a `libraryFolder` change through the migration. |
| `src/domain/asset/Asset.ts` | `projectId` gone from `CreateAssetProps`, `AssetFields`, the class, and `withChanges`'s `Omit`. |
| `src/domain/asset/Asset.events.ts` | `AssetEventPayload` loses `projectId`. |
| `src/infrastructure/persistence/dto/assetFrontmatter.ts` | `project` key removed. |
| `src/infrastructure/persistence/mappers/assetMapper.ts` | Stops reading/writing `project`; strips a leftover key. |
| `src/infrastructure/obsidian/repositories/noteEntityWrite.ts` | Constraint drops `projectId`; `NoteWriteSpec` gains `projectId(entity)`. |
| `src/infrastructure/obsidian/repositories/ObsidianAssetRepository.ts` | Library folder, `listAll()`, no `projectId`. |
| `src/infrastructure/persistence/in-memory/InMemoryAssetRepository.ts` | Same port change. |
| `src/application/ports/AssetRepository.ts` | `listByProject` → `listAll`. |
| `src/application/queries/ListAssets.ts` | `execute()` takes nothing. |
| `src/application/queries/ListRequirementsReferencing.ts` | Answers `readonly ReferencingGroup[]`. |
| `src/application/queries/ListProjects.ts` | `ProjectListResult` gains `overlapping`. |
| `src/application/queries/ListReassignmentTargets.ts` | Header narrowed. |
| `src/application/commands/requirement/AssignAsset.ts` | `requirement.cross-project` deleted. |
| `src/application/commands/requirement/reversible-assign-asset-command.ts` | Same. |
| `src/application/commands/asset/DeleteAsset.ts` | Asset half of `reference.cross-project-reassign` deleted; the Zone half in `DeleteZone.ts` **stays**. |
| `src/application/commands/asset/CreateAsset.ts` | No `projectId` input. |
| `src/presentation/read-models/planEditorQueries.ts` | `listAssets()` takes nothing. |
| `src/presentation/read-models/renovationProjectQueries.ts` | Maps `overlapping` onto the DTO. |
| `src/presentation/read-models/PlanDto.ts` | `ProjectSummaryDto.libraryOverlap: boolean`. |
| `src/presentation/views/ProjectList.vue` | The marker. |
| `src/presentation/editor/deleteZoneFlow.ts` | Builds rows from groups. |
| `styles/` | One partial for the marker. |
| `src/plugin/composition-root.ts`, `guardedServices.ts` | Wire the new port and the changed signatures. |

---

## Task 1: `t` gains interpolation

Slice 15 item 6a. Purely additive — no caller yet, so the tree stays green.

**Files:**
- Modify: `src/presentation/i18n/strings.ts`
- Modify: `tests/presentation/i18n/strings.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `t(language: string, key: StringKey, params?: Readonly<Record<string, string>>): string` and `tr(key: StringKey, params?: Readonly<Record<string, string>>): string`. Task 7 and Task 9 are its callers.

- [ ] **Step 1: Write the failing tests**

Append to `tests/presentation/i18n/strings.test.ts`:

```ts
describe('interpolation', () => {
	it('fills a hole from params', () => {
		expect(t('en', 'reference.row.project', { name: 'Kitchen refit' })).toBe('Kitchen refit');
	});

	it('leaves an unmatched hole standing rather than blanking it', () => {
		// A visible `{name}` is a bug report; an empty string is a silent one.
		expect(t('en', 'reference.row.project', {})).toContain('{name}');
	});

	it('is unchanged for a two-argument call', () => {
		expect(t('en', 'view.project.list-title')).toBe(en['view.project.list-title']);
	});

	it('requires de.ts to name the same holes as en.ts, per key', () => {
		const holes = (value: string): string[] => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
		for (const [key, german] of Object.entries(de) as [StringKey, string][]) {
			expect(holes(german), `de.ts holes for ${key}`).toEqual(holes(en[key]));
		}
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/i18n/strings.test.ts`
Expected: FAIL — `t` takes two arguments, and `reference.row.project` is not a `StringKey` yet.

- [ ] **Step 3: Add the key, then the parameter**

In `src/presentation/i18n/locales/en.ts`, beside the other `reference.*` keys:

```ts
	'reference.row.project': '{name}',
```

In `de.ts`:

```ts
	'reference.row.project': '{name}',
```

In `src/presentation/i18n/strings.ts`, replace `t` and `tr`:

```ts
/**
 * One pass over the template filling `{name}` holes. An UNMATCHED hole is left standing as
 * `{name}` rather than blanked: a visible hole is a bug report, an empty string is a silent
 * one. `params` is optional, so every existing two-argument call is unchanged — which the
 * compiler enforces rather than a sweep.
 *
 * ONE KEY PER LABEL, never a translated fragment concatenated with a name: word order and
 * the punctuation around an interpolated name are the translator's to choose
 * ([[Multilanguage]]).
 */
export function t(language: string, key: StringKey, params?: Readonly<Record<string, string>>): string {
	const template = LOCALES[language]?.[key] ?? en[key];
	if (params === undefined) return template;
	return template.replace(/\{(\w+)\}/g, (hole, name: string) => params[name] ?? hole);
}
```

and

```ts
/** `t` in the app's own language. */
export function tr(key: StringKey, params?: Readonly<Record<string, string>>): string {
	return t(currentLanguage(), key, params);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/presentation/i18n/strings.test.ts`
Expected: PASS.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add src/presentation/i18n tests/presentation/i18n
git commit -m "Give t a third parameter, and hold both locales to the same holes"
```

---

## Task 2: `foldersOverlap`

The predicate §83 needs. It does not exist (measured: zero matches in `src/` and `tests/`). Pure, so it is a node test and nothing else.

**Files:**
- Create: `src/infrastructure/obsidian/repositories/foldersOverlap.ts`
- Create: `tests/infrastructure/obsidian/repositories/foldersOverlap.test.ts`

**Interfaces:**
- Consumes: `normalizeFolder` from `./paths`.
- Produces: `foldersOverlap(a: string, b: string): boolean`. Tasks 3, 4 and 8 all call it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { foldersOverlap } from '../../../../src/infrastructure/obsidian/repositories/foldersOverlap';

describe('foldersOverlap', () => {
	it('is true for the same folder', () => {
		expect(foldersOverlap('Renovation/Library', 'Renovation/Library')).toBe(true);
	});

	// BOTH directions, because either path can be the one that moves — §83's own wording.
	it('is true when the first contains the second', () => {
		expect(foldersOverlap('Renovation', 'Renovation/Library')).toBe(true);
	});

	it('is true when the second contains the first', () => {
		expect(foldersOverlap('Renovation/Library', 'Renovation')).toBe(true);
	});

	it('is false for siblings', () => {
		expect(foldersOverlap('Renovation/Library', 'Renovation/Kitchen refit')).toBe(false);
	});

	// The segment boundary is the whole point: a prefix is not containment.
	it('is false for a shared name prefix that is not a folder boundary', () => {
		expect(foldersOverlap('Renovation/Lib', 'Renovation/Library')).toBe(false);
	});

	it('normalises before comparing', () => {
		expect(foldersOverlap(' Renovation/Library/ ', 'Renovation/Library')).toBe(true);
	});

	// Over-refusing costs a rename; under-refusing costs every project's catalogue. On a
	// case-insensitive filesystem these two strings are ONE folder.
	it('refuses a case-folded overlap, because the directions are not symmetric', () => {
		expect(foldersOverlap('Renovation/library', 'Renovation/Library')).toBe(true);
		expect(foldersOverlap('renovation', 'Renovation/Kitchen refit')).toBe(true);
	});

	// The vault ROOT contains everything, which is what makes an empty library folder
	// unusable rather than merely odd.
	it('is true when either side is the vault root', () => {
		expect(foldersOverlap('', 'Renovation/Kitchen refit')).toBe(true);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/infrastructure/obsidian/repositories/foldersOverlap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

```ts
import { normalizeFolder } from './paths';

/**
 * §83: the library folder and a project folder may neither be EQUAL nor CONTAIN one
 * another. The consequence is not cosmetic — deleting a project is deleting its folder, so
 * a project folder holding the library would take every project's shared catalogues with
 * it.
 *
 * Containment is tested at the SEGMENT boundary, never as a string prefix: `Renovation/Lib`
 * is not inside `Renovation/Library`, and a bare `startsWith` says it is.
 *
 * The vault ROOT (`''`) contains everything, so it overlaps every folder — which is what
 * makes an empty library setting a refusal rather than a curiosity.
 *
 * Symmetric on purpose: §83 says the check "refuses in every direction, since either path
 * can be the one that moves", and one predicate with three call sites is what keeps that
 * from becoming three predicates.
 */
export function foldersOverlap(a: string, b: string): boolean {
	// CASE-INSENSITIVE, deliberately, and this is the one asymmetric decision in the file.
	// Obsidian's paths are case-sensitive; Windows and macOS filesystems usually are not, so
	// `Renovation/library` and `Renovation/Library` can be ONE folder on disk and two strings
	// here. A case-sensitive comparison answers `false` for a genuine overlap and lets through
	// exactly the state this guard exists to prevent — deleting the apparently separate
	// project folder takes the shared catalogue with it.
	//
	// Over-refusing costs a user one rename; under-refusing costs them every project's
	// catalogue. The directions are not symmetric, so the safe one is taken without waiting
	// to learn which filesystem the vault is on — which nothing here can ask anyway.
	const left = fold(a);
	const right = fold(b);
	if (left === right) return true;
	return contains(left, right) || contains(right, left);
}

/** `toLowerCase` on the normalised path — see the asymmetry note in `foldersOverlap`. */
function fold(raw: string): string {
	return normalizeFolder(raw).toLowerCase();
}

/** Whether `outer` is an ancestor of `inner`, at a folder boundary. */
function contains(outer: string, inner: string): boolean {
	if (outer === '') return true;
	return inner.startsWith(`${outer}/`);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/infrastructure/obsidian/repositories/foldersOverlap.test.ts`
Expected: PASS, 7 cases.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add src/infrastructure/obsidian/repositories/foldersOverlap.ts tests/infrastructure/obsidian/repositories/foldersOverlap.test.ts
git commit -m "Write the §83 overlap predicate, symmetric and segment-aware"
```

**Note for the executor:** `normalizeFolder` calls Obsidian's `normalizePath`, which the test mock provides. If `npm run analyze` reports `foldersOverlap` as an unused export at this point, that is expected and is closed by Task 3 — do not add a caller to satisfy the tool.

---

## Task 3: The `libraryFolder` setting

The field, its validator, both ends of `settingsFrom`, one settings definition, and the overlap refusal at **project creation** — the first of §83's two doors. Nothing reads it as a path yet, so the tree stays green.

**Files:**
- Modify: `src/plugin/settings/settings.ts`
- Modify: `src/plugin/settings/SettingsTab.ts`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianProjectRepository.ts`
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Modify: `tests/plugin/settings/settings.test.ts`
- Modify: the project-creation repository test file

**Interfaces:**
- Consumes: `foldersOverlap` (Task 2).
- Produces: `RenovationPlannerSettings.libraryFolder: string`, `DEFAULT_SETTINGS.libraryFolder = 'Renovation/Library'`. Tasks 4, 5 and 8 all read it.

- [ ] **Step 1: Write the failing settings tests**

```ts
it('round-trips libraryFolder through settingsFrom', () => {
	expect(settingsFrom({ libraryFolder: 'Shared/Catalogue' }).libraryFolder).toBe('Shared/Catalogue');
});

it('falls back to the default for an empty or non-string libraryFolder', () => {
	expect(settingsFrom({ libraryFolder: '   ' }).libraryFolder).toBe(DEFAULT_SETTINGS.libraryFolder);
	expect(settingsFrom({ libraryFolder: 7 }).libraryFolder).toBe(DEFAULT_SETTINGS.libraryFolder);
});

it('drops a key this version does not declare, on the way out as well as in', () => {
	expect(settingsFrom({ libraryFolder: 'Shared', mystery: 1 })).not.toHaveProperty('mystery');
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run tests/plugin/settings/settings.test.ts`
Expected: FAIL — `libraryFolder` is not a property of the returned settings.

- [ ] **Step 3: Add the field**

In `src/plugin/settings/settings.ts`, beside `DEFAULT_PROJECT_FOLDER`:

```ts
/**
 * §36's drawing, and it is only legal because slice 18 landed first: under the pre-18 shape
 * `Renovation` WAS the project folder, so `foldersOverlap('Renovation/Library',
 * 'Renovation')` is true and the default would be refused by the rule §83 states. After
 * slice 18 the project folders are `Renovation/Kitchen refit` and friends, and the library
 * is their sibling.
 */
const DEFAULT_LIBRARY_FOLDER = 'Renovation/Library';
```

Add to the interface, after `projectFolder`:

```ts
	/**
	 * Where the shared Asset (and later Supplier and Trade) catalogues live — one per vault
	 * (§83). Unlike `projectFolder` this is not "where a new one starts": it is where the
	 * catalogue IS, so changing it MOVES the notes. ADR-011 priced a configurable path as
	 * something to avoid where it can be avoided; here it cannot, because a shared library
	 * has no project folder to derive its location from.
	 */
	libraryFolder: string;
```

Add to `DEFAULT_SETTINGS`:

```ts
	libraryFolder: DEFAULT_LIBRARY_FOLDER,
```

Generalise the folder validator — one function, two callers, rather than a second copy:

```ts
/**
 * Whether a folder path is usable as one. Empty after trimming is the only refusal: a path
 * is user text, `normalizePath` is applied where it meets the Vault, and anything non-empty
 * is a place. The `fallback` parameter is what lets one validator serve both folder
 * settings — the alternative was a second function differing only in its default.
 */
function folderFrom(value: unknown, fallback: string): string {
	return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
```

and in `settingsFrom`:

```ts
		projectFolder: folderFrom(stored.projectFolder, DEFAULT_SETTINGS.projectFolder),
		libraryFolder: folderFrom(stored.libraryFolder, DEFAULT_SETTINGS.libraryFolder),
```

Delete `projectFolderFrom`.

- [ ] **Step 4: Run and watch it pass**

Run: `npx vitest run tests/plugin/settings/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the settings definition — a `folder` control with a `validate`, NOT a `text` one**

**Read this before writing the row.** `setControlValue` calls `saveSettings` directly, on
**every** control change — so a `text` control here would persist an intermediate value on the
way to a real one, and (per Task 4) fire a catalogue migration for each. Typing
`Shared/Catalogue` over `Renovation/Library` would move the notes through
`Renovation/Librar`, `Renovation/Libra`, … and through the DEFAULT, because `settingsFrom`
falls an empty string back to `Renovation/Library`. `docs/tasks/19` says this row "needs no
new branch, because `getControlValue` / `setControlValue` are keyed generically" — true of a
preference, false of a migration, and that sentence is one of the amendments Task 10 owes.

Two Obsidian 1.13 features close it, and neither is used anywhere in this repository yet:

```ts
			{
				name: tr('settings.library-folder.name'),
				desc: tr('settings.library-folder.desc'),
				control: {
					// A FOLDER picker, not free text: the value is chosen whole rather than
					// typed character by character. `includeRoot` defaults to false, which
					// matters here — `foldersOverlap` treats the vault root as containing
					// everything, so the root is never an offerable library.
					type: 'folder',
					key: 'libraryFolder',
					defaultValue: DEFAULT_SETTINGS.libraryFolder,
					// Runs BEFORE the value is persisted and renders its message inline
					// beneath the row. This is where §83's refusal belongs — earlier than
					// the migration, and with a surface of its own.
					validate: (value: string) => {
						for (const projectFolder of projectFolders()) {
							if (foldersOverlap(value, projectFolder)) {
								return tr('settings.library-folder.overlaps');
							}
						}
					},
				},
			},
```

**A residue to state rather than assume:** the typings do not say whether a `folder` control
calls `setControlValue` once on selection or on each keystroke while its suggester is open.
Obsidian cannot run in this repository, so no test here settles it — which is exactly why Task
4 no longer hangs a migration off this path at all. `docs/tests/cases/` is where it gets
looked at.

`en.ts` (sentence case — the lint rule fails a capitalised mid-sentence word):

```ts
	'settings.library-folder.name': 'Library folder',
	'settings.library-folder.desc': 'Where the shared asset catalogue lives. Changing this moves the notes.',
	'settings.library-folder.overlaps': 'The library folder cannot be inside a project folder, or contain one.',
	'settings.library-folder.move-failed': 'The library could not be moved, so the setting was not changed.',
	'project.folder-overlaps-library': 'That project folder would overlap the library folder.',
```

`de.ts` — **`Objekt`, never `Material`, for an Asset** (`tests/presentation/i18n/strings.test.ts` refuses the word):

```ts
	'settings.library-folder.name': 'Bibliotheksordner',
	'settings.library-folder.desc': 'Wo der gemeinsame Objektkatalog liegt. Eine Änderung verschiebt die Notizen.',
	'settings.library-folder.overlaps': 'Der Bibliotheksordner darf nicht in einem Projektordner liegen oder einen enthalten.',
	'settings.library-folder.move-failed': 'Die Bibliothek konnte nicht verschoben werden, die Einstellung wurde nicht geändert.',
	'project.folder-overlaps-library': 'Dieser Projektordner würde den Bibliotheksordner überlappen.',
```

- [ ] **Step 6: Refuse an overlapping folder at project creation**

`ObsidianProjectRepository` computes a new project's folder with `freshProjectFolder`. Immediately after that call and **before `ensureFolder`**, so nothing is created for a refused project:

```ts
			const folder = freshProjectFolder(this.deps.vault, this.newProjectRoot, project.name, project.id);
			// §83, first of two doors. BEFORE `ensureFolder`, so a refusal creates nothing —
			// the orphan-folder compensation this class already carries is for a failed
			// write, not for a refusal it could have made first.
			if (foldersOverlap(folder, this.libraryFolder)) {
				return err(persistenceError('project.folder-overlaps-library', `Project folder ${folder} overlaps the library folder ${this.libraryFolder}.`));
			}
```

`libraryFolder` is a constructor field here, and that is correct rather than a slice-18 relapse: it is a SETTING, not a derived value, and `saveSettings` replaces the whole composition root, so a stored copy cannot go stale.

- [ ] **Step 7: Write the refusal's test, run the gate, commit**

```ts
it('refuses a new project whose folder would overlap the library, and creates no folder', async () => {
	const repo = createProjectRepository({ newProjectRoot: 'Renovation/Library', libraryFolder: 'Renovation/Library' });
	const saved = await repo.save(project, 'absent');
	expect(isErr(saved) && saved.error.code).toBe('project.folder-overlaps-library');
	expect(vault.getAbstractFileByPath('Renovation/Library/Kitchen refit')).toBeNull();
});
```

```bash
npm run check
git commit -am "Add the library folder setting and refuse a project folder that overlaps it"
```

---

## Task 4: Changing the library folder is a migration

Validate → move → rebuild → **persist last**. Order 4-after-2 is the whole reason this is called a migration: persisting first leaves every project resolving an empty library while the notes sit at the old path.

**Files:**
- Create: `src/plugin/settings/libraryMigration.ts`
- Create: `tests/plugin/settings/libraryMigration.test.ts`
- Modify: `src/plugin/RenovationPlannerPlugin.ts`

**Interfaces:**
- Consumes: `foldersOverlap` (Task 2), `libraryFolder` (Task 3).
- Produces: `migrateLibraryFolder(deps: LibraryMigrationDeps, from: string, to: string): Promise<Result<void, AppError>>`.

- [ ] **Step 1: Write the failing tests**

```ts
it('moves every catalogue note, then rebuilds, then persists — in that order', async () => {
	const order: string[] = [];
	// …deps recording 'move' | 'rebuild' | 'persist'
	await migrateLibraryFolder(deps, 'Renovation/Library', 'Shared/Catalogue');
	expect(order).toEqual(['move', 'move', 'rebuild', 'persist']);
});

it('leaves data.json untouched when a move fails', async () => {
	deps.renameFile = () => Promise.reject(new Error('locked'));
	const result = await migrateLibraryFolder(deps, 'Renovation/Library', 'Shared/Catalogue');
	expect(isErr(result) && result.error.code).toBe('settings.library-move-failed');
	expect(persisted).toBeUndefined();
});

it('refuses a destination overlapping any project folder, naming the project', async () => {
	const result = await migrateLibraryFolder(deps, 'Renovation/Library', 'Renovation/Kitchen refit/Library');
	expect(isErr(result) && result.error.code).toBe('settings.library-overlaps-project');
	expect(deps.renameFile).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run and watch them fail** — module not found.

- [ ] **Step 3: Implement it**

```ts
/**
 * A `libraryFolder` change is a MIGRATION, not a preference ([[Settings and configuration]]):
 * the setting "moves the catalogues, rebuilds the index, and refuses the new value until the
 * move has succeeded". The order is the whole point — persisting first leaves every project
 * resolving an empty library while the notes sit at the old path.
 *
 * **Partial moves are not compensated**, identically to slice 18's migration and for the same
 * reason: a reverse move can fail the same way and leave no coherent shape. A diagnostic names
 * what moved, the setting is not persisted, and this is the documented cost rather than a bug.
 */
export async function migrateLibraryFolder(
	deps: LibraryMigrationDeps,
	from: string,
	to: string,
): Promise<Result<void, AppError>> {
	const destination = normalizeFolder(to);
	if (!destination) return err(validationError('settings.library-folder-empty', 'A library folder cannot be empty.'));

	// 1. Validate against EVERY project folder, in both directions.
	for (const projectFolder of deps.projectFolders()) {
		if (foldersOverlap(destination, projectFolder)) {
			return err(validationError('settings.library-overlaps-project', `The library folder ${destination} overlaps project folder ${projectFolder}.`));
		}
	}

	// 2. Move, so vault links survive — `renameFile`, never create-and-delete.
	const moved: string[] = [];
	const source = normalizeFolder(from);
	for (const note of deps.catalogueNotes(source)) {
		// The path RELATIVE to the old root, never `note.name`. A catalogue note lives at
		// `<library>/Assets/Tiles.md`, so its leaf name alone would flatten it to
		// `<destination>/Tiles.md` — losing the layout `assetsFolderFor(libraryFolder)`
		// expects, and colliding the moment `Suppliers/` and `Trades/` exist.
		const relative = note.path.slice(source.length + 1);
		const next = joinFolder(destination, relative);
		try {
			await deps.ensureFolder(parentOf(next));
			await deps.renameFile(note, next);
			moved.push(next);
		} catch (cause) {
			deps.logger.error('settings.library-move-failed', { moved, cause });
			return err(persistenceError('settings.library-move-failed', `Moved ${moved.length} note(s) before failing; the setting was not changed.`));
		}
	}

	// 3. Rebuild from the new roots, and 4. persist ONLY now.
	deps.rebuildIndex();
	await deps.persist(destination);
	return ok(undefined);
}
```

- [ ] **Step 4: Run and watch them pass.**

- [ ] **Step 5: Trigger it from an EXPLICIT action, never from `saveSettings`**

**The obvious wiring is wrong and would be destructive.** `setControlValue` calls
`saveSettings` on every control change, so hanging the migration off `saveSettings` fires one
catalogue move per intermediate value — including the default, because `settingsFrom` falls an
empty string back to it. `saveSettings` also has no serialization, so two changes overlap and
interleave their `renameFile` loops. Neither is a preference bug; both destroy data.

So the migration is reached only from a `SettingDefinitionAction` row — a button, with no
control and therefore no per-change write.

**Two things about that button are not obvious and were wrong in the first draft of this
plan.**

*It needs a host that exists.* `askDestination()` cannot use slice 15's `FormDialog`:
`DialogHost` is mounted in `PlanEditorRoot.vue` and `ViewRoot.vue` and nowhere else, its store
is scoped to each view's own Pinia app, and `SettingsTab` mounts no Vue app at all. A user
opening plugin settings with no Renovation Project or Plan Editor leaf open has nothing to
render into. So the destination is asked with an Obsidian **`Modal`** owned by `src/plugin/` —
the layer allowed to name `obsidian` — in the shape `open-plan-editor`'s `FuzzySuggestModal`
already uses for the plan picker. No Vue, no `DialogHost`, no dependency on which leaves happen
to be open.

*It needs a SYNCHRONOUS lock, and `disabled` is not one.* `disabled` is evaluated per render
and needs an `update()` call to re-evaluate, and `openDialog`'s throw-if-open only covers the
window while a dialog is up — which closes when the destination is submitted, before the rename
loop finishes. A second click during a slow migration would open a second modal and start a
second move from the same old root. The guard is a field tested and set **before any `await`**:

```ts
			{
				name: tr('settings.library-folder.move.name'),
				desc: tr('settings.library-folder.move.desc'),
				disabled: () => this.migrating,
				action: () => {
					// Tested and SET synchronously, before anything can yield. `disabled`
					// above is cosmetic — it needs a re-render to take effect, and a second
					// click can land before one happens.
					if (this.migrating) return;
					this.migrating = true;
					runDetached(this.logger, 'settings.library-move', async () => {
						try {
							const from = this.host.root.settings?.libraryFolder;
							if (from === undefined) return;
							const to = await askLibraryDestination(this.app);
							if (to === null) return;
							const migrated = await migrateLibraryFolder(this.libraryMigrationDeps(), from, to);
							if (isErr(migrated)) notifyError(migrated.error);
						} finally {
							this.migrating = false;
						}
					});
				},
			},
```

- [ ] **Step 5a: Test the lock at the door, not at the render**

```ts
it('refuses a second migration while one is in flight, without waiting for a re-render', () => {
	const tab = createSettingsTab({ migrate: neverResolves });
	tab.libraryMoveAction();
	tab.libraryMoveAction();
	// Watched red by moving `this.migrating = true` inside the async closure, which is where
	// the first draft had it: `disabled` alone lets the second click through.
	expect(askLibraryDestination).toHaveBeenCalledTimes(1);
});
```

Two properties still inherited rather than invented: **`runDetached`** is the plugin's one door
for a handler that returns nothing, so a fault maps, logs and notifies (SDD §66) rather than
becoming an unhandled rejection — an `action` callback returns `void`, which is exactly its
shape; and **the setting is never written by the control on this path**, because
`migrateLibraryFolder` persists as its own last step, so `data.json` changes only after the
notes have moved.

**What the `validate` in Task 3 Step 5 still buys**, given this button: it refuses an
overlapping folder at the moment of *choosing* one, inline, before the user presses anything —
`foldersOverlap` is asked twice on purpose, and the migration's own check in Step 3 is the one
that is load-bearing, because a project folder can be dragged between the two moments.

- [ ] **Step 6: Gate and commit**

```bash
npm run check
git commit -am "Make a library folder change a move-and-rebuild migration that persists last"
```

---

## Task 5: `Asset` loses `projectId`

**This task is deliberately large and cannot be split.** The domain type, the schema, the mapper, the write spec's constraint, the folder and the index axis all fail to compile independently, and either half alone is a *released* state where the rule is half-kept — an asset in the project folder with no project id, or one in the library still claiming a project. Green only at its end. Work the steps in order; the compiler is the guide.

**Files:**
- Modify: `src/domain/asset/Asset.ts`, `Asset.events.ts`
- Modify: `src/infrastructure/persistence/dto/assetFrontmatter.ts`, `mappers/assetMapper.ts`
- Modify: `src/infrastructure/obsidian/repositories/noteEntityWrite.ts`, `ObsidianAssetRepository.ts`
- Modify: `src/infrastructure/persistence/in-memory/InMemoryAssetRepository.ts`
- Modify: `src/application/ports/AssetRepository.ts`, `queries/ListAssets.ts`
- Modify: `src/application/commands/asset/CreateAsset.ts`, `DeleteAsset.ts`
- Modify: `src/application/commands/requirement/AssignAsset.ts`, `reversible-assign-asset-command.ts`
- Modify: `src/presentation/read-models/planEditorQueries.ts`
- Modify: `src/plugin/composition-root.ts`, `guardedServices.ts`

**Interfaces:**
- Consumes: `libraryFolder` (Task 3).
- Produces: `AssetRepository.listAll(): Promise<Result<Loaded<Asset>[], RepositoryError>>`; `ListAssets.execute(): Promise<Result<Asset[], RepositoryError>>`; `NoteWriteSpec.projectId: (entity: TEntity) => ProjectId | undefined`.

- [ ] **Step 1: Write the replacement test FIRST — a deleted refusal leaves nothing behind**

A deleted refusal leaves no test behind and nothing notices the guard being reintroduced. So assert its **inverse**:

```ts
it('assigns one asset into zones from two different projects', async () => {
	const assign = new AssignAssetCommand(ops);
	const first = await assign.execute({ zoneId: kitchenZone.id, assetId: tiles.id });
	const second = await assign.execute({ zoneId: bathroomZone.id, assetId: tiles.id });

	expect(first.ok && second.ok).toBe(true);
	// Each Requirement carries its OWN zone's project, which is what "work stays
	// project-scoped while catalogues do not" means at the row level.
	expect(await projectIdOfRequirement(first)).toBe(kitchenProject.id);
	expect(await projectIdOfRequirement(second)).toBe(bathroomProject.id);
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL with `requirement.cross-project`.

- [ ] **Step 3: Remove the field from the domain**

`Asset.ts` — delete `readonly projectId: ProjectId;` from `CreateAssetProps`, from `AssetFields`, from the class body and from the constructor assignment; drop the now-unused `ProjectId` import. `withChanges` currently reads:

```ts
Partial<Omit<CreateAssetProps, 'id' | 'projectId'>>
```

Make it `Partial<Omit<CreateAssetProps, 'id'>>`. **Delete the `projectId` clause of the comment rather than rewriting it** — a comment explaining why a field that does not exist is not editable is the kind of sentence that outlives everything around it.

`Asset.events.ts` — `AssetEventPayload` becomes `{ readonly assetId: AssetId }`. Nothing subscribes to `projectId` (the cascade keys on `assetId` and re-reads requirements by asset), which the payload type narrowing proves.

- [ ] **Step 4: Remove it from the schema and the mapper**

`assetFrontmatter.ts` — delete `project: z.string().min(1),`. **`ASSET_MIGRATIONS` stays empty** and the schema stays at version 1: the version is DERIVED from registered steps, and no release exists (verified against the remote — see the spec's Correction 1). If `list_releases` ever answers non-empty before this lands, this decision is void and a v1→v2 step is mandatory.

`assetMapper.ts` — stop reading and writing `project`. **Omitting it from the DTO is not
enough, and the first draft of this step was wrong about that.** `writeOwnedFrontmatter` is
`processFrontMatter(file, (fm) => Object.assign(fm, owned))` — a MERGE. A key absent from the
new DTO is simply preserved, so a note carrying `project` would keep it forever and the
round-trip test in Step 5 would fail. Removing it from the schema makes it worse rather than
better: it becomes an unowned extra, which this write path is designed to protect.

So a retired owned key needs explicit deletion semantics, and the door that owns keys is the
place for it:

```ts
/**
 * Merges the plugin-owned keys into an existing note without touching body or extras, and
 * DELETES keys this build has retired.
 *
 * `retired` exists because omission cannot express removal here: this is a merge, so a key
 * dropped from the DTO is preserved rather than cleared. Slice 19 retired `project` from an
 * Asset when the catalogue left the project, and the rule is about the BYTES — a note is
 * rewritten without it on its next save.
 */
export async function writeOwnedFrontmatter(
	fileManager: FileManager,
	file: TFile,
	owned: Record<string, unknown>,
	retired: readonly string[] = [],
): Promise<void> {
	await fileManager.processFrontMatter(file, (frontmatter) => {
		for (const key of retired) delete frontmatter[key];
		Object.assign(frontmatter, owned);
	});
}
```

`NoteWriteSpec` gains `retiredKeys?: readonly string[]`, and the asset spec sets
`retiredKeys: ['project']`. **Ordering is load-bearing**: delete first, assign second, so a key
that is both retired and re-owned survives as its new value rather than being deleted after it
was written.

- [ ] **Step 5: Add the round-trip test the strip needs**

```ts
it('round-trips a note carrying a leftover project key to a note that does not', async () => {
	await writeNote('Renovation/Library/Assets/Tiles.md', { ...assetFrontmatter, project: 'project-1' });
	const loaded = await repo.getById(tilesId);
	const saved = await repo.save(loaded.value.entity, { revision: 1 });
	expect(frontmatterAt('Renovation/Library/Assets/Tiles.md')).not.toHaveProperty('project');
	expect(saved.ok).toBe(true);
});
```

**Narrow claim, and say it in the test's own comment:** a note nobody ever saves again keeps the stale key on disk forever. There is no sweep and there will not be one.

- [ ] **Step 6: Widen `saveNoteBackedEntity`'s constraint**

Asset and Requirement share it; Requirement keeps its project and Asset does not. Drop the member from the constraint and move the question onto the spec:

```ts
export interface NoteWriteSpec<TEntity> {
	// …
	/** `undefined` for a catalogue entry, which belongs to no project (§59, amended). */
	readonly projectId: (entity: TEntity) => ProjectId | undefined;
}

export async function saveNoteBackedEntity<TEntity extends { readonly id: EntityId<string> }>(
```

The index upsert passes `spec.projectId(entity)` straight through to an already-optional field. **Two call sites, two compile errors, and no third place to forget** — the check is `vue-tsc`.

- [ ] **Step 7: Move the folder and the index axis**

`ObsidianAssetRepository` — the folder is the LIBRARY's, resolved from the setting rather than per-save from the index:

```ts
	constructor(private readonly deps: NoteVaultDeps, private readonly libraryFolder: string) {}
	// …
	private saveQueued(asset: Asset, expected: Expected) {
		const spec: NoteWriteSpec<Asset> = {
			...SPEC,
			projectId: () => undefined,
			notesFolder: assetsFolderFor(normalizeFolder(this.libraryFolder)),
		};
		return saveNoteBackedEntity(this.deps, spec, asset, expected);
	}
```

`listByProject` becomes `listAll`, over `getIdsByType` — assets drop off `getIdsByProject` **by construction**, because they are upserted without a `projectId`. No filter, no exclusion list:

```ts
	listAll(): Promise<Result<Loaded<Asset>[], RepositoryError>> {
		return this.list(this.deps.index.getIdsByType('renovation-asset') as AssetId[]);
	}
```

Mirror the rename in `AssetRepository.ts` and `InMemoryAssetRepository.ts`.

- [ ] **Step 8: Assert the axis rather than assuming it**

```ts
it('keeps assets off the project axis and on the type axis', async () => {
	await repo.save(tiles, 'absent');
	expect(index.getIdsByProject(kitchenProject.id)).not.toContain(tiles.id);
	expect(index.getIdsByType('renovation-asset')).toContain(tiles.id);
});
```

- [ ] **Step 9: Delete the three refusals, and keep the fourth**

- `requirement.cross-project` — gone from `AssignAsset.ts` **and** `reversible-assign-asset-command.ts`. The unit-kind check stays untouched; it was never about ownership.
- The **asset half** of `reference.cross-project-reassign` — gone from `DeleteAsset.ts`.
- **The Zone half in `DeleteZone.ts` STAYS.** Slice 10's rewritten criterion calls this asymmetry *"the thing a later reader is most likely to tidy back into symmetry"*, so assert **both halves in one test file**, not only the changed one:

```ts
it('accepts an asset reassignment target from another project', /* … */);
it('still refuses a ZONE reassignment target from another project', /* … */);
```

- [ ] **Step 10: `ListAssets` lists the vault**

```ts
	async execute(): Promise<Result<Asset[], RepositoryError>> {
		const listed = await this.assets.listAll();
		if (isErr(listed)) return listed;
		return ok(listed.value.map((a) => a.entity));
	}
```

and in `planEditorQueries.ts`, `listAssets(projectId: string)` → `listAssets()`. Test it with two projects:

```ts
it('offers the same catalogue to both projects', async () => {
	expect(await listAssets()).toEqual(await listAssetsFromOtherProjectContext());
});
```

- [ ] **Step 11: Re-wire the composition root, then the whole gate**

`composition-root.ts` passes `settings.libraryFolder` to `ObsidianAssetRepository`; `guardedServices.ts` follows the changed `ListAssets` signature.

```bash
npm run check
```

**Expect a sweep here, and read the greens sceptically.** Slice 18 recorded that converting the repositories made ~50 tests pass on the *wrong refusal* across four files. A test whose name says "conflict" and whose green now comes from a folder or a project-id change is green for the wrong reason. Grep the asset and requirement test files for `cross-project` and `projectId` and re-read each.

- [ ] **Step 12: Commit — one commit, per the spec's staying-green rule**

```bash
git commit -am "Asset belongs to the vault: drop projectId, move the catalogue to the library"
```

---

## Task 6: `ListRequirementsReferencing` answers groups

A shared asset's references are no longer all in the project the user is looking at, so a flat count reads as "in the project I am looking at" — which is exactly what they are not.

**Files:**
- Modify: `src/application/queries/ListRequirementsReferencing.ts`
- Modify: its test file

**Interfaces:**
- Produces:

```ts
export interface ReferencingGroup {
	readonly projectId: ProjectId;
	readonly projectName: string;
	/** Only where `projectName` is not unique among the groups returned. */
	readonly projectPath?: string;
	readonly requirementIds: readonly RequirementId[];
}
```

`execute(target: ReferencedTarget): Promise<Result<readonly ReferencingGroup[], RepositoryError>>`. Task 7 consumes it.

- [ ] **Step 1: Write the failing tests**

```ts
it('groups an asset\'s referents by project', async () => {
	const groups = await query.execute({ kind: 'asset', assetId: tiles.id });
	// A bare total fails this: two groups, not one count of three.
	expect(groups.value.map((g) => g.projectId)).toEqual([kitchen.id, bathroom.id]);
});

it('yields exactly one group for a zone target', async () => {
	// A Zone belongs to one project, so the Zone flow's existing single row is unchanged in
	// appearance and changed in derivation.
	expect((await query.execute({ kind: 'zone', zoneId: z.id })).value).toHaveLength(1);
});

it('supplies projectPath only where two projects share a name', async () => {
	// `Project.create` trims a name and rejects only an empty one, so two projects may
	// legitimately share one and nothing refuses it. This fixture is the ONLY way to
	// produce the case.
	const groups = (await query.execute({ kind: 'asset', assetId: tiles.id })).value;
	expect(groups.every((g) => g.projectPath !== undefined)).toBe(true);
});

it('omits projectPath when names are unambiguous', async () => {
	expect(groups.every((g) => g.projectPath === undefined)).toBe(true);
});
```

- [ ] **Step 2: Run and watch them fail** — `execute` answers `RequirementId[]`.

- [ ] **Step 3: Implement grouping**

Group the loaded requirements by `requirement.projectId`, resolve each project's `name` and note path, and set `projectPath` **only** where the name is not unique among the groups returned. A path shown beside every row is noise on the common case; a missing path where two names collide renders two identical rows for the two things the user is choosing between.

- [ ] **Step 4: Run and watch them pass. Gate. Commit.**

```bash
npm run check
git commit -am "Group an asset's referents by project, with a path only where the name is ambiguous"
```

**The grouping is asserted on the QUERY.** Whether a group becomes a row is slice 15's rule and slice 15's test — Task 7.

---

## Task 7: The row mapping (slice 15 item 6)

**Files:**
- Modify: `src/presentation/editor/deleteZoneFlow.ts`
- Modify: `tests/presentation/editor/deleteZoneFlow.test.ts`
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Modify: `docs/tasks/15-modals-and-confirmation-dialogs.md`

**Interfaces:**
- Consumes: `ReferencingGroup` (Task 6), `t(…, params)` (Task 1).
- Produces: rows for `DeleteReferenceDescriptor.references` — `ReferenceRow { label, count }`.

- [ ] **Step 1: Write the failing test**

```ts
it('renders one row per project, labelled by name, counted by that project\'s referents', () => {
	expect(rowsFor(groups)).toEqual([
		{ label: 'Kitchen refit', count: 2 },
		{ label: 'Bathroom', count: 1 },
	]);
});

it('disambiguates two projects sharing a name by path', () => {
	expect(rowsFor(ambiguousGroups).map((r) => r.label)).toEqual([
		'Kitchen refit — Renovation/Kitchen refit',
		'Kitchen refit — Renovation/Kitchen refit 2',
	]);
});
```

- [ ] **Step 2: Run and watch it fail.**

- [ ] **Step 3: Map groups to rows**

One key per label, never a translated fragment concatenated with a name:

```ts
	'reference.row.project': '{name}',
	'reference.row.project-at-path': '{name} — {path}',
```

```ts
function rowsFor(groups: readonly ReferencingGroup[]): ReferenceRow[] {
	return groups.map((group) => ({
		label: group.projectPath === undefined
			? tr('reference.row.project', { name: group.projectName })
			: tr('reference.row.project-at-path', { name: group.projectName, path: group.projectPath }),
		count: group.requirementIds.length,
	}));
}
```

- [ ] **Step 4: Run, gate, commit — and tick slice 15**

Add a dated note to `docs/tasks/15`, the same shape slice 10 used when it closed items 8 and 8a:

```markdown
**Items 6 and 6a were met by slice 19 (2026-08-30.)** The row mapping lives in
`presentation/editor/deleteZoneFlow.ts` and is asserted in its test file; `t`'s third
parameter lives in `presentation/i18n/strings.ts`.
```

```bash
npm run check
git commit -am "Map referencing groups to dialog rows, and close slice 15 items 6 and 6a"
```

---

## Task 8: The overlap reaches the project list

§83's third site has no door — ADR-0013 made a project's folder derived, `src/application/commands/project/` holds only `CreateProject.ts`, and a user moves a project by dragging the folder in Obsidian's file explorer. So the affected project's row says so. **Derived per render**, which is what makes staleness, counting, retraction, slot caps and session lifetime unrepresentable rather than handled — see the spec's seven-round account before changing this shape.

**Files:**
- Create: `src/application/ports/LibraryOverlaps.ts`
- Create: `src/infrastructure/obsidian/repositories/IndexLibraryOverlaps.ts`
- Create: `tests/application/queries/listProjectsOverlaps.test.ts`
- Modify: `src/application/queries/ListProjects.ts`
- Modify: `src/plugin/composition-root.ts`

**Interfaces:**
- Consumes: `foldersOverlap` (Task 2), `libraryFolder` (Task 3).
- Produces:

```ts
export interface LibraryOverlaps {
	/** The subset of `projectIds` whose derived folder overlaps the library folder (§83). */
	overlapping(projectIds: readonly ProjectId[]): readonly ProjectId[];
}
```

and `ProjectListResult.overlapping: readonly ProjectId[]`. Task 9 consumes the latter.

- [ ] **Step 1: Write the failing test**

```ts
it('reports a project whose derived folder contains the library', async () => {
	// The drag a user performs in Obsidian's file explorer, which no command can refuse.
	index.setPath(kitchen.id, 'Renovation/Kitchen refit/Project.md');
	const listed = await new ListProjects(projects, overlaps).execute();
	expect(listed.value.overlapping).toEqual([kitchen.id]);
});

it('reports nothing when every project is a sibling of the library', async () => {
	expect((await query.execute()).value.overlapping).toEqual([]);
});

// The condition is DERIVED, so fixing it is simply absent from the next read — there is
// nothing recorded to retract, which is the property the whole design rests on.
it('stops reporting once the folder is moved clear', async () => {
	index.setPath(kitchen.id, 'Renovation/Kitchen refit/Project.md');
	expect((await query.execute()).value.overlapping).toEqual([kitchen.id]);
	index.setPath(kitchen.id, 'Elsewhere/Kitchen refit/Project.md');
	expect((await query.execute()).value.overlapping).toEqual([]);
});
```

- [ ] **Step 2: Run and watch them fail** — `ListProjects` takes one constructor argument and answers no `overlapping`.

- [ ] **Step 3: Implement the port and its adapter**

```ts
/**
 * §83's third site has no door. ADR-0013 derives a project's folder from where its
 * `Project.md` sits, so a user moves a project by dragging a folder in Obsidian's file
 * explorer — there is no command to refuse. This answers which projects are currently in
 * that state, PER READ, so a user who fixes it simply stops being reported.
 */
export class IndexLibraryOverlaps implements LibraryOverlaps {
	constructor(private readonly index: ProjectIndex, private readonly libraryFolder: string) {}

	overlapping(projectIds: readonly ProjectId[]): readonly ProjectId[] {
		return projectIds.filter((id) => {
			const folder = projectFolderOf(this.index, id);
			return folder !== undefined && foldersOverlap(folder, this.libraryFolder);
		});
	}
}
```

`ListProjects` takes it and answers it:

```ts
	constructor(
		private readonly projects: ProjectRepository,
		private readonly overlaps: LibraryOverlaps,
	) {}

	async execute(): Promise<Result<ProjectListResult, RepositoryError>> {
		const listed = await this.projects.listAll();
		if (isErr(listed)) return listed;
		const projects = listed.value.loaded.map((loaded) => loaded.entity);
		return ok({
			projects,
			unreadable: listed.value.refused,
			// ONE query rather than two: a second would need a policy for "the list loaded
			// but the markers did not", and an advisory marker is exactly the thing whose
			// failure mode nobody would think about again.
			overlapping: this.overlaps.overlapping(projects.map((p) => p.id)),
		});
	}
```

- [ ] **Step 4: Run and watch them pass. Wire the root, gate, commit.**

```bash
npm run check
git commit -am "Answer which projects currently overlap the library, derived per read"
```

---

## Task 9: The marker on the row

**Files:**
- Modify: `src/presentation/read-models/PlanDto.ts`, `renovationProjectQueries.ts`
- Modify: `src/presentation/views/ProjectList.vue`
- Create: `styles/project-list-overlap.css` (registered in `styles/index.css`)
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Create: `tests/presentation/views/projectListOverlap.test.ts`
- Modify: `tests/harness/accessibility.test.ts`

**Interfaces:**
- Consumes: `ProjectListResult.overlapping` (Task 8), `tr` (Task 1).
- Produces: `ProjectSummaryDto.libraryOverlap: boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
it('marks a row whose project overlaps the library', async () => {
	const list = mount(ProjectList, { props: { projects: [{ ...kitchen, libraryOverlap: true }] } });
	expect(list.find('.rp-project-list__overlap').exists()).toBe(true);
});

it('leaves an ordinary row unmarked', async () => {
	expect(list.find('.rp-project-list__overlap').exists()).toBe(false);
});

// SDD §85 forbids status carried by colour alone, and
// `docs/components/Save-state indicator.md` puts it harder: "A mark and a word. Both,
// always, never one." jsdom resolves no CSS, so this asserts the WORD is in the DOM and
// that the stylesheet declares the class the template interpolates.
it('carries a word beside the mark, not a colour alone', () => {
	expect(list.find('.rp-project-list__overlap').text()).toBe(en['view.project.library-overlap']);
});

it('declares the marker class in the assembled stylesheet', () => {
	expect(assembledStyles()).toContain('.rp-project-list__overlap');
});
```

- [ ] **Step 2: Run and watch them fail.**

- [ ] **Step 3: Carry the flag to the DTO**

```ts
export interface ProjectSummaryDto {
	readonly id: string;
	readonly name: string;
	readonly status: string;
	/** §83: this project's derived folder overlaps the shared library folder. */
	readonly libraryOverlap: boolean;
}

export function toProjectSummaryDto(project: Project, libraryOverlap: boolean): ProjectSummaryDto {
	return { id: project.id, name: project.name, status: project.status, libraryOverlap };
}
```

In `createRenovationProjectQueries`:

```ts
			const overlapping = new Set(found.value.overlapping);
			return ok({
				projects: found.value.projects.map((p) => toProjectSummaryDto(p, overlapping.has(p.id))),
				unreadable: found.value.unreadable,
			});
```

- [ ] **Step 4: Render the marker**

In `ProjectList.vue`, inside the row button after the status span:

```html
			<span
				v-if="project.libraryOverlap"
				class="rp-project-list__overlap"
			>{{ tr('view.project.library-overlap') }}</span>
```

`en.ts` / `de.ts`:

```ts
	'view.project.library-overlap': 'Overlaps the library folder',
```

```ts
	'view.project.library-overlap': 'Überlappt den Bibliotheksordner',
```

`styles/project-list-overlap.css` — **an Obsidian CSS variable, never a hard-coded colour** (the assembler fails the build on a literal, including a bare colour word), and a CSS-drawn glyph so the mark is a mark rather than an icon dependency:

```css
.rp-project-list__overlap {
	color: var(--text-warning);
	border: 1px solid var(--text-warning);
	border-radius: var(--radius-s);
	padding: 0 var(--size-2-2);
}

.rp-project-list__overlap::before {
	content: '';
	/* A drawn triangle: the MARK half of "a mark and a word". */
}
```

- [ ] **Step 5: Add the accessibility case**

This is the project's first row-level status. `tests/harness/accessibility.test.ts` already mounts the real Renovation Project view; add a case that renders a marked row and scans it, asserting `.rp-project-list__overlap` is actually present in the scanned DOM. **Await `flushPromises()` before scanning** — `mountHarness` is synchronous and `void`s `onOpen`, and a scan one tick early finds zero elements and passes vacuously. That failure is already recorded in this file's own header for the empty-state case.

- [ ] **Step 6: Run, gate, commit**

```bash
npm run check
git commit -am "Mark a project row whose folder overlaps the library, with a mark and a word"
```

- [ ] **Step 7: Look at it**

```bash
npm run harness-shot -- --width=460
```

Read the capture by eye. Spacing, wrapping and contrast are measurements no gate in this repository performs — `npm run harness-shot` has caught ten defects `npm run check` could not, and a status pill on a narrow sidebar leaf is exactly the shape that has hidden one before.

---

## Task 10: Close the slice

**Files:**
- Modify: `src/application/queries/ListReassignmentTargets.ts`
- Modify: `docs/tasks/19-the-asset-catalogue-leaves-the-project.md`
- Modify: `docs/tasks/10-assets-requirements-and-the-end-to-end-loop.md`
- Modify: `CLAUDE.md`
- Modify: `vitest.config.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Narrow the over-promising header**

`ListReassignmentTargets` reads *"so slice 15's picker cannot OFFER a target that fails validation."* It is handed a `ReferencedTarget` — an asset id with no project — so it cannot know which projects' rules a candidate must satisfy. Narrow it to what it still does (area-kind, not-self, and for a Zone target still same-project). **Checked by review, not by a gate** — a narrowed comment is not something lint can see, and saying so is the honest form of this item.

- [ ] **Step 2: Apply the five amendments the spec lists**

In `docs/tasks/19`: the schema-bump justification rewritten to *no release exists, verified against the remote*; `foldersOverlap` described as written here rather than as existing; *"slice 18's two sites"* corrected to one; the three-refusals Definition of Done item split into two refusals plus the row marker; `PersistenceError` → `RepositoryError` in the `Interfaces & Contracts` snippets.

**A sixth amendment, found while planning.** That document says the library-folder row "needs
no new branch, because `getControlValue` / `setControlValue` are keyed generically". True of a
preference and false of a migration: `setControlValue` calls `saveSettings` on every control
change, so a generic text row would move the catalogue once per keystroke and once through the
default. The row is a `folder` control with a `validate`, and the migration hangs off a
separate action button — see Task 3 Step 5 and Task 4 Step 5.

- [ ] **Step 3: Tick slice 10's seven open criteria**

They are this slice's criteria and are **not** restated. Walk `docs/tasks/10`'s seven open boxes and tick each against a named test.

- [ ] **Step 4: Correct CLAUDE.md**

Two sentences say slice 12 "is still not done". It landed in #39. Also add slice 19's own section, and correct the `foldersOverlap` sentence — it reads as a predicate written and left uncalled, and there was none.

- [ ] **Step 5: Re-measure coverage and ratchet**

```bash
npm run test:coverage
```

Read the four figures. Floors rise only to what a **finished** increment measures, and only if the rounded-down figures exceed those in force. Record the arithmetic in `vitest.config.ts` as every previous slice has.

- [ ] **Step 6: CHANGELOG, gate, commit**

Add the `[Unreleased]` entries this slice earned.

```bash
npm run check
git commit -am "Close slice 19: narrow the reassignment header, apply the amendments, re-measure"
```

---

## Self-review

**Spec coverage.** Correction 1 (schema falsifier) → Task 5 Step 4 plus Task 10 Step 2. Correction 2 (`foldersOverlap` does not exist) → Task 2. The §83 decision → Tasks 3, 4, 8, 9. Grouped references → Tasks 6 and 7. `t` interpolation → Task 1. The library folder and its migration → Tasks 3 and 4. Asset loses its project → Task 5. Amendments → Task 10. **One spec item has no task and is deliberate:** the spec's "what this does not change" section names the currency window left open for slice 20 — that is slice 20's.

**Placeholder scan.** No "TBD", no "add error handling", no "similar to Task N". Two places give shape rather than a full literal and say why: Task 6 Step 3 describes the grouping rather than spelling a fixture whose project/requirement wiring depends on the test helpers the executor will be looking at, and Task 9's CSS glyph is left to the implementer because the exact triangle is a visual decision the capture in Step 7 settles.

**Type consistency.** `listAll()` is used in Tasks 5, 8 and the port. `ReferencingGroup` is defined in Task 6 and consumed in Task 7 with the same members. `libraryOverlap` is the DTO field in Task 9 and `overlapping` is the id list in Task 8 — deliberately different names for different shapes, at the seam where domain ids become a view flag. `foldersOverlap(a, b)` has the same signature at all three call sites.

## Open questions

These need a decision and I have not taken them.

1. ~~**Case sensitivity in `foldersOverlap`.**~~ **Decided, not open.** Left as a question in the
   first draft, which was wrong: the two directions are not symmetric. Under-refusing permits
   the exact state the guard exists to prevent — deleting an apparently separate project folder
   takes the shared catalogue — while over-refusing costs a rename. Task 2 folds case, and says
   so where the code is. Nothing here can ask which filesystem the vault is on, and it does not
   need to.
2. **The library migration and open Plan Editor leaves.** Moving catalogue notes rebuilds the index, but a mounted Inspector holds `InspectorDto`s built before the move. Nothing here refreshes them, and `ProjectIndexEntryChanged` fires per entry from `VaultChangeAdapter` — not from a bulk `renameFile` loop in the plugin shell. Whether the migration should publish, or leaves are expected to be stale until reopened, is unresolved.
3. **`Asset` notes already outside the library.** Slice 18 made discovery declaration-based, so an asset note the user filed anywhere is read and indexed. After Task 5 its *updates* write where it sits and only *inserts* go to the library, so such a note never moves. That is consistent with slice 18 and it means "the catalogue lives in the library folder" is true of new assets only. Worth stating in `docs/tasks/19` rather than discovering later.
4. **Coverage headroom is 2.24 branches** and this slice adds arms in eight files. The spec's "deletions help" argument (three refusals removed) is a reason to expect it to end level, not a measurement. If Task 10 Step 5 comes in under the floor, the choice between adding tests and lowering a floor is yours — this project's ratchet policy says floors only rise.
5. **German copy.** I drafted `de.ts` strings following the recorded terminology rule (`Objekt`, never `Material`), but CLAUDE.md records three German defects found only by a human reading the file, and the only gate is a two-term check. These want a native reader.

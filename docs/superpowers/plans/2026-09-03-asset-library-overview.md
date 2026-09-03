# Asset library overview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `renovation-asset-library` — a fourth registered Obsidian workspace surface that makes the vault-wide asset catalogue visible as category shelves, with a geometry mark per row and an in-place editing inspector.

**Architecture:** A new read model (`ListCatalogueEntries`) and a batched geometry read (`ListAssetOutlines`) over two widened ports (`AssetRepository` listing, `AssetGeometrySidecar` refusal path), a `ProjectIndex` collection of excluded notes with its own event, and a Vue/Pinia view promoted from the existing `src/prototypes/` mocks. Layer rules are unchanged: `presentation → application → domain → core`, composed only in `src/plugin/`.

**Tech Stack:** TypeScript, Vue 3 (`<script setup>`), Pinia, Zod, Obsidian API 1.13.0, Vitest + jsdom, ESLint + oxlint, fallow.

**Spec:** `docs/user-experience/asset-library-overview-DESIGN-SPEC.md` — the binding authority. Every task brief names the spec line range it implements; read it.

---

## Global Constraints

Copied verbatim from the spec and from `CLAUDE.md`. Every task's requirements implicitly include this section.

- **Definition of done is `npm run check`** — build (`vue-tsc` over `src/**` and `tests/**`, then Vite, then the stylesheet checks), lint (oxlint then ESLint, `--max-warnings 0` / `--deny-warnings`), `test:coverage` against floors 99/99/99/98 (statements/functions/lines/branches), and `analyze` (fallow). All four must pass before committing.
- **Coverage headroom is ONE covered unit on branches and on functions.** Plan the test with the code. An untested arm in a tight metric fails the gate outright; one in a slack metric hides completely.
- **Layer bans are lint rules.** `core/`, `domain/` and `application/` may not name `vue`, `pinia`, `konva` or `obsidian`. `presentation/dialogs/` may not import `application/`, `infrastructure/`, `plugin/` or the event bus. Only `src/plugin/` composes.
- **Nothing writes to the vault outside `infrastructure/`** (`WRITE_BOUNDARY` in `eslint.config.mjs`).
- **Registering with Obsidian belongs to `src/plugin/`** — `tests/build/registration-locality.test.ts` reads `src/` for nine registration members and requires every hit under `src/plugin/`.
- **A view type and a command id are DATA.** `ASSET_LIBRARY_VIEW = 'renovation-asset-library'` and the command id `open-asset-library` are persisted by Obsidian and never renamed.
- **Every user-visible string resolves through `t(language, key)`.** `I18N_LITERAL_BAN` refuses a literal at six call sites; `de.ts` must translate every key `en.ts` declares and must name the same interpolation holes. Sentence case, plain, no exclamation.
- **No colour-only status.** PRODUCT.md and SDD §85: every state is a printed mark as well as a colour. Selection is a 2px inset `box-shadow` rule plus `aria-current="true"`, never a tint alone.
- **No hard-coded colours in `styles/`** — SDD §84 requires an Obsidian CSS variable; the build fails on any literal colour lightningcss resolves.
- **A style partial is capped at 400 lines** and must be imported by `styles/index.css`.
- **A row is a flattened `<button>` selected UNDER its block class** (`.rp-al-shelf .rp-al-row` — the classes the components actually emit; the `rp-asset-*` spelling this plan used before Task 12 shipped exists nowhere in `src/`), because Obsidian's `button:not(.clickable-icon)` is (0,1,1) and a bare class is (0,1,0). `tests/build/buttonSpecificity.test.ts` reads every shipping sheet.
- **Every focus stop has a visible ring** — `2px solid var(--interactive-accent)`, offset negative for edge-to-edge rows and positive for inset controls. `tests/build/buttonFocusRing.test.ts` is the check.
- **Container queries, never media queries.** The ladder is ≥720px shelves+280px rail; 560–720px rail 240px, row drops supplier then waste; <560px the rail replaces the shelves.
- **Every asynchronous read carries a ticket, and a result whose ticket is no longer current is DROPPED — successes and failures alike** (§5.5).
- **`Money` is decomposed into an amount string plus a currency at every boundary.** A float is what ADR-010 refuses.
- **WCAG 2.2 AA is the binding target.** Both action-bearing empty states are scanned by `tests/harness/accessibility.test.ts` on the day they ship, asserting `.rp-empty-state` and `.rp-empty-state__action` are in the scanned DOM.
- **A fake must not be kinder, thinner, harsher or faster than the real thing.**
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.**
- **A docblock that says "the only place X" gets a `grep` in the SAME edit.**

---

## Rulings on §11 — decisions the spec leaves to this increment

The spec's §11 names nine decisions a builder must not invent silently. They are settled here, before Task 1, and each ruling names what it costs if wrong.

| § | Decision | Ruling | Cost if wrong |
| --- | --- | --- | --- |
| 11.1 | Does the geometry mark ship now? | **Yes.** §2a names it as the one thing no Bases view can do — the honest case for building the surface at all. It ships viewport-bounded per §5.3. | The increment is larger and the viewport batching is its riskiest part; deferring would have meant shipping no mark slot at all, not an empty one. |
| 11.2 | Shelf expansion per leaf or per vault? | **Per leaf**, in Obsidian's own view state, per §6.3. A setting would write through `saveSettings`, which rebinds every view on every disclosure toggle. | A user expanding the same shelves in two leaves; cheap and reversible. |
| 11.3 | How is an unreadable sidecar repaired? | **Not here.** `Open designer` is withdrawn for every `asset-geometry.*` refusal per §3.5 — the designer hydrates through the same `GetAssetDesign` and reaches the same failed state. Recorded as a gap this surface reveals and does not close. | A user with a corrupt `.rpgeo` has no in-plugin repair. Already true today; this surface makes it visible rather than causing it. |
| 11.4 | Does `Delete` belong on this surface? | **Yes**, per §3.5, and it routes through the existing delete flow with its reference-resolution dialog. The *Used in* read the gesture needs is already on screen, which is the spec's own argument, and withholding it would make this the one surface that shows an asset's blast radius and cannot act on it. | A destructive action one Tab from a row on a browsing surface. Mitigated by the existing confirmation dialog, which is unchanged. |
| 11.5 | The ceiling on empty shelves | **Not set.** Seven declared categories draw all seven. The number belongs to whoever ships §84's configuration surface. | A vault with a long configured vocabulary sees clutter. Unreachable today — §84 has no configuration surface. |
| 11.6 | Does *Used in* mark price-overriding projects? | **Yes — REVISED mid-execution.** The first ruling was "no, §89's override does not exist and there is nothing to mark"; merging `origin/main` at `e988524` falsified that premise in the same hour. `AssetPriceOverride` is a domain entity with `listByAsset(assetId)` — the exact lookup, one read on a selection that already performs two. Without the mark, an unmarked row makes the Definition section's own claim (*a price correction reaches every room it was used in*) false by omission, directly above the field that makes the correction. See spec §11.6, spec §3.5, Task 9's bundle and Task 14. | One extra query member and one marked row. |
| 11.7 | Widen the shared catalogue source or add a fourth? | **A fourth source**, `createAssetLibraryChangeSource`. Widening `createAssetCatalogueChangeSource` makes the assign picker re-read every asset note on design events it has no use for — a cost on a surface this increment does not own. | One more source module to keep in step with the picker's. Cheap and local. |
| 11.8 | Does the requirement event vocabulary grow? | **No.** *Used in* is a snapshot taken on selection, per §5.2. Adding `assetId` to the requirement payload and a `RequirementDeleted` sibling is a domain-layer change with consequences past this surface. | *Used in* can grow a row it will not lose within one selection. Re-selecting refreshes it. |
| 11.9 | Does a Bases view ship beside this? | **No code.** §2a's commitment is discharged by the negative rule — no fact about an asset exists only in this view — which every task below is bound by. The epic's Definition of Done item stays open and is not claimed. | The epic item remains unticked. Claiming it would be the worse error. |

---

## File structure

**Application — ports and events**
- Modify `src/application/ports/ProjectIndex.ts` — the excluded-note collection and its descriptor.
- Modify `src/application/ports/AssetRepository.ts` — `listAll()` answers a listing, not a bare array.
- Modify `src/application/ports/AssetGeometrySidecar.ts` — a refusal carries `sidecarPath`.
- Create `src/application/events/assetLibraryChangeSource.ts` — the fourth change source (§11.7 ruling).
- Modify `src/application/events/projectIndexEvents.ts` (wherever `ProjectIndexEntryChanged` is declared) — add `ProjectIndexExclusionChanged`.

**Application — queries**
- Create `src/application/queries/ListCatalogueEntries.ts` — the catalogue read model.
- Create `src/application/queries/ListAssetOutlines.ts` — the batched, per-entry-settling mark read.
- Modify `src/application/queries/GetAssetDesign.ts` — clearance extent through `dimensionsOf`, `sidecarPath` passthrough.

**Infrastructure**
- Modify `src/infrastructure/persistence/index/buildProjectIndexEntries.ts` — `EntityRef`'s `no-id` arm carries `type`; the scan collects excluded descriptors.
- Modify `src/infrastructure/persistence/index/VaultChangeAdapter.ts` — the incremental door announces exclusions, and promotes/demotes duplicate-id contenders atomically.
- Modify `src/infrastructure/persistence/index/InMemoryProjectIndex.ts` (or wherever the index implementation lives) — the excluded collection.
- Modify `src/infrastructure/obsidian/repositories/ObsidianAssetRepository.ts` and the in-memory sibling — the widened listing.
- Modify `src/infrastructure/obsidian/repositories/AssetGeometryStore.ts` — `sidecarPath` on refusal.

**Presentation**
- Create `src/presentation/library/AssetLibraryView.ts`, `AssetLibraryContext.ts`.
- Create `src/presentation/library/AssetLibraryRoot.vue`, `AssetShelves.vue`, `AssetShelf.vue`, `AssetRow.vue`, `AssetMark.vue`, `AssetInspector.vue`, `AssetInspectorShape.vue`, `AssetInspectorUsedIn.vue`, `shelfFocus.ts`, `viewportMarks.ts`.
- Create `src/presentation/read-models/assetLibraryQueries.ts`.
- Create `src/presentation/stores/AssetLibraryStore.ts`, `src/presentation/stores/AssetSelectionStore.ts`.
- Modify `src/presentation/emptyStates/content.ts`, `selectors.ts`.
- Modify `src/presentation/i18n/locales/en.ts`, `de.ts`.
- Modify `src/presentation/views/ViewRoot.vue` and `ProjectList.vue` — the two in-app doors (§2).

**Plugin**
- Modify `src/plugin/RenovationPlannerPlugin.ts` — `registerView`, the command, `assetLibraryViewDeps()`, the fourth `rebindOpenViews` loop.
- Modify `src/plugin/composition-root.ts` — `assetLibraryDeps(...)`.
- Modify `src/plugin/guardedServices.ts` — guard the two new queries.

**Styles**
- Create `styles/asset-library.css`, `styles/asset-library-inspector.css`; modify `styles/index.css` and `styles/list-row.css`.

---

## Preflight scan

Run before Task 1. Every pair of tasks that share a file or an interface, and every task's own self-agreement.

| Pair | Shared surface | Found |
| --- | --- | --- |
| 1 → 2 | `EntityRef.no-id` gains `type`; Task 2 reads it | Clean — Task 1 lands the field, Task 2 is its only new consumer |
| 2 → 5 | `ProjectIndex` excluded descriptors → `UnreadableEntry` | Clean — Task 5 maps, never re-derives |
| 3 → 5 | `AssetRepository.listAll()` listing → `CatalogueListing` | Clean — Task 3 supplies `read-failed` only; Task 5 merges the index's two other sources |
| 4 → 6, 4 → 14 | `sidecarPath` on refusal | Clean — Task 6 carries it per entry, Task 14 renders it |
| 7 → 10, 7 → 14 | change source → store invalidation | **Finding (found late, by a review bot rather than by this scan):** `AssetLibraryChange` carried only `catalogue` and `marks`, which cannot express the difference Task 10 needs between invalidating the design read and restarting both selection reads. Ruled: the payload carries `design` and `replaced` id sets. This row said "Clean" and was not — recorded rather than quietly corrected, because a scan that reports clean on a pair it did not actually hold together is the failure this table exists to prevent |
| 11 → 12/13/14 | view mounts the components | Task 11 lands a minimal root; 12–14 fill it. Ordered so the view is testable before the components exist |
| 9 → every UI task | `StringKey`s | Task 9 lands the whole key inventory first, so no later task adds copy piecemeal |
| 15 → 12/13/14 | class names | Task 15 follows the components, so it styles names that exist |
| 2 (self) | scan and incremental door | **Finding:** the promotion/demotion rule is the one place the incremental door may not stay path-local. Ruled: it is in scope for Task 2, and Task 2's brief carries §5.1a lines 1000–1010 verbatim |
| 6 (self) | batch vs. per-entry | **Finding:** the batch must settle per entry; a `Result` over the whole batch is the defect. Task 6's tests assert one damaged sidecar beside three good ones |
| 16 (self) | keyboard vs. `v-show` | **Finding:** jsdom cannot report layout, so the "skip a collapsed shelf's rows" filter is unassertable here. Ruled: the filter is written against `v-show`'s own attribute rather than layout, and the residual is recorded in the manual case |

**Ruling (preflight):** Tasks 12–14 promote `src/prototypes/AssetLibrary.vue`, `AssetShelf.vue`, `AssetInspector.vue` and `AssetMark.vue`. `tests/build/prototype-promotion.test.ts` holds templates byte-identical for exactly one file pair (`ZoneSummary.vue`) and does not cover these — so promotion here is a *port*, not a move, and each task states what changed and why. Cost if wrong: the prototypes and the shipped components drift, which is the gap that test exists to close for one pair and does not close for these.

**Ruling (preflight):** the codebase survey claimed `AssetGeometryStore.pathFor` derives from `libraryFolder` without consulting the index. Measured false — `pathFor` is index-first at `AssetGeometryStore.ts:283`, exactly as the spec's §5.3 says, with `usableAsFilename` refusing above it. Task 6's brief carries the measurement, because a batch that derives for itself reintroduces the moved-sidecar defect that method's own docblock records. Cost if wrong: a moved `.rpgeo` reads as shapeless on the one surface built to show shapes.

---

### Task 1: `EntityRef`'s `no-id` arm carries the entity type

**Spec:** §5.1a, lines 1013–1030 ("the descriptor carries `EntityType`, which the index cannot supply from its key").

**Files:**
- Modify: `src/infrastructure/persistence/index/buildProjectIndexEntries.ts:34-46`
- Test: `tests/infrastructure/persistence/index/entityRef.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `EntityRef` gains `{ kind: 'no-id'; type: EntityType }`. Task 2 is its only new consumer.

**Why it is free here and nowhere else:** `entityRefOf` validates `type` against `ENTITY_TYPES` on the line ABOVE the id check, so the `no-id` arm has already proved a valid `EntityType` before it returns. Capturing it costs no parsing and no second read. The alternative — re-reading the note when the repair strip is drawn — is a vault read per excluded note per render.

- [ ] **Step 1: Write the failing test**

```ts
it('carries the entity type on a note of ours with no usable id', () => {
    const ref = entityRefOf({ type: 'renovation-asset' });
    expect(ref).toEqual({ kind: 'no-id', type: 'renovation-asset' });
});

it('still refuses a note whose type is not ours, before asking about the id', () => {
    expect(entityRefOf({ type: 'something-else' })).toEqual({ kind: 'not-ours' });
    expect(entityRefOf({})).toEqual({ kind: 'not-ours' });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/infrastructure/persistence/index/entityRef.test.ts`
Expected: FAIL — the first case reports `{ kind: 'no-id' }` received against `{ kind: 'no-id', type: 'renovation-asset' }` expected. Watch it fail at the assertion, not at an import.

- [ ] **Step 3: Widen the union and the return**

```ts
export type EntityRef =
	| { kind: 'ours'; type: EntityType; id: string }
	| { kind: 'no-id'; type: EntityType }
	| { kind: 'not-ours' };

export function entityRefOf(frontmatter: Record<string, unknown>): EntityRef {
	const type = frontmatter['type'];
	if (typeof type !== 'string' || !ENTITY_TYPES.includes(type as EntityType)) {
		return { kind: 'not-ours' };
	}
	const id = stringField(frontmatter['id']);
	// The type is validated above, so the `no-id` arm carries it for free. Recorded here
	// because this is the ONLY point at which an excluded note's type is known without a
	// second read: `ProjectIndex` is keyed by id globally and has no type in its key.
	return id === undefined
		? { kind: 'no-id', type: type as EntityType }
		: { kind: 'ours', type: type as EntityType, id };
}
```

- [ ] **Step 4: Run the whole index suite**

Run: `npx vitest run tests/infrastructure/persistence/index/`
Expected: PASS. The two existing `entityRefOf` callers (`collectNotes` and `VaultChangeAdapter.processNote`) both discriminate on `kind` and ignore the new field, so nothing else moves. If either fails to compile, that is the compiler naming a caller this step must update — do not cast around it.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: entityRefOf carries the entity type of a note it cannot index"
```

---

### Task 2: The index holds excluded notes, and the incremental door announces them

**Spec:** §5.1a in full, lines 893–1049. Read it before writing anything — particularly lines 990–1010, which carry the promotion and demotion rules, and lines 1011–1022, which say why the descriptor carries a reason and a code.

**Files:**
- Modify: `src/application/ports/ProjectIndex.ts` — the descriptor type and the read/write members.
- Modify: `src/infrastructure/persistence/index/buildProjectIndexEntries.ts` — the scan collects descriptors.
- Modify: `src/infrastructure/persistence/index/VaultChangeAdapter.ts` — the incremental door.
- Modify: wherever `ProjectIndexEntryChanged` is declared — add `ProjectIndexExclusionChanged`.
- Test: `tests/infrastructure/persistence/index/excludedNotes.test.ts` (new), and the existing `announcements.test.ts`.

**Interfaces:**
- Consumes: Task 1's `EntityRef.no-id.type`.
- Produces:

```ts
// application/ports/ProjectIndex.ts
export type ExclusionReason = 'no-id' | 'duplicate-id';
export interface ExcludedNote {
	readonly path: string;
	readonly entityType: EntityType;
	readonly reason: ExclusionReason;
}
// read side
listExclusions(): readonly ExcludedNote[];
// write side
addExclusion(note: ExcludedNote): void;
removeExclusion(path: string): void;
```

```ts
// the new event
export interface ProjectIndexExclusionChangedPayload {
	readonly path: string;
	readonly entityType: EntityType;
}
```

**Four rules this task exists to keep.** Each gets a test that fails without it.

1. **The reason is carried, never reconstructed.** Open a duplicate-id loser and its frontmatter looks entirely valid — the defect is a collision with another file, invisible from inside the note. The three sources are distinct where they are collected and nowhere afterwards.
2. **The entity type is the LOSER's own, never the winner's.** `ProjectIndex` is one global id namespace and `collectNotes` keys its map by `ref.id` with no type in the key, so an asset note and a project note can collide. Assigning the winner's type files the excluded asset under whatever displaced it. The loser's type is free at both sides: `ref.type` for an arriving note that loses, and the displaced entry's own `type` for one already in the map.
3. **Promotion.** Removing or re-identifying an entry re-evaluates the excluded contenders for that id, and **exactly one of them is promoted — never only when exactly one remains.** It becomes an index entry, its descriptor is dropped, and every other contender for that id stays excluded as `duplicate-id`. Without promotion at all, a user resolves the collision exactly as instructed and the asset does not come back until a full rebuild.

   **"If exactly one remains" was the first version of this rule and it was wrong for three notes.** With three sharing an id, deleting the indexed winner leaves two contenders, so a sole-survivor condition promotes neither and the id disappears from the catalogue entirely — worse than the collision it was resolving, and a state the SCAN can never produce: `collectNotes` is last-writer-wins over an id-keyed map, so a full rebuild always ends with exactly one winner however many notes collide. An incremental door that can reach a no-winner state its own full rebuild cannot is a door that disagrees with the thing it is supposed to be an increment of. Reported by a review bot against this plan.

   **Which one is promoted must be deterministic**, and the scan's own answer is the one to copy rather than invent a second: last-writer-wins over the enumeration order. Pick the contender the next rebuild would pick, so an incremental promotion and a full rebuild agree — otherwise a reload silently changes which note IS the asset.
4. **Demotion, in the same atomic step.** `applyUpsert` is keyed by id, so a second note declaring an id the index already holds REPLACES the entry — and without this the displaced path is in neither `entries` nor `unreadable`. It is simply gone from the surface. Demotion and promotion are one change, not two.

- [ ] **Step 1: Write the failing tests — the scan**

```ts
it('records a note of ours with no id as an exclusion carrying its own type', async () => {
    const stack = createRepositoryStack();
    await stack.vault.create('Renovation/Library/broken.md', '---\ntype: renovation-asset\n---\n');
    await stack.rebuildIndex();
    expect(stack.index.listExclusions()).toEqual([
        { path: 'Renovation/Library/broken.md', entityType: 'renovation-asset', reason: 'no-id' },
    ]);
});

it('gives a duplicate-id loser its OWN type, never the winner is', async () => {
    // A project note and an asset note declaring one id: the index is a single
    // global namespace, so they collide and one is excluded.
    const stack = createRepositoryStack();
    await stack.vault.create('a/Project.md', '---\ntype: renovation-project\nid: shared-01\n---\n');
    await stack.vault.create('Renovation/Library/tile.md', '---\ntype: renovation-asset\nid: shared-01\n---\n');
    await stack.rebuildIndex();
    const excluded = stack.index.listExclusions();
    expect(excluded).toHaveLength(1);
    // Whichever lost, its descriptor names ITS type — not the type of the note that won.
    const winner = stack.index.get('shared-01' as EntityId<string>);
    expect(excluded[0]?.entityType).not.toBe(winner?.type);
    expect(excluded[0]?.reason).toBe('duplicate-id');
});
```

- [ ] **Step 2: Write the failing tests — the incremental door**

```ts
it('promotes the sole surviving contender when the winner is deleted', async () => {
    const stack = createRepositoryStack();
    await stack.vault.create('Renovation/Library/one.md', '---\ntype: renovation-asset\nid: tile-01\n---\n');
    await stack.vault.create('Renovation/Library/two.md', '---\ntype: renovation-asset\nid: tile-01\n---\n');
    await stack.rebuildIndex();
    const loser = stack.index.listExclusions()[0]?.path;
    const winner = stack.index.get('tile-01' as EntityId<string>)?.path;
    expect(loser).toBeDefined();

    await stack.vault.delete(stack.vault.file(winner!));
    await stack.adapter.processPath(winner!);

    // The loser is now the only claimant of that id, so it IS the asset.
    expect(stack.index.get('tile-01' as EntityId<string>)?.path).toBe(loser);
    expect(stack.index.listExclusions()).toEqual([]);
});

it('promotes one of two remaining contenders, rather than none', async () => {
    // Three notes share an id. Deleting the winner leaves TWO contenders — a
    // sole-survivor rule promotes neither and the id leaves the catalogue entirely,
    // which is a state the full rebuild can never produce.
    const stack = await stackWithDuplicates('tile-01', ['one.md', 'two.md', 'three.md']);
    const winner = stack.index.get('tile-01' as EntityId<string>)!.path;
    expect(stack.index.listExclusions()).toHaveLength(2);

    await stack.vault.delete(stack.vault.file(winner));
    await stack.adapter.processPath(winner);

    expect(stack.index.get('tile-01' as EntityId<string>)).toBeDefined();
    expect(stack.index.listExclusions()).toHaveLength(1);
});

it('promotes the contender a full rebuild would pick', async () => {
    // An incremental promotion and a rebuild must agree, or a reload silently
    // changes which note IS the asset.
    const stack = await stackWithDuplicates('tile-01', ['one.md', 'two.md', 'three.md']);
    const winner = stack.index.get('tile-01' as EntityId<string>)!.path;
    await stack.vault.delete(stack.vault.file(winner));
    await stack.adapter.processPath(winner);
    const promoted = stack.index.get('tile-01' as EntityId<string>)!.path;

    await stack.rebuildIndex();
    expect(stack.index.get('tile-01' as EntityId<string>)!.path).toBe(promoted);
});

it('demotes the displaced winner in the same step as the arrival takes its id', async () => {
    const stack = createRepositoryStack();
    await stack.vault.create('Renovation/Library/one.md', '---\ntype: renovation-asset\nid: tile-01\n---\n');
    await stack.rebuildIndex();

    await stack.vault.create('Renovation/Library/two.md', '---\ntype: renovation-asset\nid: tile-01\n---\n');
    await stack.adapter.processPath('Renovation/Library/two.md');

    expect(stack.index.get('tile-01' as EntityId<string>)?.path).toBe('Renovation/Library/two.md');
    // The displaced note is REPORTED, not silently gone from the surface.
    expect(stack.index.listExclusions()).toEqual([
        { path: 'Renovation/Library/one.md', entityType: 'renovation-asset', reason: 'duplicate-id' },
    ]);
});

it('announces an exclusion change through its own event', async () => {
    const stack = createRepositoryStack();
    const heard: ProjectIndexExclusionChangedPayload[] = [];
    // The discriminant is CAPITALISED — `DomainEvent<'ProjectIndexExclusionChanged'>` in
    // `projectIndex.events.ts`. `EventBus` keys subscriptions by exact string, so the
    // lowercase factory name this snippet first used subscribes to nothing: the handler
    // never runs, `heard` stays empty, and the case fails against a CORRECT implementation
    // while looking like a real assertion. Reported by a review bot against this plan.
    stack.events.subscribe('ProjectIndexExclusionChanged', (e) => { heard.push(e.payload); });
    await stack.vault.create('Renovation/Library/broken.md', '---\ntype: renovation-asset\n---\n');
    await stack.adapter.processPath('Renovation/Library/broken.md');
    expect(heard).toEqual([{ path: 'Renovation/Library/broken.md', entityType: 'renovation-asset' }]);
});
```

- [ ] **Step 3: Run them and watch every one fail**

Run: `npx vitest run tests/infrastructure/persistence/index/excludedNotes.test.ts`
Expected: FAIL — `listExclusions is not a function` on the first two, then assertion failures. Each must fail at its own assertion once the members exist; a case that fails at an import proves nothing.

- [ ] **Step 4: Implement, in this order**

The port first (`ExcludedNote`, `ExclusionReason`, the three members), then the index implementation, then `collectNotes`'s two exclusion arms, then the event, then `VaultChangeAdapter`.

**And the bridge from the scan to the index, which this step originally left out.** Pushing a descriptor into a scan-local array reaches nothing: `buildProjectIndexEntries` returned only entries and `RenovationPlannerPlugin.startPersistence` passed only that to `index.rebuild`, so the FULL SCAN's exclusions never arrived and the repair strip would have been empty on every fresh load — with the incremental door working perfectly and hiding it. So the scan returns `{ entries, exclusions }`, `rebuild` takes both, and `startPersistence` is part of this task rather than a later one. The exclusions are a REQUIRED second argument rather than a second method, because a rebuild that replaces one collection and not the other is a rebuild that leaves the strip describing the previous vault. Reported by a review bot against this plan. `collectNotes`'s duplicate arm reads the displaced entry BEFORE `entries.set` overwrites it:

```ts
// inside collectNotes, replacing the bare warnOnDuplicate call at line 100
const displaced = entries.get(ref.id);
warnOnDuplicate(input.logger, displaced, ref.id, file.path);
if (displaced !== undefined) {
	// Last-writer-wins is deliberate (changing it would make which note wins depend on
	// scan order). What is NOT deliberate is losing the displaced note's own type: the
	// map is keyed by id with no type in the key, so this descriptor takes `displaced.type`
	// and never `ref.type`.
	input.exclusions.push({ path: displaced.path, entityType: displaced.type, reason: 'duplicate-id' });
}
```

and the `no-id` arm gains its descriptor beside the warn it already logs, using Task 1's `ref.type`.

- [ ] **Step 5: Run the tests, then the whole index suite**

Run: `npx vitest run tests/infrastructure/persistence/index/`
Expected: PASS.

- [ ] **Step 6: Mutation-check the two rules a green suite would not notice**

Three mutations, each watched red at its own assertion, each restored:
- Replace `displaced.type` with `ref.type` — the cross-type case must go red.
- Delete the demotion push — the demotion case must go red.
- Narrow promotion to "exactly one contender remains" — the three-note case must go red. This is the mutation that matters most, because the two-note case passes against it.

Record in the report what each printed.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: the project index holds the notes it could not index, and announces them"
```

---

### Task 3: `AssetRepository.listAll()` reports the notes it skipped

**Spec:** §5.1a lines 893–920 — the port change the spec's own "nothing else in the application layer changes" sentence denied.

**Files:**
- Modify: `src/application/ports/AssetRepository.ts:26`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianAssetRepository.ts` (`list`)
- Modify: the in-memory `AssetRepository` used by `tests/helpers/`
- Modify: `src/application/queries/ListAssets.ts` — unchanged behaviour, new call shape
- Test: `tests/infrastructure/obsidian/repositories/assetRepositoryListing.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export interface SkippedAsset {
	readonly assetId: AssetId;
	/** The refusal's own code, so the surface can tell a future-schema note from a bad field. */
	readonly code: string;
	readonly path: string;
}
export interface AssetListing {
	readonly loaded: readonly Loaded<Asset>[];
	readonly skipped: readonly SkippedAsset[];
}
// listAll(): Promise<Result<AssetListing, RepositoryError>>;
```

**Why:** `ObsidianAssetRepository.list` skips a note it could not read, records it to the diagnostics ledger and continues. There is no count to return, so a catalogue whose every note is unreadable arrives as an empty list and draws *no assets yet* over a library full of them. The ids are already in hand at the point of the skip — this is a wider return, not new bookkeeping. The adapter's own docblock names the project repository's `refused` count as the precedent to copy and says the assign picker had no such distinction to draw; this surface is the first caller that does.

**`code` and `path` beyond the precedent:** §4's repair strip resolves guidance from the pair. A `MigrationError` means the note was written by a newer build and the remedy is to upgrade the plugin — `Open note` is the wrong advice there; a schema failure over an unknown category really is a frontmatter edit. And the path is what `Open note` needs.

- [ ] **Step 1: Write the failing test**

```ts
it('reports a note it could not read, with its id, its path and the refusal code', async () => {
    const stack = createRepositoryStack();
    await stack.vault.create('Renovation/Library/good.md', validAssetFrontmatter('tile-01'));
    await stack.vault.create('Renovation/Library/bad.md', '---\ntype: renovation-asset\nid: tile-02\nschema-version: 99\n---\n');
    await stack.rebuildIndex();

    const listed = await stack.assets.listAll();
    const listing = expectOk(listed);
    expect(listing.loaded.map((l) => l.entity.id)).toEqual(['tile-01']);
    expect(listing.skipped).toEqual([
        { assetId: 'tile-02', code: expect.stringContaining('schema'), path: 'Renovation/Library/bad.md' },
    ]);
});

it('answers an empty listing with no skips for an empty library', async () => {
    const stack = createRepositoryStack();
    await stack.rebuildIndex();
    expect(expectOk(await stack.assets.listAll())).toEqual({ loaded: [], skipped: [] });
});
```

The second case is what tells an all-unreadable library from an empty one — it is the contrast case, and without it the first passes against a build that reports every note as skipped.

- [ ] **Step 2: Run it and watch it fail at the assertion**

Run: `npx vitest run tests/infrastructure/obsidian/repositories/assetRepositoryListing.test.ts`

- [ ] **Step 3: Widen the port, both implementations, and `ListAssets`**

`ListAssets.execute` keeps answering `Result<Asset[], RepositoryError>` — it maps `listing.loaded` and drops `skipped`, which is correct for the assign picker and is the reason the two queries stay separate.

- [ ] **Step 4: Run the tests, then the suites that touch the asset repository**

Run: `npx vitest run tests/infrastructure tests/application/queries`
Expected: PASS. Every compile error the widening produces is a call site the compiler is naming; fix each rather than casting.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: the asset listing reports the notes it skipped"
```

---

### Task 4: A sidecar refusal names its file, and the clearance's extent is guarded

**Spec:** §3.5 lines 470–560 (the refusal table and "naming the sidecar"), and lines 424–436 (both extents through `dimensionsOf`).

**Files:**
- Modify: `src/application/ports/AssetGeometrySidecar.ts` — refusal carries `sidecarPath`
- Modify: `src/infrastructure/obsidian/repositories/AssetGeometryStore.ts` — populate it
- Modify: `src/application/queries/GetAssetDesign.ts` — clearance extent, `sidecarPath` passthrough
- Test: `tests/application/queries/getAssetDesign.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `AssetDesignDto` gains `clearanceExtent: Extent | null` and the refusal path rides on the error the query returns. Tasks 6 and 14 read both.

**Two independent defects, one task because they are one read:**

**The code is `dimensions-overflow`**, raised by `dimensionsOf` at `AssetShape.ts:115`. There is no `polygon-extent-overflow` — that was this plan's own invention, corrected before anyone implemented it. `polygon-area-overflow` is a different guard two steps earlier, in `core/geometry/operations.ts`, and a fixture that trips it never reaches this task's change.

1. **`sidecarPath` on the refusal.** §3.5's table says a damaged-sidecar message names the file. `BaseError.message` is developer English by slice 11's rule and has no structured path field, so `toUserMessage` cannot interpolate one. The path has to ride on the read model. It is **absent for `asset-geometry.unusable-id`**, and that is a fact rather than a gap: `pathFor` refuses that id before it derives any path, so there is no file to name — which is exactly why that row's action is `Open note` and not `Open designer`.
2. **The clearance's extent.** `GetAssetDesign` calls `dimensionsOf` for the footprint alone. `validateAssetShape` does not close the gap: `enclosesArea` tests `Number.isFinite` on the AREA, and a very long, very thin clearance has a finite shoelace sum and an infinite SPAN — coordinates from `-1e308` to `1e308` with a hair's height. Nothing then stops the inspector printing `Infinity mm` as a measurement. The footprint got that guard when `polygon-area-overflow` was written and the clearance beside it did not.

- [ ] **Step 1: Write the failing tests**

```ts
it('names the sidecar on a damaged-sidecar refusal', async () => {
    const stack = createRepositoryStack();
    await seedAsset(stack, 'tile-01');
    await stack.vault.create('Renovation/Library/Geometry/tile-01.rpgeo', 'not json at all');
    const refused = await new GetAssetDesign(stack.assets, stack.geometry).execute({ assetId: 'tile-01' as AssetId });
    const error = expectErr(refused);
    expect(error.sidecarPath).toBe('Renovation/Library/Geometry/tile-01.rpgeo');
});

it('carries no sidecar path for an id that cannot name a file', async () => {
    // `pathFor` refuses before deriving, so there is no file to name — and that absence is
    // what makes this row's action `Open note` rather than `Open designer`.
    const refused = await getDesignFor('has/slash');
    expect(expectErr(refused).sidecarPath).toBeUndefined();
});

it('refuses a clearance whose span overflows rather than reporting Infinity', async () => {
    // The fixture is the thin NEEDLE the existing footprint case already uses
    // (getAssetDesign.test.ts, 'refuses a footprint whose extent is not representable'),
    // copied deliberately rather than invented: an axis-aligned rectangle spanning
    // -1e308 to 1e308 has a shoelace sum of Infinity, so `enclosesArea` refuses it as
    // `polygon-area-overflow` inside `validateAssetShape` and the read never reaches
    // `dimensionsOf` at all — the test would pass while exercising a different guard.
    // A 1e-300 height keeps the AREA finite and leaves the SPAN infinite, which is the
    // only arrangement that reaches the code under test.
    const shape = shapeWithClearance([
        { x: 0, y: 1e-300 }, { x: 1e308, y: 0 }, { x: -1e308, y: 0 },
    ]);
    const answered = await getDesignForShape(shape);
    expect(expectErr(answered).code).toBe('dimensions-overflow');
});

it('derives the clearance extent beside the footprint on an ordinary shape', async () => {
    const answered = await getDesignForShape(shapeWithClearance(rectangle(1400, 400)));
    expect(expectOk(answered).clearanceExtent).toEqual({ width: 1400, depth: 400 });
});
```

- [ ] **Step 2: Run them and watch all four fail at their assertions**

Run: `npx vitest run tests/application/queries/getAssetDesign.test.ts`

- [ ] **Step 3: Implement**

The clearance's extent goes through the SAME guarded `dimensionsOf` call the footprint takes, and a failure routes as the `GeometryError` it is rather than reaching the row. Do not add a second derivation.

- [ ] **Step 4: Run the tests and the designer's own suite**

Run: `npx vitest run tests/application tests/presentation/designer`
Expected: PASS — the designer reads this same DTO, so a break there is this change reaching further than intended.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: a sidecar refusal names its file and the clearance extent is guarded"
```

---

### Task 5: `ListCatalogueEntries`

**Spec:** §5.1 lines 839–892 for the DTO (verbatim — do not retype it from memory), §5.1a for where `unreadable`'s three sources come from, §4 lines 806–826 for the index-scan gate.

**Files:**
- Create: `src/application/queries/ListCatalogueEntries.ts`
- Test: `tests/application/queries/listCatalogueEntries.test.ts`

**Interfaces:**
- Consumes: Task 2's `index.listExclusions()`, Task 3's `AssetListing`.
- Produces: exactly the block in spec §5.1 lines 849–866. `category` is a `string`, never `AssetCategory`; `unreadable` is a list, never a count; `notes` and the whole `background` reference are present.

**Three sources feed `unreadable`, and each was found one at a time:**

| Source | Where it comes from | `assetId` | `code` |
| --- | --- | --- | --- |
| `read-failed` | Task 3's `AssetListing.skipped` | the id | the refusal's own code |
| `no-id` | Task 2's exclusions, `reason: 'no-id'`, filtered to `renovation-asset` | `null` | `null` |
| `duplicate-id` | Task 2's exclusions, `reason: 'duplicate-id'`, same filter | `null` | `null` |

`code` is `null` for the last two because both are decided by the index scan, which raises no `AppError` — the note is excluded, not refused. A row whose `code` is null takes its guidance from `reason` alone.

**At most one entry in `unreadable` carries any given id.** A duplicate-id loser carries `assetId: null` by construction — it is unreachable by id, which is what losing means — so an id-keyed lookup cannot find two descriptors. That is the property a selection resolves against.

**The filter is `entityType === 'renovation-asset'`.** `ENTITY_TYPES` declares the persisted discriminators and `EntityType` derives from that array; `'asset'` is not a member of the union at all, and a filter written to the short spelling matches nothing silently.

- [ ] **Step 1: Write the failing tests**

One per source, one merging all three, one asserting an empty library answers `{ entries: [], unreadable: [] }`, and one asserting a project note with no id does NOT appear:

```ts
it('leaves a project note with no id out of the asset catalogue', async () => {
    // The index is one global namespace; without the type filter this note would inflate
    // the library's unreadable count and appear in its repair strip.
    const stack = await stackWith({ 'a/Project.md': '---\ntype: renovation-project\n---\n' });
    expect(expectOk(await listCatalogue(stack)).unreadable).toEqual([]);
});
```

- [ ] **Step 2: Run them and watch each fail at its assertion**

- [ ] **Step 3: Implement the query**

- [ ] **Step 4: Mutation-check the filter**

Change `'renovation-asset'` to `'asset'` and run the suite: the two exclusion cases must go red. This is the check that the spelling is load-bearing rather than decorative. Restore, and record that you watched it.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: ListCatalogueEntries reads the catalogue and the notes it could not"
```

---

### Task 6: `ListAssetOutlines` — the batched mark read that settles per entry

**Spec:** §5.3 lines 1062–1136, and §3.4 lines 293–392 for the five states the answer has to distinguish.

**Files:**
- Create: `src/application/queries/ListAssetOutlines.ts`
- Test: `tests/application/queries/listAssetOutlines.test.ts`

**Interfaces:**
- Consumes: `AssetGeometrySidecar` (Task 4's widened refusal).
- Produces:

```ts
export type AssetOutline =
	| { readonly kind: 'measured'; readonly points: readonly Point[]; readonly extent: Extent }
	| { readonly kind: 'unscaled'; readonly points: readonly Point[]; readonly extent: Extent }
	| { readonly kind: 'none' }
	| { readonly kind: 'refused'; readonly code: string; readonly sidecarPath: string | undefined };
// execute(input: { assetIds: readonly AssetId[] }): Promise<ReadonlyMap<AssetId, AssetOutline>>
```

**It answers a MAP, not a `Result`.** The batch settles per entry, never as a whole. One damaged sidecar must not fail the shelf it is in, and it must not leave the other rows loading either. Both alternatives are reachable and both are wrong: a `Result` over the whole batch poisons a shelf for one bad file, and dropping the failed entry silently degrades it into *no shape yet*, which is the false absence §3.4's fifth state exists to refuse.

**Path resolution is the store's, and the store's is index-first.** `AssetGeometryStore.pathFor` is `usableAsFilename` check, then `index.getGeometrySidecarPath(assetId) ?? assetSidecarPathFor(libraryFolder, assetId)` — measured at `AssetGeometryStore.ts:283`. A batch that derives for itself reintroduces exactly what that method's docblock records: a `.rpgeo` moved in the file explorer, or arriving elsewhere through sync, leaves the asset reading as shapeless, and the next design write mints a second sidecar beside the orphan. **This query reads through the sidecar port and never derives a path itself.**

**`unscaled` is a distinct answer, not a flag on `measured`.** The proportions are real and the scale is not, which is what §3.4's dashed stroke says. It comes from the shape's `footprintPending`.

- [ ] **Step 1: Write the failing tests**

```ts
it('settles one damaged sidecar without disturbing the three beside it', async () => {
    const stack = await stackWithAssets(['a', 'b', 'broken', 'd']);
    await damageSidecar(stack, 'broken');
    const answered = await new ListAssetOutlines(stack.geometry).execute({
        assetIds: ['a', 'b', 'broken', 'd'] as AssetId[],
    });
    expect(answered.get('broken' as AssetId)?.kind).toBe('refused');
    expect(answered.get('a' as AssetId)?.kind).toBe('measured');
    expect(answered.get('d' as AssetId)?.kind).toBe('measured');
    expect(answered.size).toBe(4);   // never dropped, which is the false-absence rule
});

it('answers none for an asset with no sidecar, which is the ordinary state', async () => { /* ... */ });
it('answers unscaled for a footprint traced before a scale existed', async () => { /* ... */ });
it('carries the sidecar path on a refusal so the inspector can name the file', async () => { /* ... */ });
```

- [ ] **Step 2: Run them and watch each fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Mutation-check the per-entry rule**

Make the query return early on the first refusal and run the four-asset case: it must go red at `answered.size`. Then make it drop the failed entry instead: it must go red at the `refused` assertion. Both mutations, both watched, both restored.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: ListAssetOutlines reads footprints in batches that settle per asset"
```

---

### Task 7: `createAssetLibraryChangeSource`

**Spec:** §5.4 lines 1138–1222 in full — it is the contract, written so a builder does not invent one.

**Files:**
- Create: `src/application/events/assetLibraryChangeSource.ts`
- Test: `tests/application/events/assetLibraryChangeSource.test.ts`

**Interfaces:**
- Consumes: Task 2's `ProjectIndexExclusionChanged`.
- Produces:

```ts
export interface AssetLibraryChange {
	/** Re-read the whole catalogue listing. */
	readonly catalogue: boolean;
	/** Drop the cached mark for these ids; the viewport decides when they are re-read. */
	readonly marks: readonly AssetId[];
	/** Ids whose DESIGN read is stale — geometry, height or background moved. Bumps the
	 *  design generation ALONE, never the referencing one. */
	readonly design: readonly AssetId[];
	/** Ids whose ENTRY was removed or replaced. Bumps BOTH selection generations, so a
	 *  pre-deletion design or usage answer cannot populate a same-id replacement. */
	readonly replaced: readonly AssetId[];
}
export function createAssetLibraryChangeSource(
	events: EventBus,
): (listener: (change: AssetLibraryChange) => void) => () => void;
```

**A fourth source, not a widening — ruling §11.7.** The assign picker shares `createAssetCatalogueChangeSource` and would pay for any widening of it: re-reading every asset note on a design event it has no use for. The cheap edit is the one with a cost on a surface this plan does not own.

**The subscriptions, each with the reason it is not covered by its neighbour:**

| Event | Filter | Does |
| --- | --- | --- |
| Event | Filter | `catalogue` | `marks` | `design` | `replaced` |
| --- | --- | --- | --- | --- | --- |
| `AssetCreated`, `AssetUpdated` | none | ✓ | — | — | — |
| `AssetDeleted` | none | ✓ | the id | — | **the id** |
| `AssetDesignChanged` | none | ✓ | the id | **the id** | — |
| `GeometrySidecarChanged` | `entityType === 'renovation-asset'` | — | the id | the id | — |
| `ProjectIndexEntryChanged` | `entityType === 'renovation-asset'` | ✓ | the id | — | **the id** |
| `ProjectIndexRebuilt` | none | ✓ | — | — | — |
| `ProjectIndexExclusionChanged` | `entityType === 'renovation-asset'` | ✓ | — | — | — |

**`design` and `replaced` are separate sets because Task 10 asks two different things of them**, and a payload carrying only `catalogue` and `marks` cannot answer either. §5.5's rule is that *the unit of invalidation is the read and the unit of restart is the gesture*: a design edit invalidates the DESIGN read alone, while a removal or a replacement restarts BOTH selection reads. Collapsed into one signal, a consumer has exactly two options and both are defects the spec names — re-run the vault-wide `ListRequirementsReferencing` on every designer edit, which is the O(every requirement in the vault) cost §5.2 exists to avoid, or leave a pre-deletion design and usage answer eligible to populate a same-id replacement, which is the staleness §5.5's *"the ticket must follow the ENTRY, not only the id"* exists to prevent. Reported by a review bot against this plan; **the preflight scan's row for `7 → 10` read "Clean" and was not**, which is this plan's own instance of the defect §12 records — a claim about a neighbour section, made without holding the two together.

`AssetCreated` and `AssetUpdated` carry no `marks`: neither touches geometry. `GeometrySidecarChanged` carries no `catalogue`: a sidecar is not in the note.

**Three of the five are FILTERED, and the first version of this paragraph got the split wrong.** It said "unfiltered on the two design events and filtered on the two index events", justifying the first half with *"a design event names one asset and is always about geometry this surface draws"*. That is true of `AssetDesignChanged`, whose payload carries an `assetId` — and false of `GeometrySidecarChanged`, which a PLAN's `.rpgeo` raises too: `VaultChangeAdapter` publishes `geometrySidecarChanged({ entityId: entry.id, entityType: entry.type })` for whatever entry the sidecar belongs to. Unfiltered, a plan sidecar edited by hand or arriving through sync would have this surface invalidate the mark and the design read of an asset whose id happens to equal that plan's.

`createAssetDesignChangeSource` already filters that exact event on `entityType === 'renovation-asset'` — the shared-event problem is solved three files away and the plan proposed to re-open it. **Copy the filter rather than restating the reason.** Reported by a review bot against this plan; an index event has the same hazard for the same reason, which is why a burst of synced zone notes must not clear every mark on screen.

**`AssetDesignChanged` refreshing the catalogue is the arm that is easy to miss**, because the event's name says *design*. Two of the five design commands write the note — `SetAssetHeight` writes `height`, which the Definition section draws, and `SetAssetBackground` writes the keys behind the Spec sheet row. Both are `CatalogueEntryDto` fields, both publish this event and nothing else, and `VaultChangeAdapter` checks the echo window before announcing so no compensating vault signal arrives. Without this arm a peer leaf's height edit leaves the number stale for the life of the view.

- [ ] **Step 1: Write one failing test per row of that table, plus two negatives**

```ts
it('ignores a PLAN sidecar, which raises the same event a asset sidecar does', async () => {
    const heard = collect(source);
    await events.publish(geometrySidecarChanged({ entityId: 'plan-01', entityType: 'renovation-plan' }));
    expect(heard).toEqual([]);
});

it('ignores a zone note arriving through the index', async () => {
    const heard = collect(source);
    await events.publish(projectIndexEntryChanged({ entityType: 'renovation-zone', entityId: 'zone-1' }));
    expect(heard).toEqual([]);
});

it('refreshes the catalogue on a design change, not only the mark', async () => {
    const heard = collect(source);
    await events.publish(assetDesignChanged({ assetId: 'tile-01' }));
    expect(heard).toEqual([{ catalogue: true, marks: ['tile-01'], design: ['tile-01'], replaced: [] }]);
});

it('invalidates the design read on a design change, and never the usage read', async () => {
    // The vault-wide referencing scan must not re-run for a footprint edit.
    const heard = collect(source);
    await events.publish(assetDesignChanged({ assetId: 'tile-01' }));
    expect(heard[0]!.replaced).toEqual([]);
});

it('restarts BOTH selection reads when an entry is removed or replaced', async () => {
    const heard = collect(source);
    await events.publish(assetDeleted({ assetId: 'tile-01' }));
    expect(heard[0]!.replaced).toEqual(['tile-01']);
});
```

**`publish` is asynchronous and every one of these cases MUST await it.** `EventBus.publish` returns `Promise<void>` and is Promise-aware — its own docblock records "one microtask hop per delivery even for a synchronous handler — deliberate". A case that asserts immediately after an unawaited `publish` reads `heard` before any subscriber has run: the POSITIVE cases stay red against a correct implementation, and — the part that matters — **the NEGATIVE cases pass vacuously**, so the mutations prescribed below cannot discriminate at all. The first version of these snippets did exactly that. Reported by a review bot against this plan.

- [ ] **Step 2: Run them and watch each fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Mutation-check the two arms a green suite would not notice**

- Drop `catalogue: true` from the `AssetDesignChanged` arm — the design case must go red.
- Remove the `renovation-asset` filter from `ProjectIndexEntryChanged` — the zone negative must go red.
- Remove the `renovation-asset` filter from `GeometrySidecarChanged` — the plan-sidecar negative must go red. Without that case the shared event reads as asset-only, which is what the first version of this plan assumed.
- Move `AssetDesignChanged`'s id from `design` into `replaced` — the case asserting a design edit does NOT restart the referencing read must go red. Without that case the two sets are indistinguishable and the payload is back to the collapsed one this task was corrected for.

All three watched, all three restored.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: the asset library has its own change source"
```

---

### Task 8: The whole copy inventory, and both empty states

**Spec:** §8 lines 1435–1523 — the key list is exhaustive for visible copy and is reproduced there. Copy it key by key; do not invent, rename or omit one.

**Files:**
- Modify: `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`
- Modify: `src/presentation/emptyStates/content.ts`, `src/presentation/emptyStates/selectors.ts`
- Test: `tests/presentation/i18n/strings.test.ts` (existing, will exercise the new keys), `tests/presentation/emptyStates/content.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: every `StringKey` under `view.asset-library.*` and `empty.asset-library.*`, plus `command.open-asset-library`. `EMPTY_STATE_CONTENT.assetLibrary` with `noAssets` and `noMatches`, and `selectAssetLibraryEmptyState(entries, unreadable, searching): 'noAssets' | 'noMatches' | null` — a registry KEY, like every sibling selector in `src/presentation/emptyStates/selectors.ts`, never a `StringKey`.

**This task lands the whole inventory before any component exists**, deliberately. A key list assembled a string at a time as each component needs one is how the German reader gets hard-coded English in exactly the places they look first — which is the defect §8 records being reported against its own first version.

**Both empty states carry an action, and they differ in kind:** `noAssets`'s action creates something (`New asset`); `noMatches`'s action **restores the previous view** by clearing the search field. An action that creates something from a no-matches state is the wrong gesture.

**The selector is pure and takes all THREE inputs.** "Is the user searching" is not derivable from an entry list — an empty list with a query is `noMatches` and an empty list without one is `noAssets`, and those want opposite copy and opposite actions.

**And `unreadable` guards both states, unconditionally, as the FIRST statement — exactly as all three siblings in that file do.** An empty `entries` with a non-empty `unreadable` is a library whose notes could not be READ, not one with "no assets at all" (§4's row says that literally), while §4's *Some unreadable* row requires the shelves to still draw. Without the guard this selector invites the user to create their first asset over a catalogue full of damaged notes — the duplicate-inviting state this feature exists to prevent. The guard is unconditional rather than narrowed to `noAssets`: a selector carrying two different unreadable policies would need a paragraph to defend, and the no-matches feedback is not lost, since Task 13's status region announces the match count independently.

**German:** `strings.test.ts` requires `de.ts` to translate every key `en.ts` declares AND to name the same interpolation holes. It also pins two terms — no `Material` where the UI says `Objekt`, and `Vault` kept untranslated. Spelling and every other term are unread by any gate, so read the German you write.

- [ ] **Step 1: Write the failing selector test**

```ts
it('answers noAssets for an empty library and noMatches for an empty search', () => {
    expect(selectAssetLibraryEmptyState([], 0, false)).toBe('noAssets');
    expect(selectAssetLibraryEmptyState([], 0, true)).toBe('noMatches');
    expect(selectAssetLibraryEmptyState([anEntry()], 0, true)).toBeNull();
});

it('draws no empty state at all while any asset note is unreadable', () => {
    // The shelves region draws empty beside the notice strip. Both arms, because a guard
    // written for the arm somebody was thinking about is this repository's oldest defect.
    expect(selectAssetLibraryEmptyState([], 1, false)).toBeNull();
    expect(selectAssetLibraryEmptyState([], 1, true)).toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Add every key from spec §8 to `en.ts`, then translate every one in `de.ts`**

- [ ] **Step 4: Add the `assetLibrary` empty-state section and the selector**

- [ ] **Step 5: Run the i18n and empty-state suites**

Run: `npx vitest run tests/presentation/i18n tests/presentation/emptyStates`
Expected: PASS. A missing German key fails here; that is the gate working.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: the asset library's copy, in both locales, and its two empty states"
```

---

### Task 9: The read-model bundle, the guards, and the composition root

**Spec:** §2's table (the deps factory spelled once), §4's *Failed, unrecoverable* row.

**Files:**
- Create: `src/presentation/read-models/assetLibraryQueries.ts`
- Modify: `src/plugin/guardedServices.ts` — guard `ListCatalogueEntries` and `ListAssetOutlines`
- Modify: `src/application/queries/ListRequirementsReferencing.ts` and its composition — **give `ProjectFolderLookup` the note path as a SECOND-LEVEL discriminator** (see the correction below; the first draft of this line said "widen to the NOTE path" and was wrong)
- Test: `tests/application/queries/listRequirementsReferencing.test.ts` — two same-named projects in ONE folder
- Modify: `src/plugin/composition-root.ts` — `assetLibraryDeps(...)`
- Test: `tests/presentation/read-models/assetLibraryQueries.test.ts`, `tests/plugin/guardCategory.test.ts` (existing — it walks what the root hands out)

**Interfaces:**
- Consumes: Tasks 5, 6, 7.
- Produces:

```ts
export interface AssetLibraryQueryServices {
	listCatalogue(): Promise<Result<CatalogueListing, RepositoryError>>;
	listOutlines(assetIds: readonly AssetId[]): Promise<ReadonlyMap<AssetId, AssetOutline>>;
	getDesign(assetId: AssetId): Promise<Result<AssetDesignDto, AssetDesignError>>;
	listReferencing(assetId: AssetId): Promise<Result<readonly ReferencingGroup[], RepositoryError>>;
	/** Which projects hold a price override for this asset — §11.6, settled after main
	 *  brought §89's override into existence. Marks the Used in rows the price edit
	 *  will NOT reach. */
	listOverridingProjects(assetId: AssetId): Promise<Result<readonly ProjectId[], RepositoryError>>;
}
export function unavailableAssetLibraryQueries(): AssetLibraryQueryServices;
export function createAssetLibraryQueries(...): AssetLibraryQueryServices;

export interface AssetLibraryCommandServices {
	updateAsset: Command<UpdateAssetInput, Result<Asset, UpdateAssetErrors>>;
	setAssetHeight: GuardedDesignCommand<SetAssetHeightInput>;
	deleteAsset: Command<DeleteAssetInput, Result<ResolvedSequence, DeleteAssetErrors>>;
}

export interface AssetLibraryDeps {
	queries: AssetLibraryQueryServices;
	commands: AssetLibraryCommandServices;
	logger: Logger;
	onLibraryChanged: (listener: (change: AssetLibraryChange) => void) => () => void;
	indexScanCompleted: () => boolean;
	openNote: (path: string) => Promise<ProjectNoteOpenOutcome>;
	openDesigner: (assetId: AssetId) => Promise<void>;
	vault: BackgroundVault;
}
```

**The `ProjectFolderLookup` widening is part of THIS task, with files and a test — not a sentence in the self-review.** The self-review said it was "folded into Task 9" and Task 9's file list did not name `ListRequirementsReferencing.ts`, so an implementer following the checklist would leave the folder-only collaborator intact and two same-named projects in ONE folder would still draw indistinguishable *Used in* rows. That is the case §3.5 needs `projectPath` for, and it is the case a folder lookup cannot answer: `projectFolderOf` is `parentOf(path)`, so both projects share a folder and differ only in filename. Test it with two projects that share BOTH a display name and a directory. A declared fold with no files behind it is a fold that did not happen. Reported by a review bot.

**CORRECTION, and this brief was the thing that was wrong.** "Widen the lookup to the note path" reads as *always show the note path*, and that kills `view.asset-library.used-in.vault-root` — copy Task 8 has already shipped and §8 states in the present tense. §3.5 states a TWO-LEVEL rule verbatim: the project's folder is the discriminator, and the note's own path is the discriminator only *where the folder does not separate two rows*; `''` stays a supplied answer that renders the root label rather than an absence. Build the two-level rule, and mutation-check BOTH directions — the same-name-same-folder pair must yield two distinguishable rows, and a vault-root project must still render its root label. Task 9's implementer overruled this brief in the spec's favour and was upheld on review; this paragraph is corrected rather than deleted, because a brief that quietly stops being wrong teaches the next reader nothing.

**`refuseUnrecovered` reuses the exact code string `settings.unrecovered`** — several call sites branch on it, and `viewHydrationOrigin` decides "no retry" from it. A new code here would silently give the bootstrap failure a retry button that cannot work.

**`unavailableAssetLibraryQueries` is TOTAL.** `root.persistence` is `null` exactly when settings could not be read, and every member must refuse rather than any member being nullable.

**`listOutlines` refuses differently from its siblings**, and that is not an oversight: it answers a map rather than a `Result`, so its unavailable form answers a map of `refused` entries, one per requested id. A `Promise.resolve(new Map())` would degrade every row into *no shape yet*, which is the false absence again.

- [ ] **Step 1: Write the failing test**

```ts
it('refuses every door when settings are unrecovered, including the outline map', async () => {
    const queries = unavailableAssetLibraryQueries();
    expect(expectErr(await queries.listCatalogue()).code).toBe('settings.unrecovered');
    const outlines = await queries.listOutlines(['a', 'b'] as AssetId[]);
    expect([...outlines.values()].map((o) => o.kind)).toEqual(['refused', 'refused']);
});
```

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Implement the bundle, the two guards and `assetLibraryDeps`**

Each guard call is a local `const` first (never assigned straight into a typed field — the inference reason is in `guardedServices.ts`'s header), typed structurally as `Query<...>`, wrapped with the shared `VAULT_EXCEPTION_MAPPER`.

- [ ] **Step 4: Run the guard category walk**

Run: `npx vitest run tests/plugin/guardCategory.test.ts tests/presentation/read-models`
Expected: PASS. That walk detonates every door the root hands out and requires the mapped `vault.unexpected-failure` back; a new unguarded door fails there.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: the asset library's query bundle, guarded and composed"
```

---

### Task 10: The stores, and every ticket in them

**Spec:** §5.5 lines 1224–1310 in full. It is a rule over a category, not a list of reads — implement it that way.

**Files:**
- Create: `src/presentation/stores/AssetLibraryStore.ts`, `src/presentation/stores/AssetSelectionStore.ts`, `src/presentation/library/viewportMarks.ts`
- Test: `tests/presentation/stores/assetLibraryStore.test.ts`, `assetSelectionStore.test.ts`

**Interfaces:**
- Consumes: Task 9's `AssetLibraryQueryServices`, Task 7's `AssetLibraryChange`.
- Produces: `useAssetLibraryStore()` (`entries`, `unreadable`, `status`, `error`, `hydrate`, `invalidateMarks`, `markFor`, `requestMarks`, `reset`) and `useAssetSelectionStore()` (`selectedId`, `design`, `designStatus`, `usedIn`, `usedInStatus`, `select`, `refreshDesign`, `refreshUsedIn`).

**Three ticket seams, and what makes two requests the same request differs at each:**

1. **The catalogue listing** — one counter on the store, latest wins, exactly `RenovationProjectStore.hydrate`'s `latestHydration`. It is refreshed by events rather than by a gesture, so two arriving close together is the ordinary case.
2. **Selection reads** — one generation **per read kind**, not per read start and not per selection cycle. A selection CHANGE bumps both `getDesign` and `listReferencing` together; a §5.4 refresh bumps only the read it invalidates. Per read start causes a permanent loading state (the second read invalidates the first and nobody delivers to the first's ticket); per selection cycle over-restarts, re-running the vault-wide referencing scan for a geometry-only edit. **The unit of invalidation is the read; the unit of restart is the gesture.**
3. **Mark reads** — a generation **per asset**, bumped by invalidation, so a late answer cannot overwrite a fresh cache. A dropped generation drops its failures too.

**A result whose ticket is no longer current is dropped — successes AND failures alike.** A failure delivered against a stale ticket paints an error over a selection the user has left.

**The index-scan gate.** `hydrate` holds `status` at `'loading'` while `indexScanCompleted()` is false, and re-reads on the catalogue change the rebuild raises. The question is whether the scan **ran**, never whether it **found** anything — asking "is the index populated" hangs a restored pane for ever in a vault whose last asset note was deleted while Obsidian was closed. Without this, `listAll()` answers a legitimate `ok([])` before the rebuild and the view draws *no assets yet* over a full catalogue, with a `New asset` button under it.

**`AssetDeleted` and the selected asset's own `ProjectIndexEntryChanged` bump BOTH selection generations immediately**, and an applied listing that removes or replaces the selected entry bumps them again. The ticket follows the ENTRY, not only the id: a delete-and-recreate under the same id leaves both listings identical, so the event is load-bearing and the listing diff is the backstop, not the other way round.

- [ ] **Step 1: Write the failing tests**

```ts
it('holds loading until the index scan has run, whatever the read answers', async () => {
    let scanned = false;
    const store = useAssetLibraryStore();
    await store.hydrate(queriesAnswering({ entries: [], unreadable: [] }), () => scanned);
    expect(store.status).toBe('loading');       // never 'ready' with an empty list
    expect(store.emptyStateKey).toBeNull();     // and never the no-assets invitation
    scanned = true;
    await store.hydrate(queriesAnswering({ entries: [], unreadable: [] }), () => scanned);
    expect(store.status).toBe('ready');
});

it('drops a slower earlier listing, and drops its failures too', async () => { /* ... */ });

it('bumps only the invalidated read on a geometry refresh, and both on a selection change', async () => {
    // A geometry-only edit must not re-run the vault-wide referencing scan.
});

it('drops a late mark answer for an asset whose mark was invalidated meanwhile', async () => { /* ... */ });
```

The first case's second assertion is the one that matters: a build that reaches `'ready'` with an empty list and no scan draws the exact duplicate-inviting empty state this feature exists to prevent.

- [ ] **Step 2: Run them and watch each fail at its assertion**

- [ ] **Step 3: Implement both stores and the viewport request queue**

`viewportMarks.ts` owns rule 3 of §5.3: a mark is requested when its row enters the viewport, in batches; a row never waits; nothing in flight is cancelled when a row leaves, and nothing further is requested for it. Invalidation drops the cached value and the viewport decides when it is re-read — a row on screen re-requests immediately, a row that is not re-requests when it next enters the viewport and never before.

- [ ] **Step 4: Mutation-check the scan gate and the per-read generations**

Remove the `indexScanCompleted` guard: the first case must go red at `status`.

**Collapse the selection generations into one — and note what that mutation does NOT redden, because this brief predicted the wrong case.** It said "the geometry-refresh case must go red". It cannot: collapsing changes which ANSWERS ARE DROPPED, not which DOORS ARE CALLED, so a call-count-shaped geometry case passes against the collapse and pins nothing. Driven by Task 10's implementer, confirmed by its reviewer, and corrected here rather than quietly — the case that DOES redden is §5.5's own: a `design` refresh must not strand an in-flight *Used in* read, which fails at `expected 'loading' to be 'ready'`. Write that one; keep a call-count case beside it if you like, but know it pins a different half.

**There are THREE selection read kinds, not two** — `design`, `referencing` and `overriding` — settled by ruling after Task 10's review. `listReferencing` and `listOverridingProjects` are separate reads with separate generations: a selection change and `replaced` bump all three, `design` bumps only the design one, and **`usage` bumps only `overriding`**. Joining the two `usedIn` doors under one ticket re-runs the vault-wide referencing scan for a price change and flips *Used in* to `loading` — §5.5's own named `Delete`-flap arriving on a price trigger, and the thing the `usage` channel exists to prevent. Mutate `usage` to bump both and watch the referencing read restart.

All mutations watched, all restored.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: the asset library's stores, and a ticket on every read"
```

---

### Task 11: The view, its registration, its rebind, and the two in-app doors

**Spec:** §2 lines 88–144 (the placement table and both doors), §6.3 lines 1378–1408 (view state and the history rule).

**Files:**
- Create: `src/presentation/library/AssetLibraryView.ts`, `AssetLibraryContext.ts`, and a minimal `AssetLibraryRoot.vue` (Tasks 12–14 fill it)
- **Do NOT declare `AssetLibraryDeps`** — Task 9 already shipped it at `src/presentation/library/AssetLibraryDeps.ts`. Import it. This plan originally had Task 11 create it inside `AssetLibraryContext.ts`; that would half-write a second home for one type, and Task 9's review upheld the shipped placement. The sibling convention (`RenovationProjectContext.ts`, `AssetDesignerContext.ts`) does put deps in the context file, so if a later reader wonders: the deviation is known, deliberate and reviewed.
- Modify: `src/plugin/RenovationPlannerPlugin.ts`
- Modify: `src/presentation/views/ViewRoot.vue` (the no-projects aside) and `ProjectList.vue` (the header)
- Modify: `tests/build/registration-locality.test.ts` if the command lands in its own module
- Create: `tests/helpers/makeAssetLibraryView.ts`
- Test: `tests/presentation/library/assetLibraryView.test.ts`, `tests/plugin/registration.test.ts`

**Interfaces:**
- Consumes: Tasks 9 and 10.
- Produces: `ASSET_LIBRARY_VIEW = 'renovation-asset-library'`, `ASSET_LIBRARY_ICON`, `class AssetLibraryView extends ItemView` with `rebind(deps: AssetLibraryDeps): void`, and `ASSET_LIBRARY_CONTEXT`/`useAssetLibraryContext()`.

**No second ribbon icon.** The ribbon is shared real estate across every installed plugin and this surface is reached often but not constantly. A command plus two in-app doors is the whole of it. (The codebase survey suggested copying `openProject`'s ribbon+command pair; the spec refuses the ribbon half, and the spec is the authority.)

**The command is a plain callback, never a `checkCallback`.** `open-plan-editor` already paid for that lesson: a command gated on the active note is a command absent from the palette in every vault that has none of the thing.

**Two doors, because `ProjectList` is not always mounted.** `ViewRoot` draws the project empty state instead of the list when a vault has no projects — so a door placed only in that header disappears in exactly the state where a user has fewest other routes. And the catalogue is vault-wide: a vault with no projects can hold a full library, which is why the aside beside that empty state already offers `New asset`. The **Assets** control joins it there as a SIBLING of the empty state, never a second action on it — `EMPTY_STATE_CONTENT` carries one action per entry and this is an unrelated affordance.

**The deps factory is spelled ONCE** and used by both the `registerView` factory and `rebindOpenViews`, so a rebind cannot hand the view something its factory would not have built.

**The fourth `rebindOpenViews` loop is the point of this task, not a footnote.** A registered view that is not rebound holds the retired composition root for as long as it stays open — attached to the previous root's index, repositories and event bus, with nothing failing anywhere. This surface is where that matters most: §83's library-folder migration MOVES every catalogue note and then swaps the root, so an un-rebound library goes on resolving asset notes at the folder they have just left. Every other view would show stale data; this one shows an empty or wrong library immediately after the single gesture most likely to be performed from it. The loop body **annotates** the narrowed view (`const view: AssetLibraryView = leaf.view;`) rather than calling through the `instanceof` narrowing, because fallow resolves a class member through an explicit type and reports a `rebind` reached only by property access as an unused class member.

**View state carries `assetId` and the expanded set, and neither is a navigation.** `projectIdFrom`'s three-way parse is the shape to copy for `assetId`: a non-object refuses, a non-string refuses, and `''` is ACCEPTED and means nothing selected. A validator that refuses `''` discards exactly the value a restore needs.

> `AssetLibraryView.setState` leaves `result.history` false for every change to `assetId` and to the expanded set.

Stated as an obligation on the view because there is no `history: false` field on `setViewState` — Obsidian passes a `ViewStateResult` into `setState` and the view writes `result.history` itself. `RenovationProjectView.setState` sets it true on an accepted, changed `projectId`; a build that copied that shape would put a history entry behind every row the user clicks. **Write the difference where the code is**: one plugin now has two answers to "what does a view do when its own state changes", and a reader who finds only one of them will assume it is the rule.

**Selection does not remount the Vue tree.** `RenovationProjectView` remounts per navigation because a navigation replaces the whole subject and a remount makes staleness unrepresentable. Here a selection changes an adjacent panel, and remounting per row click throws away the shelves' scroll position — the thing the user is browsing. The tree updates in place, which is why Task 14 keys the inspector's fields region by `assetId`.

**Mount directly onto `contentEl`, with no wrapper div** — a `contentEl.createDiv(...)` host has `height: auto` and collapses the pane to a sliver. jsdom cannot see it; only the browser harness catches it. And name the field `vueApp`, never `app`: `View.app` is Obsidian's own member.

- [ ] **Step 1: Write the failing tests**

```ts
it('accepts an empty assetId as the unselected state and refuses a non-string', async () => {
    const { view } = makeAssetLibraryView();
    const result = {} as ViewStateResult;
    await view.setState({ assetId: '' }, result);
    expect(view.getState()).toEqual({ assetId: '', expanded: [] });
    await view.setState({ assetId: 42 }, result);
    expect(view.getState().assetId).toBe('');
});

it('never records a selection or an expansion as a navigation', async () => {
    const { view } = makeAssetLibraryView();
    const result = {} as ViewStateResult;
    await view.setState({ assetId: 'tile-01', expanded: ['material'] }, result);
    expect(result.history).toBeFalsy();
});

it('rebinds an open library against the new root', () => { /* mirrors rootSwapRebind.test.ts */ });
```

- [ ] **Step 2: Run them and watch each fail**

- [ ] **Step 3: Implement the view, the context, the registration, the command and the fourth rebind loop**

- [ ] **Step 4: Add both in-app doors**

- [ ] **Step 5: Mutation-check the rebind loop**

Delete the fourth loop and run `tests/plugin/`: the rebind case must go red. Restore it.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: register the asset library view, its command and its two doors"
```

---

### Task 12: The mark, the row and the shelf

**Spec:** §3.2 lines 212–256 (shelves), §3.3 lines 257–292 (the row), §3.4 lines 293–392 (the mark). Read all three; they constrain each other.

**Files:**
- Create: `src/presentation/library/AssetMark.vue`, `AssetRow.vue`, `AssetShelf.vue`
- Port from: `src/prototypes/AssetMark.vue`, `AssetShelf.vue`
- Test: `tests/presentation/library/assetMark.test.ts`, `assetRow.test.ts`, `assetShelf.test.ts`

**Interfaces:**
- Consumes: Task 6's `AssetOutline`, Task 5's `CatalogueEntryDto`.
- Produces: `<AssetMark :outline>`, `<AssetRow :entry :outline :selected :ordinal @select>`, `<AssetShelf :label :entries :expanded :collapsible @toggle @select>`.
  **`AssetMark` takes no `ordinal`** — this line advertised one and Task 12 dropped it, with the
  reason at the code: the mark is `aria-hidden`, so the ordinal it would have been for is minted
  into the ROW's hidden description span instead (§3.4). Corrected here rather than left to read
  as a prop a later task can pass.
- **`AssetShelf.selectedId` is an `AssetId`, not a `string`** — the comparand is branded, and a
  `string` here silently accepts any other id-shaped value.

**The shelf list is DERIVED, never enumerated.** Two groups: every category the build declares, in `ASSET_CATEGORY_LABELS`'s order — all of them, empty ones included — then every category the vault names that the build does not, ordered by `localeCompare` and **kept as written**: not case-normalized, not retitled, not folded into `custom`. A configured eighth category joins group 1 the day the vocabulary declares it, with no edit here. A literal seven is the one arrangement that could answer neither.

**Group 2 cannot be reached in today's code — derive it anyway, and do not test it.** An unknown category never becomes an `Asset`: `AssetFrontmatterSchemaV1` validates through `kebabEnum(ASSET_CATEGORIES)`, which returns `z.NEVER` (`assetFrontmatter.ts:23`), and `Asset.create` refuses independently via `isAssetCategory` (`Asset.ts:216`). Such a note is SKIPPED by `listAll()` and appears in the unreadable strip instead of on a shelf. Derive the shelves generally — the declared vocabulary unioned with the categories the listing actually names — because that is simpler than special-casing group 1 and it populates with no edit the day §84 opens the vocabulary. **Do not write a case asserting an unknown category gets a shelf**: it cannot reach the list, so the case would pass for the wrong reason and certify a gap. Do not write copy promising it either. Ruled after a review bot found Task 5's `category: string` necessary for the eventual fix and sufficient for none of it; closing it properly is a persistence-and-domain change belonging to §84.

**A declared shelf can be empty and an undeclared one cannot**, and it looks like an inconsistency until it is said out loud: the only evidence an undeclared category exists is an asset sitting in it.

**An empty declared shelf draws its header, greyed and non-interactive, with the count `0`** — and it is therefore **not a tab stop and has no Enter/Space behaviour**. "Collapsible" is load-bearing in §6.2's table for exactly this reason; written as *every shelf header*, the two sections ask for something impossible.

**Five mark states, each differing in KIND rather than in weight:**

| State | Drawn as |
| --- | --- |
| Footprint, measured | the outline, solid hairline stroke, fitted with a 2px inset |
| Footprint, unscaled | the same outline, **dashed** |
| Not yet read | **three dots**, centred |
| No shape yet | **nothing** |
| Unreadable | a **struck box** — the only state that draws a box at all |

The prototype's own finding was that three of four states were the same picture — a measured tile, an unscaled cabinet and a not-yet-read cabinet were each *a square with a line through it*, separated in one case by stroke pattern and in the other **by colour alone**: the failure the mark exists to avoid, shipped by the spec that forbade it. Only visible once one capture held all four at once. **Draw all five side by side and look at them before claiming this task is done.**

**The 20px `<svg>` column renders in every state, including the empty one**, or the grid shifts left on the rows that have no shape.

**The mark's drawing is `aria-hidden` and its MEANING is not.** The state and the extent are carried in words in a visually hidden span that is a **sibling of the row button, never a descendant** — inside, it joins the row's accessible name and a screen reader announces "Measured footprint, 1200 × 190 mm Oak plank floor". The button references it with `aria-describedby`.

**The `aria-describedby` reference is minted from the row's ORDINAL, never from the asset's id.** An asset id is `z.string().min(1)` in the note's own frontmatter, so it may contain whitespace, and `aria-describedby` is a whitespace-separated IDREF list: an id like `wall tile` breaks into two references that resolve to nothing. An id a user can author may not be interpolated into a syntax that gives its characters meaning.

**Selection is a printed mark, not a tint** — a 2px filled rule at the leading edge drawn with an inset `box-shadow` (so it costs no layout and cannot shift the grid against unselected rows beside it), plus `aria-current="true"`. Not `aria-selected`, which is invalid on a `<button>` and which the promised axe scan would report.

**The row's slots and where they drop:** mark (never), name with `min-width: 0` (never), unit cost `€34.95 / m²` `tabular-nums` right-aligned (never), waste `+8%` or nothing when the default is zero (< 520px), supplier muted and ellipsing (< 640px). `min-width: 0` on the name is load-bearing — `.rp-project-detail__name` already paid for its absence at 460px, where a long name refuses to ellipse and pushes its neighbours off the row.

**The currency comes from the entry, never from a literal.** The prototype shipped a hard-coded euro sign, which reported the wrong currency for any non-EUR asset — a lie about a number rather than a cosmetic slip.

- [ ] **Step 1: Write the failing tests**

```ts
it('draws five visibly distinct marks', () => {
    // Distinctness is settled by an eye in Task 17's capture. What this asserts is that the
    // five render different ELEMENT SHAPES, so a build collapsing two into one stroke
    // variation fails here rather than in a photograph nobody takes.
    const drawn = FIVE_STATES.map((o) => shallowMount(AssetMark, { props: { outline: o, ordinal: 1 } }).html());
    expect(new Set(drawn).size).toBe(5);
});

it('renders the mark column even when there is no shape', () => { /* the grid-shift rule */ });

it('describes the row from an ordinal, never from an id that may hold whitespace', () => {
    const row = mount(AssetRow, { props: { entry: entryWithId('wall tile'), ordinal: 3, /* ... */ } });
    const describedBy = row.get('button').attributes('aria-describedby');
    expect(describedBy).not.toContain(' ');
    expect(row.find(`#${describedBy}`).exists()).toBe(true);
});

it('keeps the description outside the button so it does not join the accessible name', () => {
    const row = mount(AssetRow, { props: { entry: anEntry({ name: 'Oak plank floor' }), /* ... */ } });
    expect(row.get('button').text()).not.toContain('mm');
});

it('marks a selected row with aria-current, never aria-selected', () => { /* ... */ });

it('draws an empty declared shelf as a non-interactive heading with a zero count', () => {
    const shelf = mount(AssetShelf, { props: { label: 'Plant', entries: [], collapsible: false } });
    expect(shelf.find('button').exists()).toBe(false);
    expect(shelf.text()).toContain('0');
});

it('prints each asset in its own currency', () => { /* GBP entry renders £, not € */ });
```

- [ ] **Step 2: Run them and watch each fail at its assertion**

- [ ] **Step 3: Port the three components from `src/prototypes/`**

This is a PORT, not a move: the prototypes read a fixture and these read DTOs, and `tests/build/prototype-promotion.test.ts` does not cover this file set. State in the report what changed from each prototype and why.

- [ ] **Step 4: Run the component suite**

Run: `npx vitest run tests/presentation/library`

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: the asset mark, the asset row and the category shelf"
```

---

### Task 13: The root — toolbar, shelves, search, status bar and every state

**Spec:** §3 lines 180–212 (the composition and the four regions), §3.1, §3.6, §4 lines 786–834, §6.1 lines 1315–1329.

**Files:**
- Modify: `src/presentation/library/AssetLibraryRoot.vue` (Task 11's minimal version)
- Create: `src/presentation/library/AssetShelves.vue`
- Reuse: `src/presentation/components/EmptyState.vue` and Task 8's
  `selectAssetLibraryEmptyState` — mounted here and nowhere earlier
- **Build §3.2's shelf DERIVATION here — Task 12 built the shelf and not the list of them.**
  `AssetShelves.vue` is where the list is derived, and it is derived rather than enumerated: every
  category the build declares, in `ASSET_CATEGORY_LABELS`'s order, ALL of them including empty
  ones, then every category the listing names that the build does not, ordered by `localeCompare`
  and **kept as written** — not case-normalized, not retitled, not folded into `custom`. A literal
  seven is the one arrangement that could answer neither group.
  **The second group cannot be reached in today's code, and you must still derive it and must NOT
  test it.** An unknown category never becomes an `Asset` — `kebabEnum(ASSET_CATEGORIES)` returns
  `z.NEVER` and `Asset.create` refuses independently — so such a note is skipped by `listAll()` and
  appears in the unreadable strip instead. Derive generally anyway, because that is simpler than
  special-casing group 1 and it populates with no edit the day §84 opens the vocabulary; write no
  case asserting an unknown category gets a shelf, because it cannot reach the list and the case
  would pass for the wrong reason and certify a gap. Write no copy promising it either.
  This paragraph is here because Task 12's review found the ruling had been stated in Task 12's
  brief, correctly deferred by Task 12, and then named in no later brief at all — the third
  between-task gap on this plan, and the reason a hand-off belongs in the plan rather than in a
  ledger nobody downstream reads.
- Port from: `src/prototypes/AssetLibrary.vue`
- Test: `tests/presentation/library/assetLibraryRoot.test.ts`

**Interfaces:**
- Consumes: Tasks 8, 10, 12.
- Produces: the mounted surface Task 16 attaches its focus manager to and Task 17 captures.

**The store's API is exactly this, and three of its members are traps if you assume the obvious
thing.** `useAssetLibraryStore()` exposes `visibleEntries`, `total`, `unreadable`, `status`,
`error`, `query`, `searching`, `emptyStateKey`, `hydrate`, `applyChange`, `reset`, `markFor`,
`setVisibleMarks`, `invalidateMarks` — measured from the shipped store rather than described.

- **`entries` is NOT exported.** Rows come from `visibleEntries`, which is already filtered AND
  ordered by name under the resolved language. Do not sort it again and do not reach for an
  unfiltered list: there isn't one, deliberately, so that this task cannot forget §6.1's order.
- **`total` is §3.6's count**, and it counts READABLE entries only, by ruling — a note this build
  cannot read is not an asset yet, and its count is already carried by the unreadable strip. Do
  not add the unreadable count into it.
- **Never call `applyListing`.** `hydrate` owns that backstop itself, deliberately, so no view has
  to remember it.
- **`query` is writable and `searching` is derived from it.** Bind the search field to `query`;
  do not keep a second copy of the search term in the component. `emptyStateKey` reads `searching`
  through the store, so a component holding its own term silently draws `noAssets` — the
  create-a-duplicate invitation — where the user should see `noMatches`.

**Four shell regions**, which is the Asset designer's count rather than the Plan editor's five — a library has nothing to layer.

**The toolbar is one search field and one `New asset` button. Nothing else** — no sort control, no view switcher, no filter menu. The shelves *are* the filter, which is the whole argument for this structure. `New asset` opens the existing `NewAssetForm` through the existing `DialogHost`, unchanged.

**Search collapses every shelf into one flat result list**, ordered by name across categories, each row carrying its category as a muted slot. Clearing the field restores the shelves **and their prior expansion state** — a search must not cost a user the arrangement they had. Matching is on **name, supplier and SKU only**, never notes: a free-text field produces matches a row cannot explain.

**The result count is announced** — `12 matching assets` in a `role="status"` live region, so a keyboard or screen-reader user hears the effect of typing rather than inferring it from a list they cannot see.

**Every state from §4's table**, and the three that are easiest to get wrong:

- **BOTH empty states are rendered HERE**, and nothing before this task draws either of them.
  Task 8 built `selectAssetLibraryEmptyState`, the two `EMPTY_STATE_CONTENT.assetLibrary`
  entries and their copy; the plan then named no task that mounts them, which is the same shape
  as the `ProjectFolderLookup` fold Task 9 had to be corrected for — a declared piece with no
  file behind it is a piece nobody builds. So: mount the existing `EmptyState.vue` with the
  selector's answer, pass the search term as its second argument (an empty list WITH a query is
  `noMatches`, without one it is `noAssets` — opposite copy, opposite actions), wire
  `noAssets`'s action to the same `New asset` door the toolbar uses and `noMatches`'s action to
  clearing the search field, and note that **`selectAssetLibraryEmptyState` returns
  `'noAssets' | 'noMatches' | null`** — a registry KEY, matching every sibling selector in this
  repository, not the `StringKey` the Task 8 snippet's pseudocode returned. Where this text and
  the shipped `selectors.ts` disagree, the shipped file wins.
  Each one **replaces the SHELVES REGION and never the shell** (spec §4, lines 852–853): the
  toolbar and the status bar stay drawn, so the search field a user must reach to leave
  `noMatches` is still there — which is also why `noMatches`'s own action button is the
  destroyed control the focus manager has to move away from (spec line 2306).
  The two empty states are what Task 17's axe cases grade, one case each, so a state that draws
  no `.rp-empty-state__action` fails there rather than quietly.
- **Loading is held until the index scan has run** (Task 10 supplies the gate). Never a spinner over an empty pane.
- **Some unreadable** is the ADDITIVE `.rp-view-notice` strip above the shelves — the shelves still draw. It names **each path with its reason** and offers `Open note` **per row rather than for every row**: a `read-failed` whose code names a future-schema refusal draws the sentence and no action, because there is nothing in that file to change. An action that cannot work is worse than no action.

A count alone strands exactly the notes that need a human: two of the three sources carry no usable id, so neither can be selected, and the selection-level state that offers `Open note` is unreachable for them by construction.

- [ ] **Step 1: Write one failing test per state, plus search**

```ts
it('draws the shelves beside the unreadable strip, never instead of them', async () => {
    const root = await mountRoot({ entries: [anEntry()], unreadable: [aNoIdNote()] });
    expect(root.find('.rp-view-notice').exists()).toBe(true);
    expect(root.find('.rp-al-shelf').exists()).toBe(true);
});

it('offers Open note per row, and withholds it for a future-schema refusal', async () => {
    const root = await mountRoot({ unreadable: [
        { assetId: 'a', path: 'x.md', reason: 'read-failed', code: 'asset.schema-version-unsupported' },
        { assetId: null, path: 'y.md', reason: 'no-id', code: null },
    ] });
    // `asset.schema-version-unsupported` is what `MigrationRunner.migrateToLatest` really
    // raises (`${kind}.schema-version-unsupported`, MigrationRunner.ts:106). Seed it through
    // the repository rather than as a literal: a builder can satisfy an invented code while
    // still drawing `Open note` for every real future-version asset.
    const rows = root.findAll('.rp-view-notice li');
    expect(rows[0]!.find('button').exists()).toBe(false);
    expect(rows[1]!.find('button').exists()).toBe(true);
});

it('never draws the no-assets invitation before the index scan has run', async () => { /* ... */ });
it('announces the match count in a live region', async () => { /* role="status" */ });
it('restores the prior expansion state when the search is cleared', async () => { /* ... */ });
it('matches on name, supplier and SKU, and never on notes', async () => { /* ... */ });
```

- [ ] **Step 2: Run them and watch each fail**

- [ ] **Step 3: Port the root from `src/prototypes/AssetLibrary.vue` and wire it to the stores**

- [ ] **Step 4: Run the suite**

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: the asset library shell, its search and all six of its states"
```

---

### Task 14: The inspector

**Spec:** §3.5 lines 393–777 in full. It is the longest section in the document and every one of its four sections has its own rules; do not work from this summary alone.

**Files:**
- Create: `src/presentation/library/AssetInspector.vue`, `AssetInspectorShape.vue`, `AssetInspectorUsedIn.vue`
- Port from: `src/prototypes/AssetInspector.vue`
- Test: `tests/presentation/library/assetInspector.test.ts`, `assetInspectorShape.test.ts`, `assetInspectorUsedIn.test.ts`

**THE COMPLEXITY BUDGET, RE-MEASURED AT HEAD — and read the correction, because the first version
of this paragraph was true when written and false when you read it.** I wrote it from Task 13's
REVIEW (cognitive 15, zero headroom, 273 lines, 11th largest, "you cannot add a region"). Task 13's
FIX ROUND then extracted regions out of that template, and every one of those numbers moved. This
is the staleness class this plan keeps finding in other people's prose, committed in mine: a
measurement is a fact about the moment it was taken, and I wrote one into a brief a later commit
was still changing.

**What is true at `912e961b`, verified twice — by the re-review and again by me:**
- The template is **331 lines**, 8th largest. `wc -l` says so; `max-lines` counts well under its
  400 cap, so **`max-lines` is not the binding constraint**.
- Cognitive complexity is **12** against fallow's threshold of **15**, and `npm run analyze`
  reports `✗ 0 above threshold`.
- **Cost is NESTING DEPTH**, which is why one number cannot answer this. Adding a conditional
  region costs 1 as a direct child of the root element, 2 one level in, and 3 inside the
  ready-branch.

**So the budget depends entirely on where you put it, and the position an inspector actually wants
is the tightest one:**
- Direct child of the root element, above the `ViewFailure` branch: **three** regions fit (a fourth
  fails).
- Inside the ready branch: **one** fits (a second takes it to 18 and `analyze` exits 1).
- **At the toolbar/body/footer sibling position — where an inspector RAIL naturally goes — the
  budget is ONE.** That is the number to plan against, not the three.

Extract if you need more than that, as Task 13 did when this template hit 24 and it pulled out
`UnreadableStrip.vue` as a real §5.1a seam rather than taking fallow's suggested
`fallow-ignore-next-line`. **Do not take the ignore, and do not lower a threshold** — an
over-complex template is a seam nobody has drawn yet.

**A COVERAGE FAILURE HIDES THE HEALTH GATE.** `npm run check` chains with `&&`, so `analyze` never
runs while coverage is red. Task 13 cleared coverage and only then discovered the complexity
failure underneath it. Expect a second, different failure on your next run rather than reading the
first fix as the whole job.

**Interfaces:**
- Consumes: Tasks 4, 9, 10.
- Produces: the panel Task 16's narrow composition swaps to.

**THE INSPECTOR'S SUBJECT IS THE ROOT'S OWN `selectedId`, HANDED DOWN AS A PROP — never
`context.assetId`.** Read this before writing a line, because the two are live sources that
disagree by design and reaching for the wrong one is invisible to every gate. Task 13 shipped
`selectedId` as a local `ref` in `AssetLibraryRoot.vue`, seeded from `context.assetId` at setup
and re-assigned by a `watch` on it, while `onSelect` writes ONLY the local ref: the context is
`DeepReadonly` and no component may write it. So after a user clicks a row, `selectedId` names
the clicked asset and `context.assetId.value` still names whatever the leaf was restored with.
An inspector subscribing to the context would show the restored asset forever and never follow a
click — and it would contradict the marked row beside it, since `AssetRow`'s `selected` prop
comes from `selectedId`. One source for the mark and the panel, or they disagree the first time
anyone clicks.

That divergence is HALF A MECHANISM rather than a defect to fix here: the missing write-back
into Obsidian's view state is folded into Task 16, which owns the context member it needs. Do
not attempt it from this task — a write through the context slot is a compile error on purpose.

**This also gives §6.3's `''` sentinel its second consumer**, which Task 13's report records as
honestly unheld until now: `''` means nothing selected, `null` after `selectionOf`, and the
inspector's resting state is what that value draws.

**The `<dl>` is the two-column grid `.rp-designer-inspector-fields` and `.rp-editor-inspector-fields` already are.** A user moving between the Plan editor, the Asset designer and this surface must not be able to tell that three people wrote them.

**Four sections, in this order: Definition, Shape, Used in, Actions.**

**1. Definition** — name, category, unit, unit cost, waste factor, supplier, SKU, notes, height. Editable in place through `useFieldCommit`, dispatching the existing `UpdateAsset` / `SetAssetHeight`. A rejected commit **keeps what the user typed** and shows a persistent inline error under the field it is about — never reverts. `routeError` maps the codes to fields; `asset.unit-kind-referenced` routes to the **unit** field, because that is the field that is wrong.

**Every field's commit state is keyed by `assetId`, and both halves are required.** `useFieldCommit` holds `drafted` and `error` as refs with no notion of a subject — it is per FIELD, and the field it belongs to is a fact about the template. The Plan editor never had to think about this because `RequirementRow` is `v-for`-keyed per requirement, so changing subject remounts the row. Here the tree stays alive on purpose (Task 11), so the same instance survives a selection change and an edit to A still in flight when the user clicks B lands afterwards: **A's rejection renders A's inline error, over A's retained draft, under B's name.** So: a `:key` on the fields region discards the stale draft, AND an outcome whose subject is no longer selected updates nothing. Keying alone leaves the resolved promise pointing at a retired instance, which is harmless for the DOM and still runs `notify` for a refusal about an asset the user has left.

**Height is in Definition, not in Shape.** *Shape lists what the sidecar derives; Definition lists what the note stores and a field edits.* A height is on `Asset`, in millimetres, changed by `SetAssetHeight` — and it fails Shape's own admission test, which is that those rows are there because they are mush at 20px.

**2. Shape** — Footprint (`1200 × 190 mm`, omitted when absent), Clearance (its own extent, `None` when absent), Spec sheet (the file's name, omitted when absent), plus a pending warning per coordinate group and `Open designer`. **Anchor and facing are NOT here** — the Asset designer draws them.

The section has **its own three states**, because `GetAssetDesign` returns the sidecar's error rather than a DTO, and §4's whole-catalogue failure row does not cover it: a fine name, price and supplier must not be hidden behind a shape failure.

- **In flight** — a loading line in this section only; the Definition fields stay usable.
- **Refused** — the table at spec lines 535–540, **keyed on the CODE, never on the union arm**. `Open designer` is **withdrawn** for every `asset-geometry.*` refusal, because `GetAssetDesign.execute` returns early on a sidecar refusal, so the designer hydrates through the same read and reaches the same failed state with only a Retry. `asset-geometry.unusable-id` is the one row that offers `Open note` instead — the id is in the note's frontmatter and editing it is the whole repair — and it is split out because `pathFor` refuses it before deriving any path, so there is no sidecar to name.
- **Answered** — the rows above.

**Neither the in-flight state nor the refused one may state an ABSENCE.** `None` is only valid once a read has actually answered.

**3. Used in** — per-project groups from **`ListRequirementsReferencing`** (`src/application/queries/ListRequirementsReferencing.ts`, the query Task 9 widened — its `ReferencingGroup` is the row shape, and `projectPath` is declared `readonly projectPath?: string`, which is why the test below is against `undefined` and not against truthiness), loaded on selection. **A group whose project holds a price override for this asset carries a printed mark and a word** — `listByAsset(assetId)` on `AssetPriceOverrideRepository` is the exact lookup and it is one read on a selection that already performs two. Ruled mid-execution when `main` brought §89's override into existence: an unmarked row makes the Definition section's own claim — *a price correction reaches every room it was used in* — false by omission, directly above the field that makes the correction. Never a tint alone. Each row: project name, requirement count, and the project's path **wherever the query supplies one**. "Supplied" is tested against `undefined`, never truthiness: `''` is a supplied answer — a project whose `Project.md` sits at the vault root — and it renders `view.asset-library.used-in.vault-root`, a root label rather than nothing. **The row's key is `projectId`, never the name-and-path pair**: two projects can share both.

It has its own three states too. On a refusal, **`Delete` is unavailable while the usage read has not succeeded**, with the reason shown on the control; Edit stays available.

**It is a SNAPSHOT taken at selection and does not subscribe**, and that is a decision rather than an omission: the requirement event payload cannot filter to the selected asset, undoing an assignment publishes nothing at all, and an unfiltered re-run is O(every requirement in the vault) with a note read each. Reselecting is the refresh, and the copy says so rather than pretending to be live.

**YOU WILL NEED A NEW LOCALE KEY, AND A PIN WILL FIRE ON IT — that is the pin working, not a
test to loosen.** Task 4 shipped the section's copy, so `view.asset-library.used-in`,
`.used-in.none`, `.used-in.project`, `.used-in.vault-root`, `.used-in.loading` and
`.used-in.failed` all exist in both locales already. The **word beside the override mark does
not** — measured at `1d2f2a25`, `grep -n "override" src/presentation/i18n/locales/en-assetLibrary.ts`
prints two comment lines and no key. So the mark's word is a new key in BOTH
`en-assetLibrary.ts` and `de-assetLibrary.ts`, and `tests/presentation/i18n/strings.test.ts`
pins the Asset library's key COUNT at 60 — it will fail, naming 61 against 60. Move the pin to
61 in the same commit; do not widen its filter or delete it. It exists because a count kept in
prose went stale six times on this branch, and it has already forced two keys into the open that
would otherwise have shipped in one locale only. German: check `de-assetLibrary.ts`'s own
vocabulary before inventing a word — this branch has already shipped `Material` where the German
UI says `Objekt`, and `Grundriss` where a footprint needed `Umriss`.

**4. Actions** — `Open designer` · `Open note` · `Delete`. `Delete` reuses slice 15's `DeleteReferenceDialog` / `EntityPickerDialog` and slice 10's resolution through `deleteZoneFlow.ts`'s shape — the *Used in* read IS that flow's read. **After a successful deletion** the inspector withdraws to its resting state and focus goes to the next row in the shelf the asset was in: the row now occupying the deleted row's index, or the previous surviving row if the deleted one was last; the same rule inside the flat Results list when a search is running; and the search field otherwise, which is the most common case. **The shelf's heading is not a fallback** — it can never receive focus in the one case that would reach it, because an empty shelf's heading is non-interactive.

**A panel-level failure is one level up from the Shape section's**, and has its own two rows: a selected id in `unreadable` says the note could not be read, names it, and offers **`Open note` alone**; a selected id in neither says the asset is gone, with a way back, and offers nothing.

- [ ] **Step 1: Write the failing tests**

```ts
it('does not render A\'s rejection under B\'s name', async () => {
    const panel = await mountInspector({ assetId: 'a' });
    const pending = panel.rejectFieldCommitLater('unitCost');
    await panel.select('b');
    await pending.reject({ code: 'asset.invalid-cost' });
    expect(panel.find('.rp-field-error').exists()).toBe(false);
});

it('states no absence while the shape read is in flight', async () => {
    const panel = await mountInspector({ designPending: true });
    expect(panel.text()).not.toContain('None');
});

it('withdraws Open designer for a damaged sidecar and offers Open note for an unusable id', async () => { /* both rows */ });
it('renders a root label for a project whose path is the empty string', async () => { /* '' is supplied */ });
it('keys used-in rows by projectId, so two identically named projects both draw', async () => { /* ... */ });
it('withholds Delete while the usage read has not succeeded', async () => { /* ... */ });
it('offers Open note alone for a selected id that is in unreadable', async () => { /* ... */ });
```

The first is the one this task exists for; watch it fail before the `:key` and the subject test are in.

- [ ] **Step 2: Run them and watch each fail at its assertion**

- [ ] **Step 3: Port and implement the three components**

- [ ] **Step 4: Mutation-check the two halves of the keying rule**

Remove the `:key` — the first case must go red. Restore it and remove the subject test on the outcome instead: assert that `notify` is not called for a refusal about an unselected asset, and watch that go red too. Both are needed; either alone leaves a real defect.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: the asset library inspector, its four sections and their own states"
```

---

### Task 15: The stylesheet

**Spec:** §3.3 (the row's slots and where they drop), §7 lines 1411–1431 (the container-query ladder), §9 lines 1527–1554 (targets and focus).

**Files — CORRECTED AT `1d2f2a25`, because three of the four entries below were written before
Tasks 12 and 13 shipped and are stale in the direction that matters:**
- Create: NOTHING. **This entry said `styles/asset-library-inspector.css` and Task 14 shipped it**
  (`aae0a4fa`, 288 lines, imported at `styles/index.css:40`), forced rather than chosen: promotion
  turned the prototype's classes into a real component's and `tests/build/prototype-styles.test.ts`
  reddens on a class NEITHER home declares, so the partial had to exist in the same commit as the
  component. Recorded rather than quietly absorbed, because a task whose Files list is wrong in
  the CREATE direction is one whose implementer overwrites shipped work.
- **So this task's real job on that file is to READ it and fix what it cannot have got right.**
  Nothing has RENDERED it — the container holds no pinned Chromium — and Task 14's own report
  names three of this repository's recorded rendering defect classes as live in it: a third
  `space-between` child moving its siblings out of column (three surfaces have now shipped that
  one), a `:last-child` separator, and `:focus-visible` on the controls. `npm run harness` with
  an eye is the instrument; a text assertion over the stylesheet is what keeps a fix.
- Modify: `styles/asset-library.css` (Task 13 created it; it holds `.rp-al-shelves`'s
  `container: rp-al-shelves / inline-size` declaration, which both of `asset-shelf.css`'s
  container queries key off), `styles/asset-mark.css` and `styles/asset-shelf.css` (Task 12
  created both), `styles/list-row.css` (Task 12 already joined `.rp-al-shelf .rp-al-row` into
  the shared selector list — check before adding it a second time).
- Do NOT create `styles/asset-library.css`. It exists and `styles/index.css` imports it at
  line 37; the imports for all three are already in place and already correctly ordered after
  `list-row.css` at line 29.
- Test: `tests/build/buttonSpecificity.test.ts` and `buttonFocusRing.test.ts` (existing category
  checks — they read every shipping sheet, so all four partials are already in their scope)

**Interfaces:**
- Consumes: the class names Tasks 12–14 emit.
- Produces: nothing any other task imports.

**Container queries, never media queries.** The editor's own width is its pane's — the window minus both Obsidian sidebars minus whatever is split beside it — so a media query measures the wrong box. This is measured, not preferred: fixed rails gave the plan canvas 67% of a 1440px pane and 29% of a 680px one.

| Container width | Composition |
| --- | --- |
| ≥ 720px | shelves + inspector rail, rail 280px |
| 560–720px | rail narrows to 240px; the row drops its supplier slot, then its waste slot |
| < 560px | the rail stops being a rail — selecting a row replaces the shelves with the inspector in full |

**THE CLASS NAMES IN THIS TASK'S REMAINING TEXT ARE WRONG, INCLUDING IN ITS STEP 1 TEST.** The
plan was written with `.rp-asset-shelf` / `.rp-asset-row`; what Task 12 actually shipped, and what
`AssetShelf.vue` and `AssetRow.vue` emit today, is **`.rp-al-shelf` / `.rp-al-row`** — with
`.rp-al-shelves`, `.rp-al-mark`, `.rp-al-row__name`, `.rp-al-row__supplier`, `.rp-al-row__waste`,
`.rp-al-toolbar`, `.rp-al-body`, `.rp-al-results`, `.rp-al-status` and `.rp-al-repair` beside
them. Task 13's report flagged the same stale selector in its own brief. Read the class off the
component, never off this plan: a test written from the text below asserts a selector nothing
renders, which passes or fails for reasons unrelated to the rule it means to keep — and the worse
outcome is an implementer renaming shipped, tested classes to match a stale plan. Substitute
throughout, Step 1 included.

**Read BOTH width ladders in the spec, because they measure different boxes and this task is
where they meet.** §3.3's row table (spec lines 305–306) drops the waste slot below **520px** and
the supplier slot below **640px**, and Task 12 shipped exactly that as `@container rp-al-shelves`
queries at `32.5rem` and `40rem` — measuring the SHELVES REGION. §7's table below drops the same
two slots inside its 560–720px rung — measuring the PANE. They are consistent only if the rail is
taken out of the pane first, which is the arithmetic this task performs and the previous one
could not. Spec line 1934 already records one finding in this area (a 280px rail held through
§7's whole middle rung because only the `< 35rem` override had ever been exercised). Do not
change Task 12's shipped container queries to §7's numbers without stating which box each
measures; if the two genuinely conflict, the SPEC is the authority and §7's table is the one
about this composition.

**The row is a flattened `<button>` selected UNDER its block class** (`.rp-al-shelf .rp-al-row`). Obsidian's own `button:not(.clickable-icon)` is (0,1,1) and a bare class is (0,1,0) and loses silently. `buttonSpecificity.test.ts` has caught this exact defect four times already.

**Every focus stop opts its ring back in** — Obsidian's global `:focus { outline: none }` reaches buttons. `2px solid var(--interactive-accent)`, offset **negative** for the edge-to-edge rows (an outside ring would be clipped) and **positive** for the inset toolbar and inspector controls.

**Rows and shelf headers at `--size-4-6` minimum** — WCAG 2.5.8's 24px floor. The harness index shipped 19.5px rows once, found by photographing the page rather than by any gate.

**No colour literal, a bare `red` included** — SDD §84, checked on lightningcss's parsed tree over the assembled sheet. **400 lines per partial**, which is why the inspector gets its own from the start rather than after a split.

**Precedence is decided in TypeScript, not in the cascade** wherever two rules could compete — a computed class, never source order under a comment claiming source order wins. That comment has been false here before.

- [ ] **Step 1: Write the failing test**

```ts
it('declares a rule the asset row's emitted class can match, under its block', () => {
    const sheet = assembledStylesheet();
    expect(sheet).toContain('.rp-al-shelf .rp-al-row');
});

it('declares the three container-query steps', () => {
    const sheet = assembledStylesheet();
    expect(sheet).toMatch(/@container[^{]*\(max-width:\s*720px\)/);
    expect(sheet).toMatch(/@container[^{]*\(max-width:\s*560px\)/);
});
```

Built from the same expressions the templates interpolate, because jsdom resolves no CSS and a state whose rule is one word off renders the base style with every test green — a defect this repository has shipped once already (`rp-save-state-error` against an emitted `rp-save-state-save-error`).

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Write both partials and add the imports**

- [ ] **Step 4: Run the style gates**

Run: `npm run build && npx vitest run tests/build/buttonSpecificity.test.ts tests/build/buttonFocusRing.test.ts`
Expected: PASS. A colour literal fails the build; a losing selector fails the specificity check.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: the asset library stylesheet and its container-query ladder"
```

---

### Task 16: The keyboard, and the narrow composition

**Spec:** §6.2 lines 1330–1377 in full, §6.1's narrow-search rule, §7's last row.

**Files:**
- Create: `src/presentation/library/shelfFocus.ts`
- Modify: `src/presentation/library/AssetLibraryRoot.vue`, `AssetInspector.vue`, `AssetLibraryView.ts`, `AssetLibraryContext.ts`
- Test: `tests/presentation/library/shelfFocus.test.ts`, `assetLibraryKeyboard.test.ts`, `assetLibraryViewState.test.ts`

**Interfaces:**
- Consumes: Tasks 12–15.
- Produces: nothing any other task imports.

**THIS TASK ALSO OWNS THE DELETE FLOW, handed over by Task 14 with a measured reason.** The
`Delete` control ships — drawn, and `aria-disabled` with its reason while the usage read has not
succeeded — but it EMITS rather than running slice 10's reference resolution. Two things forced
that and both are this task's to resolve. `deleteZoneFlow.ts` is not reusable as written: its
dispatch takes an `InspectorEdit`, and its reassign branch needs a read for the reassignment
TARGET that `AssetLibraryQueryServices` has no door for — so reuse means either widening that
bundle or extracting the flow's shape, which is a decision about a shared seam rather than a wiring
line. And §3.5's post-deletion focus rule names three targets that live in SIBLING regions (the
next row in the shelf the asset was in, the same rule inside the flat Results list while a search
runs, and the search field otherwise) — this task's `shelfFocus.ts` is exactly the thing that can
address them, and Task 14 could not reach them from inside the panel. **The shelf heading is not a
fallback**: it can never receive focus in the one case that would reach it, because an empty
shelf's heading is non-interactive.

**THIS TASK ALSO CLOSES THE WRITE-BACK INTO OBSIDIAN'S VIEW STATE, folded in by ruling
mid-execution.** Task 13 shipped only the READ half of §6.3 and said so in
`AssetLibraryRoot.vue`'s header and its report: `expandedCategories` is seeded from
`context.expanded` once at setup, `selectedId` starts from `context.assetId`, and **neither
ever reaches `AssetLibraryView.getState()`**. So a restored leaf opens on the selection and
expansion it was saved with, and a selection or an expansion made in THIS session does not
survive a leaf reopen — half a mechanism, whose other half is what §6.3's three-way parse and
Task 11's `getState`/`setState` pair exist for. It is folded here rather than given its own task
because this task already re-enters the root, and a separate task would be a second entry into
the same two files for one seam.

It cannot be done from inside a component, and that is a deliberate design rather than an
obstacle: `AssetLibraryContext.assetId`/`expanded` are `DeepReadonly<Ref<T>>` precisely so a
component write is a compile error (`assetLibraryContext.test-d.ts` is the proof), and
`AssetLibraryView` is the one writer. **The route Task 13's report recorded is a context member
the view supplies** — a `publishViewState(assetId, expanded)` callback beside the two refs,
which writes the view's own `assetIdRef`/`expandedRef` and asks Obsidian to record the state.
Two things it must get right, both of them already paid for elsewhere in this repository:
- **`rebind` remounts the tree**, so the re-seed after a settings save is what stops a
  selection being thrown away by a save the user made while an asset was open — the
  `ProjectDetailState` lesson, and the reason the refs are the VIEW's fields constructed once.
- **A write must not fight the `watch`.** `AssetLibraryRoot` watches `context.assetId` and
  assigns `selectedId` from it; publishing on select makes that watch fire with the value it
  already holds, which is idempotent and must be ASSERTED as such rather than assumed — a
  publish that re-entered would be an infinite loop no type can see.

Test both halves separately: a click reaches `getState()`, AND a `rebind()` preserves the
selection made before it. The second is what the round-1 probe on Task 13 used (selected = 1
against 0 when reverted) and it is the case that would redden if a later author moved the refs
back inside `mount()`.

**One focus manager over the shelves region, never a handler per shelf.** Headers and rows already alternate in DOM order, so *the next focusable thing in this region* IS *the next row, or the next shelf's header when the rows run out* — the wrap falls out rather than being written. A per-shelf handler would have to be told about its siblings, which is a list, and a list goes stale where a rule does not.

**A collapsed shelf's rows are `v-show`n rather than removed**, so the manager filters them out rather than walking them.

**`v-show` sets no attribute — it sets an inline `display: none`**, and the first version of this paragraph said "the attribute `v-show` sets", which does not exist. An implementation following that sentence would have kept every collapsed row in the arrow-key stop list and let the keyboard focus invisible rows. Reported by a review bot against this plan.

**And `v-show` sits on the `<ul>`, not on the focus stops.** `AssetShelf.vue` binds it to the row list (`src/prototypes/AssetShelf.vue:136`) while the stops are the `<button>`s inside its `<li>`s — so each stop's own `style.display` is the empty string whether the shelf is open or shut, and a filter reading the stop itself keeps every collapsed row in the list. That was the FIRST correction of this paragraph and it was wrong for the element it named; a fix that moves a claim from the wrong mechanism to the wrong element is still a fix that does not work. Reported by a review bot, one round after the attribute correction.

So the filter is a walk, not a property read:

```ts
/** True when no ancestor between `el` and `root` carries an inline `display: none`. */
function isLaidOut(el: HTMLElement, root: HTMLElement): boolean {
	for (let node: HTMLElement | null = el; node !== null && node !== root; node = node.parentElement) {
		if (node.style.display === 'none') return false;
	}
	return true;
}
```

jsdom reflects inline styles at every level, so this IS assertable in the suite — which narrows the spec's own §6.2 claim that it is checkable by eye alone. What stays unassertable is genuine LAYOUT — `offsetParent`, `getBoundingClientRect`, `checkVisibility()` — so a row hidden by a STYLESHEET rule rather than by `v-show` would still slip through, and that residual is what the manual case carries. Do not reach for `offsetParent`: jsdom answers `null` for every element, so the manager would filter out every row and the arrow keys would do nothing, with the whole suite green.

**Empty shelves are skipped, having no header to focus.** This is §3.2's non-interactive heading arriving in the section that promises the gestures.

**Below 35rem, selecting a row MOVES focus, and `Back to library` returns it.** The narrow composition hides the shelves outright, so the button the user just activated is inside a `display: none` subtree — focus lands on a hidden element or resets to the document, the pane change is announced to nobody, and the next Tab starts from the top.

**Whether the swap happened is asked of the DOM, never of a breakpoint.** `matchMedia` is the wrong instrument: §7's ladder is a CONTAINER query, so it answers about the pane's width and the viewport's may differ — a split leaf is exactly that case. The honest test is whether the shelves region is actually laid out after the change, which is what the browser already knows.

**Searching returns the narrow composition to the shelves.** With the pane given to a selected asset, a user typing into the search field filtered a list they could not see and the surface appeared to ignore them. Found in the 460px capture, which is the width that composition exists for at all.

**`Escape` means two different things at two scopes** — in the search field it clears the field; in an inspector field it resyncs that ONE field through `useFieldCommit.onCancel`, exactly as the Plan editor's Inspector already behaves.

- [ ] **Step 1: Write the failing tests**

```ts
it('wraps from the last row of a shelf into the next focusable header', () => { /* ... */ });
it('skips an empty shelf, which has no header to focus', () => { /* ... */ });
it('does not stop on the rows of a collapsed shelf', async () => {
    // v-show leaves them in the DOM with an inline display:none, which jsdom reflects.
    const surface = await mountShelves({ expanded: [] });
    expect(focusStops(surface)).toEqual(surface.findAll('button.rp-al-shelf__head').map(el => el.element));
});
it('moves focus to the back control when the narrow composition swaps', async () => { /* ... */ });
it('returns focus to the row it came from', async () => { /* ... */ });
it('returns the narrow composition to the shelves when the user types', async () => { /* ... */ });
it('clears the search on Escape and resyncs one inspector field on Escape', async () => { /* ... */ });
```

- [ ] **Step 2: Run them and watch each fail**

- [ ] **Step 3: Implement the focus manager and the narrow swap**

- [ ] **Step 4: Mutation-check the wrap and the swap**

- Make the manager per-shelf: the wrap case must go red.
- Ask `matchMedia` instead of the DOM: the swap case must go red under a container narrower than the viewport.
- Drop the `display` filter: the collapsed-shelf case must go red.
- Narrow `isLaidOut` to read the stop's OWN `style.display` instead of walking its ancestors: the collapsed-shelf case must go red. This is the mutation that catches the defect two review rounds produced, and no other case in the file distinguishes the two spellings.

All three watched, all three restored.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: one focus manager over the shelves, and the narrow composition's focus handoff"
```

---

### Task 17: The harness, the axe scan, and the captures

**Spec:** §4's last paragraph (both empty states scanned on the day they ship), §7 (460px is a required capture width), §9's closing paragraph (what no gate here can settle), §12 (what the prototype found and what it could not).

**Files:**
- Create: `tests/harness/assetLibrary.ts`
- Modify: `tests/harness/page.ts` (a `?view=asset-library` branch), `tests/harness/entries.ts`, `tests/harness/accessibility.test.ts`, `scripts/harness-shot.mjs` (two more fixed shots)
- Create: `docs/tests/cases/Browse the asset library.md`
- Test: `tests/harness/harness.test.ts`

**Interfaces:**
- Consumes: everything.
- Produces: the captures and the manual case.

**The axe cases are scoped by their FIXTURE, and that is what decides which state is graded.** `planEditor.noZones` went seven slices unscanned because the case's fixture resolved to a different entry. So: one case per empty state, each asserting `.rp-empty-state` AND `.rp-empty-state__action` are in the scanned DOM — otherwise a fixture drift silently grades a different state, or nothing.

**`await flushPromises()` before scanning.** `mountHarness` is synchronous and `void`s `onOpen`, so a scan run before the store's hydrate resolves finds zero elements under any rule bucket and passes vacuously — indistinguishable from a pass on a compliant tree.

**What the scan does NOT reach, stated so it is not read as covered:** it runs over `contentEl` in jsdom, so it grades roles, names, labels, heading order and ARIA validity, and it grades **no** contrast, **no** focus-indicator visibility and **no** hit-target size. Those three are settled by a capture and by a live vault.

**Capture at 1280 and at 460**, both schemes. 460px is an Obsidian sidebar leaf's real width and is where the project row's name defect was found; this row has four more slots to lose.

**Capture the five marks side by side.** The prototype's own finding was that three of four states drew the same picture, visible only once one capture held them all at once. A capture per state would have shown four correct-looking pictures.

**The pinned Chromium may not be on this machine.** `RP_CHROMIUM_EXECUTABLE` is the one door out, and the script prints that the build is not the pinned one so the caveat travels with the picture. Never hunt a build on disk.

- [ ] **Step 1: Write the failing harness test**

```ts
it('opens the asset library on ?view=asset-library', async () => { /* mirrors the asset-designer branch */ });
```

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Wire the harness mount, the page branch and the index entries**

**A SIXTH CASE: POPULATED WITH AN ASSET SELECTED, so the INSPECTOR is in the scanned DOM.**
Task 14 shipped the panel and reported, as its own last concern, that **no axe scan reaches it** —
and it is the largest new ARIA surface on this view: four sections, each with three states, a
definition list of live fields with inline errors, `aria-disabled` controls carrying their reason,
and a per-group override mark. The five cases below all rest at the resting state, where the panel
is not drawn at all, so every one of them would pass a build in which the inspector's ARIA is
broken. Assert `.rp-al-inspector` is in the scanned DOM the same way the empty-state cases assert
`.rp-empty-state`, or the case grades the shelves twice.

Scan it in its ANSWERED state, and say why in the case: a panel whose two reads are still in
flight draws loading lines rather than the fields, so a scan taken one tick early grades the
smaller surface and reads identically to one that grades the larger. `flushPromises()` is what
separates them, which is the same hazard the paragraph above states for the empty states.

- [ ] **Step 4: Add the axe cases — populated, populated-with-a-selection, no-assets, no-matches, some-unreadable, failed**

- [ ] **Step 5: Capture and LOOK at every capture**

```bash
npm run harness-shot -- --width=460
npm run harness-shot asset-library
```

Read them. The five marks must be five pictures. The row must not push its neighbours off at 460px. The empty shelves must read as room rather than as clutter.

- [ ] **Step 6: Write the manual case**

`docs/tests/cases/Browse the asset library.md`, carrying what no gate here can settle: contrast, focus-ring visibility, hit-target size, whether a collapsed shelf's rows are really skipped by the arrow keys, and whether Obsidian honours the view state across a reload. Its Runs table records that it has not been run in a vault — an unrun manual case is a plan to find out, not a finding.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add -A && git commit -m "feat: harness, axe cases and captures for the asset library"
```

---

### Task 18: The exclusion invariant survives the repository's own index mutations

**Added mid-execution, by ruling, after Task 2's review.** It is last because it is a decision about who owns *"an id was vacated"* rather than a defect in Task 2 — and because the asset library's repair strip is what makes it observable end to end, so it wants the surface to exist first.

**Spec:** §5.1a's promotion rule, lines 1021–1040.

**Files:**
- Modify: `src/infrastructure/obsidian/repositories/noteEntityWrite.ts`, `src/application/ports/ProjectIndex.ts`, `src/infrastructure/persistence/index/VaultChangeAdapter.ts`
- Test: `tests/infrastructure/persistence/index/excludedNotes.test.ts`, plus a case driving `DeleteAssetCommand` end to end

**The defect, measured rather than described.** `trashNoteBackedEntity` awaits `trashFile` at `noteEntityWrite.ts:228` and calls `deps.index.remove(id)` at line 261, after it and after any `alsoRemove` compensation. So for a duplicate winner deleted through a COMMAND rather than out of band, both orderings lose:

- the vault's delete event is handled during `trashFile` → `promoteContender` runs, and line 261 then removes that same id, deleting the entry just promoted;
- the event arrives after line 261 → `processPath` finds no vacated entry and never reaches promotion.

Either way the surviving note stays unindexed until a full rebuild. **Every promotion case in Task 2's suite drives the out-of-band doors**, so the feature is proven for the case the tests cover and broken for the ordinary in-app delete.

**A second door, folded in by ruling after a later review round: the delete's own ROLLBACK.** When a winner's delete fails at `alsoRemove` — a geometry sidecar that will not go — `trashNoteBackedEntity` restores the note and calls `deps.index.upsert(indexed)` directly (`noteEntityWrite.ts:250`). That is the RAW port method, not the adapter's `applyUpsert`, so it displaces whichever entry holds the id — including a loser the vault event had just promoted — and creates no `duplicate-id` descriptor for it. The restore's own create event is then echo-suppressed. Both notes are still in the vault and the loser has vanished from the repair list until a full rebuild.

**That is the same seam, which is why it belongs here rather than in its own patch.** Task 2's reviewer named the general shape as a deferred minor: the five repositories mutate the index directly, so the two-collections invariant is kept by the scan and the pipeline rather than by every writer. Promotion-on-delete and restoration-on-rollback are two consequences of that one fact, and patching either alone leaves the other live. Whatever this task chooses — an observer on the index, or a service both the pipeline and the repositories call — must answer for every writer, not for the delete path alone.

**Why it is not a fix round in Task 2**, in the implementer's own reading, which I accept: routing promotion from the repository's delete path opens a new seam between `noteEntityWrite` and behaviour that lives in the vault-change pipeline; and putting it inside `index.remove` — the *one question, one function* shape this repository prefers — **cannot be done in `InMemoryProjectIndex` at all**, because promotion needs the vault and the metadata cache and `ProjectIndex` is a pure port with neither. It needs an observer on the index, or a promotion service both removers call. That is an ownership decision, not an edit.

**What the residue costs while it stands, stated so it is not read as covered.** A user resolving an id collision by deleting the visible asset through the plugin does not see the survivor appear until a reload. Out-of-band resolution — editing the loser's id, or deleting either note in the file explorer — works today, and those are the routes a user reaching two colliding notes most often takes, because a duplicate-id loser is not in the index and cannot be selected in the app at all. Bounded by a reload, which is the bound every other index fact already lives under.

**First, decide what a duplicate delete MEANS — index promotion is not the question.** A review bot found that the proposed test could pass while doing real harm, and it is right. `DeleteAssetCommand` does not merely remove a note: `runDeleteResolution` resolves or reassigns **every requirement** that referenced the asset, `ObsidianAssetRepository.delete` takes the geometry sidecar with it through `alsoRemove`, and `deleteOverridesOf` clears **every price override** — all before `AssetDeleted` is published (`DeleteAsset.ts:82-136`). Every one of those is keyed by the ID, and **the duplicate loser shares that id.**

So promoting the loser after a command delete resurrects a catalogue entry whose geometry is gone, whose requirements were deliberately reassigned away, and whose price overrides were deleted — and it does that to a user who has just been walked through a reference-resolution dialog to confirm the deletion. A test asserting "the loser is promoted" passes over exactly that.

**The likely answer, and it is Task 18's to confirm rather than mine to impose:** promotion is right for an OUT-OF-BAND delete, where nothing cascaded and the surviving note is simply the remaining claimant, and probably WRONG for a command delete, where the id's resources are gone by the user's own instruction. If so, the two doors want different behaviour rather than the same behaviour wired twice — which is a stronger reason for this to be its own task than the wiring argument that opened it.

- [ ] **Step 1: Decide and write down the semantics** — what a duplicate-id delete means for each door, with the cascade above as the input. Record why the rejected reading was rejected.
- [ ] **Step 2: Write the failing test for the semantics you chose** — and if promotion is right for a door, assert against what a full `rebuildIndex()` produces rather than a hard-coded path. If promotion is WRONG for the command door, the test asserts the loser stays excluded and says why.
- [ ] **Step 3: Run it and watch it fail at the assertion.**
- [ ] **Step 4: Decide the owner and implement it.** Both shapes are legitimate and the choice is the task: an index observer the pipeline registers, or a promotion service both `trashNoteBackedEntity` and `processPath` call. Whichever is chosen, write down at the code why the other was not.
- [ ] **Step 5: Cover the rollback door too** — a winner whose `alsoRemove` refuses, restored, with the displaced promoted loser asserted back in `listExclusions()` as `duplicate-id`. Watch it fail against today's raw `index.upsert`.
- [ ] **Step 6: Prove each door does what Step 1 DECIDED — which is not the same as proving both promote.**

  This step said "prove BOTH doors still promote", unconditionally, directly beneath the passage arguing that the command door probably must NOT. An implementer choosing the documented non-promotion semantics could not satisfy both instructions, and the way out of that contradiction is to restore the destructive resurrection Step 1 exists to prevent — a plan instructing someone to reintroduce the defect it opens by describing. Reported by a review bot; corrected in place rather than deleted, because a step that quietly stops being wrong teaches the next reader nothing.

  So: the OUT-OF-BAND door promotes, which Task 2 already covers and this step re-asserts, because a fix that moves promotion to the repository and loses the vault-event path is the partial fix this repository keeps paying for. The COMMAND door is asserted to do whatever Step 1 decided, with the assertion naming the decision. If Step 1 chose non-promotion, this step's command case is the INVERSE — the loser stays excluded — and it is the more important of the two to watch fail, since a build that starts promoting there resurrects an entry whose geometry, requirements and price overrides the user was walked through a dialog to destroy.
- [ ] **Step 7: `npm run check`, then commit.**

---

## Self-review

**Spec coverage.** §1 and §1a are context. §2 → Task 11. §2a → the §11.9 ruling plus the negative rule bound into every task. §3.1/§3.6/§4/§6.1 → Task 13. §3.2/§3.3/§3.4 → Task 12. §3.5 → Task 14. §5.1 → Task 5. §5.1a → Tasks 1, 2, 3. §5.2 → Task 14's snapshot rule. §5.3 → Task 6. §5.4 → Task 7. §5.5 → Task 10. §6.2/§6.3 → Tasks 11 and 16. §7 → Tasks 15 and 16. §8 → Task 8. §9 → Tasks 12, 15, 17. §10 is anti-goals — nothing to build, and each is a thing no task may add. §11 → the rulings table. §12 → Task 17.

**One gap, ruled rather than left open:** §3.5's *Used in* needs `ListRequirementsReferencing` to widen its `ProjectFolderLookup` to the note path so a vault-root project answers `''` rather than `undefined`. It is folded into **Task 9**, whose brief carries spec lines 640–660. (It is NOT the "two-line change" this sentence first called it, and it is not a plain widening: §3.5's rule is two-level — folder first, note path only where the folder fails to separate two rows — because always showing the note path destroys the vault-root label. Corrected after Task 9's review upheld the implementer against this plan.) Cost if wrong: two identically named projects are indistinguishable in the one panel where the price edit that reaches both is about to happen.

**Placeholder scan:** no "TBD", no "add appropriate error handling", no "similar to Task N". Where a test body is elided it is because the spec's own line range carries the exact values, and the brief names that range.

**Type consistency:** `CatalogueEntryDto`, `UnreadableEntry`, `CatalogueListing`, `AssetListing`, `SkippedAsset`, `ExcludedNote`, `AssetOutline`, `AssetLibraryChange`, `AssetLibraryQueryServices`, `AssetLibraryCommandServices`, `AssetLibraryDeps` are each declared in exactly one task and consumed by name afterwards. `listAll` answers `AssetListing` from Task 3 onward everywhere. The exclusion filter is `'renovation-asset'` at all three sites.

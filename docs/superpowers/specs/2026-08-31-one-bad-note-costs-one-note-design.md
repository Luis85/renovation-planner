# One bad note costs one note

A correctness increment, not a design slice. It has no `docs/tasks/` document and derives from
three Issues rather than from a slice map row:

- [[One unreadable zone note blanks every zone on the canvas]]
- [[The diagnostics snapshot has no surface that reaches it]]
- and the half of [[A future-version note can be neither read nor deleted]] that is about
  *finding out which note*, which is explicitly **out of scope** here — see **Not in scope**.

## Purpose

SDD §92 item 13 asks that a note this build cannot read cost the user that note and nothing
more. `migrateNote`'s own docblock states it: a refusal is *"scoped to THIS note ... and the
rest of the project loads on."*

That is true of exactly one listing. `ObsidianProjectRepository.listAll` skips and counts, and
the count reaches `ViewRoot` as `.rp-view-notice`. Every other listing still answers the first
read failure it meets, and two of them feed surfaces with something to lose:

- **`ObsidianZoneRepository.list`** — one site behind **two** entry points, `listByPlan` and
  `listByProject`. One unparseable Zone note fails the whole listing, so the Plan Editor draws
  **no zones at all** and shows its failed state.
- **`ObsidianPlanRepository.listByProject`** — one unparseable Plan note makes design slice
  21's project detail state draw its failure screen instead of the plans it can read.

Neither is reachable by any gate. Every test in the suite drives readable notes, and a
fail-fast listing is not a defect any lint rule can name.

The third Issue is what makes this one increment rather than two. The whole argument for
skipping is *"the per-entity detail already lives in the diagnostics report"* — true of the
`DiagnosticsLedger` and false of anything a user can open. `GetDiagnosticsSnapshotQuery` is
built, guarded, composed and tested, and consumed by nobody. This increment adds two more
surfaces leaning on that fallback, so it owes the fallback.

## Two corrections to what the Issues say

Both were measured against the tree on 2026-08-31 and both change the work.

**No shipped string points at a diagnostics report.** The Issue quotes *"Open the diagnostics
report for details."* — that sentence was **removed** before it shipped, and
`src/presentation/i18n/locales/en.ts:201` carries the comment recording why: a sentence
pointing at a surface that does not exist is the live-control-that-does-nothing failure this
codebase already named for buttons. The count-free sentence ships alone. So the report is owed
by the *design's* fallback, not by a broken promise on screen.

**The Issue says three entry points; there are two.** `grep -n "this\.list(" ` over
`ObsidianZoneRepository.ts` prints exactly two call sites, at lines 331 and 342. The third
comes from that file's own docblock at line 354, which names a `findByProject` handing it
*"zones from several"* plans — and `grep -rn "findByProject" src/` returns **that comment and
nothing else**. The method does not exist. A docblock naming a caller that is not there is the
staleness this repository already has a rule about, and it propagated into an Issue. Deleting
that clause is a one-line fix folded into this increment, since the file is being edited anyway.

**The constraint against a counted sentence has lifted.** The Issue rejected interpolating a
count because `t(language, key, params?)` did not exist. Design slice 19 built it —
`src/presentation/i18n/strings.ts:29`. Both new sentences carry a number rather than the word
"some".

## Design

### 1. The listing contract

Both repositories answer a listing object rather than a bare array, following `ProjectListing`
(`application/ports/ProjectRepository.ts:21`) exactly rather than inventing a second shape:

```ts
export interface ZoneListing { readonly loaded: Loaded<Zone>[]; readonly refused: number; }
export interface PlanListing { readonly loaded: Loaded<Plan>[]; readonly refused: number; }
```

`ObsidianZoneRepository.list` and `ObsidianPlanRepository.listByProject` skip and count instead
of returning the first `err` — but **only for refusals that are about one note**, and only after
recording each one. Both qualifications are corrections found by review on this spec's own first
commit, and each would have shipped a defect worse than the one being fixed.

#### 1a. A shared failure is not N note failures

`ObsidianZoneRepository.loadOne:113-119` answers `zone.sidecar-unreadable` when the plan's
geometry sidecar cannot be read, and `list` memoises that read across the whole loop — so one
unreadable sidecar makes **every** zone in the plan refuse. Blanket skip-and-count would answer
`loaded: [], refused: 20` and draw an empty canvas under a notice blaming twenty notes for one
file. That is this increment's own claim inverted: a shared failure reported as N note failures,
with the editor's honest failure state replaced by a cheerful partial-list notice.

So `list` propagates a shared failure and skips only entity-local ones. The set is enumerated as
the codes that MAY be skipped, never as the codes that may not, so the default is to propagate:

```ts
const SKIPPABLE_ZONE_CODES = new Set([
    'zone.frontmatter-invalid',   // this note's frontmatter does not parse
    'zone.entity-invalid',        // this note's values do not make a Zone
    'zone.geometry-entry-missing' // this zone has no entry in a sidecar that read fine
]);
```

`zone.sidecar-unreadable` is absent, which is the point. A migration refusal carries its own
category (`MigrationError`) and is skippable by category rather than by code. **Fail-closed is
the whole design of this list**: a refusal code invented later propagates, which is today's
behaviour and safe, rather than being silently swallowed into a count.

#### 1b. "Skipping loses nothing" was false on both of these surfaces

The Issue states that *"`getById` records every refusal into the `DiagnosticsLedger` before
returning it, so skipping loses nothing on the zone side either."* Measured on 2026-08-31, it is
false. `grep -c ledger` over `ObsidianZoneRepository.ts` and `ObsidianPlanRepository.ts` returns
**0** for both — neither records anything. The only recording on their path is `noteIo.ts:315`,
inside `openNoteById`, and it records **only the migration error**; every later refusal in
`loadOne` records nothing. `ObsidianProjectRepository:91` records at `readEntity` level, catching
migration *and* frontmatter failures, which is why the project fix was sound and why the analogy
does not carry.

So each repository **records the refusal into the ledger at the point of skipping**, before
incrementing the count. Without it, this increment's entire argument fails for the commonest
refusals: an entity vanishes from the listing, the count says so, and the diagnostics report the
user is then told to open has no row for it.

**The residue, named rather than implied:** a `getById` refusal reached OUTSIDE a listing — the
Inspector reading one zone — still records nothing for zone and plan, where the project
repository would. That is pre-existing, wider than this increment, and left alone; what this
increment owes is that every note it *skips* is findable, and that is what the recording at the
skip site guarantees.

The in-memory repositories answer `refused: 0` always. That is honest rather than a stub —
they hold entities, not notes, and have no parse step to refuse at.

### 2. The policy lives in the consumer, not in the listing

Three application queries read these listings, and they must not get the same answer. This is
the increment's one real decision.

| Consumer | Feeds | Policy |
| --- | --- | --- |
| `FindZonesByPlan` | Plan Editor canvas | Carries `refused` |
| `ListPlansByProject` | Project detail state | Carries `refused` |
| `ListReassignmentTargets` | Delete flow's reassignment picker | **Keeps failing fast** |

The third is deliberate. That picker exists to offer a **complete** set of zones to reassign a
Requirement to *before a zone is deleted*. An incomplete picker, silently, is how a user
reassigns to the wrong zone and then deletes — a destructive silence, unlike a canvas that
draws nineteen zones instead of twenty and says so. So the repository hands back both halves
and each consumer decides: **skip-and-count is a reading policy, not a property of the
listing.**

The alternative — carrying the count into the picker as a warning row — is more useful and
reopens design slice 15's dialog-row vocabulary inside a correctness increment. Declined here
and recorded as the follow-up.

Two sibling rules disagreeing on purpose read as an oversight when their tests sit apart, so
the reassignment case lives **adjacent** to the zone-listing cases under a header saying why.

### 3. The two surfaces

Both already have the receiving shape; this follows precedent rather than inventing one.

**Plan Editor.** `ProjectStore` gains `unreadableZones`, written on every successful hydrate
beside `zones` and cleared the same way. `PlanEditorRoot` draws a counted `.rp-editor-notice`
as its **own `v-if`** — never chained into the background `missing`/`unreadable` chain. That
file carries a comment recording what chaining an independent condition cost last time: a
failed read-back silently swallowed the sentence explaining an absent background, *"two
unrelated failures, one of them silently swallowing the other."*

**Project detail.** `ProjectDetailStore` gains `unreadablePlans`; the count travels to
`ProjectDetail`'s plans region as a prop and draws the same strip.

Both sentences interpolate the count. Both are `role="status"`, matching the strips beside them.

### 4. The diagnostics report

**The door.** Design slice 15's `DialogHost` cannot serve this: it is scoped to an ItemView's
Vue app, and a palette command has no such host when no view is open. Rather than build a third
Vue mount point — the plugin-global app SDD §12 would need an exception for, which slice 13
deliberately never built — the report is a **plain-DOM Obsidian `Modal`** in `src/plugin/`,
built with `createDiv`/`createEl` the way the notice live regions and the settings pane already
are.

Reached two ways, both calling one function per the one-action-every-input rule:

- a `show-diagnostics-report` command, and
- an ACTION row in the settings pane, beside slice 19's library-migration row.

`I18N_LITERAL_BAN` already watches `.setText` and `createEl`'s `text:` option, so every string
in it goes through `t()` by gate rather than by convention.

**The path join.** `DiagnosticsLedger` stays provably content-free: the five `@ts-expect-error`
directives in `tests/application/ports/diagnostics.test-d.ts` are untouched, and no name or
path enters it. The modal is handed a `resolvePath(id)` closing over the project index and
joins **at render time**, so:

- the rendered row shows the note's path, and the user can open it;
- the **copied** payload is the snapshot as the query produced it, with no path in it.

What is shown and what is exported deliberately differ. That asymmetry is stated where the code
is and pinned by a test — a convention with no test is one edit from being false.

**The copy action.** `navigator.clipboard.writeText`, in `src/plugin/`. SDD §86 forbids the
plugin transmitting a snapshot; a user exporting one themselves is exactly what it permits. The
lint rule keeping diagnostics on the device covers `infrastructure/logging/` and
`application/queries/`, and the clipboard is neither network nor in those directories.

## Limitations, recorded rather than closed

Both are written where the code is, not only here.

- **The ledger is session-scoped and in-memory**, bounded at `MAX_ISSUES = 200` (`infrastructure/logging/diagnosticsLedger.ts:19`) with
  oldest-first eviction and dedup on `(kind, id, code)`. Restart the vault and the report is
  empty until the reads happen again. Coherent — a strip appears on a read and the report
  explains that read — and a user who reopens the plugin the next day and goes straight to the
  report sees nothing.
- **A strip's count and the report's rows can disagree.** The strip counts one listing; the
  report holds every refusal this session. Stating that costs a sentence; reconciling it costs a
  design.

## Not in scope

- **Whether a future-version note may be deleted.** [[A future-version note can be neither read
  nor deleted]] is a policy decision about `trashNoteBackedEntity`'s ordering, weighed and
  declined once already. This increment gives that user the *place that says which note and
  why*, which is half of what the Issue asks for, and takes no position on the refusal.
- **A warning row in the reassignment picker.** See §2.
- **The count on the project listing.** `ViewRoot`'s sentence stays count-free in this
  increment; interpolating it is a one-key change that belongs with whoever next edits that
  copy, and doing it here would put a third surface's wording in a change about two.
- **`PlanCanvas.vue`'s line budget.** Being extracted on PR #43.

## Persistence impact

None. Every change is on the read path. No schema version moves, no note is written, no
migration is registered.

## Testing strategy

Each case watched failing against the un-fixed code, and the mutation named.

| What | Level | Mutation that must redden it |
| --- | --- | --- |
| Zone listing skips, both entry points | Disk-backed fixture vault | Restore `if (!one.ok) return one` |
| A **post-migration** validation failure is skipped AND recorded | Disk-backed fixture vault | Drop the `ledger.record` at the skip site |
| An unreadable **sidecar** still fails the whole listing | Disk-backed fixture vault | Add `zone.sidecar-unreadable` to the skippable set |
| Plan listing skips | Disk-backed fixture vault | Same |
| Count reaches the canvas strip | jsdom, rendered DOM | Drop the field from the template |
| Count reaches the detail strip | jsdom, rendered DOM | Same |
| Reassignment picker still fails fast | node | Route it through the listing's `loaded` |
| Copied payload holds no path; rendered row does | node + jsdom | Swap either half |
| The report is reachable from both doors | `tests/plugin/` | Delete either registration |

**A corrupt `schema-version` is the ONE refusal that already records, so a test using only that
input passes while the gap in 1b stands.** This spec's own first draft did exactly that. Every
skip-and-count case therefore drives a **post-migration** failure — a current-schema note whose
frontmatter fails the mapper — as well as a version one.

**The refusal must be produced, not stubbed.** A repository fake that cannot fail to parse a
note proves nothing about a listing that skips parse failures — this repository's own
fake-too-thin rule, and the reason these cases run against `openFixtureVault` rather than the
in-memory stack.

**Coverage.** Branches read 98.05% against a floor of 98 at design slice 19's close, and 98.10%
on PR #43's branch — roughly one to three covered branches of headroom either way, the tightest
this metric has been. Neither figure was re-measured for this spec; run `npm run test:coverage`
before trusting one. Every new arm gets its test written with it, and
`coverage-final.json` is read for the **changed files** rather than the summary line, which
cannot see a single arm.

**A manual case.** `docs/tests/cases/` gains one: no gate here draws either strip, and the
browser harness cannot produce a refusing note. It is the only instrument for what the strips
and the report look like.

## Definition of done

1. `ZoneListing` and `PlanListing` exist; both Obsidian repositories skip and count **only
   entity-local refusals**, propagating a shared sidecar failure; both record each skipped
   refusal into the ledger before counting it; both in-memory repositories answer `refused: 0`.
2. `FindZonesByPlan` and `ListPlansByProject` carry the count to their stores;
   `ListReassignmentTargets` still refuses, with its reason in the code and its case beside the
   others.
3. The Plan Editor and the project detail state each draw a counted strip, each as its own
   `v-if`, each `role="status"`, each in both locales.
4. `show-diagnostics-report` and the settings ACTION row both reach one function; the modal
   renders versions, schema versions, migration state and this session's refusals; a row shows
   its note's path.
5. The copy action puts the snapshot on the clipboard **without** the path, and a test asserts
   both halves.
6. `diagnostics.test-d.ts` is unchanged — the ledger's content-free proof still holds.
7. Both limitations are written where the code is.
8. The manual case is written.
9. `ObsidianZoneRepository`'s docblock no longer names a `findByProject` that does not exist.
10. `npm run check` green.

## References

- SDD §68 (the content-free snapshot), §86 (the plugin never transmits), §92 item 13 (a
  refusal is scoped to one note), §12 (two workspace surfaces, one Vue app each)
- `docs/issues/One unreadable zone note blanks every zone on the canvas.md`
- `docs/issues/The diagnostics snapshot has no surface that reaches it.md`
- `docs/issues/A future-version note can be neither read nor deleted.md`
- `application/ports/ProjectRepository.ts` — the `ProjectListing` precedent
- `presentation/views/ViewRoot.vue` — the `.rp-view-notice` precedent
- `presentation/editor/PlanEditorRoot.vue` — the `.rp-editor-notice` precedent and the
  chaining comment

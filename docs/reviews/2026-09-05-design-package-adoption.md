# Adoption: the two design packages of 2026-09-05, item by item

`d00e9993` brought two externally-produced packages into `docs/user-experience/` and archived the
two design specifications the current surfaces were built from. This ledger is the record of what
happened to each of their proposed items, so a reader who opens either package and finds `PBI-07`
can discover its disposition without re-deriving it.

**Why a ledger and not a note per item.** The twenty-eight proposed PBIs produced **six** backlog
notes, and EN-01's own boundary produced a seventh — so seven notes in total, and the split matters
because six is the number a reader checking this ledger against the two packages' PBI tables will
count. The other twenty-two are met, changed, or folded, and each of those is a *finding about the
package* rather than work somebody is scheduled to do — which is this folder's subject and not the
register's. Recording them as notes would file twenty-two descriptions of existing behaviour as a
backlog.

**What this is not.** No item below was verified by running the suite: `node_modules` was empty in
the session that produced this, so every *met* verdict rests on reading the shipped module named
beside it. That is stronger evidence than either package had — both were written without being
rechecked against a commit and both say so — and it is weaker than a green gate.

## Method

Each item was read against the module that would implement it. A verdict is one of four:

- **Met** — the behaviour ships. The evidence column names where.
- **Change** — the item is a deliberate change to shipped behaviour, not a gap. It becomes a
  decision before it can become work.
- **Folded** — the item is a consequence of a *Change* above it and has no independent existence
  until that decision is taken.
- **Gap** — nothing implements it and nothing owns it. These are six of the seven notes; the
  seventh comes from EN-01's boundary rather than from any PBI.

## `asset-library-delivery` — 18 PBIs, 2 enablers

| ID | Verdict | Evidence or destination |
| --- | --- | --- |
| PBI-01 Open and resume the library | Met | `revealView`'s singleton coalescing; `AssetLibraryContext` restores `assetId` and `expanded` from Obsidian's own view state |
| PBI-02 Compare and select in groups | Met | `AssetShelves`; `AssetSelectionStore`'s ticketed sections drop a late result whose ticket is stale — this PBI's own acceptance scenario |
| PBI-03 Find by name, supplier or SKU | Met | `AssetLibraryStore` matches exactly those three and never notes |
| PBI-04 Inspect the full definition | Met | `AssetInspectorFields`' nine fields, including height and explicit currency |
| PBI-05 Explicit Save/Discard | **Change** | Ships nine per-field `useFieldCommit` bindings. → [[A field edit commits on blur, and two design packages ask for an explicit Apply]] |
| PBI-06 Switch without losing input | Folded | No draft exists to protect until PBI-05 is decided |
| PBI-07 Library price vs project overrides | Met | The override is a separate entity; setting one leaves `unitCost` untouched |
| PBI-08 Unit and waste allowance | Met | `asset.unit-kind-referenced` refuses an incompatible unit on a referenced asset; the waste field carries two refusal codes |
| PBI-09 Create without a project | Met | `New asset` → `NewAssetForm`, reachable in a vault with no projects |
| PBI-10 Usage and price source | Met | `ListRequirementsReferencing` and `ListOverridingProjects`, composed into one region |
| PBI-11 Navigate to note or project | Met | `AssetInspector`'s `Open note`, which handles a `missing` outcome rather than assuming the path |
| PBI-12 Outline and open in designer | Met | `AssetInspectorShape`; `Open designer` is withdrawn for every design refusal rather than offered inert |
| PBI-13 Keep content after a read failure | Met | Ticketed sections keep prior content; re-selecting is the retry, deliberately unguarded for that reason |
| PBI-14 Continue after save failure | Folded | The write/read-back distinction ships; the conflict half is PBI-05's |
| PBI-15 Narrow panels and host themes | Met | The 35rem container swap, its back control and its focus handoff |
| PBI-16 Keyboard-only operation | Met | `shelfFocus.ts` — one focus manager over the region, not a handler per shelf |
| PBI-17 Delete an unused asset | Met | `deleteAssetFlow` → `deleteWithReferences`; the referent set is re-checked as a set at commit, which is this PBI's acceptance scenario |
| PBI-18 Native notes and Bases | **Gap** | → [[Reach the asset catalogue without this plugin's own view]], gated on [[What discharges the catalogue's Bases access is undecided]] |
| EN-01 Consolidate existing contracts | Discharged in part | This ledger is its delta classification. Its field-by-field contract matrix is not written and is still owed by whoever takes PBI-05 |
| EN-02 Saving and conflicts | Folded | Only needed if PBI-05 is taken |

**One finding of EN-01's own boundary became a note.** It asks that unknown values not be silently
destroyed, and one is: `kebabEnum` returns `z.NEVER` for a category outside the seven, so the note
fails to parse and the asset disappears. → [[Keep an unrecognised asset category as written]].

**F01–F05 are not adopted.** They are the package's own planning aids; the four Features under
[[Asset library]] already carry the same ground, and a second set would give one body of work two
parents.

**Amended 2026-09-05, later the same day.** Pull request #70 (`codex/asset-library-delivery`)
implemented the package against this table's verdicts, and all eighteen PBIs were then adopted into
`docs/requirements/` as register-shaped notes under the two existing Features — so a `PBI-NN` in this
table resolves through the **Sources** footer of the note carrying that id, and the two Gap/Change
notes this ledger produced ([[Reach the asset catalogue without this plugin's own view]] and the
Apply issue) each point at their adopted counterpart. The verdicts above are the state before that
branch and are left as written.

## `renovation-planner-project-specs` — 10 PBIs

| ID | Verdict | Evidence or destination |
| --- | --- | --- |
| PBI-01 Return with search context | **Gap** | → [[Return to the project list with my search context]] |
| PBI-02 Start a new project immediately | **Gap** | → [[Enter a project immediately after creating it]] |
| PBI-03 Freely choose the next action | Met in part | The detail state draws note, plans and prices, and `unreadablePlans` is carried through the store and drawn — so *"unreadable plans are not concealed as No plans yet"* holds. The guidance panel is a **design proposal**, not a gap, and is not written as an item |
| PBI-04 Resume deliberately | **Gap** | → [[Resume the last plan on a confirmed opening]] |
| PBI-05 Continue when unavailable | **Gap** | → [[Continue when the last plan is unavailable]] |
| PBI-06 Understand price sources | Met | `ListProjectAssetPrices`; library price, project price and the recorded figure are drawn side by side with the one in force marked |
| PBI-07 Apply or discard a price | **Change** | Same decision as asset PBI-05 |
| PBI-08 Remove a saved price | Met | The clear path targets the override and its expected version, not the catalogue asset |
| PBI-09 Continue after price errors | Folded | Tickets and the save-state distinction ship; the dirty-navigation guard is PBI-07's |
| PBI-10 Narrow views and mobile | Split | Narrow is met by the container queries both surfaces carry. **Mobile is a gap** → [[Bound the mobile surface to what it can actually do]] |

**Amended 2026-09-05, later the same day.** Pull request #73 (`codex/project-experience`) implemented
this package, and the five items above that were *Met*, *Change* or *Folded* are now register notes
beside the five gaps, all under [[Project dashboard and navigation]]: [[Choose the next step from a
project's details]] (03), [[Understand a project's price sources]] (06), [[Apply or discard a project's
own price deliberately]] (07), [[Remove a saved project price]] (08) and [[Continue safely after a
price error or a parallel change]] (09). The verdicts above are the state before that branch and are
left as written.

**The proposed epic *Start and continue renovation projects* is not adopted.** The register already
routes this surface through [[Project dashboard and navigation]] → [[The project surface]], and a
second epic over the same ground would be a third authority for one fact.

## The two decisions, and why neither was taken here

Both packages independently propose replacing blur/Enter commit with an explicit Apply, and neither
noticed the other was asking. `useFieldCommit` is shared with the Plan Editor Inspector, so it is
not a per-surface preference — which is why it is [[A field edit commits on blur, and two design packages ask for an explicit Apply]] rather than two items. Five proposals across the two packages
are different spellings of its answer.

The second is narrower than it looks. [[The alternative list route is a Bases view]] already decided
*that* the route is a Bases view; what nobody has decided is what has to ship for it to be
reachable, and the three candidates differ in what a test can assert. Hence
[[What discharges the catalogue's Bases access is undecided]].

## Numbering

Both packages number their PBIs `01`…`10`, so the two sets collide. This register addresses notes by
**basename**, which dissolves the collision rather than resolving it — but only for notes. Inside
this ledger and inside each package, an ID is meaningful only with its package named, and every
reference above carries one.

## Project-surface implementation follow-through

The tables above preserve the adoption baseline. The project-plan implementation now supplies leaf-local return context, direct created-ID entry, optional guidance and an explicit project-price subsection with guarded drafts. The corresponding PBIs are Active pending their remaining acceptance work; they are not recorded as Done merely because UI code exists.

The strict Resume PBI still requires editor load confirmation beyond host leaf opening. The unavailable-target PBI still requires clearing a missing-project target. The mobile PBI still requires its plugin-wide disabled-with-reason policy and real-device measurement. The shared Apply issue records the project-price decision without changing the shared hook or claiming the Asset Library work.

Current contracts, automated evidence and live-host blockers are in the [project execution record](../user-experience/renovation-planner-project-specs/implementation/execution-record.md).

# Working with saved data and recoverable drafts

The Plan editor stores project records in vault notes and geometry sidecars. Keep a separate
backup of the whole vault before trying a pre-release build: what it has to contain, how to
restore it and what a restore cannot do are in [Back up and restore](#back-up-and-restore).
Restoring only a Plan note can leave its geometry or references from another point in time.
What this build does not do or has not been checked to do is in
[Known limitations](known-limitations.md).

## Saved · refresh needed

After an edit, this means the edit was written but the editor could not read the updated data.
The qualifier can also appear when an existing Plan's planning data cannot first load.
The canvas and planning panels retain their last valid content where available. Read the persistent warning, use
**Open source note** to inspect the owning Plan, and choose **Try again**. The retry only
reads saved data; it never submits the successful edit again.

Repeated failures leave the warning visible. You can inspect records and navigate between
rooms and planning views. Editing pauses where it requires stale data. Planning read failure
also pauses Undo/Redo; after a successful refresh those actions return. Spatial-only stale
geometry retains the existing version-checked snapshot history where it is safe.

If a form was already open, its draft stays attached to the target you opened it for. You can
copy or revise its text, retry the read inside the dialog, or Cancel. Recovery does not apply
the draft. Apply still checks its captured baseline and refuses a conflicting peer edit.
Close and reopen a conflicting draft against current data before re-entering the intended
change; it is never silently moved to another selected room or record.

## A refused write or incomplete recovery

A validation refusal has not saved the proposed edit. A save error means the write did not
complete successfully; the form retains its draft where possible. A conflict message means
the target or baseline changed and needs review. These are different from a confirmed save
whose read-back failed.

An incomplete-write warning means a multi-file operation could neither finish nor undo its
partial writes. Inspect the Plan note and related geometry against your backup before making
further changes. When the half-written record is a room, the warning says so and its **Open
source note** button opens that room's note instead; the room also counts as one that could not
be read until it is repaired or removed. A tab reopened after Obsidian restarts no longer knows
which room it was, and points at the Plan note. This pauses writing everywhere in the vault, not only in the tab that raised
it — most of what the plugin offers as a command or form is refused until the incident is
resolved. Not everything is inside this pause. The plugin checks for an open incident at two
kinds of step — where it runs a command, and where the Plan editor or the Asset designer runs
an Undo or Redo — so anything that writes without passing one of those checks is not refused.
Because of the second, undoing a zone deletion, an asset assignment or a quantity or cost
override is paused along with everything else. What still writes straight to its target without
passing either check is the link update the plugin makes when you rename or move a file the plan
links to as evidence. That is an example rather than a boundary: nothing in the plugin lists or
checks what sits outside the pause, so do not read this as a complete list. An action outside
the pause is not refused, but it is not unwatched either: the plugin records an incident at the
moment any of its writes notices that it left files half-written, whichever action made the
write, and every checked write is refused from then on. What it cannot record is a half-write it did
not notice — not every failure is detected where it happens — or one noticed while the plugin is
disabled, after it unloads and before it loads again, unless the plugin was still counting a save
that started before the unload — so this warning is not guaranteed to appear for every partial
write.
So do not read
any single action still working as proof the incident has cleared, and do not treat a quiet
failure in one of those actions as nothing having happened. Stop making changes anywhere in the
vault and inspect the affected files against your backup instead. Reading, navigating and
inspecting still work: that is deliberate, because comparing the affected files against your
backup is the recovery, and a plugin that also blocked reading would take away the one tool you
have for it.

Nothing clears this on its own. A successful read does not repair those files, a later
successful write elsewhere is not evidence that the affected ones were mended, and saving
plugin settings does not lose it. Neither does closing the tab, reloading the plugin or
restarting Obsidian — the record lives in a file in the plugin's own folder, not in the tab or
the running session, and it outlives all three. A restart is not an all-clear here.

Ending an incident is therefore something you do, not something the plugin decides. There is no
"I have repaired this" control, because nothing here can tell a write that mended the affected
files from any other write that happened to land. Once you have checked the affected files
against your backup, remove `write-incidents.json` from the plugin's folder — it is the
plugin's own bookkeeping file, not vault content — and then reload the plugin, or restart
Obsidian. Both steps are needed: the plugin reads that file once, when it loads, so until it
loads again it goes on refusing writes from what it read at startup, and a retry before the
reload simply repeats the same message. Do not keep working in between — deleting the file and
carrying on without reloading leaves the plugin blocking on a record that is no longer on disk,
and anything recorded after that point is written to a fresh file that no longer mentions the
incident you just removed.
Clearing it that way proves **nothing** about the vault; your own inspection is what does. If
that file is edited by hand into something the plugin cannot read, that counts as an open
incident too, on purpose, so a corrupted record can never be mistaken for an all-clear —
deleting it is the supported way to end an incident, editing it is not.

The list of affected files an incident names is best effort. Some failures cannot name
everything they touched, so an incident's list may under-report; inspect around what it names
rather than treating it as exhaustive. The diagnostics report, reached from settings and from
the command palette, lists every open incident and names the file to remove.

Nothing here repairs anything, replays the interrupted operation, or rolls it back
automatically — a restart never re-runs what was interrupted. There is no general durable
crash-recovery journal for these planning operations: this is a durable
*record* that a half-write happened, not a journal that could undo one. The existing
specialized requirement-sequence recovery mechanism remains separate — it exists to roll back
an interrupted delete and carries the deleted content to do it, where this record carries no
content and rolls nothing back.

That separate mechanism can hold a recovery record this build does not understand — one written
by a newer version of the plugin, or one edited by hand into a shape it cannot read. Such a
record is left exactly as it is. Nothing is replayed from it, because rolling back from a shape
the plugin could not read could write the wrong content over your requirements; and nothing is
removed, because a record it could not read is not a record it can declare finished. It is
reported to the developer console when the plugin loads, and it is not shown anywhere in the
plugin's own screens. Deleting the same item again is refused while its record is outstanding,
so that a rollback this build cannot finish is never written over.

The remedy depends on which of the two it is, and only one of them has a newer build to wait for.
A record written by a newer version of the plugin is read by that version: run a build at least as
new as the one that wrote it, and it reads the record and completes the rollback. A record edited
by hand into a shape nothing can read has no such remedy — no version will ever read it, because
there is no version it was written by. Treat it the way you would a corrupted incident record:
check the affected files against your backup first, then remove `sequence-markers.json` from the
plugin's folder and reload the plugin or restart Obsidian. Removing that file ends every recovery
record in it, including any the plugin could still have completed, and it repairs nothing on its
own — your inspection is what does. Until you act, nothing is lost and nothing is acted on, and
the rest of your vault's recovery records are unaffected.

An open draft in this state offers source-note inspection and Cancel. It does not offer a
read retry or promise that reading will resume Apply. You can copy its retained text before
cancelling and reviewing the affected files against your backup.

An Undo in the Asset designer that another change overtook — a second pane, the asset library,
or a sync changing the same asset between your edit and your Undo — is refused with a message
that the change was edited elsewhere after this step, and that you can reload and undo again.
That is not an incident: writing is not paused and the tab's save indicator is left alone. In
one rare case — two other writers changing a calibrated asset during the Undo — the asset can be
left without its calibration behind that same message, so check its scale if you see it there. A
delete or a write failure in the same moment can instead show a save error or open an incident.

For the connected editing journey, see [Plan a renovation from the floor](using-plan-editor.md).

## Quantities, costs and files

English and German displays use their decimal and grouping conventions. Editable quantities,
budgets and financial facts accept either a decimal point or comma, without thousands
separators. For example, enter `1234,50`, not `1.234,50`. Currency codes stay visible; decimal
calculations, manual overrides and source measurements keep their existing meaning.

A source measurement can change while pack rounding leaves the same purchase quantity.
Such an estimate is still marked stale. Review its calculation and explicitly recalculate it
before using generated shopping content or automatic cost totals. Purchased and reserved
quantities are separate allocations, not evidence of payment or completed work.

Evidence remains an ordinary vault file. Moving a linked file or folder updates affected
links through version-checked Plan writes. A missing image can recover when its file becomes
available again. Unlink removes the relationship, not the user's file.

## Existing vaults

There is no single schema version for a vault. Each kind of note and file carries its own, and
the tables below say what this build does with each one. A number is a schema version.

- **Opening is not a rewrite.** An older version is upgraded in memory when it is read, and
  nothing is written back because a note or sidecar was opened (`legacyReadBytes.test.ts`
  compares every byte of a legacy vault before and after reading a Project, Plan, Room, Asset
  and both sidecars).
- **A save stamps the lowest version the content needs**, where the Writes cell says "by
  content". A Plan that uses nothing newer is still written at 1, so an older build can go on
  reading it, and a Plan that uses something newer is written at a version an older build
  refuses rather than one it would read and then silently drop part of.
- **A version newer than this build is refused**, with the code in the table, and nothing is
  written. The check is on the read. An Asset, Asset price or Requirement delete reads the
  note first and refuses too (`errorPaths.test.ts` pins the Asset case). A Plan or Room delete
  is protected the way a save is: its command loads the note first. A save does not check
  again: what keeps a refused note from being overwritten is that commands load a note before
  they save it, and no test checks that for every command. `errorPaths.test.ts` pins both the
  refusing delete and a save that skipped the load and overwrote.
- **A note with no `schema-version` is refused** (`migration.chain-gap`), because no version
  starts below 1.
- **A save keeps what the plugin does not own.** An update changes the plugin's own
  frontmatter keys through Obsidian and leaves the note's body, and the values of frontmatter
  keys the plugin does not own, as they were.
- **Open a vault with a build at least as new as the newest one that has written to it.** A
  build that has the reader refuses notes it cannot read, but a settings change made in it drops settings a
  newer build added.

`tests/release/dataCompatibility.test.ts` holds the first table's set of rows and its Reads,
Writes and "Newer than this build" cells, the Reads and Writes of the three rows in the second
table, and the Settings Fields, against the plugin's migration table, mappers and stores. A
version changed in the code without an edit here fails it. It does not check the Record,
Version field, Where or Code columns, the second table's "Another version" column or which
rows it has, the rest of the third table, or the prose.

### Notes and sidecars in the vault

| Record | Key | Version field | Reads | Writes | Newer than this build | Code |
| --- | --- | --- | --- | --- | --- | --- |
| Project note | `project` | `schema-version` | 1 | always 1 | refused: `project.schema-version-unsupported` | `projectToPersistence` |
| Plan note | `plan` | `schema-version` | 1–12 | 1–12 by content | refused: `plan.schema-version-unsupported` | `planSchemaVersion` |
| Room note | `zone` | `schema-version` | 1–2 | 1–2 by content | refused: `zone.schema-version-unsupported` | `zoneToPersistence` (2 only while locked) |
| Requirement note | `requirement` | `schema-version` | 1–5 | 1–5 by content | refused: `requirement.schema-version-unsupported` | `requirementSchemaVersion` |
| Asset note | `asset` | `schema-version` | 1 | always 1 | refused: `asset.schema-version-unsupported` | `assetToPersistence` |
| Asset price note | `asset-price` | `schema-version` | 1 | always 1 | refused: `asset-price.schema-version-unsupported` | `assetPriceToPersistence` |
| Trade note | `trade` | `schema-version` | 1 | always 1 | refused: `trade.schema-version-unsupported` | `TRADE_MAPPER` |
| Supplier note | `supplier` | `schema-version` | 1 | always 1 | refused: `supplier.schema-version-unsupported` | `SUPPLIER_MAPPER` |
| Quote note | `quote` | `schema-version` | 1 | always 1 | refused: `quote.schema-version-unsupported` | `quoteToPersistence` |
| Plan geometry (`Geometry/<plan id>.rpgeo` in the project folder) | `plan-geometry` | `schemaVersion` | 1–16 | 1–16 by content | refused: `plan-geometry.schema-version-unsupported` | `PlanGeometryStore` |
| Asset geometry (`Geometry/<asset id>.rpgeo` in the library folder) | `asset-geometry` | `schemaVersion` | 1–4 | always 4 | refused: `asset-geometry.schema-invalid` | `AssetGeometrySchema`, `AssetGeometryStore` |

The upgrades run in memory, in `MigrationRunner` for every row but asset geometry. The Plan,
Room and Requirement steps and all but one plan geometry step only raise the version number.
The exception is plan geometry 12 → 13 (`migrateWallSides`), which gives each wall two face
distances of half its thickness. Asset geometry 1, 2 and 3 → 4 (`AssetGeometrySchema`) reads an
older file as version 4, every field added since defaulting to what an older file meant (no
details, closed graphics, no groups, a clearance not flagged for review); its newer-version refusal is a schema failure
rather than a migration one, so it reads as damaged data rather than as "this build is too old".

### Files the plugin keeps for itself

| Record | Key | Where | Reads | Writes | Another version |
| --- | --- | --- | --- | --- | --- |
| Delete recovery markers | `sequence-markers` | `sequence-markers.json` in the plugin folder | 1 | always 1 | kept as written and reported as unreadable (per entry; the file's own version is not checked and is written as 1); a new marker for the same item is refused (`sequence.marker-write-blocked`) |
| Write incidents | `write-incidents` | `write-incidents.json` in the plugin folder | 1 | always 1 | kept as written and counted as an open incident this build cannot read (per entry; the file's own version is not checked and is written as 1) |
| Continue context | `continue-context` | this device's local storage, not the vault | 1 | always 1 | ignored, so there is no Continue row; the next visit replaces it |

### Stored without a version

| Record | Where | Fields | What this build does with it |
| --- | --- | --- | --- |
| Settings | `data.json` in the plugin folder | `units`, `projectFolder`, `libraryFolder`, `defaultCurrency`, `verboseLogging` | A value outside a field's choices reads as the default. Any other key is dropped when read and is gone from the file after the next settings change, including a key a newer build added. |
| Grid and snapping choices, panel widths | this device's local storage | — | A value of the wrong type, or a width out of range, reads as the default. |
| Review and Shopping notes | beside the plan note when first generated; they stay there if the plan note is moved | — | Generated. If someone edited one, regenerating it is refused rather than overwriting the edit. |
| Evidence files | where they were added | — | Ordinary vault files. Unlinking removes the link, not the file. |
| Open tabs | Obsidian's workspace layout | `planId`, `origin`, `unrecoveredWrite` (Plan editor); `projectId`, `section`, `origin` (Renovation project); `assetId` (Asset designer); `assetId`, `expanded` (Asset library) | Which project, plan or asset a tab shows, and whether a plan tab saw an unrecovered write. |

## Back up and restore

A backup is only useful if every file it holds comes from **the same moment**. The plugin's
records point at each other across files — a Plan note and its geometry sidecar, a placement and
the asset it places, a requirement and the room it is measured from — so a set copied at
different times can disagree even when every file in it is valid on its own.

### What a coherent backup contains

The simplest coherent backup is a copy of the **whole vault folder, including its `.obsidian`
folder**, taken while Obsidian is closed.

**Keep the backup outside the vault.** The plugin finds its notes by what they declare in their
properties, not by which folder they sit in, so a copy of the notes kept as ordinary notes inside the vault is read as a
second set of the same notes, with the same ids, and the plugin may then edit the copy instead of
the original.

If you back up less than the whole vault, it must still contain all of the following, from one
moment:

- **Each project's folder, in full** — the folder holding its `Project.md`. That covers the Plan,
  Room, Requirement, Asset price and Quote notes, the `Geometry/` folder with each plan's `.rpgeo`
  sidecar, the generated Review and Shopping notes, and the `Evidence/` folder where imported
  files and evidence notes are created — **and any of the project's notes or `.rpgeo` files you
  have moved out of that folder**, and the Review, Shopping and `Evidence/` files wherever they
  were generated. A moved note still belongs to its project: each Plan, Room, Requirement, Asset
  price and Quote note carries the project's id in its `project` property, the same value as the
  `id` property in `Project.md`. A Review or Shopping note has no `project` property. Its file
  name is `Review-` or `Shopping-` followed by a code derived from the plan's id, and it stays in
  the folder where it was first generated, even if you move the plan note afterwards — so keep
  every `Review-…` and `Shopping-…` note and `Evidence/` folder from wherever it sits. The first
  line of a Review or Shopping note starts `<!-- rp-review:` or `<!-- rp-shopping:`.
- **The asset library folder, in full** (`Renovation/Library` unless you changed it in settings).
  It holds the Asset notes, each asset's `.rpgeo` sidecar in its own `Geometry/` folder, and the
  Trade and Supplier notes — and any of those you have moved elsewhere in the vault, for the same
  reason. The library is shared by every project in the vault, so restoring a
  project without the library from the same moment can leave placements and requirements pointing
  at asset definitions or shapes from another time.
- **Every file a plan links to that lives outside those folders** — a reference image or PDF
  chosen from elsewhere in the vault, and evidence files you linked rather than imported.
- **The plugin's folder**, `.obsidian/plugins/renovation-planner/`: `data.json` (settings,
  including the library folder and the folder new projects are created in), `write-incidents.json` (open write
  incidents) and `sequence-markers.json` (delete-recovery records). Either of the last two may be
  absent, which means it holds nothing. They describe the vault files beside them, so they belong to the
  same moment as those files.

Not in the vault, and therefore not in a vault backup: what this device keeps in local storage —
the Continue row's last target, grid and snapping choices and panel widths. Losing it loses those
preferences and nothing else. Obsidian's own workspace layout (`.obsidian/workspace.json`) records
which tabs were open, including whether a Plan editor tab saw an unrecovered write.

### Restoring

1. **Quit Obsidian first, and pause any sync client for the vault.** The plugin reads its incident
   record once, when it loads, and it follows vault changes while it runs; replacing files
   underneath a running plugin gives it a mixture to react to. A sync client left running can copy
   the newer files back over the ones you restored.
2. **Restore the whole set from one backup**, replacing rather than merging. Do not combine notes
   from one backup with sidecars, library files or plugin-folder files from another.
3. **Open the vault with a plugin build at least as new as the newest build that wrote to that
   backup, and never with a build older than this one** (see [Existing vaults](#existing-vaults)
   and the section below). A build that has the reader refuses notes it cannot read.
4. **Check what the plugin reports.** Open each project and its plans, and the asset library,
   first: the report lists only the notes the plugin has tried to read. Then run **Show diagnostics
   report** from the command palette or settings: it lists the notes this build has refused to read
   since it loaded, and every open write incident. An incident
   restored with the backup is still open, and ends only as described in
   [A refused write or incomplete recovery](#a-refused-write-or-incomplete-recovery).

### What a restore cannot do

- **It cannot be partial without risk.** Restoring one note, one project or the library alone
  is the mixed-moment case above. This guide does not describe what each mixture does, because no
  test drives one.
- **A clean report is not proof the restore is whole.** The diagnostics report says what this
  build could read, not that the files agree with each other or with your intent. Opening,
  reading, reopening a tab and reloading the plugin repair nothing. Compare what matters to you
  against the backup yourself.
- **It recovers nothing written after the backup.** Changes made since are gone from the restored
  copy.

### A binary downgrade is not a data rollback

Installing an older plugin build does not turn your data back into what that build wrote. Notes
and sidecars stay exactly as the newer build left them. A build at least as new as this one,
reading records a newer build wrote:

- refuses every note or plan sidecar stamped with a version newer than it knows, with the
  `…schema-version-unsupported` code in the [Existing vaults](#existing-vaults) table, and writes
  nothing to it — an asset sidecar it does not know reads as damaged
  (`asset-geometry.schema-invalid`) rather than as too new;
- keeps incident and delete-recovery entries it cannot read, and counts such an incident as open;
- drops every setting it does not know the next time you change a setting in it.

A build older than this one may do less. One from before 2026-09-16 does not read
`write-incidents.json` at all, so it does not pause for an incident a newer build recorded. No
release has been cut yet, so every older build is an unreleased development build.

To get data back to an earlier state, restore a backup taken before the newer build wrote to it,
and open it with a build at least as new as the one that wrote that backup.

## Older evidence

The [Increment E report](user-experience/renovation-planner-editor-specs/implementation/planning-recovery-evidence.md)
records browser and automated evidence for an earlier build. It is history, not acceptance of
this build; live Obsidian, assistive-technology and native zoom acceptance are tracked in
[first beta readiness](releases/first-beta-readiness/README.md).

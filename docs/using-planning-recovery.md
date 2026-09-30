# Working with saved data and recoverable drafts

The Plan editor stores project records in vault notes and geometry sidecars. Keep a separate
backup of the whole vault before trying a pre-release build, including `.rpgeo` files, the
asset library and linked evidence. Restoring only a Plan note can leave its geometry or
references from another point in time.

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
further changes. This pauses writing everywhere in the vault, not only in the tab that raised
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
- **Open a vault with a build at least as new as the newest one that has written to it.** An
  older build refuses notes it cannot read, but a settings change made in it drops settings a
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
| Asset geometry (`Geometry/<asset id>.rpgeo` in the library folder) | `asset-geometry` | `schemaVersion` | 1–2 | always 2 | refused: `asset-geometry.schema-invalid` | `AssetGeometrySchema`, `AssetGeometryStore` |

The upgrades run in memory, in `MigrationRunner` for every row but asset geometry. The Plan,
Room and Requirement steps and all but one plan geometry step only raise the version number.
The exception is plan geometry 12 → 13 (`migrateWallSides`), which gives each wall two face
distances of half its thickness. Asset geometry 1 → 2 (`AssetGeometrySchema`) reads a
version 1 file as version 2 with no details; its newer-version refusal is a schema failure
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
| Review and Shopping notes | beside the plan note | — | Generated. If someone edited one, regenerating it is refused rather than overwriting the edit. |
| Evidence files | where they were added | — | Ordinary vault files. Unlinking removes the link, not the file. |
| Open tabs | Obsidian's workspace layout | `planId`, `origin`, `unrecoveredWrite` (Plan editor); `projectId`, `section`, `origin` (Renovation project); `assetId` (Asset designer); `assetId`, `expanded` (Asset library) | Which project, plan or asset a tab shows, and whether a plan tab saw an unrecovered write. |

Browser and automated evidence is recorded in the
[Increment E report](user-experience/renovation-planner-editor-specs/implementation/planning-recovery-evidence.md).
Live Obsidian, assistive-technology and native zoom acceptance are tracked separately.

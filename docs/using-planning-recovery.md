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
further changes. Edits through that editor tab stay blocked while the warning stands. Nothing
clears it: a successful read does not repair those files, a later successful write is not
evidence that the affected ones were the ones mended, and saving plugin settings no longer
loses it either. The warning belongs to the editor tab that raised it, so it is still there
after a settings save and still there when you return to that tab. There is no general durable
crash-recovery journal for these planning operations.

Ending an incident is therefore something you do, not something the plugin decides. There is no
"I have repaired this" control, because nothing here can tell a write that mended the affected
files from any other write that happened to land. Once you have checked the Plan note and its
geometry against your backup, close that Plan editor tab and open the plan again: the plugin
opens a new tab carrying the plan and no warning. Clearing it that way proves **nothing** about
the vault — your inspection is what does. Two situations could bring the warning back by
restoring the tab's saved state rather than the plugin re-raising anything: reopening the
closed tab with Obsidian's own undo-close gesture instead of opening the plan afresh, and
restarting Obsidian onto a layout that still held the tab. Whether either one actually does is
not confirmed. Treat a returned warning exactly as before — it is not a fresh incident to
diagnose, but it is also not a reason to trust the tab any less than you already did. Treat its
absence the same way you treat clearing the tab in the first place: it proves nothing about the
vault either way, only your own inspection does. The existing specialized requirement-sequence
recovery mechanism remains separate.

An open draft in this state offers source-note inspection and Cancel. It does not offer a
read retry or promise that reading will resume Apply. You can copy its retained text before
cancelling and reviewing the affected files against your backup.

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
links through guarded Plan writes. A missing image can recover when its file becomes
available again. Unlink removes the relationship, not the user's file.

## Existing vaults

The combined editor reads Plan metadata through v12, Requirement metadata through v5 and
geometry through v16. A writer stamps a note or sidecar with the lowest of those versions its
actual content needs, not the ceiling by default — Shared Work/Evidence contexts use Plan v5
when no generic labels require v6. Older payloads retain their earlier persisted
versions; opening a Plan does not bulk-rewrite the vault. Unsupported future versions are
refused, and unrelated human-written note content is preserved. Use a build that understands
these formats before editing a vault containing the new element types.

Browser and automated evidence is recorded in the
[Increment E report](user-experience/renovation-planner-editor-specs/implementation/planning-recovery-evidence.md).
Live Obsidian, assistive-technology and native zoom acceptance are tracked separately.

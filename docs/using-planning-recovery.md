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
further changes. A successful read does not repair those files and does not clear that warning
within the current editor mount. There is no general durable crash-recovery journal for
these planning operations. Closing the editor or saving plugin settings currently remounts
the editor and loses this in-memory warning; that does **not** prove the vault was repaired.
The existing specialized requirement-sequence recovery mechanism remains separate.

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

This slice adds no persisted schema version. Existing Plan v4, Requirement v2 and geometry v3
formats remain current. Supported older records are upgraded in memory on read; opening a
Plan does not bulk-rewrite the vault. A later explicit edit writes the current supported
format through the existing conditional repository boundary. Unsupported future versions
remain refused, and unrelated human-written note content is preserved.

Browser and automated evidence is recorded in the
[Increment E report](user-experience/renovation-planner-editor-specs/implementation/planning-recovery-evidence.md).
Live Obsidian, assistive-technology and native zoom acceptance are tracked separately.

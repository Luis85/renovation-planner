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
resolved. Not everything is inside this pause. Undoing a zone deletion is the one action known
to be outside it, and nothing in the plugin checks for another like it, so there may be others.
For an action outside the pause the plugin may neither pause nor remember: if it leaves files
half-written, it can fail without ever recording an incident, and the warning you are reading
now would not appear for it at all. So do not read any single action still working as proof the
incident has cleared, and do not treat a quiet failure as nothing having happened.
Stop making changes anywhere in the vault and
inspect the affected files against your backup instead. Reading, navigating and inspecting still work: that is deliberate,
because comparing the affected files against your backup is the recovery, and a plugin that
also blocked reading would take away the one tool you have for it.

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

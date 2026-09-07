# Plan a renovation from the floor

Open a floor from its Project. An empty floor offers three starting points: add a Room,
prepare a reference plan, or keep an empty canvas. A reference image or PDF can be cropped,
rotated and scaled before it becomes the locked background. Reopen its settings to change
its appearance or measurements.

Room outlines and current wall measurements can be adjusted with the same geometry history in Plan and Renovate. Wall edits retain their Preview → Apply confirmation. Renovate keeps Select and Add available; Review remains read-only. Changes to intended structure use the Planned forms and their separate geometry.

## Shape and select the space

Use **Add** to choose a Room, Area, wall, hosted opening or another supported element.
Temporary tools show Finish and Cancel. Finish validates the draft and saves one change;
Cancel discards it. Room creation supports a rectangle and a free-shape outline. Numeric
controls let you enter exact dimensions or corner coordinates without drawing on the canvas.
With canvas focus, Enter finishes an Object, Path, Fence or Measurement; Backspace removes
its last draft point. Pending numeric input must be applied or discarded first. Enter in a
numeric field applies that field’s form and does not finish the element.

For a selected rectangular Room, activate its width or depth label to enter an exact
length in metres. Commas and decimal points are accepted. Apply or Enter saves one
geometry change; Escape cancels. The other dimension and the Room’s identity stay intact,
and Undo restores the original outline. An invalid or conflicted entry stays visible.
While saving, Select, Add and Cancel retain the pending edit. Switching tools deliberately
abandons an unsaved entry; changing perspective first asks about the draft.

The nearby **Edit shape** action opens the Room’s outline coordinates. **Add detail**
opens the contextual Existing, Planned, Work, Materials, Costs or Evidence form. A selected
wall offers **Edit length** and, when it has a Room context, **Mark change**. Length changes
still require Preview and Apply; Mark change uses the separate Planned record.

Use the floor list to select an element with the keyboard. Select several compatible
elements to create shared Work or Evidence, apply a planned change, or inspect their totals.
A shared record keeps one identity across its linked contexts. Deletion shows its impact
and refuses unresolved references; removing walls does not reshape independent Rooms.

## Connect the renovation

Select a Room or associated element, then open the current section’s navigation disclosure:

1. **Existing** records what is present and its condition.
2. **Planned** describes what to add, change, remove or keep. It preserves the Existing facts.
3. **Work** links tasks to their Planned outcomes. Set order, progress, DIY or Trade responsibility
   and dependencies. Optional start and end dates can be added independently. Incomplete predecessors explain why work is blocked; cycles are refused.
4. **Materials** links catalogue items to measured or manual quantities. Inspect the
   calculation and waste allowance, retain an explicit override when needed, and record
   purchased or reserved quantities separately. The shopping list uses outstanding quantities.
5. **Costs** groups entries by Work and separates estimates, commitments and actual spending.
   Opening an assigned Work group highlights its visible spatial targets without changing
   the displayed Room totals. Follow the reconciliation
   explanation to understand what contributes to the displayed totals. Procurement does not
   itself record a payment.
6. **Evidence** links ordinary vault files, notes and photos. Select a photo thumbnail to
   show its metadata. Phase filters organize the gallery or list; following a specific record reveals it even if another phase was selected before.
7. **Review** identifies the supported planning gaps and links back to the source controls.
   A generated Review note summarizes these findings; it is not a construction approval.

Numbered Work and Material markers correspond to Inspector rows. Selecting a material
reveals its source geometry. Links between Work, Planned outcomes, costs and evidence
change the context when needed; a valid shared Room context stays selected. Linked documents
on several targets within a Room are shown in that Room context. Explicit record and marker
navigation opens Details when constrained. Project and Materials library actions reuse
the existing workspace views.

Work can remain unassigned, belong to DIY, or reference a shared Trade category. Open
**View schedule** from Work, or the Project Work section, to see each floor’s Work once,
including shared Room contexts, dependency blockers and known dates. Add a Trade there,
then choose it in the same Work editing form. Dates are entered explicitly; dependencies
stay within the floor. A missing Trade stays visibly unresolved until you choose a new
responsibility. Open the floor from a schedule row to return to that Work record.

From Costs, **Compare quotes** opens the Project’s separate comparison. Add a Supplier,
record an offer’s dates and priced lines, and explicitly link each line to Work or catalogue
items. Preview before applying. Compare only the scope you recorded: uncovered rows are
shown as not quoted, and each offer has its own totals per currency. Recording a quote does
not create a commitment or payment. A received offer is immutable; use **Record revision**
to start a new offer identity. Return to the floor to restore the original Room and record
when they still exist.

If a quote refresh fails while its form is open, raw input remains editable while Apply is
paused. Retry refreshes the choices and facts without replacing the captured write version.
After a conflict, explicitly keep the draft as a new quote to preserve it without overwriting
the other offer, then preview it again.

If Work or a Quote was saved but its refreshed view cannot be read, use **Open source note**
to inspect the saved record. A new Quote remains reachable even if it has not appeared in
the comparison yet; after Work Undo/Redo, the action opens the floor changed by that operation.
Retry reads the current data without repeating the write. If the source was deleted elsewhere,
the action reports that it is missing and does not recreate it. When Retry removes its focused
warning button, keyboard focus returns to the Project Back control.

## Keep drafts and saved data clear

At narrow supported widths, the Layers and Details rails open the same controls used in
the wide layout. Resizing retains draft text, caret and focus. Close or Escape returns
focus to the rail; a workspace that is too narrow explains how to make room.

Apply, Finish and supported Undo/Redo operations check the saved version before changing
records. If a saved edit needs a read-back retry, the editor keeps the draft and the last
valid content while unsafe actions pause. See [saved data and recoverable drafts](using-planning-recovery.md)
for the meaning of each recovery state and how to handle conflicts.

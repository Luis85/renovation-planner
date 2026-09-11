# Plan a renovation from the floor

Open a floor from its Project. An empty floor offers three starting points: add a Room,
prepare a reference plan, or keep an empty canvas. A reference image or PDF can be cropped,
rotated and scaled before it becomes the locked background. Reopen its settings to change
its appearance or measurements. The large preview has Zoom in, Zoom out, Pan and Fit controls.
Drag the image to pan or use the wheel to zoom around the pointer. Calibration points A and B
stay attached to the image while the view changes. With the preview focused, arrow keys pan,
+ and − zoom, and F fits the image.

Room outlines and current wall measurements can be adjusted with the same geometry history in Plan and Renovate. Wall edits retain their Preview → Apply confirmation. Renovate keeps Select and Add available; Review remains read-only. Changes to intended structure use the Planned forms and their separate geometry.

## Shape and select the space

Use **Add** to choose a Room, Area, wall, hosted opening or another supported element.
Temporary tools show Finish and Cancel. Finish validates the draft and saves one change;
Cancel discards it. Room creation supports a rectangle and a free-shape outline. Numeric
controls let you enter exact dimensions or corner coordinates without drawing on the canvas.
With canvas focus, Enter finishes an Object, Path, Fence, Measurement, Stair or Direction arrow; Backspace removes
its last draft point. Pending numeric input must be applied or discarded first. Enter in a
numeric field applies that field’s form and does not finish the element.
Hold Shift while drawing a line to use the same angle constraints as a Zone. Wall and opening
placement keeps the canvas available; use Details when you want exact numeric entry.

Drag from empty canvas to select several items; hold Shift to add to the selection. Handles
come first, then Object → Opening → Wall → Room. Alt cycles overlaps or selects an individual
group member. Choose **Pan** for left-button drag navigation; Space-drag and the middle button
also pan. Right-click an item, or use the keyboard context-menu key, for its available actions.
Outside text fields and modal forms, **Ctrl+Z** undoes and **Ctrl+Y** redoes saved edits.

Use **Stairs** to draw a flight between two endpoints, then set its width, run, tread count
and up/down direction. **Direction arrow** follows the order of its drawn points. Both tools
remain on the canvas in narrow layouts; open Details explicitly for numeric entry.

For a selected rectangular Room, activate its width or depth label to enter an exact
length in metres. Commas and decimal points are accepted. Apply or Enter saves one
geometry change; Escape cancels. The other dimension and the Room’s identity stay intact,
and Undo restores the original outline. An invalid or conflicted entry stays visible.
Retyping a displayed dimension makes it an exact numeric input: for example, a pointer-made
1234.4 mm width displays as 1.234 m, and retyping 1.234 sets it to 1234 mm. A field you leave
untouched retains its original precision. Applying a value that already matches the geometry
does not add history.
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

## Lock a zone so the canvas clicks through it

A large zone such as the whole site sits under everything else and catches every click. Open
**Rooms and areas** in the left panel and press the lock button beside the zone (or use the same button
in its Inspector). A locked zone stays on the plan, slightly faded, but clicking, hovering,
dragging a selection box or right-clicking on the canvas ignores it and reaches whatever is
inside or on top of it. It is still listed, so its row still selects it, and the same button
unlocks it. Lock and unlock are saved with the zone and can be undone.

## Build detail plans from a zone

Right-click a zone such as House or Garden and choose **New detail plan**. The new plan is named
after the zone, opens in its own tab and shows that zone's outline as a dashed guide in its top-left
corner; crop its reference image at the same corner and calibrate it, and the drawing lines up with
the guide. A zone can have several detail plans, for example one per floor, and its right-click
menu lists **Open** for each. On a detail plan, the breadcrumb and the Property tree list every
plan above it, and each name opens that plan.

## Group and enclose a room

Choose **Group selected items** to save a reusable selection with the floor. A normal click
on a member selects its group, including hosted openings. Drag the group to move it, or use
**Move or rotate together** for numeric movement and rotation. Hidden members remain part of
the group. **Select focused item** lets you edit one member; **Select saved group** returns to
the assembly without changing membership. Ungroup removes membership while keeping the items.

For a Room, **Enclose with walls and group** creates missing boundary walls, reuses matching
walls and saves the assembly in one undo step. The walls stand outside the Room, their inner
faces on its outline, so its area stays the floor you drew. An edge shared with another Room
gets one wall centred on it, which both Rooms use. A Room made by closing a wall loop sits on
the loop's inner faces the same way. It uses the normal wall defaults; individual
wall properties remain editable. This is an explicit action: later independent outline edits
do not rebuild the walls automatically. Deleting a member updates the group; Undo restores
its membership along with the deleted item, subject to the normal conflict checks.

## Draw curved rooms and openings

Choose the Room task’s **Free-form** action to place an arbitrary outline. Every Room edge
shows its own length during drawing, point editing and rotation. **Edit curves** on a Room
or wall opens numbered edge controls: drag a bend handle or enter a bend depth or radius,
then Apply. Curved lengths and material quantities use the actual arcs. The rectangular
width/depth form is available for straight, axis-aligned Rooms.

Doors and windows show their opening leaves and angles. Edit the hinge, side and angle in
the opening’s controls. During placement, click the wall where the opening’s centre should
be. **Move along wall** lets you preview a new position on its existing straight or curved
host and click to place it; Escape cancels. The opening stays within the host’s available span.

## Rotate a spatial item

Select a Room, Area, Object, Path, Fence, Measurement, Stair, Direction arrow, wall or group.
Hover near its edges to reveal small curved-arrow handles. Drag one to turn the selection
around the displayed centre, or click one for precise angle entry. Hover alone never changes
selection. The pivot stays fixed for the gesture, and the angle label shows the current turn.
Hold Shift to use the active angle-snap setting. Release saves
a free item's turn; Escape cancels the preview. Review stays read-only.

For keyboard entry, select the item from the floor list and choose **Rotate by…**. Enter
degrees, using either a decimal point or comma. Positive values turn clockwise; negative
values turn counterclockwise. **Apply** saves the preview. The clockwise and counterclockwise
90-degree actions provide quarter turns. Cancel keeps the saved shape; zero or a full turn
adds no history. Undo and Redo restore the saved point sequences exactly.

Wall turns first show their impact for review, then **Apply** saves them. Connected junctions
move with the wall's endpoints, and hosted doors/windows stay attached with their saved
placement and dimensions. Selecting an opening offers **Rotate host wall**. A turn that would
create an invalid wall intersection or leave an opening outside its host is refused. Room
outlines remain independent of walls.

Rotation preserves identity, names and links; separate Planned geometry stays independent.
The rectangular Room size form remains limited to axis-aligned rectangles: use Edit shape
for rotated outlines. Reference plans rotate through their existing configuration workflow.
Saved groups and multiple selections rotate as an assembly. If another edit changes the
saved baseline, the stale turn is refused. Read-back retry after a successful save only refreshes
the view.

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
   show its metadata. Optionally record its capture or document date as YYYY-MM-DD; leave it
   blank when unknown. Recorded dates sort chronologically, with undated records following;
   the date is never taken from the file timestamp. Phase filters organize the gallery or list; following a specific record reveals it even if another phase was selected before.
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

## Add a photo

Choose an image from the vault or import one, optionally enter a caption, then Add photo.
The search offers a bounded list of matching images instead of listing the whole vault.
Context, dates, phase, links and pin coordinates remain available under Details when needed.
Leaving the caption blank uses the image filename.

## Keep drafts and saved data clear

At narrow supported widths, the Layers and Details rails open the same controls used in
the wide layout. Resizing retains draft text, caret and focus. Close or Escape returns
focus to the rail; a workspace that is too narrow explains how to make room.

Apply, Finish and supported Undo/Redo operations check the saved version before changing
records. If a saved edit needs a read-back retry, the editor keeps the draft and the last
valid content while unsafe actions pause. See [saved data and recoverable drafts](using-planning-recovery.md)
for the meaning of each recovery state and how to handle conflicts.

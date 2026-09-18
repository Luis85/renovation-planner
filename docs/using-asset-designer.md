# Design an object for the asset library

> **Beta, and not yet validated in a live Obsidian session — 2026-09-18.** Nothing in the asset
> designer has been photographed, no manual case under `docs/tests/` has been walked in a vault,
> and no walkthrough has confirmed that any of it looks or behaves on screen the way this guide
> describes. What follows is written from the code: it says what the plugin is built to do, not
> what anyone has observed it doing. Treat every sentence here as a claim to check, and keep a
> backup of the vault before designing anything you would be sorry to lose.

> The designer is **desktop only**, and that is a deliberate gate rather than a gap. The
> **Open asset designer** command does not appear on a mobile device, and a designer tab restored
> from a saved workspace layout there draws a refusal and mounts nothing. Compact desktop widths
> are supported; a phone is not.

An asset is one reusable definition — a chair, a basin, a raised bed — kept in the vault-wide
library and placed on as many plans as you like. The designer authors that definition's shape: its
footprint, the space it needs kept clear around it, the point a plan positions it by, which way its
front points, and the interior linework that makes it recognisable.

## Open the designer

**Open asset designer** in the command palette asks which asset, over the whole catalogue, and
opens it. On a plan, selecting a placed asset offers **Open in designer** for the definition behind
that placement. Creating an asset from the project list's **New asset** button opens the designer
on what it made. One asset gets one tab, whichever route you take.

Each tab holds **one asset**, so several can be open at once for comparison. Every tab is titled
"Asset designer"; the name of the object you are editing is the first line of the Inspector.

## Make an object

There are three ways to give an asset a shape, and none of them is a prerequisite for the others.

**Type its size.** **Set dimensions** — in the Inspector, and as the empty state's own action —
asks for a width and a depth in millimetres and writes a rectangle. This is the shortest path and
it needs no drawing and no calibration: an object typed as 1200 × 800 is immediately placeable.
Once a shape exists the same button reads **Edit dimensions**.

**Start from a preset.** **Start from preset** opens a gallery of fourteen shapes in four groups —
Tables, Seating, Bathroom, Plants and beds — with a search over the names as they are displayed, so
searching in German finds the German names. Choosing one shows its own parameters (a width and a
depth, or a diameter, a seat count, a canopy diameter) and **Apply preset** writes the result. It
**replaces the whole current design**, which the dialog says, and one Undo restores what was there.
And **a preset's parameters are not stored**: what it writes is ordinary editable geometry, so a
later "make it 1800 wide" is made on the shape itself — there is no parameter field to go back to.

**Trace it over a spec sheet.** **Choose a background** picks an image or a PDF page from the vault
as this asset's reference sheet, and the toolbar's tracing and drawing tools draw over it. This is
the path that needs a calibration to produce real measurements — see below.

A new asset is created from the **New asset** dialog, which takes a name, a category, a unit, a
unit cost and a currency, and optionally a width and a depth in millimetres that become its first
footprint. **A height cannot be given there.** Height is set in the designer's Inspector afterwards,
and it is descriptive: nothing in the product computes with it.

## Build the object up

The toolbar carries the camera (**Pan**), **Select**, the drawing tools, **Undo**, **Redo** and a
**View** menu. The drawing tools are **Trace footprint**, **Trace clearance**, **Draw rectangle**,
**Draw rounded rectangle**, **Draw circle**, **Draw line**, **Trace detail**, **Set anchor**,
**Set facing** and **Calibrate**. A completed trace or drawing returns to Select with the new part
chosen.

The **Parts** panel on the left lists every part of the object, including parts lying underneath
others — which is how you reach something a click cannot get at, since a press selects the topmost
part under the pointer and there is no overlap chooser popup. A row press selects exactly what a
canvas press would, and the list is one tab stop with Up, Down, Home and End. Each row offers
**Label** (your own words for the part; its internal name is a key and is never overwritten by it),
**Hide**/**Show**, **Lock**/**Unlock** and **Isolate**, with **Show all parts**. Hiding and locking
are **aids for this tab only**: they are not saved, a hidden part is still in the stored object and
still draws on every plan, and reopening the tab clears them.

With Select active and a part chosen, the toolbar offers three editing modes — **Transform**,
**Edit points** and **Bend edges** — so box handles and vertex handles never compete for the same
pointer, and each button's tooltip names the gesture it gives you. **A line is offered Transform
only**, because it has no resize or rotate handles: drag it to move it, or set its centre, size and
rotation in the Inspector fields.

Several parts are selected by dragging a rectangle across the canvas. Inclusion is by
**intersection** — touching is enough, and the drag direction does not matter. The **Select
multiple parts** checkbox in the Inspector adds to a selection without a modifier key.

With a set of parts selected, the Inspector's **Arrange** block offers **Group** and **Ungroup**,
**Bring group to front** and **Send group to back**, the six alignments (**Align left**, **Centre
across**, **Align right**, **Align top**, **Centre down**, **Align bottom**), four distributions
(**Even centres across**/**down**, **Even gaps across**/**down**), **Move across**/**Move down in
millimetres**, **Scale by a factor**, and **Repeat**. **Align to** chooses whether the alignment
holds the selection's bounds still or one named part. Controls appear only where they can act:
alignment at two parts, distribution at three, **Group** only where every selected part is still
ungrouped.

**Repeat** asks for a number of copies, a spacing in millimetres, a direction and — the part that
matters — what the spacing **measures**: centre to centre, or the gap between copies. The form
states the step it will actually apply before you press **Add the copies**, because those two
readings of the same number produce different pictures.

Two refusals you will meet, both deliberate:

- **A locked part refuses the whole arrangement** rather than being quietly left out of it, so a
  half-aligned object is not reachable. Unlock it, or leave it out of the selection.
- **Parts in different measurement spaces cannot be arranged together.** If some parts are still
  in the reference sheet's own pixels and others are in millimetres, aligning, distributing,
  repeating or transforming them as one body is refused with a sentence saying so. Calibrate the
  drawing first, or narrow the selection. **Grouping is still allowed**, because a group records no
  coordinates. A selection where *everything* is still unscaled is also fine: they share one space.

A gesture that would change nothing writes nothing and adds no undo step.

## Measurements, and where they stop

Every stored coordinate in this plugin is in **millimetres**. The Inspector displays whole
millimetres and whole degrees; the stored values are not rounded to match what is displayed.

**Typed dimensions are exact and need no reference sheet.** Tracing over one is different: an
outline captured before the sheet has been calibrated is recorded **in the sheet's own pixels**,
and the plugin remembers that fact per captured part rather than guessing it later. The Inspector's
**Reference** block names the sheet, says whether it is **Calibrated** or **Not calibrated**, and
lists which groups are still in reference pixels — the outline, the clearance, the placement point,
the graphics — with the hint that calibrating a known length on the sheet turns them into
millimetres. Where numbers would be placeholder pixels rather than measurements, **the fields are
withheld and a warning stands in their place**, rather than showing a number that is not a size.

**Calibrate** places two points on the sheet and asks what the real distance between them is. If
anything was captured before a scale existed, it asks first whether to rescale it; that conversion
is undoable. Calibrating an asset changes only that asset, never a plan's own calibration, and
never a part that was already measured. **Replacing the sheet clears the calibration and leaves
every per-part flag as it was** — a measured outline is not re-flagged, and an unscaled one does not
lose its warning.

**Edit dimensions** behaves differently depending on what it finds. On a footprint that is already
in real millimetres it **scales** the object about its placement point, so a traced L-shape keeps
its corners. On an object with no shape, or one still in reference pixels, it **replaces** the
outline with a rectangle of the size you typed — and the dialog says so before you save, and starts
with its fields empty rather than offering the placeholder numbers back to you as if they were
measurements.

Three limits of the arithmetic, stated because they are real and small:

- **A size is solved, not divided.** Scaling a shape whose edges bow keeps each bulge, so a plain
  ratio would miss the size you typed. The plugin makes up to four attempts and takes the closest;
  for most shapes that lands the typed number exactly, and for some curved ones it lands a fraction
  of a thousandth of a millimetre away.
- **Some sizes cannot be reached at all.** A circle made of four arcs cannot be narrowed below
  roughly a fifth of its diameter. Where that happens you get the nearest achievable result rather
  than a refusal.
- **A non-uniform stretch keeps circles circular here and does not on a plan.** Stretching an
  object more in one direction than the other should strictly turn a circular arc into an elliptical
  one, and this plugin cannot store an ellipse. The designer therefore keeps each arc circular
  through its new chord, while a plan flattens arcs to straight segments (within a millimetre)
  before applying a placement's own size. **The numbers are the guarantee and the silhouette is an
  approximation**: an object given the same nominal size in both places measures the same and draws
  a slightly different curve. For straight-edged objects the two are identical.

**Height is stored, shown and round-trips, and nothing reads it.** There is no vertical clash check,
no fit test and no calculation anywhere in the product that uses it. "Does the worktop clear the
window sill" is not a question this plugin answers.

## What a clearance means

A clearance is a **second boundary** around the object, describing the space a renovator wants kept
free — a door swing, a chair pull-out, room to kneel in front of an oven.

**It is an authored planning boundary and nothing more.** It is not a regulatory approval, it does
not encode a building code, and no number the plugin ever suggests is a requirement for real
construction. The helper's own hint says it: these are your own allowances, not a standard.

Two ways to make one. **Trace clearance** draws an arbitrary boundary, which is what an irregular
object needs. Or the Inspector's **Clearance** block takes four allowances — **In front**,
**Behind**, **To its left**, **To its right** — and **Generate clearance** builds a rectangle from
them. That helper is offered **only for a rectangular outline whose front points along an axis**;
for anything else it says so and offers no fields, because four setbacks mean nothing against a
traced curve and "left" means nothing while the front points between two axes. The four numbers
**generate and never read back**: they start at zero whatever boundary the object already has, and
generating **replaces** what is there, which the panel warns before you press the button.

**Resizing the object does not resize a measured clearance.** It is preserved at the size you drew
it, standing around a now-different object where it visibly no longer fits, and the Inspector says
so: *this clearance was kept at the size you drew it when the object was resized; check that it
still describes the space you need*. **Mark clearance as reviewed** answers that notice, and the
answer survives closing and reopening the tab. Regenerating or retracing the boundary counts as
the review too. A clearance still in reference pixels is scaled along with everything else and is
never flagged, because its numbers are not yet measurements.

**"Reviewed" certifies nothing.** It records that a person looked at the boundary. It is not a
compliance check and the plugin performs none.

## One definition, many plans

Every plan that places this asset draws **the current definition**. Correcting the shape here is
how one fix reaches every plan at once — and it is also how an edit reaches plans you were not
thinking about. There is no per-placement copy of the geometry.

**The designer does not tell you which plans those are.** The asset library's **Duplicate** panel
does: it lists **Used in plans** with a placement count per plan, and says when some notes could
not be read so the list may be incomplete. The designer's Inspector shows the asset's name, its
dimensions and its own controls, and no usage list. If you are about to make a change whose reach
matters, check the library first.

**Duplicate** — in the library, not here — creates a new definition with its own geometry, for when
you want an object to diverge. Plans that place the original keep the original.

**Use in plan** in the Inspector takes this asset into the Plan editor, on the plan already open
where there is exactly one, and otherwise on a plan you pick. It appears only once the object is
placeable: it needs a footprint, and that footprint has to be measured rather than still in
reference pixels. An object in either state is one gesture away — **Set dimensions**, or
**Calibrate** — and both controls are on the same panel.

If two panes are open on one asset, an edit in one refreshes the other.

## Versions, history, and what is not kept

**Nothing here can be frozen, approved or issued, and nothing is labelled as though it could.**
There is no draft/published split, no approval state and no way to pin a plan to an older version
of a shape. If you need a shape to stop changing under a plan, duplicate it.

**No earlier version of a shape is retained.** Undo is the only route back to a previous state, and
undo is **per tab and per session**: it lives in the open designer, it does not reach edits made in
another pane, and **closing the tab ends it**. Saving plugin settings also remounts an open
designer, which discards its undo history for the same reason. The vault holds the current shape
and no history of it.

The geometry file keeps a **revision counter** that rises on every write, and a write is refused if
the file changed since it was read. That is what stops two panes overwriting each other; it is not
a history you can browse.

**Schema version 4.** This build reads geometry files written at versions 1 to 4 and writes
version 4. A file written by a **newer** build is refused outright rather than loaded, because
loading a file whose fields this build does not understand would strip them on the next write. The
practical consequence is in [Recovery](#when-something-goes-wrong) below.

## What the shape carries, and where it goes

Four kinds of geometry can be drawn: **closed outlines** (rectangles, circles, rounded rectangles,
traced shapes), **curved** edges on any of them (Bend edges, or the drawing tools' own arcs), and
**open lines**. Each part is **solid** or **dashed**, where dashed conventionally means overhead or
hidden. **A line is never filled**: for an open part, solid and dashed set the dash pattern only,
which the Inspector says where the control is.

A shape reaches exactly three places, and **there is no export subsystem in this plugin** — no PDF,
no print path, no render-to-file, and no image export of a designed object:

1. **This canvas**, where it is authored.
2. **The library's small mark** beside the asset in the catalogue, drawn from the footprint alone
   with arcs flattened to straight segments.
3. **A plan placement**, which carries the footprint, the clearance and every interior graphic,
   with arcs flattened within a millimetre. What a plan then *does* with a clearance — drawing it,
   or flagging an overlap between two of them — is the Plan editor's business and is not promised
   by the designer.

Guides, handles, the reference sheet and an isolated view are **editing aids** and are not part of
what any of those three draw.

## When something goes wrong

The designer shares the plugin's save-state vocabulary — **Saving**, **Saved**, **Unsaved
changes**, **Save error** — which appears beside the grid and Shift hints at the foot of the pane.
[Working with saved data and recoverable drafts](using-planning-recovery.md) explains what each
state means; the states below are this surface's own.

**"This asset could not be re-read after the last change; what you see may be out of date."** The
write landed and the read that follows it did not, so the canvas is showing the state before your
edit. Nothing is lost. Reopen the tab to see the current shape.

**"This asset could not be loaded", with Try again.** The read refused. The retry only reads; it
never repeats a write. Where the failure is that the plugin's settings never loaded, no retry is
offered, because re-running a read through a service that was never wired does nothing.

**"This asset no longer exists", with Close this tab.** The asset was deleted elsewhere. Nothing
redirects on its own and nothing is recreated.

**"The background file for this asset is missing"** and **"The background for this asset could not
be rendered"** are notices, not failures: the asset read fine and everything else still works, but
there is nothing to trace over. **Remove reference** in the Inspector's Reference block takes the
reference away — it never deletes the file from your vault — and it works even when the file it
names has already gone, which is the one gesture that repairs that state. Removing a reference
**clears the calibration** and leaves every unscaled part unscaled; Undo restores both.

**Two panes, or an edit made elsewhere.** Every write is conditional on the version it read, inside
a lock, so the later of two conflicting writes is refused rather than silently winning. A refusal
of that kind asks you to reload and try again. A design change made in one pane refreshes the other.

**A missing geometry file is not damage.** An asset with no drawn shape simply has no geometry file
yet, and the plugin reads that as "no shape" rather than as an error. A file that exists but will
not parse is different: it is refused with a message naming the file, and it is never partially
loaded. A file that declares a different asset than the one being opened is refused rather than
adopted.

**Moving the library folder moves the geometry with it.** If you change the library folder setting,
the plugin moves both the asset notes and their geometry together; the geometry files are read from
a path derived from that setting, and a stale one would read as "every asset lost its shape"
without an error. If the move reports a failure, read the message: some of them say nothing moved
and a retry is right, and one says the notes moved but the setting did not, where the fix is to
point the setting at where they now are.

### Keep a backup

Keep a separate backup of the whole vault before using a pre-release build, **including the asset
library's `Geometry/` folder and its `.rpgeo` files**, not just the notes. An asset's shape lives in
that sidecar; restoring only the Markdown note restores a name and a price and no geometry at all.

**Going back to an older build is not by itself a recovery.** Once this build has written a
geometry file at schema version 4, an older build refuses to read it — deliberately, because the
alternative is loading it and silently stripping the fields it does not know. Recovery from a
version you cannot read means restoring a verified backup. There is no downgrade path and no
assumption that one would be lossless.

For the connected editing journey on a plan, see
[Plan a renovation from the floor](using-plan-editor.md).

## Disagreements found while writing this

Recorded for the integrator rather than fixed here; this file is the only one its author may write.

1. **`docs/requirements/Asset designer.md`** says height is "stored, shown and **exported**". There
   is no export path in `src/` — contract revision `r1` (row 4) measured exactly that and rescoped
   C10 to three consumers: the authoring canvas, the library mark and plan placement. The
   requirement's wording promises a capability the code does not have.
2. **`DECISIONS.md`'s ruling AD13-R1** names the plan-side door into the designer as
   *"Edit shared asset"*. The string in the code is `editor.asset.open-designer` → **"Open in
   designer"**; no string anywhere in `src/` reads "Edit shared asset". This guide uses the code's
   spelling.
3. **AD13-R1 part 1** rules that a usage scope is **owed in the designer** and that its acceptance
   criterion 3 "is NOT met until it lands". It has not landed: `grep -rn
   "listPlansUsingAsset\|UsageScope\|used-in"` over `src/presentation/designer/` still prints no
   lines, and `guardAssetUsage` — the extraction that ruling specifies — does not exist
   (`src/plugin/guardedAssetLibrary.ts` still constructs the query inside `guardAssetDuplication`).
   This guide states the absence and points the reader at the library instead.
4. **`AssetGeometryStore.ts`'s own class docblock** says the future-version refusal comes from
   "`AssetGeometrySchema`, which knows versions 1 **and 2**". It knows 1 to 4 (`AssetGeometrySchema`
   preprocesses 1, 2 and 3 to 4). The sentence was not updated when v3 and v4 were allocated; the
   behaviour it describes is still correct.

## What this guide could not establish

Every gap below is a place where the code did not settle the question in reasonable reading time.
Nothing here has been guessed at in the body above; where a claim could not be pinned down it was
either narrowed or left out.

- **Anything about appearance.** No part of this surface has been rendered in Obsidian or captured
  by `npm run harness-shot` for this guide, so nothing is said about layout, colour, icon, spacing,
  what is visible at a narrow pane width, or whether a control is easy to find. The one structural
  claim made is ordering within the Inspector, read from the template. A reader who needs to know
  what it looks like should run `npm run test-build` and open a vault.
- **Which keyboard shortcuts exist beyond three.** Delete/Backspace removes a selected graphic or
  the clearance, Ctrl+D (Cmd+D) duplicates a graphic, and the arrow keys nudge a selection — all
  three only while Select is active. Shift constrains a Transform box handle's proportions, snaps a
  rotate handle and snaps a facing drag. Whether the camera, the grid, fit-to-view or the tools
  carry further bindings was not traced; `Shift+1` appears in a code comment as a "frame the design"
  shortcut but was not confirmed at its binding site.
- **What the preset parameters do at their edges.** The fourteen presets and their field labels are
  listed in the code; which combinations are refused as "not a shape that can be built" was not
  enumerated.
- **Snapping in detail.** The View menu's **Show grid** and **Snap to objects** were read at the
  control, and vertex, edge, alignment, anchor and grid candidates are named in a comment. The
  precise snap radius, priority order and behaviour at high zoom were not established.
- **The German wording.** This guide is English only. The German strings exist (the locale modules
  are paired), but no German guide has been written and the German labels were not checked against
  it. `docs/using-item-colors.md` is the precedent for a bilingual guide if one is wanted.
- **Whether a designer edit invalidates anything downstream.** Quantities, costs and requirements
  derived from an asset are outside what was read for this guide; whether editing geometry marks a
  derived figure stale was not traced.
- **Two panes, in practice.** The compare-and-swap in the geometry store and the cross-pane refresh
  subscription were both read in the code. Neither has been exercised in a real Obsidian session,
  and the plugin's own test fakes record requests rather than behaving like Obsidian, so the
  observable behaviour of a real conflict is unconfirmed.

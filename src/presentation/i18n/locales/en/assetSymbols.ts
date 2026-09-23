/** Asset designer symbols (spec 2026-09-13): details, presets and the preset dialog. */
export const assetSymbolsEn = {
	'asset.invalid-detail': 'That detail is not a shape this plugin can store.',
	'asset.degenerate-detail': 'That detail encloses no area.',
	'asset.invalid-detail-id': 'Every detail needs its own ID.',
	'asset.preset-value-out-of-range': 'A value is outside what this preset allows.',
	'asset.preset-incoherent': 'Those values do not describe a shape that can be built.',
	'asset.part-not-found': 'That part is no longer in the design.',
	'asset.vertex-out-of-range': 'That corner or edge is not on the outline.',
	'asset.invalid-scale': 'A part cannot be scaled to nothing or flipped.',
	'asset.detail-at-limit': 'That detail is already at the end of the drawing order.',
	'asset.no-details': 'This design has no details to fit the footprint to.',
	'asset.details-await-scale': 'A detail is still unscaled. Calibrate before fitting the footprint to the details.',
	'designer.inspector.start-preset': 'Start from preset',
	'designer.preset.title': 'Start from a preset',
	'designer.preset.picker': 'Preset',
	'designer.preset.replaces': 'This replaces the current design. Undo restores it.',
	'designer.preset.apply': 'Apply preset',
	'designer.preset.preview': 'Preview of the preset',
	'designer.preset.group.tables': 'Tables',
	'designer.preset.group.seating': 'Seating',
	'designer.preset.group.sanitary': 'Bathroom',
	'designer.preset.group.plants-beds': 'Plants and beds',
	'designer.preset.field.width': 'Width in millimetres',
	'designer.preset.field.depth': 'Depth in millimetres',
	// The compact row's SHORT visible labels (AD18-R16 Task 5): `DesignerFieldRow` draws these
	// beside the input and keeps the sentence above as the input's `aria-label`.
	'designer.preset.field.width.short': 'Width',
	'designer.preset.field.depth.short': 'Depth',
	'designer.preset.field.diameter': 'Diameter in millimetres',
	'designer.preset.field.length': 'Length in millimetres',
	'designer.preset.field.radius': 'Outer radius in millimetres',
	'designer.preset.field.sweep': 'Sweep in degrees',
	'designer.preset.field.seats': 'Seats',
	'designer.preset.field.canopy': 'Canopy diameter in millimetres',
	'designer.preset.field.trunk': 'Trunk diameter in millimetres',
	'designer.preset.field.pillows': 'Pillows',
	'designer.toolbar.draw-rect': 'Draw rectangle',
	'designer.toolbar.draw-circle': 'Draw circle',
	'designer.toolbar.trace-detail': 'Trace detail',
	'designer.selection.detail': 'Detail',
	'designer.selection.footprint': 'Footprint',
	'designer.selection.clearance': 'Clearance',
	'designer.selection.anchor': 'Anchor',
	'designer.selection.facing': 'Facing',
	'designer.selection.name': 'Name',
	'designer.selection.line': 'Line',
	'designer.selection.line.solid': 'Solid',
	'designer.selection.line.dashed': 'Dashed',
	// "Centre x in millimetres" and "Position x in millimetres" failed `sentence-case-locale-module`;
	// the "Horizontal …" / "Vertical …" spellings pass.
	'designer.selection.centre-x': 'Horizontal centre in millimetres',
	'designer.selection.centre-y': 'Vertical centre in millimetres',
	'designer.selection.rotate-by': 'Rotation to apply in degrees',
	'designer.selection.position-x': 'Horizontal position in millimetres',
	'designer.selection.position-y': 'Vertical position in millimetres',
	'designer.selection.angle': 'Angle in degrees',
	// The same compact-row split as the preset fields above, for the selection inspector's own
	// fields and `DesignerSetTransform`'s "by" fields, which reuse `rotate-by`.
	'designer.selection.centre-x.short': 'Horizontal centre',
	'designer.selection.centre-y.short': 'Vertical centre',
	// "Rotation" rather than "Rotate by": WCAG 2.5.3 needs the visible short label inside the
	// full sentence ("Rotation to apply in degrees"), and "Rotate by" is not a substring of it.
	'designer.selection.rotate-by.short': 'Rotation',
	'designer.selection.position-x.short': 'Horizontal position',
	'designer.selection.position-y.short': 'Vertical position',
	'designer.selection.angle.short': 'Angle',
	'designer.selection.bring-forward': 'Bring forward',
	'designer.selection.send-backward': 'Send backward',
	'designer.selection.duplicate': 'Duplicate',
	'designer.selection.delete': 'Delete',
	'designer.selection.fit-to-details': 'Fit to details',
	// A detail's `name` is a stable key (spec Decision 8): every name a preset or a draw tool writes has
	// a label here, and the inspector shows any other name exactly as it is stored.
	'designer.detail.arm': 'Arm',
	'designer.detail.backrest': 'Backrest',
	'designer.detail.basin': 'Basin',
	'designer.detail.bowl': 'Bowl',
	'designer.detail.cabinet': 'Cabinet',
	'designer.detail.canopy': 'Canopy',
	'designer.detail.circle': 'Circle',
	'designer.detail.cushion': 'Cushion',
	'designer.detail.drain': 'Drain',
	'designer.detail.duvet': 'Duvet',
	'designer.detail.outline': 'Outline',
	'designer.detail.pillow': 'Pillow',
	'designer.detail.rectangle': 'Rectangle',
	'designer.detail.seat': 'Seat',
	'designer.detail.tank': 'Tank',
	'designer.detail.tap-hole': 'Tap hole',
	'designer.detail.trunk': 'Trunk',
	'preset.rect-table': 'Rectangular table',
	'preset.round-table': 'Round table',
	'preset.oval-table': 'Oval table',
	'preset.curved-table': 'Curved table',
	'preset.chair': 'Chair',
	'preset.armchair': 'Armchair',
	'preset.sofa': 'Sofa',
	'preset.toilet': 'Toilet',
	'preset.washbasin': 'Washbasin',
	'preset.vanity': 'Vanity',
	'preset.shower-tray': 'Shower tray',
	'preset.bathtub': 'Bathtub',
	'preset.tree': 'Tree',
	'preset.shrub': 'Shrub',
	'preset.bed': 'Bed',
	'designer.toolbar.select': 'Select',
	'designer.selection.mode': 'Selection mode',
	'designer.selection.mode.transform': 'Transform',
	'designer.selection.mode.points': 'Edit points',
	'designer.selection.mode.bend': 'Bend edges',
	// A pending detail's or anchor's millimetre fields are withheld (spec Amendment 2); this says why, under the section heading.
	'designer.selection.unscaled': 'This part was captured before a scale existed, so its measurements are hidden until the asset is calibrated.',
	// Under Select with an outline in Transform: a box handle keeps proportions and the rotate handle snaps (`selectionDrag.ts`).
	// Key first, as `editor.hint.constrain-angle` is: `sentence-case-locale-module` refuses a capitalised `Shift` mid-sentence.
	'designer.hint.shift-transform': 'Shift keeps proportions and snaps the rotation',
	// The mode buttons' tooltips name the gesture each mode offers; the button text stays the accessible name.
	'designer.selection.mode.transform.tip': 'Drag the part to move it, a square handle to resize it or the curved arrow to rotate it',
	'designer.selection.mode.points.tip': 'Drag a corner to move it; it snaps to the corners, edges and alignments of the other parts, to the anchor, and to the grid while shown',
	'designer.selection.mode.bend.tip': 'Drag the handle in the middle of an edge to curve that edge',
	// The asset-level block's own heading, so its Dimensions never read as the selected part's (critique finding 4).
	'designer.inspector.asset': 'Asset',
	// The header's landmark name (AD18 item 2). A `<header>` is a `banner` landmark and is NOT named
	// by a heading inside it under HTML-AAM — and for a leaf whose read is in flight or refused there
	// is no heading in it at all. `EditorContextBar` labels its own bar for the same reason.
	'designer.header': 'Asset designer header',
	// The library door's icon and accessible name (AD18-R16 Task 2, board 02's `← Back to library`).
	// Replaces `designer.inspector.open-library`, dropped in the same edit: `grep -rln
	// "designer.inspector.open-library" src/` printed only this table, its `de` twin and the
	// component before this change, so nothing else held a second answer to lose.
	'designer.header.back-to-library': 'Back to library',
	// The Inspector's two tabs (AD18-R2). `Object` carries the thing being drawn, its placement and
	// the space it needs kept free; `Reference` the sheet it is traced over and that sheet's scale.
	// There is deliberately no third: the designer has no styling controls, and board 01's `Style`
	// tab would ship empty.
	'designer.inspector.tabs': 'Inspector sections',
	'designer.inspector.tab.object': 'Object',
	'designer.inspector.tab.reference': 'Reference',
	// Moved from `en.ts` (AD18-R16 Task 5's follow-up): that file was already over its 400-line
	// cap, and every other `designer.inspector.*` key already lives here. Height draws
	// `DesignerFieldRowShell`'s compact row now, through `FieldError`'s slot, and keeps the
	// full sentence as the input's `aria-label`; `.unparseable` is unchanged.
	'designer.inspector.height': 'Height in millimetres',
	'designer.inspector.height.short': 'Height',
	'designer.inspector.height.unparseable': 'Enter a height as a number, or clear it.',
	'designer.selection.toggle-mode': 'Select multiple parts',
	'designer.selection.count': '{count} parts selected',
	// Under the facing's angle field, as its description: `facingTip` adds the sine to y, and y grows DOWN the screen.
	'designer.selection.angle.hint': 'An angle of 0 points right, and 90 points down',
	// The status row while the grid is shown (snapping spec 2026-09-15 §2.6); withheld while the footprint is unscaled.
	// The camera's scale used to sit beside it (`designer.status.zoom`) and moved into the toolbar's
	// own zoom cluster at AD18-R16's Task 1 — see `DesignerToolbar.vue`'s `zoomPercent`.
	'designer.status.grid': 'Grid {step} mm',
	// AD09's Parts panel: the list itself, its empty line, and the row controls. `designer.selection.*`
	// already names the footprint, the clearance, the anchor and the facing, so those are not repeated.
	'designer.parts': 'Parts',
	'designer.parts.empty': 'This asset has no parts yet. Set its dimensions or start from a preset.',
	'designer.parts.reference': 'Reference sheet',
	'designer.parts.group': 'Group',
	'designer.parts.label': 'Label',
	'designer.parts.hide': 'Hide',
	'designer.parts.show': 'Show',
	'designer.parts.lock': 'Lock',
	'designer.parts.unlock': 'Unlock',
	'designer.parts.isolate': 'Isolate',
	'designer.parts.show-all': 'Show all parts',
	'designer.parts.hidden': 'Hidden',
	'designer.parts.locked': 'Locked',
} as const;

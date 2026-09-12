import { openingMoveEn } from './openingMove';
import { openingEn } from './opening';
import { curvesEn } from './curves';
import { referenceViewportEn } from './referenceViewport';
import { editorShellEn } from './editorShell';
import { objectEn } from './object';
import { assetPlacementEn } from './assetPlacement';
import { stairsArrowsEn } from './stairsArrows';
import { inputEn } from './input';
import { groupsEn } from './groups';
import { creationEn } from './creation';
/**
 * The Plan Editor's own vocabulary — the shell (context bar, rail, status bar),
 * the add-menu catalogue, the Inspector (its floor and room panels, its requirements
 * panel, its zone-type labels), the task banner and the calibration dialogs. Split out of
 * `en.ts` at Task 20 to keep the assembled table under the 400-line `max-lines` cap
 * (`skipBlankLines`/`skipComments`, so this docblock is free and a key is not) — `en.ts`'s
 * own header records the measurement that made the split safe: the marketplace
 * sentence-case rule self-scopes through `isEnglishLocalePath`, which admits
 * `locales/en/editor.ts` on its path alone, with no configuration to write. `en.ts` spreads
 * this object into its own (`...editorEn,`), so `StringKey = keyof typeof en` stays exact
 * and no consumer of a key changes.
 *
 * **Not every `editor.*` key lives here.** `editor.plan-failed.headline`,
 * `editor.refresh-failed`, `editor.some-zones-unreadable` and `editor.plan-missing.*` stay
 * in `en.ts`, grouped there with design slice 17's shared in-place failure states
 * (`view.failure.retry`, `view.project.failed.headline`) under one comment that explains
 * all of them together — splitting a documented group across two files would be the worse
 * trade than leaving four `editor.`-prefixed keys outside this module. This is a coherent
 * SUBSET of the editor's keys, not the whole prefix.
 *
 * **Three keys that sat inside this block did NOT move with it**, for the opposite reason:
 * `sequence.marker-clear-failed`, `cascade.stale-marker-failed` and `cascade.aborted` are
 * not `editor.*` at all — they happened to sit between `editor.inspector.linked.notes` and
 * `editor.room.default-name` in the source file's reading order. They stayed in `en.ts`.
 */
import { structureEn } from './structure';
export const editorEn = {
	...curvesEn,
	...groupsEn,
	...stairsArrowsEn,
	...inputEn,
	...creationEn,
	'editor.direct.edit-shape': 'Edit shape',
	'editor.direct.edit-length': 'Edit length',
	'editor.direct.mark-change': 'Mark change',
	'editor.direct.add-detail': 'Add detail',
	'editor.direct.length-value': 'Edit wall length, {value} m',
	'editor.dimension.edit-width': 'Edit room width, {value} m',
	'editor.dimension.edit-depth': 'Edit room depth, {value} m',
	'editor.dimension.context-changed': 'Selection changed. Your entry is retained. Cancel and reopen the dimension to edit the current selection.',
	'editor.dimension.task': 'Edit room dimension',
	'editor.dimension.instruction': 'Enter a length in metres. Apply saves the change. Escape cancels.',
	...objectEn,
	...assetPlacementEn,
	...openingEn,
	...openingMoveEn,
	...referenceViewportEn,
	...editorShellEn,
	"editor.element.name-required": "Enter a name.",
	"editor.element.edit": "Edit {name}",
	"editor.element.edit-action": "Edit name and coordinates",
	"editor.element.edit-hint": "Edit the name and exact coordinates. Apply saves these changes together.",
	"editor.element.changed": "This element changed. Cancel and reopen to use the latest saved version.",
	"editor.element.delete-impact": "Delete {name} and its geometry? Undo can restore it.",
	"editor.element.create-hint": "Place points on the plan or enter coordinates in metres, then finish. Measurements need two points.",
	"editor.element.add-point": "Add point",
	"editor.element.undo-point": "Remove last point",
	"editor.element.finish": "Finish",
	"editor.element.cancel": "Cancel",
	"spatial.element-invalid": "Enter a name and a valid shape before finishing.",
	"plan.invalid-spatial-elements": "Element names and identities must be valid and unique.",
	'editor.room.snapped': "Snapped to nearby geometry.",
	'editor.add.note.context-required': "Select one room and wait for its notes to load before adding a note.",
	'zone.category-change': "Room and area identity cannot be changed here.",
	"editor.room.free-shape": "Draw a free-form room",
	"editor.room.free-shape-hint": "For an irregular room, place corners on the plan or enter their coordinates.",
	"editor.room.edge-length": "Edge {edge}: {length} m",
	"editor.outline.action": "Edit outline coordinates",
	"editor.outline.title": "Edit {name} outline",
	"editor.outline.hint": "Enter corner coordinates in metres. Apply updates this outline in one step. Connected walls keep their own geometry.",
	"editor.outline.latest": "The outline of {name} changed. Cancel and reopen to use the latest version.",
	"editor.area.details": "Edit area details",
	"editor.area.name": "Area name",
	"editor.area.type": "Area type",
	"editor.area.latest": "Current area: {name} · {type}. Cancel and reopen to use the latest version.",
	"editor.area.unavailable": "The area is no longer available. Cancel and reopen the floor.",
	...structureEn,
	"editor.reference.title": "Reference plan setup",
	"editor.reference.prepare": "Prepare plan",
	"editor.reference.scale": "Set scale",
	"editor.reference.review": "Review reference",
	"editor.reference.action": "Configure reference plan",
	"editor.reference.upload": "Upload a floor plan",
	"editor.reference.start": "How would you like to start?",
	"editor.reference.empty": "Start empty",
	"editor.reference.rooms": "Add rooms",
	"editor.reference.rooms-description": "Quickly draw and size your rooms",
	"editor.reference.upload-description": "Use a PDF or image as your guide",
	"editor.reference.empty-description": "Draw walls or areas yourself",
	"editor.reference.source": "Source file in your vault",
	"editor.reference.source-help": "Enter the vault-relative path of a PNG, JPEG or PDF. The original file stays unchanged.",
	"editor.reference.page": "PDF page",
	"editor.reference.load": "Load / retry source",
	"editor.reference.loading": "Reading source…",
	"editor.reference.missing": "Source file is missing. Correct the path or choose a replacement, then load again.",
	"editor.reference.unreadable": "Cannot read this image or PDF page. Check the page number, retry, or choose another file.",
	"editor.reference.source-changed": "The source changed. Return to preparation and load it again.",
	"editor.reference.crop-x": "Crop left (px)",
	"editor.reference.crop-y": "Crop top (px)",
	"editor.reference.crop-width": "Crop width (px)",
	"editor.reference.crop-height": "Crop height (px)",
	"editor.reference.rotation": "Rotation (degrees)",
	"editor.reference.preview": "Prepared reference and measurement endpoints; edit coordinates in the fields",
	"editor.reference.measure-help": "Click two points in the preview or enter their source-pixel coordinates below. Enter the real distance between them.",
	"editor.reference.ax": "First point horizontal (px)",
	"editor.reference.ay": "First point vertical (px)",
	"editor.reference.bx": "Second point horizontal (px)",
	"editor.reference.by": "Second point vertical (px)",
	"editor.reference.length": "Known distance (m)",
	"editor.reference.another": "Choose another distance",
	"editor.reference.scale-summary": "Scale: {scale} mm per source pixel. Known distance: {length} m.",
	"editor.reference.opacity": "Reference opacity",
	"editor.reference.visible": "Visible",
	"editor.reference.locked": "Locked",
	"editor.reference.unlock-help": "Position changes are made through setup; the canvas does not drag references.",
	"editor.reference.rescale": "Rescale all walls, openings, rooms and areas by {factor} about the floor origin. Measurements and calculated quantities will change.",
	"editor.reference.consent": "Confirm the effect on existing walls, openings, rooms and areas before finishing.",
	"editor.reference.invalid-prepare": "Load a source and enter a positive crop within the image, with rotation from -180° to 180°.",
	"editor.reference.invalid-scale": "Enter two different points inside the crop and a finite positive known distance.",
	"editor.reference.paused": "Saving is paused. Wait for the operation, or cancel and reopen after refreshing the floor.",
	"editor.reference.failed": "Reference setup failed. Your draft is retained; refresh the floor before retrying.",
	"editor.reference.back": "Back",
	"editor.reference.continue": "Continue",
	"editor.reference.apply-scale": "Apply scale",
	"editor.reference.finish": "Finish setup",

	'editor.resize.current': 'Starting size: {width} m × {depth} m',
	'editor.resize.latest': 'Latest saved size: {width} m × {depth} m. Your draft is unchanged. Cancel and reopen to use the current room.',
	'editor.resize.latest-unavailable': 'The current room size cannot be read. Your draft is unchanged. Cancel, refresh the floor and reopen.',
	'editor.resize.action': 'Change room size',
	'editor.resize.title': 'Change size: {name}',
	'editor.resize.anchor': 'The top-left corner stays fixed. Width extends to the right; depth extends downwards. Values are in metres. The dashed outline is a preview; the room changes only when you apply it.',
	'editor.resize.preview': 'Preview: {width} m × {depth} m — {area}',
	'editor.resize.invalid': 'Enter valid dimensions that can describe this room.',
	'editor.resize.paused': 'Saving or refreshing this floor. Changes cannot be applied now.',
	'editor.resize.apply': 'Apply dimensions',
	'editor.resize.unsupported': 'Width and depth editing supports only rectangles aligned with the floor axes. Rotated and other outlines can be edited using their existing corner handles.',

	'editor.selection.toggle-mode': 'Select multiple elements',
	'editor.selection.shared-type': 'Shared type',
	'editor.selection.mixed': 'Different types',
	'editor.selection.unavailable': 'Unavailable selected elements: {count}. Measurements cover readable elements only.',
	'editor.selection.unknown': 'Unavailable',
	'editor.selection.count': 'Selected elements',
	'editor.selection.area-sum': 'Sum of areas',
	'editor.selection.area-sum-hint': 'Overlapping areas are counted separately.',
	'editor.selection.members': 'Selected items',
	'editor.selection.records': 'Rooms and areas',
	'editor.selection.clear': 'Clear selection',
	'editor.selection.hint': 'Shift-click to add or remove a selection. Alt-click on the plan to cycle overlapping elements.',
	'editor.context-bar': 'Editor context',
	'editor.context.undo': 'Undo',
	'editor.context.redo': 'Redo',
	'editor.primary-actions': 'Primary actions',
	'editor.primary.select': 'Select',
	'editor.primary.add': 'Add',
	// Task 17's creation catalogue and its menu (design spec §7.1). Ten entries, one available
	// (Room, which routes to the existing draw tool) and nine `not-yet` — a reason rather than
	// a dead control, per the empty-state amendment this file's own slice 14 section carries.
	'editor.add.menu': 'Add',
	'editor.add.search': 'Search what to add',
	'editor.add.group.structure': 'Structure',
	'editor.add.group.property': 'Property',
	'editor.add.group.planning': 'Planning',
	'editor.add.room.label': 'Room',
	'editor.add.room.description': 'Fastest way to start',
	'editor.add.room.synonyms': 'Kitchen, bedroom, bathroom, living room',
	'editor.add.wall.label': 'Wall',
	'editor.add.wall.description': 'For precise layouts',
	'editor.add.door.label': 'Door',
	'editor.add.door.description': 'An opening between two rooms',
	'editor.add.window.label': 'Window',
	'editor.add.window.description': 'An opening for light and air',
	'editor.area.coordinates': 'Enter corner coordinates',
	'editor.area.coordinates-hint': 'Positions in metres from the plan origin (0, 0), with X increasing to the right and y downwards. Zero and negative values are allowed. Use a decimal point or comma; input rounds to whole millimetres.',
	'editor.area.corner': 'Corner {n}',
	'editor.area.x': 'X position (m)',
	'editor.area.y': 'Y position (m)',
	'editor.area.coordinate-invalid': 'Enter a position in metres, such as 0, -1.5 or 4.2.',
	'editor.area.coordinate-too-large': 'This position is too large to represent in whole millimetres.',
	'editor.area.duplicate': 'Another corner already has this position. Enter a different position.',
	'editor.area.add-corner': 'Add corner',
	'editor.area.update-corner': 'Apply corner change',
	'editor.area.reset-input': 'Discard coordinate entry',
	'editor.area.corner-position': 'Corner {n}: X {x} m, Y {y} m',
	'editor.area.edit-corner': 'Edit corner {n}',
	'editor.area.remove-corner': 'Remove corner {n}',
	'editor.area.edit': 'Edit',
	'editor.area.remove': 'Remove',
	'editor.area.pending-input': 'Apply or discard the coordinate entry before creating the area or editing another corner.',
	'editor.area.default-name': 'Area {n}',
	'editor.area.keep-adding': 'Keep adding areas',
	'editor.area.finish': 'Create area',
	'editor.add.area.synonyms': 'Garden, terrace, outdoor surface',
	'editor.task.add-area.name': 'Adding an area',
	'editor.task.add-area.instruction': 'Place at least three corners enclosing a surface, then click the first corner or choose create area. Enter also finishes. Esc discards the outline; cancel leaves the task.',
	'editor.add.area.label': 'Area',
	'editor.add.area.description': 'An outdoor surface with no walls',
	'editor.add.path.label': 'Path',
	'editor.add.path.description': 'A route to walk or drive',
	'editor.add.fence.label': 'Fence',
	'editor.add.fence.description': 'Marks the edge of a property',
	'editor.add.item.label': 'Item',
	'editor.add.item.description': 'A single piece of furniture or equipment',
	'editor.add.measurement.label': 'Measurement',
	'editor.add.measurement.description': 'A distance noted on the plan',
	'editor.add.note.label': 'Note',
	'editor.add.note.description': 'A reminder pinned to a spot',
	'editor.add.unsupported.not-yet': 'Not available in this version yet.',
	'editor.inspector': 'Inspector',
	'editor.inspector.multiple': 'Multiple objects selected.',
	'editor.inspector.name': 'Name',
	'editor.inspector.area': 'Area',
	'editor.inspector.delete-zone': 'Delete',
	'editor.inspector.requirements': 'Requirements',
	'editor.inspector.requirements.empty': 'No requirements reference this room or area yet.',
	'editor.inspector.requirement.asset': 'Asset',
	'editor.inspector.requirement.quantity': 'Quantity',
	'editor.inspector.requirement.cost': 'Cost',
	'editor.inspector.requirement.overridden': 'Overridden',
	'editor.inspector.requirement.stale': 'Figures are out of date; recalculate this requirement.',
	'editor.inspector.requirement.missing-asset': 'Asset missing from the catalog.',
	'editor.inspector.assign.label': 'Assign asset',
	'editor.inspector.assign.button': 'Assign',
	'editor.inspector.assign.placeholder': 'Choose an asset',
	'editor.inspector.assign.none': 'No assets in the library yet',
	'editor.inspector.quantity-override.label': 'Override quantity for',
	'editor.inspector.cost-override.label': 'Override cost for',
	'editor.inspector.override.reset': 'Reset to calculated',
	'editor.inspector.delete-zone.reassign-title': 'Move these requirements to which room or area?',
	'editor.inspector.floor.rooms': 'Rooms',
	'editor.inspector.floor.areas': 'Areas',
	'editor.inspector.floor.total-area': 'Total area',
	'editor.inspector.floor.planned-changes': 'Planned changes',
	'editor.inspector.floor.estimated-cost': 'Estimated cost',
	'editor.inspector.unavailable': 'Not available yet',
	'editor.inspector.partial': '{count} could not be read',
	'editor.inspector.floor.guidance': 'Select a room on the canvas or from the list to see its details.',
	'editor.inspector.floor.no-rooms': 'This floor has no rooms yet.',
	// The Room Inspector's own `<dl>` labels (Task 16), beside the existing `.area` one.
	// `.type` labels the value `editor.zone-type.*` resolves, keyed through a `Record` rather
	// than a template string so a type nothing labels is a compile error at the map instead
	// of an unresolved key discovered at render (`ZoneRenderModel.ZONE_TYPE_TOKENS`'s own
	// shape). `.floor-context` is a SEPARATE key from `editor.floor` even though the two
	// currently say the same word: one labels the property panel's Floor/Site tree, the other
	// labels which floor a selected room is on, and a copy change to one is not necessarily
	// a copy change to the other.
	'editor.inspector.type': 'Type',
	'editor.inspector.floor-context': 'Floor',
	'editor.inspector.status': 'Status',
	// ADR-0016's seven-member zone-type vocabulary, homeowner-worded. Keys are NOT
	// sentence-case-linted (only VALUES are); `Construction area` and `Other` are.
	'editor.zone-type.Room': 'Room',
	'editor.zone-type.Garden': 'Garden',
	'editor.zone-type.Terrace': 'Terrace',
	'editor.zone-type.Driveway': 'Driveway',
	'editor.zone-type.Roof': 'Roof',
	'editor.zone-type.ConstructionArea': 'Construction area',
	'editor.zone-type.Custom': 'Other',
	// `comingLater.ts`'s labels for the three homeowner questions, in canonical order
	// (component library §8).
	'editor.inspector.question.existing': 'What’s here',
	'editor.inspector.question.planned': 'What will change',
	'editor.inspector.question.work': 'What needs doing',
	// `comingLater.ts`'s labels for the four linked sections — Materials is design slice 10's
	// Requirements panel already and is not one of these (`INSPECTOR_SECTIONS`'s own docblock
	// states why).
	'editor.inspector.linked.costs': 'Costs',
	'editor.inspector.linked.documents': 'Documents',
	'editor.inspector.linked.photos': 'Photos',
	'editor.inspector.linked.notes': 'Notes',
	// The one line those seven labels are joined into (2026-09-12 side panels spec §3,
	// `comingLater.ts`). The labels keep their own capitals, so the list reads as names.
	'editor.inspector.coming-later': 'Coming later: {sections}',
	// §89's "beside what it replaced" at the INPUT level: the shared library's unit price, this
	// project's own, and the price the row's figures were actually derived from. `price-in-force`
	// is the §85 non-colour channel — a WORD beside the figure, so a screen reader reads it and a
	// user who cannot tell the two colours apart still knows which figure is being used.
	//
	// `editor.inspector.*`, with this surface's other keys. The task brief spelled these four
	// `view.inspector.*`; `view.*` everywhere else means the Renovation Project view, so that
	// prefix would have named the wrong surface. Ruled on rather than assumed. (Arrived with the
	// per-project price override increment on `main`; moved here when that branch merged into
	// the editor-foundation branch, whose Task 20 had already split the `editor.*` keys out.)
	'editor.inspector.price-library': 'Library price',
	'editor.inspector.price-project': 'Project price',
	'editor.inspector.price-in-force': 'In force',
	'editor.inspector.price-derived-from': 'Derived from',
	'editor.room.default-name': 'Room {n}',
	'editor.canvas': 'Plan canvas',
	'editor.status': 'Status',
	'editor.measurements': 'Measurements',
	'editor.save-state': 'Save state',
	'editor.zoom': 'Zoom',
	/**
	 * The angle constraint, announced because a modifier nothing mentions is a feature only
	 * its author knows about — the one real cost of the modifier-driven convention every
	 * drawing tool uses, and the reason the status bar carries this while a drawing tool is
	 * active. Deliberately not a numeric angle readout, which is what CAD shows beside its
	 * tracking line: `t()` takes no parameters, so the first interpolated string in this
	 * plugin is a piece of work of its own.
	 *
	 * Phrased with the key first because the marketplace's sentence-case rule
	 * (`obsidianmd/ui/sentence-case-locale-module`) refuses a capitalised `Shift` mid-sentence
	 * — measured, it fails the build — and lowercasing the name of a key is worse copy than
	 * leading with it.
	 */
	'editor.hint.constrain-angle': 'Shift constrains the angle',
	'editor.loading': 'Loading plan…',
	'editor.background-missing': 'The background file for this plan is missing.',
	'editor.background-failed': 'The background for this plan could not be rendered.',
	'editor.property-panel': 'Property and layers',
	'editor.floor': 'Floor',
	'editor.layer.reference-plan': 'Reference plan',
	'editor.layer.reference-plan.none': 'No reference plan has been added to this floor.',
	'editor.layer.reference-plan.guide-only': 'Shows the outline of the room or area this plan details.',
	'editor.layer.reference-plan.set-scale': 'Set scale',
	'editor.layer.rooms': 'Rooms',
	'editor.calibrate.distance.title': 'Set the real-world distance',
	'editor.calibrate.distance.label': 'Distance in millimetres',
	// 'Measured on the plan:' until Task B6, when `KnownDistanceForm` gained a second caller:
	// the asset designer measures on an asset's reference image, and the background is the one
	// noun true of both surfaces. The key keeps its `editor.` prefix because the FORM lives in
	// `presentation/editor/shell/` and a key rename orphans nothing but reads as a move.
	'editor.calibrate.distance.measured': 'Measured on the background:',
	'editor.calibrate.recalibrate.title': 'Rescale the walls, openings, rooms or areas on this plan?',
	'editor.calibrate.recalibrate.message': 'This plan already has walls, openings, rooms or areas drawn on it. Setting the scale rescales all their measurements. You can undo it.',
	// Task 18's temporary task banner: names the active creation task over the canvas and
	// offers a Cancel button. NOT `routeEscape` (R7, 2026-09-04): Cancel LEAVES the task —
	// clears any draft, returns to Select, never touches the selection — where Escape (Task 9)
	// instead steps back one interaction at a time through `routeEscape`. `draw-room` names the
	// TASK, not the `draw-polygon` tool id — the same distinction `editor.add.room.label`
	// already draws for the menu entry that starts it.
	'editor.task.banner': 'Current task',
	'editor.task.draw-room.name': 'Adding a room',
	'editor.task.draw-room.instruction': 'Click to place corners; click the first corner to finish.',
	// Task 2's own key: `RoomDraftStore.settle()`'s announced sentence, built from the
	// draft rect's own width, depth and area — never a translated fragment concatenated
	// with a number, per this file's own "one key per label" rule.
	'editor.room.settled': '{width} m by {depth} m, {area}',
	'editor.task.calibrate.name': 'Setting the scale',
	'editor.task.calibrate.instruction': 'Click two points a known distance apart.',
	'editor.task.cancel': 'Cancel',
	// Task 6 (design spec 2026-09-03, Add Room): the room creation task's own vocabulary — the
	// add-room task banner, the New Room form (its name-suggestion buttons and its width/depth/
	// area fields) and `parseMetres`'s three length refusals. `editor.room.cancel` is the form's
	// OWN Cancel button, a second door to the same `runtime.cancelActiveTask()` the banner's
	// `editor.task.cancel` above already calls (spec §9) — two doors, one action.
	'editor.task.add-room.name': 'Adding a room',
	'editor.task.add-room.instruction': 'Drag on the floor to size the room, or type its width and depth.',
	'editor.task.finish': 'Create room',
	'editor.task.finish.blocked': 'Size the room and give it a name first',
	'editor.room.new.heading': 'New room',
	'editor.room.name': 'Name',
	'editor.room.suggestion.prompt': 'What room is this?',
	'editor.room.suggestion.kitchen': 'Kitchen',
	'editor.room.suggestion.living-room': 'Living room',
	'editor.room.suggestion.bedroom': 'Bedroom',
	'editor.room.suggestion.bathroom': 'Bathroom',
	'editor.room.suggestion.hallway': 'Hallway',
	'editor.room.suggestion.office': 'Office',
	'editor.room.width': 'Width (m)',
	'editor.room.depth': 'Depth (m)',
	'editor.room.area': 'Area',
	'editor.room.keep-adding': 'Keep adding rooms',
	'editor.room.create': 'Create room',
	'editor.room.cancel': 'Cancel',
	'editor.room.error.not-a-number': 'Enter a length in metres, such as 4.2',
	'editor.room.error.not-positive': 'A side must be longer than zero',
	'editor.room.error.too-large': 'A side cannot be longer than 1000 m',
	// Task 19's constrained and unsupported layouts (design spec §5.4/§5.5). The rail's two
	// labels are TEXT rather than icons — this plugin calls `setIcon` nowhere — and `details`
	// names the Inspector the way a homeowner would, which is why the rail id and the overlay
	// kind (`inspector`) deliberately differ.
	'editor.rail.layers': 'Layers',
	'editor.rail.details': 'Details',
	'editor.overlay.close': 'Close panel',
	'editor.unsupported-width.headline': 'This pane is too narrow to edit the floor plan',
	// THREE keys chosen at the caller (R12), never a plural mechanism added to `tr`: `.one` and
	// `.other` inflect the room count English requires, and `.partial` withholds the count
	// entirely rather than presenting a lower bound as complete — a pane too narrow to draw
	// still says WHICH plan it is refusing to draw, and never a wrong grammar or a false total.
	// The counterpart action is the only thing this state can offer.
	'editor.unsupported-width.body.one': '{floor} has 1 room. Widen the pane or focus this tab to edit.',
	'editor.unsupported-width.body.other': '{floor} has {rooms} rooms. Widen the pane or focus this tab to edit.',
	'editor.unsupported-width.body.partial':
		'Not every record on {floor} could be read, so its room count is unknown. Widen the pane or focus this tab to edit.',
	'editor.unsupported-width.action': 'Focus this tab',
	// Task 20's status bar additions. `.scale.*` says whether `PlanDto.calibration` is set — a
	// number would need `t()`'s interpolation for a unit no homeowner reads usefully off a
	// status bar anyway. `.hint.pan` sits beside `.hint.constrain-angle` under the same
	// argument that key's own comment already makes: a modifier nothing mentions is a feature
	// only its author knows about, so the status bar is where it is admitted to.
	//
	// Phrased with the key first for the same reason `.hint.constrain-angle` is: the
	// marketplace's sentence-case rule (`obsidianmd/ui/sentence-case-locale-module`) refuses
	// a capitalised `Space` mid-sentence — measured, it fails the build — and "hold space to
	// pan" reads as an instruction to hold down the word rather than the key.
	'editor.status.scale.calibrated': 'Scale set',
	'editor.status.scale.uncalibrated': 'Scale not set',
	'editor.hint.pan': 'Space or the middle button pans',
	// R5 (2026-09-04): the persistent warning strip's per-item severity mark, a word beside
	// `data-rp-severity` — SDD §85's "status not colour-only", read at slice 13's own "a word
	// is not a colour" cost: both, never one.
	'editor.warning.severity.warning': 'Warning',
	'editor.warning.severity.error': 'Error',
	// The trust path (checkpoint C3). `editor.stale-write-refused` IS an error code: the gate
	// refuses with it and `toUserMessage` resolves the code as its own key.
	'editor.stale-write-refused': 'Editing is paused until the floor is re-read.',
	'editor.paused.reason': 'Editing is paused: the floor could not be re-read after the last change. Retry from the warning above.',
	'editor.hint.paused': 'Editing paused until the floor is re-read',
	'editor.refresh-failed.again': 'Re-reading failed again; what you see may still be out of date.',
	'editor.warning.retry': 'Try again',
	'editor.warning.open-source-note': 'Open source note',
	'editor.unrecovered': 'A change was written but could not be completed or undone. Inspect the floor’s note before editing further.',
	'editor.source-note-missing': 'The floor’s note could not be found.',
	'editor.rename.action': 'Rename room',
	'editor.rename.title': 'Rename room',
	'editor.rename.name': 'Room name',
	'editor.rename.current': 'Current saved name: {name}',
	'editor.rename.hint': 'Names may be shared by multiple rooms. Renaming keeps the room’s identity and note filename.',
	'editor.rename.latest': 'Latest saved name: {name}. Your draft is retained. Cancel and reopen to use this baseline.',
	'editor.rename.latest-unavailable': 'The current room could not be read. Your draft is retained. Cancel and reopen after refreshing.',
	'editor.rename.paused': 'Renaming is paused while saving or until the floor is refreshed.',
	'editor.rename.apply': 'Apply name',
	'zone.empty-name': 'Enter a room name.',
	'editor.view': 'View',
	'editor.view.fit-floor': 'Fit floor',
	'editor.view.fit-selection': 'Fit selection',
	'editor.view.fit-nothing': 'Nothing on this floor to fit yet.',
	'editor.view.zoom-in': 'Zoom in',
	'editor.view.zoom-out': 'Zoom out',
	'editor.view.grid': 'Show grid',
	'editor.view.snap': 'Snap to objects',
	'editor.view.snap-hint': 'The grid is a visual guide; hold shift to constrain drawing angles, while wall openings stay attached to their wall.',
	'editor.status.grid-on': 'Grid on',
	'editor.status.grid-off': 'Grid off',
	'editor.status.snap-on': 'Snap on',
	'editor.status.snap-off': 'Snap off',
} as const;

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
 * `editor.zone.default-name` in the source file's reading order. They stayed in `en.ts`.
 */
export const editorEn = {
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
	'editor.inspector.delete-zone': 'Delete zone',
	'editor.inspector.requirements': 'Requirements',
	'editor.inspector.requirements.empty': 'No requirements reference this zone yet.',
	'editor.inspector.requirement.asset': 'Asset',
	'editor.inspector.requirement.quantity': 'Quantity',
	'editor.inspector.requirement.cost': 'Cost',
	'editor.inspector.requirement.overridden': 'Overridden',
	'editor.inspector.requirement.stale': 'Figures are out of date; recalculate this requirement.',
	'editor.inspector.requirement.missing-asset': 'Asset missing from the catalog.',
	'editor.inspector.assign.label': 'Assign asset',
	'editor.inspector.assign.button': 'Assign',
	'editor.inspector.quantity-override.label': 'Override quantity for',
	'editor.inspector.cost-override.label': 'Override cost for',
	'editor.inspector.override.reset': 'Reset to calculated',
	'editor.inspector.delete-zone.reassign-title': 'Move these requirements to which zone?',
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
	// ADR-0016's seven-member zone-type vocabulary, homeowner-worded. Keys are NOT
	// sentence-case-linted (only VALUES are); `Construction area` and `Other` are.
	'editor.zone-type.Room': 'Room',
	'editor.zone-type.Garden': 'Garden',
	'editor.zone-type.Terrace': 'Terrace',
	'editor.zone-type.Driveway': 'Driveway',
	'editor.zone-type.Roof': 'Roof',
	'editor.zone-type.ConstructionArea': 'Construction area',
	'editor.zone-type.Custom': 'Other',
	// `HomeownerQuestionNav`'s three rows, in canonical order (component library §8).
	'editor.inspector.question.existing': 'What’s here',
	'editor.inspector.question.planned': 'What will change',
	'editor.inspector.question.work': 'What needs doing',
	// `LinkedContentList`'s four rows — Materials is design slice 10's Requirements panel
	// already and is not one of these (`INSPECTOR_SECTIONS`'s own docblock states why).
	'editor.inspector.linked.costs': 'Costs',
	'editor.inspector.linked.documents': 'Documents',
	'editor.inspector.linked.photos': 'Photos',
	'editor.inspector.linked.notes': 'Notes',
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
	'editor.zone.default-name': 'Zone',
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
	'editor.layer.reference-plan.set-scale': 'Set scale',
	'editor.layer.rooms': 'Rooms',
	'editor.calibrate.distance.title': 'Set the real-world distance',
	'editor.calibrate.distance.label': 'Distance in millimetres',
	// 'Measured on the plan:' until Task B6, when `KnownDistanceForm` gained a second caller:
	// the asset designer measures on an asset's reference image, and the background is the one
	// noun true of both surfaces. The key keeps its `editor.` prefix because the FORM lives in
	// `presentation/editor/shell/` and a key rename orphans nothing but reads as a move.
	'editor.calibrate.distance.measured': 'Measured on the background:',
	'editor.calibrate.recalibrate.title': 'Rescale the zones on this plan?',
	'editor.calibrate.recalibrate.message': 'This plan already has zones drawn on it. Setting the scale rescales every one of them. You can undo it.',
	// Task 18's temporary task banner: names the active creation task over the canvas and
	// offers a Cancel button. NOT `routeEscape` (R7, 2026-09-04): Cancel LEAVES the task —
	// clears any draft, returns to Select, never touches the selection — where Escape (Task 9)
	// instead steps back one interaction at a time through `routeEscape`. `draw-room` names the
	// TASK, not the `draw-polygon` tool id — the same distinction `editor.add.room.label`
	// already draws for the menu entry that starts it.
	'editor.task.banner': 'Current task',
	'editor.task.draw-room.name': 'Adding a room',
	'editor.task.draw-room.instruction': 'Click to place corners; click the first corner to finish.',
	'editor.task.calibrate.name': 'Setting the scale',
	'editor.task.calibrate.instruction': 'Click two points a known distance apart.',
	'editor.task.cancel': 'Cancel',
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
} as const;

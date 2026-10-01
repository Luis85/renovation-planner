/**
 * AD18 item 7 (the guided trace checklist) and the empty Reference tab panel — card W10-B's copy.
 *
 * **Created EMPTY by the integrator before wave 10 was dispatched**, for the reason
 * `en/designerToolbarIcons.ts`'s header gives: `en/editor.ts` is the one composition point, and
 * two parallel cards cannot both hold it.
 *
 * **Five steps, not six.** AD12-R1 deletes `Lock reference` and only that one — it is already true
 * by construction, so no control is owed and no string is either. Board 02's other five (choose
 * image, calibrate scale, trace footprint, add details, verify dimensions) are AD12 card item 1's
 * guided sequence and are not ruled out.
 *
 * **`designer.trace.image` says "sheet" where the board says "image", deliberately.** Every other
 * string on this surface calls the traced document a SHEET — `designer.reference.sheet`,
 * `designer.reference.sheet.none` — and it is a PDF page as often as a picture. A sixth word for
 * the thing the panel above already names would be a second vocabulary for one object.
 *
 * **`designer.trace.done` is the only state word, and it is visually hidden.** The step list marks
 * the current step with `aria-current` and strikes the finished ones through in CSS; neither
 * reaches a screen reader, so the finished ones carry this word off-screen. There is no matching
 * word for a step still to do — an unmarked checklist item already reads as undone, and inventing
 * "to do" would put a second announcement on every row that has nothing to announce.
 */
export const designerTraceEn = {
	'designer.trace': 'Tracing steps',
	'designer.trace.image': 'Choose a sheet',
	'designer.trace.scale': 'Calibrate the scale',
	'designer.trace.footprint': 'Trace the footprint',
	'designer.trace.details': 'Add details',
	'designer.trace.dimensions': 'Verify the dimensions',
	'designer.trace.done': 'Done',
} as const;

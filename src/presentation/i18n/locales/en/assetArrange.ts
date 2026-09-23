/**
 * The asset designer's COMPOSITION vocabulary (AD10): group and ungroup, align, distribute,
 * repeat, and the refusals each of them can answer.
 *
 * Its own module for `assetEntryPaths.ts`'s reason. Spread into `en/editor.ts`.
 *
 * **The `asset.*` entries are error CODES, not labels** — `toUserMessage` looks a refusal up by its
 * code, so a key here whose name is a code is how a domain refusal gets a sentence instead of the
 * generic category one. Only the codes AD10's own controls can actually raise are listed, and the
 * ones left out are left out for two DIFFERENT reasons worth keeping apart:
 *
 * - `invalid-group-id` and `empty-group` describe states no control here can produce — the ids and
 *   the membership are minted by `groupEdits`, never typed.
 * - `dangling-group-member` is unreachable through this door because it is PRE-EMPTED:
 *   `groupDetails` resolves through `resolveParticipants` first, which answers `asset.part-not-found`
 *   for the same input before the aggregate is asked. The same pre-emption takes the
 *   one-graphic-named-twice arm of `overlapping-groups` under `asset.duplicate-part`; the code is
 *   listed all the same, because the Group button being withheld for an already-grouped selection is
 *   a fact about the RENDER, and the shape an edit is handed is read when the edit runs — a peer leaf
 *   that grouped those graphics since is a press whose button was drawn correctly and refused anyway.
 *
 * Copy for a refusal nothing can reach is copy nobody has read, which is why the list is narrow.
 */
export const assetArrangeEn = {
	'designer.arrange': 'Arrange',
	'designer.arrange.group': 'Group',
	'designer.arrange.ungroup': 'Ungroup',
	'designer.arrange.group-front': 'Bring group to front',
	'designer.arrange.group-back': 'Send group to back',
	'designer.arrange.reference': 'Align to',
	'designer.arrange.reference.bounds': 'The selection bounds',
	// The key object is named, so "which part stays put" is readable rather than a convention.
	'designer.arrange.reference.key': '{name}, which stays put',
	'designer.arrange.align.left': 'Align left',
	'designer.arrange.align.centre-x': 'Centre across',
	'designer.arrange.align.right': 'Align right',
	'designer.arrange.align.top': 'Align top',
	'designer.arrange.align.centre-y': 'Centre down',
	'designer.arrange.align.bottom': 'Align bottom',
	// Centres and gaps are named in the label itself, because C06 asks that the choice be stated
	// rather than inferred and a button whose meaning lives in a docblock states nothing.
	'designer.arrange.distribute.centres-x': 'Even centres across',
	'designer.arrange.distribute.centres-y': 'Even centres down',
	'designer.arrange.distribute.gaps-x': 'Even gaps across',
	'designer.arrange.distribute.gaps-y': 'Even gaps down',
	'designer.arrange.move-x': 'Move across in millimetres',
	'designer.arrange.move-y': 'Move down in millimetres',
	'designer.arrange.scale-by': 'Scale by a factor',
	// The compact row's short visible labels (AD18-R16 Task 5), the same split
	// `assetSymbols.ts`'s own `.short` keys carry. Scale by has no unit — a bare factor.
	'designer.arrange.move-x.short': 'Move across',
	'designer.arrange.move-y.short': 'Move down',
	'designer.arrange.scale-by.short': 'Scale by',
	'designer.arrange.repeat': 'Repeat',
	'designer.arrange.repeat.count': 'Copies',
	'designer.arrange.repeat.spacing': 'Spacing in millimetres',
	// The compact row's short visible label for Spacing (AD18-R16 Task 5 follow-up); Copies
	// needs no separate key, since `designer.arrange.repeat.count` ("Copies") is already the
	// short form and is passed as both the row's visible text and its accessible name.
	'designer.arrange.repeat.spacing.short': 'Spacing',
	'designer.arrange.repeat.axis': 'Direction',
	'designer.arrange.repeat.axis.x': 'Across',
	'designer.arrange.repeat.axis.y': 'Down',
	'designer.arrange.repeat.mode': 'Spacing measures',
	'designer.arrange.repeat.mode.centres': 'Centre to centre',
	'designer.arrange.repeat.mode.gaps': 'The gap between copies',
	'designer.arrange.repeat.run': 'Add the copies',
	// The preview: the step a gap mode resolves to differs from the number typed, which is the
	// whole reason the two modes need telling apart before the write rather than after it.
	'designer.arrange.repeat.preview': '{count} copies, each {step} mm on from the one before',
	'asset.too-few-parts': 'This arrangement needs more parts than are selected.',
	'asset.duplicate-part': 'A part was named twice in one arrangement.',
	'asset.locked-part': 'A selected part is locked. Unlock it, or leave it out of the selection.',
	'asset.key-part-not-selected': 'The part chosen to stay put is not one of the selected parts.',
	'asset.group-not-found': 'That group is no longer in the design.',
	'asset.overlapping-groups': 'A selected part is already in another group. Ungroup it first.',
	// **The limit is NOT repeated here.** `MAX_REPEAT_COPIES` is what the domain enforces and what the
	// count field's own `max` attribute shows; a number typed into this sentence is a second copy that
	// drifts, and an error template has no way to be handed one (`toUserMessage` fills `{names}` and
	// nothing else).
	'asset.repeat-count-out-of-range': 'That is more copies than one repeat can add, or not a whole number of them.',
	'asset.repeat-spacing-invalid': 'A repeat spacing must be a number of millimetres.',
	// Ruling AD10-R1: the refusal names BOTH halves, because "these cannot be arranged together" with
	// no reason is a dead end, and the way out (calibrate, or narrow the selection) is the copy.
	'asset.mixed-coordinate-spaces':
		'Some of these parts are still in background pixels and others are measured, so they cannot be arranged together. Calibrate the drawing first, or leave one of them out.',
} as const;

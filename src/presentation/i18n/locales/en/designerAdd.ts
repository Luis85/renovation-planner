/**
 * AD18 item 5 — the `Add` section of the left rail — card W11-A's copy.
 *
 * **Created EMPTY by the integrator before wave 11 was dispatched**, for the reason
 * `en/designerTrace.ts`'s header gives: `en/editor.ts` is the one composition point for feature
 * copy, and a card that added its own import and spread line would be editing a file the
 * integrator owns.
 *
 * **What this table does NOT need, measured rather than predicted — because wave 10's equivalent
 * header predicted more keys than it turned out to need and said so afterwards.** The four
 * drawing tools keep the labels they already have. `DESIGNER_TOOL_LABELS` names them
 * `designer.toolbar.draw-rect`, `-rounded-rect`, `-circle` and `-line`, and `DesignerToolButton`
 * reads the same key for the visible text and for `aria-label`, so a button that moves from the
 * toolbar into the rail carries its copy with it and adds none.
 *
 * **Which makes those four key NAMES stale the moment this card lands, and they are deliberately
 * NOT renamed.** Wave 10's `designerToolbarIcons.ts` header records naming the shape GROUP
 * `designer.shapes.group` precisely so it would outlive the toolbar — that reasoning was right
 * about the group and reached exactly one key; the four button labels were never renamed and the
 * hand-off into this wave read the narrow fact as the wide one. Renaming them now is six locale
 * files and 43 `toolbarButton(...)` call sites of churn for a string nobody reads: a locale key is
 * DATA the code looks a translation up by, not user-visible text, and this repository's rule about
 * renaming data (a view type, a command id) is that the cost lands on somebody who has something
 * bound to the old name. Nothing is bound here, so this is churn rather than breakage — which is
 * why it is refused as not worth the diff rather than as unsafe.
 *
 * So what lands here is the section's own chrome: its heading, and the preset door AD18-R6 moves
 * out of the Inspector. If the card finds it needs nothing at all, an empty table that ships is a
 * true statement about the copy this feature adds, and the header above is the record of why.
 *
 * **It turned out to need exactly ONE key, and the prediction above is the reason to say which.**
 * The heading is new copy and has nowhere else to come from. The preset door reuses
 * `designer.inspector.start-preset` — the SAME string it carried in the Inspector, and the same
 * one `DesignerEntryPaths` already reuses, so the gesture's two spellings say the same words as
 * well as calling the same function. That key's name is stale in exactly the way the four shape
 * keys are, and is left alone for the same reason.
 *
 * `designer.shapes.group` stays where wave 10 minted it (`designerToolbarIcons.ts`): the group
 * label outlived the toolbar exactly as that card intended, and moving the ENTRY between locale
 * modules would be churn with no reader.
 *
 * **Four more keys landed in the Task 3 fix round, and they are new copy rather than a rename of
 * the four above.** The integrator's rendered check found the tile grid overflowing at 176px
 * because `repeat(2, 1fr)` sized each column to the LONGEST unbreakable label
 * (`designer.toolbar.draw-rounded-rect`, "Draw rounded rectangle"), and separately found board 01
 * labelling the tile with the shape's name alone — "Rectangle", not "Draw rectangle". So the rail
 * needs a SHORTER visible label than its accessible name, which stays `designer.toolbar.draw-*`
 * (unchanged, still the toolbar's copy too). WCAG 2.5.3 label-in-name holds: each short label is a
 * literal substring of its own accessible name ("Rectangle" ⊂ "Draw rectangle", and so on for the
 * other three) — `designerAddRail.test.ts` pins that containment rather than trusting the pairing
 * by construction.
 */
export const designerAddEn = {
	/**
	 * The rail's `Add` section — its `<h2>` and its `aria-label`, the same string in both, which is
	 * what WCAG 2.5.3 asks of a visible label and an accessible name that could otherwise disagree.
	 * One word, because it names half a rail beside `Parts` and the two are read as a pair.
	 */
	'designer.add': 'Add',
	/** The tile's own visible text (Task 3 fix round) — board 01's shape name, not the verb. */
	'designer.add.tile-rect': 'Rectangle',
	'designer.add.tile-rounded-rect': 'Rounded rectangle',
	'designer.add.tile-circle': 'Circle',
	'designer.add.tile-line': 'Line',
} as const;

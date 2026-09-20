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
 */
export const designerAddEn = {} as const;

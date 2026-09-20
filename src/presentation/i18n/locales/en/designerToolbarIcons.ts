/**
 * AD18 item 3 (icon toolbar) and item 6 (canvas proportion) — card W10-A's copy.
 *
 * **Created EMPTY by the integrator before wave 10 was dispatched**, which is this package's
 * recorded way of leasing locale copy to parallel cards: `en/editor.ts` composes every feature
 * table, so two cards that both added their own import and spread line would put one file in two
 * lease rows. The table and its wiring are the integrator's; the KEYS are W10-A's, and this file
 * is the only locale module that card may edit.
 *
 * The icon toolbar is where most of these will land: `HostIcon.vue` draws the glyph and the label
 * that used to be the button's text becomes its `aria-label`, so the copy does not disappear with
 * the words — it moves to the accessible name.
 *
 * **It turned out to need ONE key, and the reason is worth stating because the sentence above
 * predicted more.** Every tool's label already exists — `designer.toolbar.*`, spread here from
 * `assetSymbols.ts` and `assetOpenLines.ts` — and `DesignerToolButton.vue` reads the SAME key for
 * the visible text and for `aria-label`, so iconifying a button adds no copy at all. What has no
 * key yet is the shape GROUP the toolbar now draws around the four drawing tools, and it is named
 * `designer.shapes.*` rather than `designer.toolbar.*` deliberately: the user's wave-10 ruling
 * moves those buttons into AD18 item 5's `Add` rail, so the group outlives the toolbar it is
 * currently drawn in and a toolbar-shaped key would be wrong the moment wave 11 lands.
 */
export const designerToolbarIconsEn = {
	'designer.shapes.group': 'Basic shapes',
} as const;

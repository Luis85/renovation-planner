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
 */
export const designerToolbarIconsEn = {} as const;

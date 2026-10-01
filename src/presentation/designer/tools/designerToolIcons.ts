import type { IconName } from 'obsidian';
// A TYPE import of a value, because `keyof typeof` is the only thing this module asks of that
// table — so the totality below is enforced with no runtime edge to the registration module,
// which is what keeps this file importable from anywhere the `Add` rail eventually lives.
import type { DESIGNER_TOOL_LABELS } from './registerDesignerTools';
import type { StringKey } from '../../i18n/locales/en';

/**
 * The glyph each designer tool wears, and which half of the toolbar it belongs to (AD18 item 3).
 *
 * **A MODULE rather than a `const` in `DesignerToolbar.vue`, and the reason is the same one that
 * put `DESIGNER_TOOL_LABELS` in this directory**: a binding declared in `<script setup>` is not a
 * module export, so no other component can import it. The first draft of this table lived in the
 * toolbar and its own comment promised that AD18 item 5's `Add` rail would "read the same table
 * and filter `group === 'shape'`" — which the structure refused, since that rail is a new
 * component. The promise was the thing worth keeping, so the table moved rather than the
 * sentence being narrowed. Nothing about the values changed in that move.
 *
 * **TOTAL over `DESIGNER_TOOL_LABELS`'s keys by TYPE**, which is the mechanism that table's own
 * docblock leans on and the reason this is a record rather than a list: a tool added there with
 * no entry here is a build error in this file, not a button that draws an empty box. The
 * `satisfies` enforces both directions — a missing key fails the `Record`, an invented one fails
 * as an excess property. Both arms were driven with `@ts-expect-error` probes at W10-A's review
 * rather than reasoned about.
 *
 * **`group` existed for wave 11 rather than for the card that added it, and wave 11 has
 * landed.** The user's wave-10 ruling (AD18-R3) is that the Basic-shape buttons MOVE into the
 * `Add` rail. They did: `DesignerAddPanel.vue` filters this table on `group === 'shape'` and
 * `DesignerToolbar.vue` filters on its complement, so the four are drawn in the rail and the rest
 * in the toolbar, and every registered tool is drawn exactly once because the two predicates
 * partition a two-valued field. `designerAddRail.test.ts` pins that against THIS table rather
 * than against either template. The tool table itself did not move, so a tool stays registered
 * and reachable however its button travels — which was the point of putting the discriminator
 * here instead of writing a list out in a template.
 *
 * **Every name here draws in the browser harness now, and both halves of that were false until
 * wave 13.** `tests/fixtures/editor-icons/` held no `circle`, no `squircle` and no `anchor`, so
 * `npm run harness` marked those three `data-icon-missing` rather than drawing a different glyph,
 * which is that directory's stated rule. All three have a pinned fixture and an entry in
 * `tests/helpers/editorIconNodes.ts` since — an SVG without the map entry renders nothing, so it
 * took both — and `designerIconToolbar.test.ts` pins that missing set as EMPTY. The pin therefore
 * still moves in the direction that has work left: a tool added to this table with no fixture
 * behind its glyph turns it red.
 *
 * In a vault they resolve through Obsidian's own `setIcon` like every other name here, and
 * `squircle` in particular is no longer the open question this paragraph used to record. The
 * repository owner ran `npm run test-build` at c6d0f893c on 2026-09-21, opened the worktree as a
 * vault and walked the `Add` rail and the toolbar: all five icon-only buttons drew a glyph.
 * **Read that narrowly.** The Obsidian VERSION was not captured, so it is one installed
 * catalogue, one machine, one date — more than a harness fixture can ever prove, and less than a
 * pinned claim. `docs/tasks/asset-designer-expansion/execution/state.json` carries the record.
 *
 * **Every glyph is distinct, and that is a rule rather than an accident**: once the label is
 * hidden the glyph is the only thing that tells two buttons apart on screen, and reusing one
 * would ship two controls that look identical and do different things with every label-reading
 * test still green. `designerIconToolbar.test.ts` is what refuses it.
 *
 * **One partial hid a label at every width, until Task 3's fix round — updated here because a
 * stale claim in this file is as much a defect as one in the code it describes.** Wave 11 shipped
 * `styles/designer-add.css` hiding `.rp-designer-tool-label` unconditionally, which is what the
 * paragraph above used to say; board 01 draws a visible label under the icon instead, so that rule
 * now shows the text at every width. `styles/designer-toolbar.css` hides the TOOLBAR's copy at
 * every width since AD18-R17 Task 2 (it was below 80rem). So the `'shape'` rows, all in the rail,
 * are never icon-only, and glyph distinctness is no longer the rail's ONLY signal — the tile's
 * own short label (`designer.add.tile-*`, below) tells two tiles apart too — but
 * `designerIconToolbar.test.ts` still refuses a reused glyph regardless, since every toolbar
 * button is icon-only at every width and a glyph shared with a rail tile would be reused copy.
 */
export const DESIGNER_TOOL_ICONS = {
	select: { icon: 'mouse-pointer-2', group: 'tool' },
	'trace-footprint': { icon: 'land-plot', group: 'tool' },
	'trace-clearance': { icon: 'square-dashed', group: 'tool' },
	'draw-rect': { icon: 'rectangle-horizontal', group: 'shape' },
	'draw-rounded-rect': { icon: 'squircle', group: 'shape' },
	'draw-circle': { icon: 'circle', group: 'shape' },
	'draw-line': { icon: 'minus', group: 'shape' },
	'trace-detail': { icon: 'pencil', group: 'tool' },
	'set-anchor': { icon: 'anchor', group: 'tool' },
	'set-facing': { icon: 'arrow-up-right', group: 'tool' },
	calibrate: { icon: 'ruler', group: 'tool' },
} as const satisfies Readonly<Record<keyof typeof DESIGNER_TOOL_LABELS, { icon: IconName; group: 'tool' | 'shape' }>>;

/**
 * The literal ids `DESIGNER_TOOL_ICONS` groups as `'shape'`, extracted BY TYPE — Task 3's fix
 * round, for `SHAPE_TILE_LABELS` below: a fifth shape added to the table above with no entry
 * below is a compile error rather than a tile silently rendering `undefined`. A plain `.ts` module
 * rather than a `const` inside `DesignerAddPanel.vue`'s `<script setup>`, for the reason this
 * file's own header gives about `DESIGNER_TOOL_ICONS` itself: a `<script setup>` binding is not a
 * module export, so `designerAddRail.test.ts` could not otherwise import the real table and would
 * have to keep a second, hand-written copy that could drift from it.
 */
export type ShapeToolId = { [K in keyof typeof DESIGNER_TOOL_ICONS]: (typeof DESIGNER_TOOL_ICONS)[K]['group'] extends 'shape' ? K : never }[keyof typeof DESIGNER_TOOL_ICONS];

/**
 * The tile's own visible text (Task 3 fix round) — board 01 labels a tile with the shape's name
 * ("Rectangle"), not the toolbar's verb phrase ("Draw rectangle", `DESIGNER_TOOL_LABELS`) that
 * stays every tile's accessible name. `en/designerAdd.ts`'s header carries the label-in-name
 * argument (each short label is a literal substring of its own `designer.toolbar.draw-*` string);
 * `designerAddRail.test.ts` pins the containment rather than trusting it by construction.
 */
export const SHAPE_TILE_LABELS = {
	'draw-rect': 'designer.add.tile-rect',
	'draw-rounded-rect': 'designer.add.tile-rounded-rect',
	'draw-circle': 'designer.add.tile-circle',
	'draw-line': 'designer.add.tile-line',
} as const satisfies Readonly<Record<ShapeToolId, StringKey>>;

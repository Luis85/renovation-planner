import type { IconName } from 'obsidian';
// A TYPE import of a value, because `keyof typeof` is the only thing this module asks of that
// table — so the totality below is enforced with no runtime edge to the registration module,
// which is what keeps this file importable from anywhere the `Add` rail eventually lives.
import type { DESIGNER_TOOL_LABELS } from './registerDesignerTools';

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
 * **TWO partials hide a label now, under different conditions, which is why that sentence no
 * longer names one.** `styles/designer-toolbar.css` hides it below 80rem;
 * `styles/designer-add.css` hides the rail's at EVERY width. So the `'shape'` rows are in the
 * state this rule guards against permanently and the others only at a narrow leaf — distinctness
 * got strictly harder to satisfy at AD18 item 5, not easier.
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

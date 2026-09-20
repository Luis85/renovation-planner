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
 * **`group` exists for wave 11 rather than for the card that added it.** The user's wave-10
 * ruling is that the Basic-shape buttons MOVE into the `Add` rail; that rail does not exist yet,
 * so the four are drawn in the toolbar inside one named group. Wave 11 changes where the
 * `'shape'` rows are DRAWN and nothing about what they are — which is why the discriminator is a
 * field of this table rather than a list written out in a template. The tool table itself does
 * not move, so a tool stays registered and reachable however its button travels.
 *
 * Three of these names have no harness fixture: `tests/fixtures/editor-icons/` holds no `circle`,
 * no `squircle` and no `anchor`, so `npm run harness` marks those three `data-icon-missing`
 * rather than drawing a different glyph, which is that directory's stated rule. In a vault they
 * resolve through Obsidian's own `setIcon` like every other name here; whether the installed host
 * catalogue answers `squircle` in particular is verified nowhere in this repository, the same
 * caveat that README already records for `clipboard-paste` and `building`.
 * `designerIconToolbar.test.ts` pins that missing set EXACTLY, so adding a fixture turns a test
 * red rather than passing unnoticed.
 *
 * **Every glyph is distinct, and that is a rule rather than an accident**: once the label is
 * hidden (`styles/designer-toolbar.css`, below 80rem) the glyph is the only thing that tells two
 * buttons apart on screen, and reusing one would ship two controls that look identical and do
 * different things with every label-reading test still green. `designerIconToolbar.test.ts` is
 * what refuses it.
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

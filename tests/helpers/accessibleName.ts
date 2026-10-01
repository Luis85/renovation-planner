/**
 * An element's accessible name for a resolver that finds a designer button by what it is
 * CALLED — `aria-label` when the element carries one, trimmed `textContent` otherwise,
 * mirroring the browser's own accessible-name computation (an explicit label wins, text content
 * is the fallback) rather than assuming the two always agree.
 *
 * Shared by `tests/helpers/designerRig.ts`'s `toolbarButton` and `tests/harness/assetDesigner.ts`'s
 * `pressTool`, both of which resolve a designer tool button by its label and both of which broke
 * identically once Task 3 (AD18-R16) gave the Add rail's tiles a VISIBLE label shorter than their
 * accessible name (`DesignerToolButton`'s optional `visibleLabel` prop — "Circle" on screen,
 * "Draw circle" as `aria-label`). One definition rather than two copies that could drift, since
 * both call sites need the identical rule for the identical reason.
 *
 * The fallback exists because `.rp-designer-tools`/`.rp-designer-add` hold a SECOND kind of
 * button that carries no `aria-label` at all: `DesignerSelectionModes.vue`'s mode buttons
 * ("Edit points", "Bend edges"), whose own docblock states the button's text stays its
 * accessible name. Reading `aria-label` alone would leave those unresolvable.
 */
export function accessibleName(element: Element): string {
	return element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '';
}

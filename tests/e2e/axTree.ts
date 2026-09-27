import type { NativeBrowser } from './session';

/**
 * Chromium's OWN accessibility tree for one DOM element, read over CDP — the tree a screen reader
 * is handed, computed by the browser rather than inferred from attribute strings, so an IMPLICIT
 * live region (an `<output>`, a `role="log"`) counts exactly as an explicit `aria-live` does.
 *
 * What it cannot read is what a screen reader SPEAKS: that is the assistive technology's own
 * decision, made from this tree, and no instrument here drives one.
 *
 * **Poll it; nothing announces a change.** Probe Q1 (`.superpowers/sdd/audit2/probe.md`) measured
 * `Accessibility.nodesUpdated` firing zero times while the text changed underneath, and a full tree
 * costing tens of milliseconds. So a case wraps a read in `expect.poll`, whose deadline
 * `tests/e2e/vitest.config.mts` bounds; this module adds no loop of its own.
 */

interface AXValue {
	value?: unknown;
}
interface AXNode {
	nodeId: string;
	ignored: boolean;
	role?: AXValue;
	name?: AXValue;
	properties?: { name: string; value: AXValue }[];
	parentId?: string;
	backendDOMNodeId?: number;
}

const propertyOf = (node: AXNode, name: string): unknown => node.properties?.find((p) => p.name === name)?.value.value;

interface DomNode {
	backendNodeId: number;
	children?: DomNode[];
}
const subtreeIds = (node: DomNode): number[] => [node.backendNodeId, ...(node.children ?? []).flatMap((child) => subtreeIds(child))];

/**
 * What Chromium hands a screen reader for the first element matching `selector`, or `null` when
 * nothing matches.
 *
 * **Read from the TEXT up, not from the element**: an element Chromium folds into its parent (a
 * generic `<span>`) has no AX node of its own, and measured, the save-state label lost its own
 * node the moment an `<output>` wrapped it. The text a reader reaches is what gets announced, so
 * `text` is every non-ignored `StaticText` whose DOM node sits inside the element, and `liveChain`
 * is every node from those texts up to the root whose computed `live` is present and not `off`, as
 * `role:live`. The ROLE is not read on its own: Chromium already folds an implicit live role into
 * `live` (a bare `role="status"` reads `polite`), and measured, `role="status" aria-live="off"`
 * reads no `live` at all — the explicit `off` wins, which a role test would have overruled.
 */
export async function readAx(browser: NativeBrowser, selector: string) {
	const send = async <T>(method: string, params: object): Promise<T> => (await browser.sendCommandAndGetResult(method, params)) as T;
	await send('Accessibility.enable', {});
	const { root } = await send<{ root: { nodeId: number } }>('DOM.getDocument', { depth: 0 });
	const { nodeId } = await send<{ nodeId: number }>('DOM.querySelector', { nodeId: root.nodeId, selector });
	if (!nodeId) return null;
	const { node: dom } = await send<{ node: DomNode }>('DOM.describeNode', { nodeId, depth: -1 });
	const inside = new Set(subtreeIds(dom));
	const { nodes } = await send<{ nodes: AXNode[] }>('Accessibility.getFullAXTree', {});
	const tree = new Map(nodes.map((n) => [n.nodeId, n]));
	const own = nodes.find((n) => n.backendDOMNodeId === dom.backendNodeId);
	const texts = nodes.filter((n) => !n.ignored && n.role?.value === 'StaticText' && inside.has(n.backendDOMNodeId ?? -1));
	const liveChain = new Set<string>();
	for (const text of texts) {
		for (let at: AXNode | undefined = text; at; at = at.parentId ? tree.get(at.parentId) : undefined) {
			const role = String(at.role?.value ?? '');
			const live = propertyOf(at, 'live');
			if (live !== undefined && live !== 'off') liveChain.add(`${role}:${String(live)}`);
		}
	}
	return {
		/** The element's own node, empty when Chromium folded it into its parent. */
		role: String(own?.role?.value ?? ''),
		/** Chromium's computed accessible name. */
		name: String(own?.name?.value ?? ''),
		live: own ? propertyOf(own, 'live') : undefined,
		text: texts.map((n) => String(n.name?.value ?? '')).join(' '),
		liveChain: [...liveChain],
	};
}

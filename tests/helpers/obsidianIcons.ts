import { editorIconNodes } from './editorIconNodes';

/** Only the harness supplies SVG nodes; production delegates to Obsidian setIcon. */
export function setIcon(parent: HTMLElement, name: string): void {
	parent.replaceChildren();
	const canonicalName = name.replace(/^lucide-/, '');
	parent.dataset.icon = canonicalName;
	parent.dataset.iconRequest = name;
	const nodes = editorIconNodes[canonicalName];
	if (!nodes) { parent.dataset.iconMissing = canonicalName; return; }
	delete parent.dataset.iconMissing;
	const document = parent.ownerDocument, namespace = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(namespace, 'svg');
	for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', width: '24', height: '24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) svg.setAttribute(key, value);
	svg.classList.add('svg-icon', `lucide-${canonicalName}`);
	for (const node of nodes) {
		const element = document.createElementNS(namespace, node.tag);
		for (const [key, value] of Object.entries(node.attributes)) element.setAttribute(key, value);
		svg.append(element);
	}
	parent.append(svg);
}

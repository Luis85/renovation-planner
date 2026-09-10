import { editorIconNodes } from './editorIconNodes';

const registered = new Map<string, string>();
export function addIcon(id: string, svgContent: string): void { registered.set(id, svgContent); }
export function removeIcon(id: string): void { registered.delete(id); }

/** Native fixtures and explicit application registration; unknown IDs remain missing. */
export function setIcon(parent: HTMLElement, name: string): void {
	parent.replaceChildren();
	const canonicalName = name.replace(/^lucide-/, '');
	parent.dataset.icon = canonicalName;
	parent.dataset.iconRequest = name;
	const nodes = editorIconNodes[canonicalName];
	const custom = registered.get(name);
	if (!nodes && custom === undefined) { parent.dataset.iconMissing = canonicalName; return; }
	delete parent.dataset.iconMissing;
	const document = parent.ownerDocument, namespace = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(namespace, 'svg');
	for (const [key, value] of Object.entries({ viewBox: custom === undefined ? '0 0 24 24' : '0 0 100 100', width: '24', height: '24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) svg.setAttribute(key, value);
	svg.classList.add('svg-icon', custom === undefined ? `lucide-${canonicalName}` : name);
	if (custom !== undefined) {
		const parsed = new DOMParser().parseFromString(`<svg xmlns="${namespace}">${custom}</svg>`, 'image/svg+xml');
		for (const node of parsed.documentElement.childNodes) svg.append(document.importNode(node, true));
	}
	for (const node of custom === undefined ? nodes ?? [] : []) {
		const element = document.createElementNS(namespace, node.tag);
		for (const [key, value] of Object.entries(node.attributes)) element.setAttribute(key, value);
		svg.append(element);
	}
	parent.append(svg);
}

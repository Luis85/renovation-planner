/**
 * Installs the Obsidian DOM prototype extensions the code here actually calls —
 * `createEl`, `createDiv`, `empty`, `setText` — before constructing any view. Call once
 * per jsdom test file.
 *
 * Nothing more is installed on purpose: a fake nobody exercises cannot be caught
 * drifting from the real API, so every further helper arrives with its first consumer —
 * the same policy `tests/helpers/obsidian-mock.ts` states for the module mock. And keep
 * each one no kinder than the real thing: `SVG_CLASS_TOKENS` in `eslint.config.mjs`
 * records what a tolerant fake cost the source project.
 */

interface CreateOptions {
	cls?: string | string[];
	text?: string;
	attr?: Record<string, string>;
}

function applyOptions(el: HTMLElement, options?: CreateOptions | string): void {
	const opts: CreateOptions = typeof options === 'string' ? { cls: options } : (options ?? {});
	if (opts.cls) {
		const classes = Array.isArray(opts.cls) ? opts.cls : opts.cls.split(/\s+/);
		el.classList.add(...classes.filter((c) => c.length > 0));
	}
	if (opts.text !== undefined) el.textContent = opts.text;
	if (opts.attr) {
		for (const [key, value] of Object.entries(opts.attr)) el.setAttribute(key, value);
	}
}

export function installObsidianDom(): void {
	const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
	if (proto.__obsidianDomInstalled) return;
	proto.__obsidianDomInstalled = true;

	proto.createEl = function (this: HTMLElement, tag: string, options?: CreateOptions | string): HTMLElement {
		const el = document.createElement(tag);
		applyOptions(el, options);
		this.appendChild(el);
		return el;
	};
	proto.createDiv = function (this: HTMLElement, options?: CreateOptions | string): HTMLElement {
		return (this as HTMLElement & { createEl: (t: string, o?: CreateOptions | string) => HTMLElement }).createEl('div', options);
	};
	proto.empty = function (this: HTMLElement): void {
		this.replaceChildren();
	};
	proto.setText = function (this: HTMLElement, text: string): void {
		this.textContent = text;
	};
}

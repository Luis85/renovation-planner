/**
 * Installs the Obsidian DOM prototype extensions the code here actually calls —
 * `createEl`, `createSpan`, `createDiv`, `empty`, `setText`, `addClass` — before constructing any
 * view. Call once per jsdom test file.
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

	// Obsidian's GLOBAL `createEl`, which is a different function from the prototype method
	// below: with no parent to append to, it makes a detached element. The marketplace
	// ruleset requires it over `document.createElement` (`obsidianmd/prefer-create-el`), so
	// src/ calls it and the suite has to supply it — `pdfRaster.ts` is the first caller.
	(globalThis as unknown as Record<string, unknown>).createEl = (tag: string, options?: CreateOptions | string): HTMLElement => {
		const el = document.createElement(tag);
		applyOptions(el, options);
		return el;
	};

	// Obsidian's global `createSpan`, which the marketplace ruleset requires over both
	// `document.createElement('span')` and `createEl('span', …)` — measured from what
	// `npx eslint` reports rather than read off the docs. `notify.ts`'s severity label and
	// message body are the first callers, so it arrives here with them, per this file's
	// own policy.
	(globalThis as unknown as Record<string, unknown>).createSpan = (options?: CreateOptions | string): HTMLElement => {
		const el = document.createElement('span');
		applyOptions(el, options);
		return el;
	};

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
	proto.addClass = function (this: HTMLElement, classes: string | string[]): void {
		const list = Array.isArray(classes) ? classes : classes.split(/\s+/);
		this.classList.add(...list.filter((c) => c.length > 0));
	};
}

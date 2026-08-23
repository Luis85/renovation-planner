/**
 * Runtime stand-in for the `obsidian` module, aliased in `vitest.config.ts` and in
 * `vite.harness.config.ts`. The real package is types-only, so anything a test or the
 * harness executes needs a body here.
 *
 * Keep it MINIMAL, and keep it no kinder than the real API. A fake that tolerates what
 * Obsidian rejects turns a shipped crash into a green suite — see `SVG_CLASS_TOKENS` in
 * `eslint.config.mjs` for the case that cost the source project a dead drop target.
 * Extend this file when new API surface is actually used.
 *
 * Nothing here invents behaviour: it RECORDS what was asked for, so a test asserts on the
 * ask rather than on a guess about what Obsidian does with it.
 */

export interface Command {
	id: string;
	name: string;
	callback?: () => void;
}

/**
 * The real call answers the user's app-language setting. English here, because tests and
 * the harness run in English; `t()` itself is pure and is driven per locale directly.
 */
export function getLanguage(): string {
	return 'en';
}

export type ViewFactory = (leaf: WorkspaceLeaf) => unknown;

/** What a leaf must be for the code under test; `tests/helpers/workspace.ts` supplies one. */
export interface WorkspaceLeaf {
	setViewState(state: { type: string; active?: boolean }): Promise<void>;
}

export class Plugin {
	/**
	 * Everything `onload` registered. The real base class owns the lifecycle — these are
	 * the asks, not a claim about what Obsidian then does with them.
	 */
	readonly views = new Map<string, ViewFactory>();
	readonly ribbon: { icon: string; title: string; click: () => void }[] = [];
	readonly commands: Command[] = [];

	/** What `loadData` answers; a test plants it BEFORE `onload`. Null is a fresh install. */
	data: unknown = null;

	/**
	 * When set, `loadData` REJECTS with it. A RESOLVED null is a fresh install and stays
	 * `data`'s job — the two are different outcomes and a fake that could only express one
	 * would make the suite unable to tell them apart.
	 */
	loadFailure: unknown = undefined;

	/** Every `saveData` call, in order — so a test asserts what was written AND how often. */
	readonly saved: unknown[] = [];

	readonly settingTabs: PluginSettingTab[] = [];

	constructor(
		readonly app: { workspace: never },
		readonly manifest: Record<string, unknown> = {},
	) {}

	loadData(): Promise<unknown> {
		return this.loadFailure === undefined ? Promise.resolve(this.data) : Promise.reject(this.loadFailure);
	}

	/**
	 * The real call REPLACES data.json with what it is given, and it is given the live
	 * object — so a caller that mutates its settings afterwards has changed what a previous
	 * "save" claims to have written. A structural clone is what makes that visible: each
	 * entry here is what the file held at that moment, not a window onto the current state.
	 */
	saveData(data: unknown): Promise<void> {
		this.saved.push(structuredClone(data));
		return Promise.resolve();
	}

	addSettingTab(tab: PluginSettingTab): void {
		this.settingTabs.push(tab);
	}

	registerView(type: string, factory: ViewFactory): void {
		this.views.set(type, factory);
	}

	addRibbonIcon(icon: string, title: string, click: () => void): HTMLElement {
		this.ribbon.push({ icon, title, click });
		// The real call returns the element it added, and a plugin may style it. A detached
		// div keeps that shape honest without pretending there is a ribbon.
		return document.createElement('div');
	}

	addCommand(command: Command): Command {
		this.commands.push(command);
		return command;
	}
}

/**
 * `containerEl` carries Obsidian's own view chrome — the header and the tab actions — and
 * `contentEl` is the pane below it. The distinction decides what a view may empty, so the
 * fake has both and nests them the way the app does: `containerEl` is
 * `.workspace-leaf-content` carrying a `data-type` naming the view (what
 * `styles/chrome.css` keys its selector on), a `.view-header` first, then `contentEl` as
 * `.view-content` — the same three classes and the attribute Obsidian's own DOM carries,
 * so both `styles/chrome.css` and the height chain `styles/view.css` depends on can
 * actually match here (measured in `tests/harness/harness.test.ts` and
 * `tests/presentation/views/renovationProjectView.test.ts`).
 *
 * `data-type` can only come from the SUBCLASS's `getViewType()`, and this class is the
 * base every subclass extends — reading it inside THIS constructor would run before a
 * subclass's own field initialisers do. That happens to be safe today, because every
 * `getViewType()` in this codebase is a plain prototype method rather than a bound
 * class-field arrow function, but a fake that assumed that forever would be exactly the
 * coupling this file's header warns against. So it is read lazily instead, on first ACCESS
 * to `containerEl` — a `new Subclass(...)` expression always finishes running the
 * subclass's own constructor (fields included) before it hands back a reference for
 * anything outside the constructor to read, and nothing in this codebase reads
 * `containerEl` from inside a constructor. By the time anything asks for it, `this` is
 * always the fully-built subclass. Set once, not on every read: a getter that writes on
 * every access is a surprise nothing here needs, since `getViewType()` cannot answer
 * differently between two reads of the same instance.
 */
export class ItemView {
	private readonly containerElNode: HTMLElement;
	private typeAssigned = false;
	readonly contentEl: HTMLElement;

	constructor(readonly leaf: WorkspaceLeaf) {
		this.containerElNode = document.createElement('div');
		this.containerElNode.classList.add('workspace-leaf-content');

		const header = document.createElement('div');
		header.classList.add('view-header');
		this.containerElNode.appendChild(header);

		this.contentEl = document.createElement('div');
		this.contentEl.classList.add('view-content');
		this.containerElNode.appendChild(this.contentEl);
	}

	get containerEl(): HTMLElement {
		if (!this.typeAssigned) {
			this.typeAssigned = true;
			this.containerElNode.dataset.type = this.getViewType();
		}
		return this.containerElNode;
	}

	/** Every real subclass overrides this; a fake with no subclass has no type to carry. */
	getViewType(): string {
		throw new Error('ItemView.getViewType must be implemented by a subclass');
	}
}

/**
 * Obsidian owns the pane: since 1.13 it reads `getSettingDefinitions()`, renders the
 * controls itself, and calls `getControlValue` / `setControlValue` as a user reads and
 * changes them. So the fake supplies the element and NOTHING else — no control rendering,
 * because a fake that drew its own controls would be asserting on markup this file made up
 * rather than on the definitions the app is actually given.
 *
 * What a test drives instead is the three overrides, which is the whole of a tab's
 * contract: what it declares, what it answers for a key, and what it does with a new value.
 * There is deliberately no `containerEl` here: nothing reads one (the tab is declarative
 * all the way down — even the unrecovered-settings message is a text-only DEFINITION rather
 * than a `display()` fallback), and a fake member nothing exercises cannot be caught
 * drifting — it arrives with its first consumer, per this file's own policy.
 */
export class PluginSettingTab {
	constructor(
		readonly app: unknown,
		readonly plugin: unknown,
	) {}
}


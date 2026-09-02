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

/**
 * `callback` and `checkCallback` are alternatives, never both: Obsidian calls the second
 * one twice — once with `checking: true` to ask whether the command applies right now, and
 * again to run it — which is how a command stays out of the palette when its context is
 * absent. Both are optional here for that reason, and a test drives whichever the command
 * under test declared.
 */
export interface Command {
	id: string;
	name: string;
	callback?: () => void;
	checkCallback?: (checking: boolean) => boolean;
}

/**
 * The real call answers the user's app-language setting. English here, because tests and
 * the harness run in English; `t()` itself is pure and is driven per locale directly.
 */
export function getLanguage(): string {
	return 'en';
}

/**
 * Slice 11 reads this for the diagnostics snapshot's Obsidian version. A fixed string
 * is what a fixed app reports; the plugin treats it as opaque text either way.
 */
export const apiVersion = '1.13.0';

/**
 * The real `normalizePath`, and no kinder: it is what a path handed to the vault adapter
 * has to pass through, and a fake that returned its input unchanged would pass every
 * caller while the real call answered about a DIFFERENT path.
 *
 * Four things it does, all of them driven by
 * `tests/infrastructure/obsidian/settings/pluginDataFile.test.ts`: Windows separators
 * become forward slashes, repeated slashes collapse, leading and trailing slashes go, and
 * the result is NFC-normalized — the last because macOS hands out NFD filenames and a
 * decomposed path does not match a composed one.
 *
 * **The ONE case where "no kinder" is a claim this repository cannot check: the vault root.**
 * Given `'/'` this answers `''`; the real one is believed to fall back to `'/'`, and there is
 * no way to settle it here — the `obsidian` dependency is types-only and ships no
 * implementation. It matters because `joinFolder` treats `''` as the root and `'/'` is truthy,
 * so a caller handed `'/'` builds `'//Geometry'`, which finds nothing and cannot be written.
 *
 * Nothing depends on the answer any more: `normalizeFolder` collapses a root-only result
 * itself and is correct under both readings. That was MEASURED rather than assumed — patching
 * this function to return `'/'` and removing the collapse reproduces `'//Geometry'` exactly,
 * and with the collapse in place the root cases pass under either behaviour. Do not "fix" this
 * fake to return `'/'`: that asserts the same unverified claim from the other side.
 */
export function normalizePath(path: string): string {
	return path
		.replace(/[\\/]+/g, '/')
		.replace(/^\/+|\/+$/g, '')
		.normalize('NFC');
}

/**
 * Obsidian's pdf.js loader — and what it hands back here is a REAL pdf.js, the
 * `pdfjs-dist` devDependency, not a stub.
 *
 * Not kinder than the real thing, which for this member means genuinely working: the real
 * call resolves the library the app's own PDF viewer uses, so
 * `tests/presentation/editor/background.test.ts` keeps rasterizing a real page and
 * asserting sampled pixels. A fake `getDocument` answering a blank canvas would pass every
 * assertion about the pipeline's SHAPE and nothing about whether a PDF renders — which is
 * the defect this repository has already paid for once (`tests/helpers/canvas.ts`).
 *
 * The **legacy** build specifically: the standard one constructs a `DOMMatrix` at module
 * scope and therefore cannot be imported under jsdom at all. That constraint now applies
 * only to the suite — production imports no pdf.js, it asks Obsidian for one.
 *
 * `import()` rather than a top-level import, which also matches the real call's shape:
 * Obsidian injects its script on the first `loadPdfJs()` and caches it. Here it keeps a
 * half-megabyte module out of every test file that touches this mock, which is nearly all
 * of them.
 */
export async function loadPdfJs(): Promise<unknown> {
	return await import('pdfjs-dist/legacy/build/pdf.mjs');
}

export type ViewFactory = (leaf: WorkspaceLeaf) => unknown;

/**
 * The real `TFile`/`TFolder` are CLASSES, and slice 4's repositories narrow with
 * `instanceof` — so the fake must export constructible classes, not plain shapes, or
 * every instanceof check would be false in tests while true in the app.
 */
export class TFile {
	path = '';
	name = '';
	basename = '';
	extension = '';
	stat = { mtime: 0, size: 0 };
	parent?: unknown;
}

export class TFolder {
	path = '';
	name = '';
	children: unknown[] = [];
}

/**
 * What a leaf must be for the code under test; `tests/helpers/workspace.ts` supplies one.
 *
 * `getViewState` is here because `revealPlanEditor` matches candidate leaves on the plan
 * id the LEAF carries — not on the view, which Obsidian may not have constructed yet for a
 * restored leaf. A fake without it would make the multiplicity that view exists for
 * untestable.
 */
export interface WorkspaceLeaf {
	setViewState(state: { type: string; active?: boolean; state?: Record<string, unknown> }): Promise<void>;
	getViewState(): { type?: string; state?: Record<string, unknown> };
	/** `openProjectNote`'s door: opens a note the caller already resolved to a `TFile`. */
	openFile(file: TFile): Promise<void>;
	/**
	 * Closes this leaf. `PlanEditorContext.closeLeaf` is what a Plan Editor offers a user
	 * whose plan is gone, and the view partially applies THIS method to build it — so a fake
	 * without it would make that action untestable at the view.
	 */
	detach(): void;
}

/**
 * Obsidian's transient message. THIN is the failure mode this fake exists to avoid: the
 * previous version recorded a string and drew nothing, so no test could assert the roles,
 * the dismiss control or the markup that design slice 13 puts inside `messageEl`.
 *
 * What is modelled: the `.notice-container > .notice` nesting Obsidian builds, the two
 * element handles it exposes, the duration it was constructed with, and a `hide()` that
 * disconnects — the queue reads `isConnected` to decide whether a visible slot is free, so a
 * `hide()` that left the element attached would make that mechanism untestable.
 *
 * `setMessage` is NOT modelled, and it was for one commit. Obsidian really has it, and this
 * fake really implemented it, and nothing in `src/` has ever called it: `notify.ts` owns the
 * markup inside `messageEl` — a severity label, a message span and a dismiss button — and
 * `setMessage` replaces that element's whole content, so the repeat count is written to the
 * message span directly. A fake method with no consumer cannot be caught drifting from the
 * real API, which is this file's stated policy, and a test exercising one reads as coverage
 * of a mechanism the plugin does not use.
 *
 * What is NOT modelled, stated so nothing trusts this wider than it is: Obsidian's own
 * auto-dismiss timer (this plugin always passes `duration: 0` and owns the timer), its
 * click-to-dismiss gesture, and every visual rule — `tests/harness/obsidian.css` carries no
 * `.notice` rules at all, so appearance is verified in a real vault and nowhere else.
 *
 * **And HIDE TIMING, which is an assumption about the real thing rather than a testability
 * requirement.** `hide()` here detaches SYNCHRONOUSLY. Obsidian's `Notice` is animated, and
 * whether its element leaves the document inside the call or after a transition is
 * undocumented; if it is the latter, this fake is kinder than the real thing at exactly the
 * point the queue's slot accounting rests on. `notify.ts` no longer depends on the answer for
 * its OWN dismiss control — that path latches `live` to false rather than asking
 * `isConnected` — but Obsidian's own click-to-dismiss gesture still does, and no instrument
 * here can measure it. `docs/tests/cases/Notices and save state.md` is where it gets looked
 * at.
 */
export class Notice {
	static readonly shown: string[] = [];
	/**
	 * The instances themselves, so a test can assert the ARGUMENTS a caller passed rather than
	 * only the outcome. `duration` is the one that matters: this plugin owns every notice's
	 * timer and passes `0` for it, and nothing but this array can check that the `0` is really
	 * being passed — the fake implements no timer, so a wrong duration is invisible in
	 * behaviour here and visible only in a real vault.
	 */
	static readonly constructed: Notice[] = [];

	readonly containerEl: HTMLElement;
	readonly messageEl: HTMLElement;

	constructor(
		readonly message: string,
		readonly duration?: number,
	) {
		Notice.shown.push(message);
		Notice.constructed.push(this);

		const container =
			document.body.querySelector<HTMLElement>('.notice-container') ??
			document.body.appendChild(
				Object.assign(document.createElement('div'), { className: 'notice-container' }),
			);

		this.containerEl = container.appendChild(
			Object.assign(document.createElement('div'), { className: 'notice' }),
		);
		this.messageEl = this.containerEl.appendChild(document.createElement('div'));
		this.messageEl.textContent = message;
	}

	hide(): void {
		this.containerEl.remove();
	}
}

/**
 * Obsidian's plain `Modal`, modelled at the three members a subclass here actually uses:
 * `titleEl`, `contentEl` and the `open`/`close` pair that runs the lifecycle hooks.
 *
 * `close()` runs `onClose()` for the reason `FuzzySuggestModal.close()` does — a fake that
 * skipped it would make a subclass's teardown untestable — and `open()` runs `onOpen()`, which
 * is where a `Modal` builds its content: a fake that only flipped a flag would leave every
 * assertion about what a modal DRAWS reaching an empty element.
 *
 * The two elements are detached from the document, as the real ones are until Obsidian attaches
 * them. Nothing here models the backdrop, the scope, or the close button.
 */
export class Modal {
	static readonly opened: Modal[] = [];

	readonly titleEl: HTMLElement = document.createElement('div');
	readonly contentEl: HTMLElement = document.createElement('div');
	isOpen = false;

	constructor(readonly app: unknown) {}

	open(): void {
		this.isOpen = true;
		Modal.opened.push(this);
		this.onOpen();
	}

	close(): void {
		this.isOpen = false;
		this.onClose();
	}

	onOpen(): void {
		// The real base class's hook is a no-op too; a subclass overrides it.
	}

	onClose(): void {
		// As above.
	}
}

/**
 * The fuzzy file picker. Obsidian owns the rendering and the fuzzy matching; what a
 * subclass supplies is the three methods below, so those are the whole contract and this
 * fake exercises exactly them.
 *
 * `open()` records rather than drawing, and `choose()` is the fake's own affordance for
 * driving what a user selecting an item does — without it a test could assert that a
 * picker was opened and nothing about what choosing does.
 */
export class FuzzySuggestModal<T> {
	static readonly opened: FuzzySuggestModal<unknown>[] = [];

	placeholder = '';
	isOpen = false;

	constructor(readonly app: unknown) {}

	setPlaceholder(placeholder: string): void {
		this.placeholder = placeholder;
	}

	open(): void {
		this.isOpen = true;
		FuzzySuggestModal.opened.push(this as FuzzySuggestModal<unknown>);
	}

	/**
	 * `Modal.close()` runs `onClose()`, and a fake that skipped it would make a subclass
	 * treating that hook as "the user dismissed me" untestable — which is the only way a
	 * promise-shaped picker can ever answer "nothing was chosen".
	 */
	close(): void {
		this.isOpen = false;
		this.onClose();
	}

	onClose(): void {
		// The real base class's hook is a no-op too; a subclass overrides it.
	}

	/**
	 * Stand-in for a user picking a row; the real class routes this through its list AND
	 * closes the modal afterwards, so this does both. A `choose` that left the modal open
	 * would let a subclass settle twice with nothing here to notice.
	 */
	choose(item: T): void {
		this.onChooseItem(item);
		this.close();
	}

	/**
	 * The SAME gesture in the other order, and it exists because modelling only the
	 * convenient one is exactly the "kinder than the real thing" this file refuses.
	 *
	 * `SuggestModal.selectSuggestion` is widely believed to CLOSE before it delivers the
	 * choice, and `obsidian.d.ts` states no ordering either way — so a subclass that treats
	 * `onClose` as "the user dismissed me" is correct under one ordering and loses every
	 * choice under the other. With only `choose()` above, a picker whose cancellation answer
	 * was not deferred passed every case here while being wrong in a vault (measured: three
	 * cases go red once this door exists and the deferral is removed).
	 *
	 * Both doors are kept deliberately: what a caller owes is order-INDEPENDENCE, which is a
	 * claim about the pair rather than about either one.
	 */
	chooseAfterClose(item: T): void {
		this.close();
		this.onChooseItem(item);
	}

	getItems(): T[] {
		throw new Error('FuzzySuggestModal.getItems must be implemented by a subclass');
	}

	getItemText(_item: T): string {
		throw new Error('FuzzySuggestModal.getItemText must be implemented by a subclass');
	}

	onChooseItem(_item: T): void {
		throw new Error('FuzzySuggestModal.onChooseItem must be implemented by a subclass');
	}
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
		// The real call populates `settingItems` here — `update()`'s own docblock says
		// "called by addSettingTab() and by dynamic tabs when their data changes" — so a
		// fake that only pushed would leave the rendered definitions empty until something
		// happened to refresh them, and a test asserting a refresh could not tell the two
		// apart.
		tab.update();
	}

	registerView(type: string, factory: ViewFactory): void {
		this.views.set(type, factory);
	}

	/** Registered custom file extensions — recorded, never interpreted. */
	readonly extensions = new Map<string[], string>();

	registerExtensions(extensions: string[], viewType: string): void {
		this.extensions.set(extensions, viewType);
	}

	/** Every `registerEvent` ask; the base class unregisters these itself in real Obsidian. */
	readonly eventRefs: unknown[] = [];

	registerEvent(_ref: unknown): void {
		this.eventRefs.push(_ref);
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

	/** The leaf's view state, as the real base class stores it for `setState`/`getState`. */
	private viewState: Record<string, unknown> = {};

	getState(): Record<string, unknown> {
		return this.viewState;
	}

	setState(state: Record<string, unknown> | null): Promise<void> {
		this.viewState = state ?? {};
		return Promise.resolve();
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

	/**
	 * What the pane is currently RENDERED from. Obsidian stores the result of
	 * `getSettingDefinitions()` here and never re-reads it on its own, so a tab whose
	 * underlying data changed shows the old definitions until it calls `update()` — which
	 * is exactly the behaviour the library migration has to answer for, and which a fake
	 * without this pair could not express at all.
	 */
	settingItems: unknown[] = [];

	update(): void {
		this.settingItems = this.getSettingDefinitions();
	}

	getSettingDefinitions(): unknown[] {
		return [];
	}
}


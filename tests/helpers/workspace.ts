/**
 * A workspace that records instead of drawing.
 *
 * The two facts the activation code depends on, and therefore the two this fake has to get
 * right: `getLeavesOfType` answers only leaves that have been given that view state, and
 * `getLeaf` hands back a NEW empty leaf every call. That pairing is what makes "open a
 * second tab on every click" a failure a test can see.
 *
 * **This file imports nothing from `src/presentation/`, and stays that way on purpose.**
 * `FakeWorkspace`/`FakeLeaf` are DOM-independent and used from plain-'node' test files
 * (`revealView.test.ts`, `revealPlanEditor.test.ts`) as well as jsdom ones — this used to
 * also export `makeView`, which reaches `RenovationProjectView` and, through it, the real
 * `ViewRoot.vue`. That single re-export dragged a Vue SFC's client-mode compilation into
 * every 'node'-environment file that imported this one for `FakeWorkspace` alone, which is
 * what turned `ViewRoot.vue` gaining real content (slice 15's `DialogHost`) into a
 * `@vitest/coverage-v8` false positive (see `tests/helpers/makeRenovationProjectView.ts` for
 * the full account). `makeView` now lives there, precisely so this file can keep this
 * invariant for the next helper someone adds here.
 */

import type { TFile, WorkspaceLeaf } from './obsidian-mock';

// `implements` ties this fake to the mock's contract where the EDITOR can see it — no
// gate type-checks tests/** yet (vitest transpiles without checking, tsconfig includes
// src/ only), so drift past the editor is the reviewer's to catch; the root CLAUDE.md's
// Testing section names this limit.
export class FakeLeaf implements WorkspaceLeaf {
	state: { type: string; active?: boolean; state?: Record<string, unknown> } | undefined;

	/**
	 * The view Obsidian mounted into this leaf, because Obsidian sets exactly this after
	 * calling a registered factory — and until `saveSettings` had to find its open views to
	 * rebind them, this fake had no such member at all. That is the recurring shape recorded
	 * in CLAUDE.md rather than a gap peculiar to this file: a fake thinner than the real thing
	 * leaves the mechanism pointed at it undrivable, so `rebindOpenViews` could have been
	 * written, shipped and green with nothing able to observe that it reached a view.
	 *
	 * Assigned by whoever plays Obsidian's part in a test (`openViewOnLeaf`), never by the
	 * leaf itself: the real one is set by the workspace, not by the factory.
	 */
	view: unknown;

	/**
	 * Records the state AND tells the view, because Obsidian's own call does both — setting a
	 * leaf's view state is how a view's `setState` is ever reached, which is the entire reason
	 * `navigateToProject` writes through this method rather than touching the view.
	 *
	 * **It recorded only, until the whole-branch review of design slice 21.** A fake that
	 * merely remembers what it was told leaves the view deaf to every navigation after the
	 * first, so a `navigate('project-1')` driven through the real plugin moved the LEAF's
	 * state and left the view's own `projectId` at `null` — and the case that meant to prove a
	 * settings swap keeps a detail-state pane off the list could only observe the recorded
	 * state, by way of a `projectViewDeps` parameter whose value nothing renders. The thin
	 * fake and the wrongly-pinned assertion were one defect wearing two faces: with the fake
	 * deaf, the dead field was the ONLY thing that case could have asked.
	 *
	 * `view.setState` is called through a shape test rather than an `instanceof`: this file
	 * imports nothing from `src/presentation/` and stays that way (see the header), and what
	 * matters is that the object has the method — the same reasoning `rebindOpenViews` gives
	 * for the opposite choice in a layer that may name the class.
	 *
	 * The result object is `{}`: `ViewStateResult.history` is something Obsidian READS after
	 * the call, and no fake caller here asks. A test that wants it passes its own leaf.
	 */
	async setViewState(state: { type: string; active?: boolean; state?: Record<string, unknown> }): Promise<void> {
		await Promise.resolve();
		this.state = state;
		const view = this.view as { setState?: (state: unknown, result: unknown) => Promise<void> } | undefined;
		if (typeof view?.setState === 'function') await view.setState(state.state ?? {}, {});
	}

	/**
	 * The real call answers `{}` for a leaf nothing has been set on, not `undefined` — and
	 * `revealPlanEditor` reads `.state?.planId` straight off it, so a fake returning
	 * `undefined` would throw there while the app returned a plain miss.
	 */
	getViewState(): { type?: string; state?: Record<string, unknown> } {
		return this.state ?? {};
	}

	/** Every file `openProjectNote` (or anything else) opened on this leaf, in order. */
	readonly opened: TFile[] = [];
	/** How many times `detach` was called — the leaf-closing action's only observable. */
	detached = 0;

	/**
	 * Sets the leaf's own view state, because the real call does. Obsidian gives a leaf it
	 * opened a file into a `markdown` view whose state names that file, which is what makes
	 * the leaf findable through `getLeavesOfType('markdown')` afterwards — so a fake that only
	 * recorded the file left every note it opened invisible to the very lookup "reuse the tab
	 * this note is already in" is built on, and a duplicate-tab defect had no instrument that
	 * could see it. Thinner than the real thing, in the one direction that mattered.
	 *
	 * **And it establishes that state only when the returned promise SETTLES**, which is the
	 * same lesson one turn further on. Setting it synchronously modelled a guarantee
	 * `openFile(file): Promise<void>` does not make: the real call reads the file and builds a
	 * view, and nothing in its signature promises the leaf answers for that file before it
	 * resolves. Faster than the real thing is the same defect as thinner than it — a second
	 * open racing the first found a leaf already naming the note and could not produce the
	 * duplicate tab a double click really produces, so the coalescing `openProjectNote` now
	 * does had no instrument either. A fake models what the API GUARANTEES, never what one
	 * build happens to do first.
	 */
	async openFile(file: TFile): Promise<void> {
		this.opened.push(file);
		await Promise.resolve();
		this.state = { type: 'markdown', state: { file: file.path } };
	}

	/**
	 * Closes this leaf, which in Obsidian means it stops answering `getLeavesOfType` — so the
	 * state goes with it rather than the fake merely counting the call. A leaf that recorded
	 * `detached` and kept its state would still be found by the very lookup "is this view
	 * already open" is built on, which is the thin-fake defect `openFile` above already paid
	 * for once.
	 */
	detach(): void {
		this.detached += 1;
		this.state = undefined;
	}
}

export class FakeWorkspace {
	readonly leaves: FakeLeaf[] = [];
	readonly revealed: FakeLeaf[] = [];
	/** Callbacks handed to `onLayoutReady`, fired explicitly by a test. */
	readonly layoutReadyCallbacks: (() => void)[] = [];

	getLeavesOfType(type: string): FakeLeaf[] {
		return this.leaves.filter((leaf) => leaf.state?.type === type);
	}

	getLeaf(_kind?: unknown): FakeLeaf {
		const leaf = new FakeLeaf();
		this.leaves.push(leaf);
		return leaf;
	}

	revealLeaf(leaf: FakeLeaf): Promise<void> {
		this.revealed.push(leaf);
		return Promise.resolve();
	}

	onLayoutReady(callback: () => void): void {
		this.layoutReadyCallbacks.push(callback);
	}

	/** Simulates the workspace having finished restoring — what the index scan waits for. */
	layoutReady(): void {
		for (const callback of this.layoutReadyCallbacks) callback();
	}

	/** A leaf already showing `type`, as a vault reopened onto the view would have. */
	withOpen(type: string, state?: Record<string, unknown>): FakeLeaf {
		const leaf = new FakeLeaf();
		leaf.state = { type, state };
		this.leaves.push(leaf);
		return leaf;
	}

	/** The active file, for a command whose availability depends on one. */
	activeFile: { path: string } | null = null;

	getActiveFile(): { path: string } | null {
		return this.activeFile;
	}

	/**
	 * Recorded, never resolved by type: the real call walks the workspace looking for an
	 * active leaf whose view is an instance of the class it was given, and a fake that
	 * reimplemented that search would be asserting on its own guess at Obsidian's traversal.
	 * A test plants the answer instead.
	 */
	activeView: unknown = null;

	getActiveViewOfType(_type: unknown): unknown {
		return this.activeView;
	}

	/** Workspace event handlers, by event name — `css-change` is the one anything drives. */
	readonly handlers = new Map<string, (() => void)[]>();

	/**
	 * The real `on` answers an `EventRef` that `offref` takes back, and
	 * `createThemeChangeSource` unsubscribes with it — so a fake without this member is not
	 * merely thin, it makes the Plan Editor unmountable. Which is how it was found: the
	 * restored-leaf test builds a view through the PLUGIN's own factory, and that is the
	 * first test to do so.
	 */
	on(name: string, handler: () => void): { name: string; handler: () => void } {
		const existing = this.handlers.get(name);
		if (existing) existing.push(handler);
		else this.handlers.set(name, [handler]);
		return { name, handler };
	}

	offref(ref: { name: string; handler: () => void }): void {
		const existing = this.handlers.get(ref.name);
		if (existing) this.handlers.set(ref.name, existing.filter((one) => one !== ref.handler));
	}

	/** Fires a workspace event, so a test can drive a theme change the way Obsidian does. */
	trigger(name: string): void {
		for (const handler of this.handlers.get(name) ?? []) handler();
	}
}

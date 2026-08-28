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

	setViewState(state: { type: string; active?: boolean; state?: Record<string, unknown> }): Promise<void> {
		this.state = state;
		return Promise.resolve();
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

	openFile(file: TFile): Promise<void> {
		this.opened.push(file);
		return Promise.resolve();
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

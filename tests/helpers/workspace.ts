/**
 * A workspace that records instead of drawing.
 *
 * The two facts the activation code depends on, and therefore the two this fake has to get
 * right: `getLeavesOfType` answers only leaves that have been given that view state, and
 * `getLeaf` hands back a NEW empty leaf every call. That pairing is what makes "open a
 * second tab on every click" a failure a test can see.
 */

import type { WorkspaceLeaf } from './obsidian-mock';
import { RenovationProjectView } from '../../src/presentation/views/RenovationProjectView';

// `implements` ties this fake to the mock's contract where the EDITOR can see it — no
// gate type-checks tests/** yet (vitest transpiles without checking, tsconfig includes
// src/ only), so drift past the editor is the reviewer's to catch; the root CLAUDE.md's
// Testing section names this limit.
export class FakeLeaf implements WorkspaceLeaf {
	state: { type: string; active?: boolean } | undefined;

	setViewState(state: { type: string; active?: boolean }): Promise<void> {
		this.state = state;
		return Promise.resolve();
	}
}

/**
 * The real view against a fake leaf — the `as never` cast lives HERE, once. Both the
 * jsdom suite and the browser harness mount build their view through this, so a grown
 * constructor requirement meets every consumer at the same time instead of fixing the
 * suite and silently stranding the harness page.
 */
export const makeView = (): RenovationProjectView => new RenovationProjectView(new FakeLeaf() as never);

export class FakeWorkspace {
	readonly leaves: FakeLeaf[] = [];
	readonly revealed: FakeLeaf[] = [];

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

	/** A leaf already showing `type`, as a vault reopened onto the view would have. */
	withOpen(type: string): FakeLeaf {
		const leaf = new FakeLeaf();
		leaf.state = { type };
		this.leaves.push(leaf);
		return leaf;
	}
}

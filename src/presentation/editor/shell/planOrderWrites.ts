import type { PropertyTreeNode } from '../../read-models/planHierarchy';

export interface PlanOrderWrite { readonly planId: string; readonly order: number }

/**
 * The writes a move needs: the siblings renumbered 0..n-1 with `id` at `index` (clamped), one
 * write per sibling whose STORED `order` differs from its new index. Compared against the stored
 * value and not the previous position, because every vault older than this build holds `order:
 * 0` on every plan — a move that skipped "unchanged positions" would leave those zeros in place
 * and the next read would sort them by name again. An unknown id writes nothing.
 *
 * Pure, and in its OWN module rather than beside `usePlanReorder` for a reason its node test
 * paid for: importing that composable pulls the editor's whole module graph — the context, the
 * runtime, every SFC below them — and a test in the `node` environment has vitest compile each
 * of those SFCs in SSR shape (`if` statements for `v-if`, ternaries for a `<select v-model>`),
 * loaded and never rendered. The coverage merge then reported those SSR-only arms as uncovered
 * on files the test never mentioned — 84 phantom arms across 17 forms, branch coverage under
 * the floor. A module that imports one type is what a pure arithmetic test may reach for.
 */
export function plannedWrites(siblings: readonly PropertyTreeNode[], id: string, index: number): PlanOrderWrite[] {
	const from = siblings.findIndex((node) => node.id === id);
	if (from < 0) return [];
	const to = Math.max(0, Math.min(index, siblings.length - 1));
	const moved = [...siblings];
	const [node] = moved.splice(from, 1);
	moved.splice(to, 0, node);
	return moved.flatMap((item, order) => (item.order === order ? [] : [{ planId: item.id, order }]));
}

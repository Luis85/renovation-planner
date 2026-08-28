/**
 * A distinct `useId` namespace per mounted Vue app.
 *
 * `useId` restarts at `v-0` in every app, so two leaves in one document collide — and the
 * failure is silent: `aria-describedby` resolves to whichever element carries the id first,
 * so a screen reader reads the wrong form's error and both panes look right.
 *
 * A counter rather than the leaf's identity because `WorkspaceLeaf` exposes none publicly,
 * and because "unique" is the whole requirement — nothing reads the prefix back or matches
 * it to a leaf. Monotonic across unmount/remount on purpose: reusing a retired prefix while
 * the old app's DOM is still detaching is the collision again, narrower.
 */
let mounted = 0;

export function nextAppIdPrefix(): string {
	mounted += 1;
	return `rp-${String(mounted)}`;
}

import type { EditorRuntime } from '../runtime';

/**
 * Design spec §2.9's pause pair over the leaf's own gate: `aria-disabled="true"` plus
 * `aria-describedby` naming the shared reason while writes are paused, and NEITHER attribute
 * while live — never `aria-disabled="false"`, which is why the live answer is `{}` rather than a
 * false-valued map. One statement for `RoomInspector`'s Delete and `PlanKindSelect`'s select,
 * which had each spelled the ternary; `v-bind` the result.
 */
export function pauseAttrs(runtime: Pick<EditorRuntime, 'writesBlocked' | 'pausedReasonId'>): Record<string, string> {
	return runtime.writesBlocked.value ? { 'aria-disabled': 'true', 'aria-describedby': runtime.pausedReasonId } : {};
}

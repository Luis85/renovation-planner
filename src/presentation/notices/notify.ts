import { Notice } from 'obsidian';

/**
 * Show a transient message in Obsidian's own notice area.
 *
 * A one-line wrapper, for two reasons that are both about the call SITE rather than about
 * the notice. It is the one place `Notice` is constructed, so slice 13's save-state
 * surfaces and slice 17's error routing have somewhere to change behaviour once, instead
 * of a `new Notice` per call site. And `new Notice(…)` as a bare statement is a
 * construction for its side effect, which `no-new` refuses in both linters with no inline
 * suppression available here (`noInlineConfig`) — returning the instance is what makes the
 * idiom expressible rather than worked around.
 *
 * The message is TEXT and therefore already translated by the time it arrives: this
 * function does not reach for `t`/`tr` itself, because its callers include error paths
 * whose text comes from an `AppError` rather than from the string table.
 */
export function notify(message: string): Notice {
	return new Notice(message);
}

import { Notice, getLanguage } from 'obsidian';
import type { AppError } from '../../core/errors/AppError';
import { toUserMessage } from '../i18n/toUserMessage';

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

/**
 * The OTHER way this plugin raises a notice, and the only one an `AppError` may take.
 * An error's own `message` is developer text (SDD §65): English, untranslated, and
 * written for a log line — so a raw one in a Notice is the defect design slice 11 exists
 * to remove. `toUserMessage` resolves the locale table's copy from the error's `code`,
 * its suffix, or its category, in that order.
 *
 * Beside `notify` rather than in a module of its own because the two are one decision:
 * which of them a call site reaches for is entirely "do I hold text, or an error?".
 */
export function notifyError(error: AppError): Notice {
	return notify(toUserMessage(getLanguage(), error));
}

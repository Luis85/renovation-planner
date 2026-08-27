import { Notice } from 'obsidian';
import type { AppError } from '../../core/errors/AppError';
import { createVaultExceptionMapper } from '../../application/errors/exceptionMapper';
import type { Logger } from '../../application/ports/Logger';
import { trError } from '../i18n/toUserMessage';

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
 * to remove. `trError` resolves the locale table's copy from the error's `code`, its
 * suffix, or its category, in that order, in the app's own language — reached through
 * `currentLanguage()` like every other translated string rather than by calling
 * `getLanguage()` here, which is what keeps `strings.ts`'s claim to be the ONE language
 * resolution point true of this door as well.
 *
 * Beside `notify` rather than in a module of its own because the two are one decision:
 * which of them a call site reaches for is entirely "do I hold text, or an error?".
 */
export function notifyError(error: AppError): Notice {
	return notify(trError(error));
}

/**
 * The mapper the fault door below uses. The same shape the composition root's guards take,
 * built here because this door stands OUTSIDE them: what reaches it has already escaped
 * every guarded service, so there is no boundary left to have mapped it.
 */
const mapUnexpected = createVaultExceptionMapper('vault');

/**
 * The last door of all: something THROWN that no guard turned into a `Result`.
 *
 * A raw `Error.message` in a Notice is forbidden outright — it is developer text, often an
 * engine's own words and sometimes a file path — so the cause is mapped to the same coded
 * `PersistenceError` a guarded service would have produced, and printed from the locale
 * table like any other refusal.
 *
 * This exists because presentation still holds things the boundary does not cover: the raw
 * `ZoneRepository`/`RequirementRepository`/`AssetRepository` ports that
 * `PlanEditorCommandServices` hands the reversible adapters. Every COMMAND and QUERY it
 * holds is guarded; the ports are not, and this is what keeps their faults presentable.
 *
 * **The `logger` is not optional, and the reason is SDD §66 rather than convenience.** A
 * guarded service produces two representations of one failure at ONE step — a terse user
 * message and a log line carrying the original cause — and the spec's own words are that
 * they "must not drift into being produced from two independent code paths". This door
 * stands where no guard did, so a print-only version of it would be exactly that second
 * path: the user gets a sentence and a developer gets nothing — and here, uniquely, the
 * cause is an unmapped exception, so no guard below has already recorded it and this line
 * is the only place that detail survives. So the mapping happens ONCE and both halves come
 * out of it. The event name is the caller's, for the same reason `guardCommand` takes one:
 * it says which door faulted.
 */
export function notifyFault(cause: unknown, logger: Logger, event: string): Notice {
	const mapped = mapUnexpected(cause);
	logger.error(event, { cause, code: mapped.code });
	return notifyError(mapped);
}

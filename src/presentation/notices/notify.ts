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
 * The mapping half of the last door of all: something THROWN that no guard turned into a
 * `Result`. Maps the cause to the same coded `PersistenceError` a guarded service would have
 * produced, logs it under the caller's own event name, and returns the mapped `AppError` —
 * it does NOT notify.
 *
 * Split out of `notifyFault` (design slice 16) so a caller that must not announce a fault
 * itself — because a DOWNSTREAM owner is the one deciding whether the failure gets a field
 * message or a banner notice — can still get the map-once, log-once guarantee without a
 * Notice coming out of this step too. `commitField` (`presentation/editor/commitField.ts`)
 * is that caller: two notices for one fault, byte-identical because both were minted from
 * the same code, is exactly the defect this split exists to close.
 *
 * **The `logger` is not optional, and the reason is SDD §66 rather than convenience.** A
 * guarded service produces two representations of one failure at ONE step — a terse user
 * message and a log line carrying the original cause — and the spec's own words are that
 * they "must not drift into being produced from two independent code paths". This door
 * stands where no guard did, so a version that only logged would be exactly that second
 * path once a caller also skipped notifying: the user gets nothing at all. Every caller
 * either uses this directly (and owns announcing the result itself) or goes through
 * `notifyFault` below, which still notifies in the same step it maps and logs.
 */
export function faultError(cause: unknown, logger: Logger, event: string): AppError {
	const mapped = mapUnexpected(cause);
	logger.error(event, { cause, code: mapped.code });
	return mapped;
}

/**
 * The last door of all, in full: maps, logs and notifies in one step — `notifyError` of
 * `faultError`'s result. This is the ONLY shape that existed before the split above; every
 * caller that wants the fault announced HERE, and not by something downstream, keeps
 * reaching for this one unchanged.
 *
 * This exists because presentation still holds things the boundary does not cover: the raw
 * `ZoneRepository`/`RequirementRepository`/`AssetRepository` ports that
 * `PlanEditorCommandServices` hands the reversible adapters. Every COMMAND and QUERY it
 * holds is guarded; the ports are not, and this is what keeps their faults presentable.
 * The event name is the caller's, for the same reason `guardCommand` takes one: it says
 * which door faulted.
 */
export function notifyFault(cause: unknown, logger: Logger, event: string): Notice {
	return notifyError(faultError(cause, logger, event));
}

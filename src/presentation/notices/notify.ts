import { Notice } from 'obsidian';
import type { AppError } from '../../core/errors/AppError';
import { createVaultExceptionMapper } from '../../application/errors/exceptionMapper';
import type { Logger } from '../../application/ports/Logger';
import { trError } from '../i18n/toUserMessage';
import { tr } from '../i18n/strings';
import { createNoticeQueue, type NoticeHost, type NoticeQueue, type NoticeView } from './queue';
import { SEVERITY_LABEL_KEYS, type NoticeSeverity } from './severity';

/**
 * Which severities interrupt a screen reader and which wait to be read. A warning and an
 * error are announced promptly; a routine confirmation is not worth demanding attention for.
 */
const LIVE_REGION: Readonly<Record<NoticeSeverity, { role: string; live: string }>> = {
	success: { role: 'status', live: 'polite' },
	info: { role: 'status', live: 'polite' },
	warning: { role: 'alert', live: 'assertive' },
	error: { role: 'alert', live: 'assertive' },
};

/** `message (×3)` once a message has repeated. */
const textOf = (view: NoticeView): string =>
	view.count > 1 ? `${view.message} (×${String(view.count)})` : view.message;

/**
 * The one place `Notice` is constructed.
 *
 * **`duration: 0` on every notice is load-bearing rather than incidental.** Obsidian's own
 * timer is internal and cannot be paused, so letting it time the notice would make the
 * accessibility rule below unimplementable: a timed message must not vanish while somebody
 * is reading it or tabbing to its dismiss control. Owning the timer is what buys hover-pause
 * and the promotion of a held notice into a freed slot.
 *
 * **A known, accepted defect, recorded rather than carried silently.**
 * `docs/components/Toast.md` asks for `role`/`aria-live` on a live region ALREADY in the
 * document — explicitly not "on a container that appears" — because a live region inserted
 * together with its content often does not announce. `new Notice(textOf(view), 0)` inserts a
 * populated element and the attributes go on afterwards, which is exactly the shape the
 * contract refuses. The remedy (construct, empty `messageEl`, set the attributes, populate on
 * a microtask) changes timing that this module's tests assert synchronously, and no jsdom test
 * can observe whether an announcement happened either way — so the defect is carried for this
 * slice and written into the slice document rather than fixed blind.
 */
const obsidianHost: NoticeHost = {
	open(view, callbacks) {
		/**
		 * **The message goes through the CONSTRUCTOR, not only into the DOM.** Obsidian's
		 * `Notice` records nothing, but this repository's fake pushes its constructor argument
		 * onto `Notice.shown`, and existing suites make CONTENT assertions against that array
		 * (`inspectorFaults`, `planEditorCommands`, `sampleProject`, `slice10CascadeWiring`).
		 * Constructing with `''` and then writing `messageEl` would fill it with empty strings
		 * and break every one of them. The structured markup below replaces `messageEl`'s
		 * content afterwards; the recorded text stays the user's sentence.
		 */
		const notice = new Notice(textOf(view), 0);
		const { role, live } = LIVE_REGION[view.severity];
		notice.containerEl.setAttribute('role', role);
		notice.containerEl.setAttribute('aria-live', live);
		notice.containerEl.classList.add('rp-notice', `rp-notice-${view.severity}`);

		/**
		 * **Hover and focus are two conditions, not one flag.** Passing `pause`/`resume`
		 * straight to the four listeners lets `pointerleave` resume a timer while the dismiss
		 * button still holds focus, and `blur` resume one while the pointer is still over the
		 * notice — so an auto-dismissing notice vanishes mid-interaction, which is precisely
		 * what the accessibility timing rule exists to prevent. `held` is the OR of both, and
		 * only a transition is reported: `resume` restarts a full duration, so calling it on
		 * an already-running timer would silently extend it.
		 */
		let hovered = false;
		let focused = false;
		let held = false;
		/**
		 * **Set by OUR dismiss control, and read by `live` below.** The queue frees a slot by
		 * asking `handle.live`, which asks `containerEl.isConnected` — correct for a dismissal we
		 * did not perform, and an assumption about Obsidian for one we did. This repository's fake
		 * detaches synchronously inside `hide()`; Obsidian's real `Notice` is animated, and if it
		 * fades out and detaches after a transition then `isConnected` is still `true` when the
		 * sweep that follows our own click runs, the slot is not freed, and a held fourth notice
		 * waits for some later push. Nothing in this repository can settle which it is — hide
		 * timing is a vault-only measurement, recorded as such in
		 * `docs/tests/cases/Notices and save state.md`.
		 *
		 * So the one path that KNOWS the notice is going does not infer it: the latch makes the
		 * release deterministic and independent of hide timing, the same unconditional release the
		 * auto-dismiss timer already performs. `isConnected` stays the authority for every
		 * dismissal we did not perform, which is the design's whole point and is what step 11 of
		 * the manual case exercises.
		 */
		let dismissedHere = false;
		const sync = (): void => {
			const next = hovered || focused;
			if (next === held) return;
			held = next;
			if (held) callbacks.pause();
			else callbacks.resume();
		};

		notice.containerEl.addEventListener('pointerenter', () => {
			hovered = true;
			sync();
		});
		notice.containerEl.addEventListener('pointerleave', () => {
			hovered = false;
			sync();
		});

		/**
		 * **Obsidian dismisses a notice when the user clicks it, and does not tell us.** This
		 * listener is the PROMPT to sweep that the design calls for — `handle.live` remains the
		 * authority — and without it a natively-dismissed notice would hold its slot until some
		 * later push happened to sweep. Our own dismiss button calls `dismissed` directly as
		 * well; sweeping twice is idempotent, and relying on the button's click bubbling to
		 * here would depend on propagation surviving the element's removal mid-dispatch, which
		 * is not worth resting on.
		 */
		// Wrapped rather than passed as `callbacks.dismissed` directly: `NoticeCallbacks`
		// declares it as a METHOD, so handing the reference to a listener is
		// `@typescript-eslint/unbound-method` — an error here, not a warning. The arrow keeps
		// the receiver, which is what the rule is protecting.
		notice.containerEl.addEventListener('click', () => {
			callbacks.dismissed();
		});

		// Obsidian's own GLOBAL helpers rather than `document.createElement`, which the
		// marketplace ruleset refuses (`obsidianmd/prefer-create-el`) — the same call
		// `pdfRaster.ts` makes, and detached, since these three are appended below in one go.
		// `createSpan` over `createEl('span', …)` because that ruleset refuses the second
		// spelling too; both are measured rather than chosen, from what `npx eslint` reported.
		const label = createSpan({ cls: 'rp-notice-severity' });
		const body = createSpan({ cls: 'rp-notice-message' });

		const dismiss = createEl('button', { cls: 'rp-notice-dismiss' });
		dismiss.type = 'button';
		// The glyph is punctuation rather than copy, and it is not the accessible name: the
		// `aria-label` below is, and it comes from the string table like every other word here.
		dismiss.textContent = '×';
		dismiss.setAttribute('aria-label', tr('notice.dismiss'));
		dismiss.addEventListener('focus', () => {
			focused = true;
			sync();
		});
		dismiss.addEventListener('blur', () => {
			focused = false;
			sync();
		});
		dismiss.addEventListener('click', () => {
			dismissedHere = true;
			notice.hide();
			callbacks.dismissed();
		});

		const render = (next: NoticeView): void => {
			label.textContent = tr(SEVERITY_LABEL_KEYS[next.severity]);
			body.textContent = textOf(next);
		};
		render(view);

		notice.messageEl.textContent = '';
		// The flex container is THIS element, not `containerEl` — the three children below are
		// its children, and flex only reaches direct ones. This host applies SIX class names —
		// `rp-notice`, `rp-notice-<severity>`, `rp-notice-body`, `rp-notice-severity`,
		// `rp-notice-message`, `rp-notice-dismiss` — and `styles/notices.css` names all six:
		// four of them (`-body`, `-severity`, `-message`, `-dismiss`) as the element a rule
		// declares on, and two only as ANCESTORS — `.rp-notice`, which scopes the dismiss
		// button past Obsidian's `button:not(.clickable-icon)`, and `.rp-notice-<severity>`,
		// which picks the label's colour. The `display: flex` goes here rather than on
		// `containerEl`, where it would have made `messageEl` the only flex item and left the
		// three children below unseparated. Nothing here can show what they LOOK like: the
		// vendored `tests/harness/obsidian.css` carries no `.notice` rule at all, so a notice
		// drawn in the browser harness would have no position, no stacking and no chrome. The
		// manual case under `docs/tests/cases/` is the only instrument.
		notice.messageEl.classList.add('rp-notice-body');
		notice.messageEl.append(label, body, dismiss);

		return {
			update: render,
			hide: () => {
				notice.hide();
			},
			get live() {
				return !dismissedHere && notice.containerEl.isConnected;
			},
		};
	},
};

/**
 * `null` until the plugin activates it, and `null` again once it unloads. **Disposal has to be
 * TERMINAL, which an earlier draft got wrong by recreating the queue inside `disposeNotices`.**
 * The cascade and the recovery pass both run fire-and-forget, so a promise can resolve after
 * `onunload` and call `notifyError`; against a recreated queue that attaches a live notice to a
 * vault with no plugin loaded and nothing left to remove it. Dropping the push is the right
 * answer rather than a lesser one: a toast reports something that already happened, and there
 * is no surface left to report it to.
 */
let queue: NoticeQueue | null = null;

/**
 * Called once from `RenovationPlannerPlugin.onload`, before anything can notify. Starting
 * inert rather than active is deliberate: a notice raised before the plugin is loaded would be
 * a sequencing bug, and a module that quietly worked anyway would hide it.
 */
export function activateNotices(): void {
	queue?.dispose();
	queue = createNoticeQueue(obsidianHost);
}

/**
 * Hide everything on screen and stay off. Registered as one disposer on the plugin's existing
 * `disposers` list, beside the Konva global that got there first. A later
 * `activateNotices()` is what brings it back — this function does not, and that asymmetry is
 * the whole point.
 */
export function disposeNotices(): void {
	queue?.dispose();
	queue = null;
}

/**
 * Show a transient message in Obsidian's own notice area, at `info`.
 *
 * The message is TEXT and therefore already translated by the time it arrives: this function
 * does not reach for `t`/`tr` itself, because its callers include error paths whose text
 * comes from an `AppError` rather than from the string table.
 *
 * **Four bare function names rather than `notify.success(...)`, and the reason is a gate
 * rather than a taste.** `NOTICE_DOOR` in `eslint.config.mjs` — the one rule keeping raw
 * `Error.message` and bare literals out of a notice — matches on `callee.name`, which a
 * member expression does not have. Every `notify.success('…')` call site would have been
 * invisible to it, which is this repository's own recurring defect: the wrapper present, the
 * test green, and the second door raw.
 */
export function notify(message: string): void {
	queue?.push('info', message);
}

/**
 * **No production caller yet, and that is deliberate rather than an oversight.** The four
 * severities are this slice's vocabulary; the routing that decides which operations announce
 * a success is slice 17's, and inventing a call site here would mean inventing a user-facing
 * string for an operation nobody asked to have announced.
 *
 * Precedented: slice 15 shipped `DeleteReferenceDialog` and `EntityPickerDialog` with no
 * caller for two slices for the same reason — the queries feeding them belonged to a later
 * slice, and declaring them early would have been a second derivation of contracts that slice
 * owned. `npm run analyze` does not catch an export with only test callers, so this comment
 * is the record rather than the gate.
 *
 * The consequence for manual testing is written down rather than owed:
 * `docs/tests/cases/Notices and save state.md` names this door under "Deliberately NOT
 * checked", because a tester in a vault cannot raise a success notice at all. Its
 * auto-dismiss and hover-pause steps are driven through the reachable INFO notice instead,
 * and the 4000 ms policy is covered by node tests. Two files rather than one, measured:
 * `grep -n 4000 tests/presentation/notices/*.test.ts` prints four lines in `queue.test.ts`
 * and two in `notify.test.ts`, the latter pushing through THIS door and advancing the clock
 * — so the door itself is exercised at that timing, not only the queue beneath it.
 */
export function notifySuccess(message: string): void {
	queue?.push('success', message);
}

export function notifyWarning(message: string): void {
	queue?.push('warning', message);
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
export function notifyError(error: AppError): void {
	queue?.push('error', trError(error));
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
export function notifyFault(cause: unknown, logger: Logger, event: string): void {
	const mapped = mapUnexpected(cause);
	logger.error(event, { cause, code: mapped.code });
	notifyError(mapped);
}

import { Notice } from 'obsidian';
import type { AppError } from '../../core/errors/AppError';
import { createVaultExceptionMapper } from '../../application/errors/exceptionMapper';
import type { Logger } from '../../application/ports/Logger';
import { trError } from '../i18n/toUserMessage';
import { surfaceFor, type ToastSurface } from '../errors/errorSurfacePolicy';
import { surfaceError, type SurfaceSinks } from '../errors/surfaceError';
import { tr } from '../i18n/strings';
import { createNoticeQueue, type NoticeHost, type NoticeQueue, type NoticeView } from './queue';
import { SEVERITY_LABEL_KEYS, type NoticeSeverity } from './severity';

/**
 * Which of the two live regions a severity announces through. A warning and an error
 * interrupt; a routine confirmation waits to be read.
 */
const ANNOUNCED_BY: Readonly<Record<NoticeSeverity, RegionRole>> = {
	success: 'status',
	info: 'status',
	warning: 'alert',
	error: 'alert',
};

type RegionRole = 'status' | 'alert';

const ARIA_LIVE: Readonly<Record<RegionRole, string>> = {
	status: 'polite',
	alert: 'assertive',
};

/**
 * **The live regions are the plugin's, not the notice's, and that is the whole point.**
 * `docs/components/Toast.md` asks for `role`/`aria-live` on a region ALREADY in the document —
 * "explicitly not on a container that appears" — because a live region inserted together with
 * its content often does not announce, and it calls that "the one [mechanism detail] that
 * decides whether this component works at all for the users it exists for". An earlier draft
 * put the pair on the `Notice` element itself, which is the refused shape exactly: `new
 * Notice(text, 0)` inserts a POPULATED element and the attributes went on afterwards.
 *
 * So the regions are created once by `activateNotices` and removed by `disposeNotices`; a
 * notice announces by writing text into the one its severity names, and the `Notice` element
 * carries no `role` and no `aria-live` at all. Two regions rather than one, because the
 * politeness is fixed on the ELEMENT and a severity cannot change it after the fact.
 *
 * `null` only between a disposal and the next activation, and the HOST never reads this
 * variable: `openRegions` hands the pair it just built straight to `createObsidianHost`, so a
 * notice announces into a `Regions` it was constructed with rather than into one it has to
 * check for. Deliberate, and not only for tidiness — a `regions?.[…]` inside the announcement
 * path would carry a null arm no test could ever drive, since a host only exists while a queue
 * does and a queue only exists after the regions do. This module has a whole bullet in
 * `CLAUDE.md` about a guard nobody can reach; an unreachable one costs a branch of a budget
 * with about four to spare.
 */
type Regions = Readonly<Record<RegionRole, HTMLElement>>;

let regions: Regions | null = null;

function closeRegions(): void {
	regions?.status.remove();
	regions?.alert.remove();
	regions = null;
}

function openRegions(): Regions {
	closeRegions();
	const make = (role: RegionRole): HTMLElement =>
		document.body.createDiv({
			cls: 'rp-notice-live-region',
			// `aria-atomic` so the whole region is re-read rather than only the changed node:
			// the region holds one sentence at a time and a partial re-read of it is noise.
			attr: { role, 'aria-live': ARIA_LIVE[role], 'aria-atomic': 'true' },
		});
	regions = { status: make('status'), alert: make('alert') };
	return regions;
}

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
 * **Every per-notice concern is keyed on `messageEl`, never on `containerEl`.** Obsidian's
 * typings say `containerEl` is `@since 1.8.7` and nothing else; whether it is this notice's own
 * `.notice` element or the shared `.notice-container` every notice lands in is not settleable
 * from here, and this repository's fake necessarily encodes one reading of it. Under the
 * unfavourable one, `isConnected` is permanently true — so no slot is ever freed and the queue
 * wedges at three notices for the session — while the severity class accumulates on one shared
 * element and the four hover listeners fire for whichever notice the pointer is over.
 * `messageEl` is per-notice under BOTH readings, and this module already proves it: it clears
 * that element and appends this notice's own children into it. So the classes, the listeners
 * and the liveness read all go there.
 *
 * The cost, which is real and is why the reading still wants settling: the hover target shrinks
 * from the notice to its message box, so a pointer resting on Obsidian's own padding does not
 * pause the timer, and a click landing there dismisses natively without prompting a sweep —
 * degrading to "the slot frees on the next push", which is the mechanism's own documented
 * fallback. Step 3 of `docs/tests/cases/Notices and save state.md` is what settles which element
 * `containerEl` IS, and the answer decides whether the padding can be won back.
 *
 * **`role`/`aria-live` are NOT here at all** — see `regions` above. A notice announces by
 * writing into a live region that was already in the document before it appeared, which is what
 * `docs/components/Toast.md` asks for and what an attribute on a container that APPEARS is not.
 */
const createObsidianHost = (announceInto: Regions): NoticeHost => ({
	open(view, callbacks) {
		/**
		 * **The announcement rides `render` rather than the open, so a repeat announces too.**
		 * The queue folds an identical message into a `(×N)` suffix and calls `update` — a
		 * screen-reader user who has already been told "Save failed" is told "Save failed (×3)"
		 * when it happens twice more, which is the same information the sighted user gets. The
		 * severity word goes into the region for the same reason it is on screen: SDD §85's
		 * status-not-colour-only rule has an audible half, and `role="alert"` carries urgency
		 * without carrying WHICH of the two assertive severities this is.
		 *
		 * **What this does NOT close.** A region announces when its content CHANGES, so an
		 * identical message at the same severity — raised again after the first was dismissed —
		 * writes the same string and says nothing. A repeat arriving while the first notice is
		 * still up does not have that problem: the `(×N)` suffix makes the string differ. The
		 * usual remedy is to clear the region and write the text back in a later TASK, which
		 * puts a timer between a notice appearing and its announcement and gives disposal one
		 * more thing to cancel. Written down rather than taken, and no jsdom test can observe an
		 * announcement either way — `docs/tests/cases/Notices and save state.md` is the only
		 * instrument.
		 */
		const announce = (next: NoticeView): void => {
			announceInto[ANNOUNCED_BY[next.severity]].textContent =
				`${tr(SEVERITY_LABEL_KEYS[next.severity])} ${textOf(next)}`;
		};

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
		// The one element this host treats as the notice. See the header for why it is not
		// `containerEl`, and for the hover target that costs.
		const element = notice.messageEl;
		element.classList.add('rp-notice', `rp-notice-${view.severity}`);

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
		 * **Set by every dismissal this host can SEE, and read by `live` below.** The queue frees
		 * a slot by asking `handle.live`, which falls back to `isConnected` — correct for a
		 * dismissal nothing here observed, and an assumption about hide timing for one it did.
		 * This repository's fake detaches synchronously inside `hide()`; Obsidian's real `Notice`
		 * is animated, and if it fades out and detaches after a transition then `isConnected` is
		 * still `true` when the sweep runs. Nothing in this repository can settle which it is —
		 * hide timing is a vault-only measurement, recorded as such in
		 * `docs/tests/cases/Notices and save state.md`.
		 *
		 * So neither path that KNOWS the notice is going infers it. Our own `×` latches, and so
		 * does a click ANYWHERE on the notice, because Obsidian dismisses a clicked notice — the
		 * click listener below is what this module has always asserted that on. Latching only the
		 * `×` left the native gesture resting on hide timing, and the symptom was not the missing
		 * slot: `push` sweeps first and then DEDUPS, so a repeat of the message the user had just
		 * clicked away found the dying entry, bumped a count nobody would ever see and opened
		 * nothing. The repeat was lost outright rather than deferred, which is worse than the
		 * wedged slot the sweep was already written to survive.
		 *
		 * `isConnected` stays the authority for every dismissal neither listener sees — a future
		 * Obsidian gesture, a notice cleared by the host — which is the design's whole point and
		 * is what step 11 of the manual case exercises. That residue is still hide-timing-bound,
		 * and degrades to "the slot frees on the next push" rather than to a wedged queue.
		 */
		let dismissedHere = false;
		const sync = (): void => {
			const next = hovered || focused;
			if (next === held) return;
			held = next;
			if (held) callbacks.pause();
			else callbacks.resume();
		};

		element.addEventListener('pointerenter', () => {
			hovered = true;
			sync();
		});
		element.addEventListener('pointerleave', () => {
			hovered = false;
			sync();
		});

		/**
		 * **Obsidian dismisses a notice when the user clicks it, and does not tell us.** This
		 * listener is the design's PROMPT to sweep, and — since that sentence is a fact about
		 * the gesture and not a guess — also the latch that makes the release deterministic.
		 * Without it a natively-dismissed notice would hold its slot until some later push
		 * happened to sweep. Our own dismiss button latches and calls `dismissed` directly as
		 * well; both are idempotent, and relying on the button's click bubbling to here would
		 * depend on propagation surviving the element's removal mid-dispatch, which is not worth
		 * resting on.
		 */
		// Wrapped rather than passed as `callbacks.dismissed` directly: `NoticeCallbacks`
		// declares it as a METHOD, so handing the reference to a listener is
		// `@typescript-eslint/unbound-method` — an error here, not a warning. The arrow keeps
		// the receiver, which is what the rule is protecting.
		element.addEventListener('click', () => {
			dismissedHere = true;
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

		/**
		 * `announce` is called from HERE rather than from `open`, so a repeat announces too: the
		 * queue folds an identical message into a `(×N)` suffix and calls `update`, and a
		 * screen-reader user who has already been told "Save failed" is told "Save failed (×3)"
		 * when it happens twice more — the same information the sighted user gets.
		 */
		const render = (next: NoticeView): void => {
			label.textContent = tr(SEVERITY_LABEL_KEYS[next.severity]);
			body.textContent = textOf(next);
			announce(next);
		};
		render(view);

		element.textContent = '';
		// The flex container is THIS element — the three children below are its children, and
		// flex only reaches direct ones. This host applies SIX class names — `rp-notice`,
		// `rp-notice-<severity>`, `rp-notice-body`, `rp-notice-severity`, `rp-notice-message`,
		// `rp-notice-dismiss` — and `styles/notices.css` names all six: four of them (`-body`,
		// `-severity`, `-message`, `-dismiss`) as the element a rule declares on, and two only
		// as ANCESTORS — `.rp-notice`, which scopes the dismiss button past Obsidian's
		// `button:not(.clickable-icon)`, and `.rp-notice-<severity>`, which picks the label's
		// colour. Both ancestors are THIS element now rather than `containerEl` (see the
		// header), which every one of those rules survives because all four descendants are
		// appended here. The `display: flex` was always going to be here: on `containerEl` it
		// would have made `messageEl` the only flex item and left the three children
		// unseparated. Nothing here can show what they LOOK like: the vendored
		// `tests/harness/obsidian.css` carries no `.notice` rule at all, so a notice drawn in
		// the browser harness would have no position, no stacking and no chrome. The manual case
		// under `docs/tests/cases/` is the only instrument.
		element.classList.add('rp-notice-body');
		element.append(label, body, dismiss);

		return {
			update: render,
			hide: () => {
				notice.hide();
			},
			get live() {
				return !dismissedHere && element.isConnected;
			},
		};
	},
});

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
	// The regions are BUILT here and handed to the host, so a notice announces into a pair it was
	// constructed with rather than into one it has to look up and check for. `openRegions` closes
	// any pair a previous activation left, so a second call replaces rather than accumulates.
	queue = createNoticeQueue(createObsidianHost(openRegions()));
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
	// The regions are two elements this plugin appended to `document.body`, so leaving them
	// behind would leak markup into a vault with no plugin loaded — the same shape as the Konva
	// global this disposer list got built for.
	closeRegions();
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
 *
 * **Design slice 17 made the second parameter the door's lock.** `ToastSurface` carries a
 * brand `errorSurfacePolicy.ts` declares and never exports, so it cannot be built by hand:
 * the only way to call this is to have asked `surfaceFor` what surface the failure belongs
 * on, and to have been told a toast. A call site that should have flipped the save indicator
 * instead can no longer reach this function by accident. What the type does NOT hold is that
 * the caller named the right ORIGIN; that half is review's, against the table in the slice's
 * spec.
 *
 * The SEVERITY comes from that routed answer rather than being fixed at `error`, which is
 * what lets a `Geometry` refusal and a background stale-marker failure arrive as warnings —
 * both quieter than an error by the table's own reasoning, and neither expressible before.
 *
 * `grep -rn "notifyError" src/` prints eleven lines that are not comments: this definition,
 * `notifyFault` below it, and nine call sites across the editor, the Inspector row and two
 * plugin commands. The eleventh — `notifyFault`'s — is the one this slice's own spec table
 * missed, because that table was measured with a grep that excluded this file.
 */
export function notifyError(error: AppError, routed: ToastSurface): void {
	queue?.push(routed.level, trError(error));
}

/**
 * The doors a call site has when a notice is the only surface it can draw — a plugin command
 * with no view of its own, an editor action whose failure belongs to no field.
 *
 * Both members end at `notifyError`, and that is the honest shape rather than a shortcut: such
 * a site genuinely has one door, so a surface the table routes elsewhere has exactly one place
 * left to go. Declared ONCE here rather than spelled at each call site, because three copies of
 * "and if you cannot draw it, toast it" is three chances for one of them to be a `() => {}`
 * that tells nobody — which is the failure `unrenderable` being required exists to prevent, and
 * would reintroduce it one level down.
 *
 * A site with more doors than this builds its own `SurfaceSinks` and does not reach for this.
 */
export const noticeOnlySinks: SurfaceSinks = {
	toast: notifyError,
	unrenderable: (error, _surface, asToast) => {
		notifyError(error, asToast);
	},
};

/**
 * The `(error) => void` door a call site hands to something that will report a failure LATER
 * and cannot route it itself — `useFieldCommit`'s required `notify`, and the two Inspector
 * override rows that supply it.
 *
 * The origin is fixed at `explicit-operation` and the name says so, because that is the only
 * thing this shape can honestly mean: a composable calls its `notify` precisely when the
 * failure could NOT be attached to the field, which is the FIELD question of slice 17's
 * decision procedure already answered "no". The next question down is OPERATION.
 *
 * It exists so that door is one function rather than an arrow per binding — two spellings of
 * one decision drift, and a call site that wrote its own could quietly pick a different origin
 * for the identical situation.
 */
export function notifyOperationFailure(error: AppError): void {
	surfaceError(error, { kind: 'explicit-operation' }, noticeOnlySinks);
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
	// Already carries the technical-fault stamp: `mapUnexpected` is an `ExceptionMapper`, whose
	// declared return type is what obliges every mapper to apply it. An earlier version stamped
	// HERE instead, under a comment calling this "the one place a THROW becomes an `AppError`" —
	// which was false, and the site it missed is the one every guarded command goes through.
	// See `core/errors/technical-fault.ts`.
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
 *
 * **It routes through the policy like every other toast, and the origin is
 * `explicit-operation` for a reason worth stating.** A fault arriving here is a THROW that no
 * guard turned into a `Result` — so there was no `Result` for a policy to have routed, and
 * this is the one door where the surface really is decided at the door. Asking anyway keeps
 * `notifyError` reachable through exactly one mechanism rather than two, and answers what the
 * old fixed `'error'` severity said: a technical fault at an operation the user triggered is
 * an error toast. It is NOT `background-cascade`, which would route a `Persistence` fault to a
 * warning and every other category to silence — and a fault reaching nobody is precisely the
 * defect this function exists to prevent.
 */
export function notifyFault(cause: unknown, logger: Logger, event: string): void {
	const error = faultError(cause, logger, event);
	const surface = surfaceFor(error, { kind: 'explicit-operation' });
	if (surface.kind === 'toast') notifyError(error, surface);
}

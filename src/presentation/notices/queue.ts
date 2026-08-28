import { AUTO_DISMISS_MS, MAX_VISIBLE_NOTICES, type NoticeSeverity } from './severity';

/** What a host needs in order to draw one notice. */
export interface NoticeView {
	readonly severity: NoticeSeverity;
	readonly message: string;
	readonly count: number;
}

/**
 * What a host calls back INTO the queue. `dismissed` is a HINT rather than the mechanism —
 * see `sweep` below — while `pause`/`resume` are the accessibility timing rule: a timed
 * message must not vanish while somebody is reading it or tabbing to its dismiss control.
 */
export interface NoticeCallbacks {
	dismissed(): void;
	pause(): void;
	resume(): void;
}

export interface NoticeHandle {
	update(view: NoticeView): void;
	hide(): void;
	/** False once the host's element has gone — a dismissal we did not perform included. */
	readonly live: boolean;
}

export interface NoticeHost {
	open(view: NoticeView, callbacks: NoticeCallbacks): NoticeHandle;
}

export interface NoticeQueue {
	push(severity: NoticeSeverity, message: string): void;
	dispose(): void;
}

interface Entry {
	severity: NoticeSeverity;
	message: string;
	count: number;
	handle: NoticeHandle | null;
	timer: ReturnType<typeof setTimeout> | null;
	/** The user is hovering this notice or focusing its dismiss control. */
	paused: boolean;
}

const sameNotice = (entry: Entry, severity: NoticeSeverity, message: string): boolean =>
	entry.severity === severity && entry.message === message;

const viewOf = (entry: Entry): NoticeView => ({
	severity: entry.severity,
	message: entry.message,
	count: entry.count,
});

// NOT an eager `const scheduleTimeout = setTimeout;` alias — that captures whatever
// `setTimeout` is bound to at MODULE-EVALUATION time, which in a suite is the real timer:
// `vi.useFakeTimers()` replaces `globalThis.setTimeout` in a `beforeEach` that runs AFTER
// this module has already imported and captured it, so an eager alias holds the real timer
// forever and every fake-timer assertion in this suite (and in Tasks 4 and 5, which drive
// auto-dismiss, hover-pause and the disconnect sweep through `vi.advanceTimersByTime`)
// would either hang on real time or silently pass for the wrong reason. A default parameter
// is evaluated at CALL time, so `schedule`/`cancel` re-read the current global on every
// invocation and see whichever timer — real or faked — is installed at that moment.
//
// This is also why `window.setTimeout`/`clearTimeout` isn't the answer here even though the
// marketplace ruleset (`obsidianmd/prefer-window-timers`) asks for it: `window` does not
// exist in this module's `node` test environment at all. The rule's own scope walk
// (`node_modules/eslint-plugin-obsidianmd/dist/lib/rules/preferWindowTimers.js`) stands down
// the moment it finds a LOCAL variable named `setTimeout`/`clearTimeout` — that branch exists
// to avoid flagging an unrelated user-defined function that happens to share the name, not as
// a sanctioned host-agnostic idiom, and reading it as the latter is what let the eager-alias
// defect above look settled.
const scheduleTimeout = (run: () => void, after: number, schedule: typeof setTimeout = setTimeout) =>
	schedule(run, after);
const cancelTimeout = (id: ReturnType<typeof setTimeout>, cancel: typeof clearTimeout = clearTimeout) =>
	cancel(id);

/**
 * Dedup, a three-slot visible cap, promotion, and every timer.
 *
 * Pure over an injected `NoticeHost`, so every rule below is a node test with no Obsidian in
 * it. `notify.ts` is the only module that binds that port to `new Notice(...)`, which is what
 * keeps "one notice door" a fact about the import graph rather than a sentence.
 */
export function createNoticeQueue(host: NoticeHost): NoticeQueue {
	const entries: Entry[] = [];

	const visible = (): Entry[] => entries.filter((entry) => entry.handle !== null);

	// `sweep`, `arm` and `promote` are mutually recursive — `arm`'s timeout calls `promote`,
	// `promote` calls `ops.show` which calls `arm` — and `no-use-before-define` refuses that
	// cycle whichever of two separately named functions is written first. One shared object
	// resolves it: every cross-reference below goes through `ops.<name>`, so the identifier
	// the linter checks is always `ops` itself — already declared by the time any of these
	// bodies actually runs — rather than a forward reference to a sibling's name.
	const ops = {
		/**
		 * **`handle.live` is the authority on whether a slot is free, and a dismissal hint is
		 * only a prompt to ask.** Obsidian can dismiss a notice without telling us — its own
		 * click gesture — and the typings expose no callback either way, so a queue that
		 * counted only its own dismissals would leak one slot per user dismissal until it
		 * could never show anything again: a failure that arrives slowly, in a real vault, and
		 * in no test. Reading `live` means a dismissal by any mechanism frees its slot, and a
		 * changed gesture in a future Obsidian degrades to "the slot frees on the next push"
		 * rather than to a permanently wedged queue.
		 */
		sweep(): void {
			// A SNAPSHOT, because `release` splices `entries`: iterating the live array shifts
			// the next element behind the cursor, so with two notices dismissed externally the
			// second stays tracked as visible and goes on reserving a slot no notice occupies.
			for (const entry of entries.slice()) {
				if (entry.handle !== null && !entry.handle.live) ops.release(entry);
			}
		},

		release(entry: Entry): void {
			if (entry.timer !== null) cancelTimeout(entry.timer);
			entry.timer = null;
			entry.handle = null;
			const at = entries.indexOf(entry);
			if (at >= 0) entries.splice(at, 1);
		},

		/**
		 * Start, restart or withhold this entry's auto-dismiss countdown — and decide **in one
		 * place** whether it should have one at all. Three conditions withhold it, and each was
		 * its own defect before they lived together here:
		 *
		 * - a severity that PERSISTS has no timer, which is the policy;
		 * - a HELD entry has none, because the callback below calls `release`, which would
		 *   delete a queued notice nobody has ever seen — a repeated success behind three
		 *   warnings, silently dropped instead of promoted;
		 * - a PAUSED entry has none, because the user is reading it or tabbing to its dismiss
		 *   control, and an identical message arriving mid-interaction must not restart the
		 *   clock underneath them.
		 *
		 * So every caller calls `arm` unconditionally and none of them tests a condition first.
		 * A guard at a call site would be a second copy of this rule, and two copies of one
		 * rule disagree — which is exactly how the first two of those three arrived.
		 */
		arm(entry: Entry): void {
			if (entry.timer !== null) cancelTimeout(entry.timer);
			entry.timer = null;

			const after = AUTO_DISMISS_MS[entry.severity];
			if (after === null || entry.handle === null || entry.paused) return;

			entry.timer = scheduleTimeout(() => {
				entry.handle?.hide();
				ops.release(entry);
				ops.promote();
			}, after);
		},

		show(entry: Entry): void {
			entry.handle = host.open(viewOf(entry), {
				dismissed: () => {
					ops.sweep();
					ops.promote();
				},
				pause: () => {
					entry.paused = true;
					ops.arm(entry);
				},
				resume: () => {
					entry.paused = false;
					ops.arm(entry);
				},
			});
			ops.arm(entry);
		},

		/** Fill every free slot, oldest held notice first. */
		promote(): void {
			for (const entry of entries) {
				if (visible().length >= MAX_VISIBLE_NOTICES) return;
				if (entry.handle === null) ops.show(entry);
			}
		},
	};

	return {
		push(severity, message) {
			ops.sweep();

			const existing = entries.find((entry) => sameNotice(entry, severity, message));
			if (existing !== undefined) {
				existing.count += 1;
				existing.handle?.update(viewOf(existing));
				// Unconditional on purpose: `arm` is the one place that decides whether a held or
				// paused entry gets a countdown. See its header.
				ops.arm(existing);
			} else {
				entries.push({ severity, message, count: 1, handle: null, timer: null, paused: false });
			}

			// **After BOTH paths, not just the new-entry one.** The design's guarantee is that an
			// unobserved dismissal degrades to "the slot frees on the next push" — and a push is a
			// push whether or not it happened to duplicate something. Returning early from the
			// dedup branch left `sweep` freeing a slot that nothing then filled, so a held notice
			// could stay invisible indefinitely behind a repeating message.
			ops.promote();
		},

		dispose() {
			for (const entry of entries.splice(0)) {
				if (entry.timer !== null) cancelTimeout(entry.timer);
				entry.handle?.hide();
			}
		},
	};
}

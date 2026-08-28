# Slice 13 — Notifications and save-state surfaces — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the plugin a severity-carrying, accessible, deduplicating toast surface built on Obsidian's own `Notice`, and a per-Plan-Editor save-state indicator driven by the command dispatcher.

**Architecture:** `Notice` is the container primitive — Obsidian owns positioning, stacking and animation; we own severity markup, timing, dedup, and a three-slot visible cap. Every notice is constructed with `duration: 0` so the timer is ours, which is what makes hover-pause and programmatic promotion possible. The save-state half decorates the existing `CommandHistory` dispatcher without modifying it, tracking `pendingCount` so overlapping dispatches never settle early.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia (setup stores), Vitest (node + jsdom), ESLint `no-restricted-syntax`, Obsidian 1.13.0 API.

**Spec:** [`docs/superpowers/specs/2026-08-28-slice-13-notifications-and-save-state-design.md`](../specs/2026-08-28-slice-13-notifications-and-save-state-design.md)

> **STOP — read these two before Task 1, and read the spec's "Unresolved" section with them.**
> `docs/components/Save-state indicator.md` and `docs/components/Toast.md` are component
> contracts naming this slice in their own frontmatter, and the design was written without
> opening either. Three conflicts are **open**, not fixed: no retry emit on Save Error, no
> mark beside the word on either surface, and no moving indicator for Saving.
>
> **Two tasks are genuinely blocked and three are merely extendable — the distinction matters
> and an earlier draft of this banner blurred it.**
>
> - **BLOCKED, do not execute:** **Task 12** — `affectsSaveState` cannot infer write
>   disposition from `Result.ok` and `AppError.category`, and the predicate's shape is
>   undecided. **Task 13** — the indicator owes a retry EMIT, which changes its props and
>   needs a retryable operation `SaveStateStore` does not hold, plus a mark and a moving
>   indicator.
> - **EXTENDABLE, execute as written:** **Tasks 2, 6 and 8.** A mark is *additive* to the
>   word, not a replacement for it, so the severity keys, the host markup and the stylesheet
>   are correct as far as they go and gain one element later. Building them now is an
>   increment, not rework — but whoever builds them should know a mark is still owed.
>
> **Task 14** wires the tracker and is executable, with one thing recorded rather than fixed:
> `set-plan-background` writes to the open plan outside that dispatcher, so the indicator will
> read `Saved` through a background write. See the spec's "Unresolved" section.
>
> Every other task is unaffected.
>
> There is a whole `docs/components/` directory of these. Check it for any component a task
> touches before writing the task's code — that directory was missed entirely when this plan
> was written, which is the reason for this banner.

**Slice document:** [`docs/tasks/13-notifications-and-save-state-surfaces.md`](../../tasks/13-notifications-and-save-state-surfaces.md)

## Global Constraints

- **Indentation is tabs.** Every file in `src/`, `tests/` and `styles/` uses tabs. A space-indented file fails `npm run lint`.
- **No user-facing string literal in a component or module.** All copy goes in `src/presentation/i18n/locales/en.ts` and is translated in `de.ts` in the same edit. Reach it with `tr(key)` (app language) or `t(language, key)` (pure).
- **`getLanguage` may be imported in `src/presentation/i18n/strings.ts` and nowhere else.** `LANGUAGE_RESOLUTION_BAN` fails the build otherwise. Use `tr`.
- **No hardcoded colour anywhere in `styles/`.** Use Obsidian CSS variables (`var(--text-error)`, `var(--text-success)`, `var(--text-warning)`, `var(--text-muted)`, `var(--background-modifier-error)`). The build parses the assembled sheet and fails on a literal colour, a named colour word included.
- **400-line cap per stylesheet partial**, enforced by `scripts/styles-assemble.mjs`.
- **A new partial must be imported in `styles/index.css`** or the build fails on an unreferenced partial.
- **`Result` is data.** Write `isErr(result)` or `!result.ok`, never `result.isErr()`.
- **Coverage floors: 99 / 99 / 99 / 98** (statements / functions / lines / branches). Branches has roughly two branches of headroom — plan a test with every new arm, do not add one and hope.
- **Definition of done is `npm run check`** (build + lint + coverage-thresholded tests + fallow). All four.
- **No `setIcon`.** Severity is carried by a translated text label plus colour. This plugin has never called `setIcon` and the harness has no icon renderer; a text label already satisfies "status not colour-only".
- **Follow the idiom of the file you are extending, and read it first.** Every helper in
  `tests/helpers/` has a shape the surrounding cases already demonstrate — `lintText` resolves
  `Promise<string[]>` of rule ids, not ESLint message objects, and the existing cases assert
  `expect(await lintText(code, path)).toContain(RULE)`. A test written from memory beside four
  correct examples is how this plan acquired a case that could not pass.
- **A test touching the DOM needs `@vitest-environment jsdom`.** `vitest.config.ts:19` sets
  `environment: 'node'` for everything; 52 existing suites opt in with that directive as the
  first line of a docblock. Without it a DOM suite fails with `document is not defined`
  before its first assertion. Four suites in this plan need it — the `Notice` fake's, the
  notify door's, the disposal one, and the indicator's — and the pure ones (severity, queue,
  save-state store, the tracking decorator) deliberately do not.
- **`ErrorCategory` is TITLE case**: `'Domain' | 'Validation' | 'Persistence' | 'Geometry' |
  'Import' | 'Migration' | 'Reference' | 'Calculation'` (`src/core/errors/AppError.ts:10`).
  **Never build a test error with an `unknown` cast.** Annotate it `const e: AppError = {…}`
  so the compiler checks it. A lowercase literal behind a cast does not merely fail to match:
  `toUserMessage` falls back to `CATEGORY_KEYS[error.category]`, which is keyed by the real
  union, so the lookup yields `undefined` and the resolved message is EMPTY — and a test
  asserting `not.toContain(developerText)` then passes against nothing. Two separate fixtures
  in this plan had that shape and both looked green. If you add another, grep for
  `as unknown as AppError` across every test file this plan touches, not just the one you are
  editing.
- **Commit after every task.** Conventional-commit prefixes as used in this repo (`feat:`, `fix:`, `test:`, `docs:`).

---

### Task 1: Make the `Notice` fake honest

The mock is a six-line recorder that draws nothing. Every later task's jsdom assertions depend on it nesting what Obsidian nests. Expect this to turn existing tests red — per CLAUDE.md's ledger, two previous fake-widenings turned 65 and 86 tests red, and those reds were the finding.

**Files:**
- Modify: `tests/helpers/obsidian-mock.ts:125-131`
- Test: `tests/helpers/obsidian-mock.test.ts` (create if absent)

**Interfaces:**
- Consumes: nothing.
- Produces: `class Notice` with `containerEl: HTMLElement`, `messageEl: HTMLElement`, `setMessage(text: string): this`, `hide(): void`, `readonly duration: number | undefined`, the existing `static readonly shown: string[]`, and `static readonly constructed: Notice[]`.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { Notice } from './obsidian-mock';

describe('the Notice fake', () => {
	it('nests a notice inside a notice container, the way Obsidian does', () => {
		const notice = new Notice('hello');
		expect(notice.containerEl.classList.contains('notice')).toBe(true);
		expect(notice.containerEl.parentElement?.classList.contains('notice-container')).toBe(true);
		expect(notice.messageEl.textContent).toBe('hello');
		expect(notice.containerEl.isConnected).toBe(true);
	});

	it('records the duration it was constructed with', () => {
		expect(new Notice('a', 0).duration).toBe(0);
	});

	it('keeps every instance, so a test can assert what a caller passed', () => {
		Notice.constructed.length = 0;
		new Notice('a', 0);
		expect(Notice.constructed.at(-1)?.duration).toBe(0);
	});

	it('replaces the message in place', () => {
		const notice = new Notice('one');
		notice.setMessage('two');
		expect(notice.messageEl.textContent).toBe('two');
	});

	it('disconnects the element on hide, which is what frees a slot', () => {
		const notice = new Notice('a', 0);
		notice.hide();
		expect(notice.containerEl.isConnected).toBe(false);
	});

	it('still records every message for the call sites that assert on that', () => {
		Notice.shown.length = 0;
		new Notice('recorded');
		expect(Notice.shown).toEqual(['recorded']);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/helpers/obsidian-mock.test.ts`
Expected: FAIL — `notice.containerEl` is undefined.

- [ ] **Step 3: Widen the fake**

Replace `tests/helpers/obsidian-mock.ts:125-131` with:

```ts
/**
 * Obsidian's transient message. THIN is the failure mode this fake exists to avoid: the
 * previous version recorded a string and drew nothing, so no test could assert the roles,
 * the dismiss control or the markup that design slice 13 puts inside `messageEl`.
 *
 * What is modelled: the `.notice-container > .notice` nesting Obsidian builds, the two
 * element handles it exposes, the duration it was constructed with, in-place replacement,
 * and a `hide()` that DISCONNECTS — the queue reads `isConnected` to decide whether a
 * visible slot is free, so a `hide()` that left the element attached would make that
 * mechanism untestable.
 *
 * What is NOT modelled, stated so nothing trusts this wider than it is: Obsidian's own
 * auto-dismiss timer (this plugin always passes `duration: 0` and owns the timer), its
 * click-to-dismiss gesture, and every visual rule — `tests/harness/obsidian.css` carries no
 * `.notice` rules at all, so appearance is verified in a real vault and nowhere else.
 */
export class Notice {
	static readonly shown: string[] = [];
	/**
	 * The instances themselves, so a test can assert the ARGUMENTS a caller passed rather than
	 * only the outcome. `duration` is the one that matters: this plugin owns every notice's
	 * timer and passes `0` for it, and nothing but this array can check that the `0` is really
	 * being passed — the fake implements no timer, so a wrong duration is invisible in
	 * behaviour here and visible only in a real vault.
	 */
	static readonly constructed: Notice[] = [];

	readonly containerEl: HTMLElement;
	readonly messageEl: HTMLElement;

	constructor(
		readonly message: string,
		readonly duration?: number,
	) {
		Notice.shown.push(message);
		Notice.constructed.push(this);

		const container =
			document.body.querySelector<HTMLElement>('.notice-container') ??
			document.body.appendChild(
				Object.assign(document.createElement('div'), { className: 'notice-container' }),
			);

		this.containerEl = container.appendChild(
			Object.assign(document.createElement('div'), { className: 'notice' }),
		);
		this.messageEl = this.containerEl.appendChild(document.createElement('div'));
		this.messageEl.textContent = message;
	}

	setMessage(message: string): this {
		this.messageEl.textContent = message;
		return this;
	}

	hide(): void {
		this.containerEl.remove();
	}
}
```

- [ ] **Step 4: Run the new test, then the whole suite**

Run: `npx vitest run tests/helpers/obsidian-mock.test.ts`
Expected: PASS

Run: `npx vitest run`
Expected: some existing tests may now fail. **Each failure is a finding, not an obstacle.** Read it before changing it: a test that passed against a fake drawing nothing and fails against one drawing real DOM was asserting something that was never true of Obsidian. Fix the test, not the fake — unless the fake is genuinely wrong about Obsidian, in which case fix the fake and say so in its docblock.

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/obsidian-mock.ts tests/helpers/obsidian-mock.test.ts
git commit -m "test: the Notice fake nests what Obsidian nests"
```

---

### Task 2: The severity vocabulary and its dismiss policy

**Files:**
- Create: `src/presentation/notices/severity.ts`
- Test: `tests/presentation/notices/severity.test.ts`

**Interfaces:**
- Consumes: `StringKey` from `src/presentation/i18n/locales/en`.
- Produces:
  - `type NoticeSeverity = 'success' | 'info' | 'warning' | 'error'`
  - `const AUTO_DISMISS_MS: Readonly<Record<NoticeSeverity, number | null>>`
  - `const SEVERITY_LABEL_KEYS: Readonly<Record<NoticeSeverity, StringKey>>`
  - `const MAX_VISIBLE_NOTICES = 3`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
	AUTO_DISMISS_MS,
	MAX_VISIBLE_NOTICES,
	SEVERITY_LABEL_KEYS,
	type NoticeSeverity,
} from '../../../src/presentation/notices/severity';
import { en } from '../../../src/presentation/i18n/locales/en';

const SEVERITIES: NoticeSeverity[] = ['success', 'info', 'warning', 'error'];

describe('the notice severity vocabulary', () => {
	it('auto-dismisses the two severities with nothing to act on', () => {
		expect(AUTO_DISMISS_MS.success).toBe(4000);
		expect(AUTO_DISMISS_MS.info).toBe(6000);
	});

	it('keeps a warning up as long as an error, because both may need acting on', () => {
		expect(AUTO_DISMISS_MS.warning).toBeNull();
		expect(AUTO_DISMISS_MS.error).toBeNull();
	});

	it('shows three at once', () => {
		expect(MAX_VISIBLE_NOTICES).toBe(3);
	});

	it.each(SEVERITIES)('resolves a label for %s, so severity is never colour alone', (severity) => {
		expect(en[SEVERITY_LABEL_KEYS[severity]]).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/notices/severity.test.ts`
Expected: FAIL — cannot resolve `severity`.

- [ ] **Step 3: Write the module**

```ts
import type { StringKey } from '../i18n/locales/en';

/**
 * What a notice is ABOUT, which decides how long it stays and how urgently a screen reader
 * announces it. Four members, from design slice 13.
 */
export type NoticeSeverity = 'success' | 'info' | 'warning' | 'error';

/**
 * How long each severity stays before dismissing itself; `null` means it stays until
 * dismissed. The SDD names no numbers, so these are this slice's own tunable defaults.
 *
 * `warning` is grouped with `error` rather than with the auto-dismissing pair, on the
 * reasoning that a warning exists to flag something the user may need to register — and
 * auto-hiding it risks exactly the failure mode a warning exists to prevent.
 *
 * The consequence, stated rather than hidden: a burst of warnings or errors can fill every
 * visible slot and hold a later success back until one is dismissed. A persistent notice
 * existing to be NOT missed is the same property that lets it crowd out a transient one.
 */
export const AUTO_DISMISS_MS: Readonly<Record<NoticeSeverity, number | null>> = {
	success: 4000,
	info: 6000,
	warning: null,
	error: null,
};

/**
 * The translated word that rides beside the colour. SDD §85 forbids status carried by
 * colour alone, and this — rather than an icon — is how that rule is kept: this plugin has
 * never called `setIcon`, and a text label satisfies the rule on its own.
 */
export const SEVERITY_LABEL_KEYS: Readonly<Record<NoticeSeverity, StringKey>> = {
	success: 'notice.severity.success',
	info: 'notice.severity.info',
	warning: 'notice.severity.warning',
	error: 'notice.severity.error',
};

/**
 * How many notices are on screen at once. Enough to follow a multi-step operation without
 * the stack covering meaningful canvas; anything further waits and is promoted into a freed
 * slot rather than dropped.
 */
export const MAX_VISIBLE_NOTICES = 3;
```

- [ ] **Step 4: Add the four locale entries**

In `src/presentation/i18n/locales/en.ts`, before the closing `} as const;`:

```ts
	'notice.severity.success': 'Success',
	'notice.severity.info': 'Information',
	'notice.severity.warning': 'Warning',
	'notice.severity.error': 'Error',
	'notice.dismiss': 'Dismiss',
```

In `src/presentation/i18n/locales/de.ts`, in the same relative position:

```ts
	'notice.severity.success': 'Erfolg',
	'notice.severity.info': 'Information',
	'notice.severity.warning': 'Warnung',
	'notice.severity.error': 'Fehler',
	'notice.dismiss': 'Schließen',
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/presentation/notices/severity.test.ts tests/presentation/i18n/`
Expected: PASS — including `strings.test.ts`, which refuses a key `en.ts` declares and `de.ts` does not.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/notices/severity.ts src/presentation/i18n/locales/ tests/presentation/notices/severity.test.ts
git commit -m "feat: the notice severity vocabulary and its dismiss policy"
```

---

### Task 3: The queue — dedup, the visible cap, and promotion

**Files:**
- Create: `src/presentation/notices/queue.ts`
- Test: `tests/presentation/notices/queue.test.ts`

**Interfaces:**
- Consumes: `NoticeSeverity`, `AUTO_DISMISS_MS`, `MAX_VISIBLE_NOTICES` from `./severity`.
- Produces:
  - `interface NoticeView { readonly severity: NoticeSeverity; readonly message: string; readonly count: number }`
  - `interface NoticeCallbacks { dismissed(): void; pause(): void; resume(): void }`
  - `interface NoticeHandle { update(view: NoticeView): void; hide(): void; readonly live: boolean }`
  - `interface NoticeHost { open(view: NoticeView, callbacks: NoticeCallbacks): NoticeHandle }`
  - `function createNoticeQueue(host: NoticeHost): NoticeQueue`
  - `interface NoticeQueue { push(severity: NoticeSeverity, message: string): void; dispose(): void }`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createNoticeQueue,
	type NoticeCallbacks,
	type NoticeHandle,
	type NoticeHost,
	type NoticeView,
} from '../../../src/presentation/notices/queue';

/**
 * A host that records rather than draws, so every rule in the queue is a node test. It
 * keeps each handle LIVE until something hides it, which is the property the queue reads to
 * decide whether a visible slot is free.
 */
function recordingHost() {
	const opened: { view: NoticeView; callbacks: NoticeCallbacks; handle: NoticeHandle }[] = [];
	const host: NoticeHost = {
		open(view, callbacks) {
			let live = true;
			let current = view;
			const handle: NoticeHandle = {
				update: (next) => {
					current = next;
				},
				hide: () => {
					live = false;
				},
				get live() {
					return live;
				},
			};
			opened.push({
				get view() {
					return current;
				},
				callbacks,
				handle,
			} as (typeof opened)[number]);
			return handle;
		},
	};
	return { host, opened, live: () => opened.filter((o) => o.handle.live) };
}

describe('the notice queue', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it('opens a notice for a push', () => {
		const { host, opened } = recordingHost();
		createNoticeQueue(host).push('error', 'boom');
		expect(opened).toHaveLength(1);
		expect(opened[0]?.view).toMatchObject({ severity: 'error', message: 'boom', count: 1 });
	});

	it('folds an identical repeat into a count rather than a second notice', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('error', 'boom');
		queue.push('error', 'boom');
		expect(opened).toHaveLength(1);
		expect(opened[0]?.view.count).toBe(2);
	});

	it('treats the same message at a different severity as a different notice', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('warning', 'same');
		queue.push('error', 'same');
		expect(opened).toHaveLength(2);
	});

	it('shows at most three at once and holds the rest back', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c', 'd']) queue.push('error', message);
		expect(opened).toHaveLength(3);
		expect(opened.map((o) => o.view.message)).toEqual(['a', 'b', 'c']);
	});

	it('promotes a held notice into a freed slot rather than dropping it', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c', 'd']) queue.push('error', message);

		// Both halves, in the order the real host performs them: the element goes, THEN the
		// hint arrives. `dismissed` only sweeps and promotes, and `sweep` reads `handle.live` —
		// so a hint alone, with the handle still live, frees nothing and promotes nothing.
		opened[0]?.handle.hide();
		opened[0]?.callbacks.dismissed();

		expect(opened).toHaveLength(4);
		expect(opened[3]?.view.message).toBe('d');
	});

	it('hides everything it still holds on dispose', () => {
		const { host, live } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('error', 'a');
		queue.push('error', 'b');
		queue.dispose();
		expect(live()).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/notices/queue.test.ts`
Expected: FAIL — cannot resolve `queue`.

- [ ] **Step 3: Write the queue**

```ts
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

	/**
	 * **`handle.live` is the authority on whether a slot is free, and a dismissal hint is
	 * only a prompt to ask.** Obsidian can dismiss a notice without telling us — its own
	 * click gesture — and the typings expose no callback either way, so a queue that counted
	 * only its own dismissals would leak one slot per user dismissal until it could never
	 * show anything again: a failure that arrives slowly, in a real vault, and in no test.
	 * Reading `live` means a dismissal by any mechanism frees its slot, and a changed
	 * gesture in a future Obsidian degrades to "the slot frees on the next push" rather than
	 * to a permanently wedged queue.
	 */
	const sweep = (): void => {
		// A SNAPSHOT, because `release` splices `entries`: iterating the live array shifts the
		// next element behind the cursor, so with two notices dismissed externally the second
		// stays tracked as visible and goes on reserving a slot no notice occupies.
		for (const entry of [...entries]) {
			if (entry.handle !== null && !entry.handle.live) release(entry);
		}
	};

	const release = (entry: Entry): void => {
		if (entry.timer !== null) clearTimeout(entry.timer);
		entry.timer = null;
		entry.handle = null;
		const at = entries.indexOf(entry);
		if (at >= 0) entries.splice(at, 1);
	};

	const viewOf = (entry: Entry): NoticeView => ({
		severity: entry.severity,
		message: entry.message,
		count: entry.count,
	});

	/**
	 * Start, restart or withhold this entry's auto-dismiss countdown — and decide **in one
	 * place** whether it should have one at all. Three conditions withhold it, and each was
	 * its own defect before they lived together here:
	 *
	 * - a severity that PERSISTS has no timer, which is the policy;
	 * - a HELD entry has none, because the callback below calls `release`, which would delete
	 *   a queued notice nobody has ever seen — a repeated success behind three warnings,
	 *   silently dropped instead of promoted;
	 * - a PAUSED entry has none, because the user is reading it or tabbing to its dismiss
	 *   control, and an identical message arriving mid-interaction must not restart the clock
	 *   underneath them.
	 *
	 * So every caller calls `arm` unconditionally and none of them tests a condition first. A
	 * guard at a call site would be a second copy of this rule, and two copies of one rule
	 * disagree — which is exactly how the first two of those three arrived.
	 */
	const arm = (entry: Entry): void => {
		if (entry.timer !== null) clearTimeout(entry.timer);
		entry.timer = null;

		const after = AUTO_DISMISS_MS[entry.severity];
		if (after === null || entry.handle === null || entry.paused) return;

		entry.timer = setTimeout(() => {
			entry.handle?.hide();
			release(entry);
			promote();
		}, after);
	};

	const show = (entry: Entry): void => {
		entry.handle = host.open(viewOf(entry), {
			dismissed: () => {
				sweep();
				promote();
			},
			pause: () => {
				entry.paused = true;
				arm(entry);
			},
			resume: () => {
				entry.paused = false;
				arm(entry);
			},
		});
		arm(entry);
	};

	/** Fill every free slot, oldest held notice first. */
	const promote = (): void => {
		for (const entry of entries) {
			if (visible().length >= MAX_VISIBLE_NOTICES) return;
			if (entry.handle === null) show(entry);
		}
	};

	return {
		push(severity, message) {
			sweep();

			const existing = entries.find((entry) => sameNotice(entry, severity, message));
			if (existing !== undefined) {
				existing.count += 1;
				existing.handle?.update(viewOf(existing));
				// Unconditional on purpose: `arm` is the one place that decides whether a held or
				// paused entry gets a countdown. See its header.
				arm(existing);
			} else {
				entries.push({ severity, message, count: 1, handle: null, timer: null, paused: false });
			}

			// **After BOTH paths, not just the new-entry one.** The design's guarantee is that an
			// unobserved dismissal degrades to "the slot frees on the next push" — and a push is a
			// push whether or not it happened to duplicate something. Returning early from the
			// dedup branch left `sweep` freeing a slot that nothing then filled, so a held notice
			// could stay invisible indefinitely behind a repeating message.
			promote();
		},

		dispose() {
			for (const entry of entries.splice(0)) {
				if (entry.timer !== null) clearTimeout(entry.timer);
				entry.handle?.hide();
			}
		},
	};
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/presentation/notices/queue.test.ts`
Expected: PASS — all six.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/notices/queue.ts tests/presentation/notices/queue.test.ts
git commit -m "feat: the notice queue dedups, caps at three and promotes"
```

---

### Task 4: The timers — auto-dismiss, and the pause that keeps it readable

The code is already written in Task 3. This task is the test that proves it, and it is a separate task because a reviewer could accept the queue's structure and reject its timing.

**Files:**
- Modify: `tests/presentation/notices/queue.test.ts`

**Interfaces:**
- Consumes: everything Task 3 produced.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe`, reusing `recordingHost` from Task 3:

```ts
	it('dismisses a success at its own deadline and not before', () => {
		const { host, live } = recordingHost();
		createNoticeQueue(host).push('success', 'saved');
		vi.advanceTimersByTime(3999);
		expect(live()).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(live()).toHaveLength(0);
	});

	it('gives an info longer than a success, since informational text runs longer', () => {
		const { host, live } = recordingHost();
		createNoticeQueue(host).push('info', 'indexing');
		vi.advanceTimersByTime(4000);
		expect(live()).toHaveLength(1);
		vi.advanceTimersByTime(2000);
		expect(live()).toHaveLength(0);
	});

	it('never times a warning or an error out', () => {
		const { host, live } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('warning', 'check this');
		queue.push('error', 'failed');
		vi.advanceTimersByTime(60_000);
		expect(live()).toHaveLength(2);
	});

	it('holds a notice open while it is hovered or its dismiss control is focused', () => {
		const { host, opened, live } = recordingHost();
		createNoticeQueue(host).push('success', 'saved');
		vi.advanceTimersByTime(3000);
		opened[0]?.callbacks.pause();
		vi.advanceTimersByTime(60_000);
		expect(live()).toHaveLength(1);
	});

	it('restarts a full duration on leaving, not the remainder', () => {
		const { host, opened, live } = recordingHost();
		createNoticeQueue(host).push('success', 'saved');
		vi.advanceTimersByTime(3000);
		opened[0]?.callbacks.pause();
		opened[0]?.callbacks.resume();
		vi.advanceTimersByTime(3999);
		expect(live()).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(live()).toHaveLength(0);
	});

	it('restarts the timer on a repeat, so a recurring message does not expire mid-burst', () => {
		const { host, live } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('success', 'saved');
		vi.advanceTimersByTime(3000);
		queue.push('success', 'saved');
		vi.advanceTimersByTime(3000);
		expect(live()).toHaveLength(1);
		vi.advanceTimersByTime(1000);
		expect(live()).toHaveLength(0);
	});

	it('does not restart the clock on a duplicate arriving while the user is interacting', () => {
		const { host, opened, live } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('success', 'saved');

		opened[0]?.callbacks.pause();
		queue.push('success', 'saved');

		// The repeat must not have armed a new timer under a hovering user.
		vi.advanceTimersByTime(60_000);
		expect(live()).toHaveLength(1);
		expect(opened[0]?.view.count).toBe(2);

		opened[0]?.callbacks.resume();
		vi.advanceTimersByTime(4000);
		expect(live()).toHaveLength(0);
	});

	it('does not time out a held duplicate that has never been shown', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		// Three persistent notices fill every slot, so the success below is held, not shown.
		for (const message of ['a', 'b', 'c']) queue.push('error', message);
		queue.push('success', 'held');
		queue.push('success', 'held');
		expect(opened).toHaveLength(3);

		// Well past the success deadline: a held entry has no timer, so it is still queued.
		vi.advanceTimersByTime(60_000);
		// Both halves again — the element goes, THEN the hint arrives. A hint alone leaves
		// `handle.live` true, so `sweep` frees nothing. (The sibling case above had this right
		// and this one did not, which is what a fix applied to one instance of a pattern looks
		// like.)
		opened[0]?.handle.hide();
		opened[0]?.callbacks.dismissed();
		expect(opened.at(-1)?.view.message).toBe('held');
		expect(opened.at(-1)?.view.count).toBe(2);
	});

	it('promotes a held notice when a visible one times out', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c', 'd']) queue.push('success', message);
		expect(opened).toHaveLength(3);
		vi.advanceTimersByTime(4000);
		expect(opened[3]?.view.message).toBe('d');
	});
```

- [ ] **Step 2: Run and confirm they pass against Task 3's implementation**

Run: `npx vitest run tests/presentation/notices/queue.test.ts`
Expected: PASS. If any fails, the defect is in Task 3's queue, not in the test — fix `queue.ts`.

- [ ] **Step 3: Prove the tests can fail**

Temporarily change `AUTO_DISMISS_MS.success` in `src/presentation/notices/severity.ts` from `4000` to `null`. Re-run. Expected: the success, restart and promotion cases go red. **Restore the `4000`** and re-run to green. A timing test that cannot fail is not a timing test.

- [ ] **Step 4: Commit**

```bash
git add tests/presentation/notices/queue.test.ts
git commit -m "test: the notice queue's timing, pause and promotion rules"
```

---

### Task 5: The disconnect sweep — a dismissal we did not perform still frees its slot

**Files:**
- Modify: `tests/presentation/notices/queue.test.ts`

**Interfaces:**
- Consumes: Task 3's exports.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append inside the same `describe`:

```ts
	it('frees a slot when a notice was dismissed by something other than this queue', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c', 'd']) queue.push('error', message);
		expect(opened).toHaveLength(3);

		// Obsidian's own click-to-dismiss: the element goes and nothing tells us.
		opened[0]?.handle.hide();

		queue.push('error', 'e');
		expect(opened.map((o) => o.view.message)).toContain('d');
	});

	it('frees every externally dismissed slot at once, not merely the first', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c', 'd', 'e']) queue.push('error', message);
		expect(opened).toHaveLength(3);

		// Two dismissed externally. A sweep that splices the array it is iterating skips the
		// second, leaving it tracked as visible and promoting only one of the two held.
		opened[0]?.handle.hide();
		opened[1]?.handle.hide();
		opened[0]?.callbacks.dismissed();

		expect(opened.map((o) => o.view.message)).toEqual(['a', 'b', 'c', 'd', 'e']);
	});

	it('promotes on a DUPLICATE push too, not only on a new one', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c']) queue.push('error', message);
		queue.push('warning', 'held');
		expect(opened).toHaveLength(3);

		// Dismissed with no hint delivered, then the next push happens to be a repeat.
		opened[0]?.handle.hide();
		queue.push('error', 'b');

		expect(opened.at(-1)?.view.message).toBe('held');
	});

	it('does not wedge permanently when no dismissal hint ever arrives', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c']) queue.push('error', message);
		for (const entry of [...opened]) entry.handle.hide();

		queue.push('error', 'after');
		expect(opened.at(-1)?.view.message).toBe('after');
	});
```

- [ ] **Step 2: Run and confirm they pass**

Run: `npx vitest run tests/presentation/notices/queue.test.ts`
Expected: PASS against Task 3's `sweep`.

- [ ] **Step 3: Prove the sweep is what makes them pass**

In `src/presentation/notices/queue.ts`, temporarily make `sweep` a no-op (`const sweep = (): void => {};`). Re-run. Expected: both new cases go red. **Restore `sweep`** and re-run to green.

- [ ] **Step 4: Commit**

```bash
git add tests/presentation/notices/queue.test.ts
git commit -m "test: a notice dismissed by anything frees its slot"
```

---

### Task 6: `notify` — bind the queue to `Notice`, and render severity

**Files:**
- Modify: `src/presentation/notices/notify.ts`
- Test: `tests/presentation/notices/notify.test.ts`

**Interfaces:**
- Consumes: `createNoticeQueue`, `NoticeHost`, `NoticeView`, `NoticeCallbacks` from `./queue`; `SEVERITY_LABEL_KEYS`, `NoticeSeverity` from `./severity`; `tr` from `../i18n/strings`.
- Produces:
  - `function notify(message: string): void` — severity `info`, signature unchanged
  - `function notifySuccess(message: string): void`
  - `function notifyWarning(message: string): void`
  - `function notifyError(error: AppError): void` — signature unchanged, severity `error`
  - `function notifyFault(cause: unknown, logger: Logger, event: string): void` — unchanged, severity `error`
  - `function disposeNotices(): void`

**Note on return types:** the four doors returned `Notice` before this task and now return `void`. A caller that could hold a `Notice` could dismiss someone else's; nothing in the tree uses the return value. Fix any call site the compiler flags.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Notice } from '../../helpers/obsidian-mock';
import {
	disposeNotices,
	notify,
	notifyError,
	notifySuccess,
	notifyWarning,
} from '../../../src/presentation/notices/notify';
import type { AppError } from '../../../src/core/errors/AppError';

const noticeEls = () => [...document.querySelectorAll<HTMLElement>('.notice')];

describe('the notice door', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		disposeNotices();
		document.body.innerHTML = '';
		Notice.shown.length = 0;
		Notice.constructed.length = 0;
	});

	it('renders a translated severity label beside the message, never colour alone', () => {
		notifyWarning('check the calibration');
		const el = noticeEls()[0];
		expect(el?.textContent).toContain('Warning');
		expect(el?.textContent).toContain('check the calibration');
	});

	it('marks a success politely and an error assertively', () => {
		notifySuccess('saved');
		expect(noticeEls()[0]?.getAttribute('role')).toBe('status');
		expect(noticeEls()[0]?.getAttribute('aria-live')).toBe('polite');

		disposeNotices();
		document.body.innerHTML = '';
		notifyWarning('careful');
		expect(noticeEls()[0]?.getAttribute('role')).toBe('alert');
		expect(noticeEls()[0]?.getAttribute('aria-live')).toBe('assertive');
	});

	it('carries a real focusable dismiss control, not a click handler on a div', () => {
		notifyWarning('careful');
		const button = noticeEls()[0]?.querySelector('button');
		expect(button).not.toBeNull();
		expect(button?.getAttribute('aria-label')).toBe('Dismiss');
	});

	it('dismisses when that control is pressed', () => {
		notifyWarning('careful');
		noticeEls()[0]?.querySelector('button')?.click();
		expect(noticeEls()).toHaveLength(0);
	});

	it('keeps the timer paused while the dismiss button holds focus after the pointer leaves', () => {
		notifySuccess('saved');
		const el = noticeEls()[0];
		const button = el?.querySelector('button');

		el?.dispatchEvent(new Event('pointerenter'));
		button?.dispatchEvent(new FocusEvent('focus'));
		el?.dispatchEvent(new Event('pointerleave'));

		// Hover is gone but focus is not: the notice must still be here.
		vi.advanceTimersByTime(60_000);
		expect(noticeEls()).toHaveLength(1);

		button?.dispatchEvent(new FocusEvent('blur'));
		vi.advanceTimersByTime(4000);
		expect(noticeEls()).toHaveLength(0);
	});

	it('frees a slot when the notice is dismissed by Obsidian rather than by our button', () => {
		notifyWarning('a');
		notifyWarning('b');
		notifyWarning('c');
		notifyWarning('d');
		expect(noticeEls()).toHaveLength(3);

		// Obsidian's own click-to-dismiss: the element goes, and the click is our only prompt.
		const first = noticeEls()[0];
		first?.remove();
		first?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(noticeEls().some((el) => el.textContent?.includes('d'))).toBe(true);
	});

	it('shows a repeat count rather than a second notice', () => {
		notifyWarning('same');
		notifyWarning('same');
		expect(noticeEls()).toHaveLength(1);
		expect(noticeEls()[0]?.textContent).toContain('2');
	});

	it('constructs every notice with duration 0, because the timer is ours', () => {
		notifySuccess('saved');
		// The ARGUMENT, not the outcome. Advancing the clock and watching the element go proves
		// only that the queue's own timer ran — the fake implements no timer of Obsidian's, so
		// `new Notice(text)` with a default duration would leave that assertion green while real
		// Obsidian ran a second, unpausable timer underneath the hover rule.
		expect(Notice.constructed.at(-1)?.duration).toBe(0);
	});

	it('still lets the queue time it out, which is the other half of owning the timer', () => {
		notifySuccess('saved');
		expect(noticeEls()).toHaveLength(1);
		vi.advanceTimersByTime(4000);
		expect(noticeEls()).toHaveLength(0);
	});

	it('sends a plain notify at info severity', () => {
		notify('indexing');
		expect(noticeEls()[0]?.textContent).toContain('Information');
	});

	it('resolves an AppError through the locale table rather than printing its message', () => {
		// TITLE case and no `unknown` cast. An earlier draft used `'validation'` cast through
		// `unknown`, and the test passed while proving nothing: `toUserMessage` falls back to
		// `CATEGORY_KEYS[error.category]`, that record is keyed by the real union, so a
		// lowercase category resolved to `undefined` and the notice body was EMPTY. Then
		// `toContain('Error')` passed off the severity label rather than the message, and
		// `not.toContain('developer English')` passed against nothing at all.
		const error: AppError = {
			category: 'Validation',
			code: 'zone.name-required',
			message: 'developer English that must not reach a user',
		};
		notifyError(error);

		const text = noticeEls()[0]?.textContent ?? '';
		expect(text).not.toContain('developer English');
		// The real fallback: no exact key and no suffix match for this code, so the CATEGORY
		// sentence is what the user gets. Asserted verbatim, because that string is the whole
		// thing this case exists to prove reached the notice.
		expect(text).toContain('This data is not in the expected form.');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/notices/notify.test.ts`
Expected: FAIL — `notifySuccess` is not exported.

- [ ] **Step 3: Rewrite `notify.ts`**

Keep the existing `notifyError` and `notifyFault` docblocks — they carry slice 11's reasoning and it still holds. Replace the module body with:

```ts
import { Notice } from 'obsidian';
import type { AppError } from '../../core/errors/AppError';
import { createVaultExceptionMapper } from '../../application/errors/exceptionMapper';
import type { Logger } from '../../application/ports/Logger';
import { trError } from '../i18n/toUserMessage';
import { tr } from '../i18n/strings';
import { createNoticeQueue, type NoticeHost, type NoticeView } from './queue';
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
 */
const obsidianHost: NoticeHost = {
	open(view, callbacks) {
		/**
		 * **The message goes through the CONSTRUCTOR, not only into the DOM.** Obsidian's
		 * `Notice` records nothing, but this repository's fake pushes its constructor argument
		 * onto `Notice.shown`, and five existing suites make ten CONTENT assertions against
		 * that array (`inspectorFaults`, `zoneEditing`, `planEditorCommands`, `sampleProject`,
		 * `slice10CascadeWiring`). Constructing with `''` and then writing `messageEl` would
		 * fill it with empty strings and break every one of them. The structured markup below
		 * replaces `messageEl`'s content afterwards; the recorded text stays the user's
		 * sentence.
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
		notice.containerEl.addEventListener('click', callbacks.dismissed);

		const label = document.createElement('span');
		label.className = 'rp-notice-severity';

		const body = document.createElement('span');
		body.className = 'rp-notice-message';

		const dismiss = document.createElement('button');
		dismiss.type = 'button';
		dismiss.className = 'rp-notice-dismiss';
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
		// its children, and flex only reaches direct ones. See `styles/notices.css`.
		notice.messageEl.classList.add('rp-notice-body');
		notice.messageEl.append(label, body, dismiss);

		return {
			update: render,
			hide: () => notice.hide(),
			get live() {
				return notice.containerEl.isConnected;
			},
		};
	},
};

let queue = createNoticeQueue(obsidianHost);

/**
 * Hide everything still on screen and start clean. Registered as one disposer on the
 * plugin's existing `disposers` list, and used by tests between cases.
 */
export function disposeNotices(): void {
	queue.dispose();
	queue = createNoticeQueue(obsidianHost);
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
	queue.push('info', message);
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
 * The consequence for manual testing is written into `docs/tests/cases/` rather than left to
 * be discovered: a tester in a vault cannot raise a success notice, so the auto-dismiss and
 * hover-pause steps there are driven through the reachable INFO notice instead.
 */
export function notifySuccess(message: string): void {
	queue.push('success', message);
}

export function notifyWarning(message: string): void {
	queue.push('warning', message);
}

/**
 * The OTHER way this plugin raises a notice, and the only one an `AppError` may take.
 * An error's own `message` is developer text (SDD §65): English, untranslated, and written
 * for a log line — so a raw one in a Notice is the defect design slice 11 exists to remove.
 * `trError` resolves the locale table's copy from the error's `code`, its suffix, or its
 * category, in that order, in the app's own language.
 */
export function notifyError(error: AppError): void {
	queue.push('error', trError(error));
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
 * The `logger` is not optional, and the reason is SDD §66 rather than convenience. A guarded
 * service produces two representations of one failure at ONE step — a terse user message and
 * a log line carrying the original cause — and the spec's words are that they "must not
 * drift into being produced from two independent code paths". This door stands where no
 * guard did, so a print-only version would be exactly that second path.
 */
export function notifyFault(cause: unknown, logger: Logger, event: string): void {
	const mapped = mapUnexpected(cause);
	logger.error(event, { cause, code: mapped.code });
	notifyError(mapped);
}
```

- [ ] **Step 4: Fix the call sites the compiler flags**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: errors wherever a caller used a returned `Notice`. Drop the use; none of them needs it.

- [ ] **Step 5: Classify the four call sites `notify` already has**

`notify` now means `info`, and that is a DEFAULT rather than a verdict. Leaving all four
existing calls at `info` would auto-dismiss two of them after six seconds despite their copy
being exactly what the warning tier exists for. Migrate three, leave one:

In `src/plugin/composition-root.ts`, import `notifyWarning` beside `notify` and change both
cascade notices:

```ts
	const cascadeNotices = {
		cascadeAborted: () => {
			notifyWarning(tr('cascade.aborted'));
		},
		staleMarkerFailed: () => {
			notifyWarning(tr('cascade.stale-marker-failed'));
		},
	};
```

These two are the clearest case in the plugin. They run in the BACKGROUND — nothing the user
clicked is waiting on them — and the thing that failed is the durable marker that would have
let a later reader see a wrong figure as wrong. A notice that vanishes while the user is
looking elsewhere is the same silence that port exists to break. Extend that block's existing
docblock to say so, since it currently explains why the port is announced at all and not why
the announcement persists.

In `src/plugin/planEditorCommands.ts:140`:

```ts
				notifyWarning(tr('background.unsupported'));
```

It reports that something the user explicitly asked for did not happen, and the remedy is
outside the plugin — add a supported file to the vault — so a message gone in six seconds may
be gone before they have understood what to do.

**Leave `planEditorCommands.ts:111` (`plan.none`) at `notify`.** "This vault has no
renovation plans yet" is a statement of fact about an empty vault with no failed action
behind it, which is what the `info` tier is for.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/presentation/notices/ tests/presentation/editor/ tests/plugin/`

**What to expect, stated precisely, because an earlier draft of this step claimed these
suites were unaffected and that was false.** Five existing suites make ten CONTENT
assertions against `Notice.shown`:

```bash
grep -rn "Notice.shown" tests/ | grep -v "\.length"
```

They pass because the host constructs `new Notice(textOf(view), 0)` — the recorded text is
still the user's sentence, and severity rides in the markup rather than in that string. Run
the grep and read the list before believing this paragraph.

**The one class that may genuinely break is a COUNT, and it is dedup rather than the fake.**
A suite asserting that two identical failures produce two entries in `Notice.shown` now sees
one, because the second is folded into a `(×2)`. That is the designed behaviour, so fix the
assertion — count distinct messages, or assert the count on the rendered notice — and do not
weaken dedup to preserve it.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/notices/notify.ts src/plugin/composition-root.ts src/plugin/planEditorCommands.ts tests/presentation/notices/notify.test.ts
git commit -m "feat: notices carry a severity, a live region and a dismiss control"
```

---

### Task 7: Widen the gate over the doors this slice added

A notice door with no lint rule over it is the exact hole `NOTICE_TEXT_BAN` was built to close. This task widens the rule and proves the widening.

**Files:**
- Modify: `eslint.config.mjs:527`
- Modify: `tests/build/notice-text-boundary.test.ts`

**Interfaces:**
- Consumes: Task 6's exported function names.
- Produces: a `NOTICE_DOOR` matching `notify`, `notifySuccess`, `notifyWarning` and `new Notice`.

- [ ] **Step 1: Write the failing test**

Add to `tests/build/notice-text-boundary.test.ts`, inside the existing `describe`:

```ts
	it.each([
		['a literal through the success door', 'export const s = (notifySuccess: any) => notifySuccess("saved");\n'],
		['a literal through the warning door', 'export const w = (notifyWarning: any) => notifyWarning("careful");\n'],
		['a message through the success door', 'export const s = (notifySuccess: any, e: any) => notifySuccess(e.message);\n'],
		['a stack through the warning door', 'export const w = (notifyWarning: any, e: any) => notifyWarning(e.stack);\n'],
	])('refuses %s', async (_name, source) => {
		// `lintText` already resolves to RULE IDS — `Promise<string[]>`, with `PARSE_ERROR` and
		// `NOT_LINTED` sentinels for the two ways a fixture can go wrong. Mapping `.ruleId` over
		// it yields an array of `undefined`, which makes every refusal case fail against a
		// correctly widened selector and every negative case pass vacuously. Assert the array
		// directly, exactly as the four cases above this one do.
		expect(await lintText(source, PRESENTATION)).toContain(RULE);
	});

	it('still passes a translated call through the new doors', async () => {
		expect(
			await lintText(
				'export const s = (notifySuccess: any, tr: any) => notifySuccess(tr("a.key"));\n',
				PRESENTATION,
			),
		).not.toContain(RULE);
	});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/build/notice-text-boundary.test.ts`
Expected: FAIL on the four refusal cases — the current selector names only `notify`.

- [ ] **Step 3: Widen the selector**

In `eslint.config.mjs`, replace line 527:

```js
const NOTICE_DOOR =
	":matches(CallExpression[callee.name=/^(notify|notifySuccess|notifyWarning)$/], NewExpression[callee.name='Notice'])";
```

Update the docblock above it: the rule now names three call doors rather than one, and the blind spots are unchanged — a one-hop alias, a member-expression callee (`o.notifySuccess(…)`), and a notice raised under a name this pattern does not list.

- [ ] **Step 4: Run the whole boundary suite**

Run: `npx vitest run tests/build/notice-text-boundary.test.ts`
Expected: PASS, including every pre-existing case.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs tests/build/notice-text-boundary.test.ts
git commit -m "fix: the notice text ban names every door this plugin has"
```

---

### Task 8: The notice stylesheet

**Files:**
- Create: `styles/notices.css`
- Modify: `styles/index.css`

**Interfaces:**
- Consumes: the class names Task 6 writes — `.rp-notice` and `.rp-notice-{severity}` on
  `containerEl`; `.rp-notice-body` on `messageEl`; `.rp-notice-severity`,
  `.rp-notice-message` and `.rp-notice-dismiss` on its three children.
- Produces: nothing importable.

- [ ] **Step 1: Write the partial**

```css
/*
 * Design slice 13's notices, drawn INSIDE Obsidian's own `.notice` element — Obsidian owns
 * the container, its position, its stacking and its animation, and these rules own only
 * what this plugin puts inside one.
 *
 * Every colour is an Obsidian variable (SDD §84), so a themed vault stays themed. The
 * severity colour is deliberately NOT the only carrier of severity: a translated word sits
 * beside it, which is what SDD §85's "status not colour-only" asks for and what makes an
 * icon unnecessary.
 *
 * NOT verifiable by the browser harness: `tests/harness/obsidian.css` carries no `.notice`
 * rules at all — its reduction came from another plugin's driven states and that plugin
 * never raised a notice — so nothing here is drawn by `npm run harness` or photographed by
 * `harness-shot`. Appearance is checked in a real vault, by `npm run test-build` and the
 * manual case under `docs/tests/`.
 */
/*
 * **The flex box goes on `messageEl`, not on `.rp-notice`.** The severity label, the message
 * and the dismiss button are appended to Obsidian's `messageEl`, which is a CHILD of
 * `containerEl` — so `display: flex` on the container makes `messageEl` the only flex item
 * and does nothing for the three elements it was written for. `gap` would apply to nothing,
 * the message's `flex: 1` would be inert, and the two adjacent spans carry no whitespace
 * between them, so a warning would render as `Warningcheck the calibration`.
 *
 * This repository has that exact rendering defect in its ledger already — the harness index's
 * rows read `ZonePanelprototype` because Vue's whitespace handling removed the separator
 * between two adjacent elements. It was found by capturing a PNG and looking at it. The jsdom
 * test here asserts `toContain('Warning')` and `toContain(message)`, which passes on the
 * concatenated string too, so nothing automated can see this.
 */
.rp-notice-body {
	display: flex;
	align-items: baseline;
	gap: var(--size-4-2);
}

.rp-notice-severity {
	flex: 0 0 auto;
	font-weight: var(--font-semibold);
	text-transform: uppercase;
	font-size: var(--font-smallest);
	letter-spacing: 0.04em;
}

.rp-notice-message {
	flex: 1 1 auto;
	min-width: 0;
}

.rp-notice-success .rp-notice-severity {
	color: var(--text-success);
}

.rp-notice-info .rp-notice-severity {
	color: var(--text-muted);
}

.rp-notice-warning .rp-notice-severity {
	color: var(--text-warning);
}

.rp-notice-error .rp-notice-severity {
	color: var(--text-error);
}

/*
 * `.rp-notice` prefixed rather than bare, because Obsidian's own `button:not(.clickable-icon)`
 * sets a background at specificity (0,1,1) — `:not()` contributes its argument's — and a
 * single class at (0,1,0) loses to it. Slice 15's danger button was rendered plain white by
 * exactly this, and jsdom never resolves a `var()` to a colour, so a browser is the only
 * instrument that can see it.
 */
.rp-notice .rp-notice-dismiss {
	flex: 0 0 auto;
	padding: 0 var(--size-4-1);
	background-color: transparent;
	border: none;
	box-shadow: none;
	color: var(--text-muted);
	cursor: pointer;
	/* 2.5.8 asks for 24px; a notice's own control is small and this is the floor. */
	min-width: var(--size-4-6);
	min-height: var(--size-4-6);
}

.rp-notice .rp-notice-dismiss:hover {
	color: var(--text-normal);
}

/*
 * **The reset above removes both focus channels, so this rule is not optional.** Obsidian's
 * own sheet carries `:focus { outline: none }`, and `box-shadow: none` at this selector's
 * specificity outranks its button focus rule — so without this, a keyboard user tabbing to a
 * dismiss control gets no indication of which notice they are about to dismiss. WCAG 2.2
 * 2.4.7 at AA, which `PRODUCT.md` binds by name.
 *
 * This repository has already shipped this exact defect once: the harness index's entry links
 * had no visible focus indicator for the same reason, and it took a PNG read by eye to find
 * — jsdom paints nothing, so no test here can see it either. `:focus-visible` rather than
 * `:focus`, so a pointer dismissal does not draw a ring nobody asked for.
 */
.rp-notice .rp-notice-dismiss:focus-visible {
	outline: 2px solid var(--text-accent);
	outline-offset: 2px;
	border-radius: var(--radius-s);
}
```

- [ ] **Step 2: Import it**

In `styles/index.css`, append after the `empty-state.css` line:

```css
@import "./notices.css";
```

Position is not load-bearing here — no rule in this partial shares a selector or specificity with any other — so nothing is added to that file's list of load-bearing positions.

- [ ] **Step 3: Build and confirm the sheet assembles**

Run: `npm run build`
Expected: PASS. A hardcoded colour, an unimported partial or a partial over 400 lines each fail here.

- [ ] **Step 4: Commit**

```bash
git add styles/notices.css styles/index.css
git commit -m "feat: the notice severity stylesheet"
```

---

### Task 9: Dispose the queue when the plugin unloads

**Files:**
- Modify: `src/plugin/RenovationPlannerPlugin.ts` (inside `onload`, pushing onto the existing `disposers`)
- Test: `tests/plugin/noticeDisposal.test.ts`

**Interfaces:**
- Consumes: `disposeNotices` from `src/presentation/notices/notify`.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @vitest-environment jsdom
 *
 * **Driven through a real `onunload`, not by calling `disposeNotices()` directly.** A test
 * that calls the disposer itself is green whether or not the plugin ever registers it — so it
 * would pass with `this.disposers.push(disposeNotices)` deleted, which is the entire thing
 * this task adds. That is this repository's own recurring shape: the wiring is checked, not
 * assumed.
 *
 * `loadedPlugin` is the same helper `registration.test.ts` uses for the Konva disposer, so
 * this rides an idiom rather than inventing one.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { loadedPlugin } from '../helpers/plugin';
import { Notice } from '../helpers/obsidian-mock';
import { disposeNotices, notifyWarning } from '../../src/presentation/notices/notify';

describe('notice disposal', () => {
	beforeEach(() => {
		installObsidianDom();
		vi.useFakeTimers();
		document.body.innerHTML = '';
		Notice.shown.length = 0;
		Notice.constructed.length = 0;
		disposeNotices();
	});

	it('takes every notice off the screen when the plugin unloads', async () => {
		const { plugin } = await loadedPlugin();

		notifyWarning('a');
		notifyWarning('b');
		expect(document.querySelectorAll('.notice')).toHaveLength(2);

		plugin.onunload();

		expect(document.querySelectorAll('.notice')).toHaveLength(0);
	});

	it('registers exactly one disposer for the queue, so a reload cannot strand a notice', async () => {
		const { plugin } = await loadedPlugin();
		const disposers = (plugin as unknown as { disposers: (() => void)[] }).disposers;

		// Named rather than counted: the list also holds Konva's, and asserting a LENGTH here
		// would break every time another slice adds an unrelated disposer.
		expect(disposers).toContain(disposeNotices);
	});

	it('starts clean afterwards rather than staying disposed', async () => {
		const { plugin } = await loadedPlugin();
		notifyWarning('before');
		plugin.onunload();

		notifyWarning('after');
		expect(document.querySelectorAll('.notice')).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run it and watch it FAIL**

Run: `npx vitest run tests/plugin/noticeDisposal.test.ts`
Expected: **FAIL** on the first two cases — Step 3 has not registered the disposer yet, so
`onunload` leaves the notices on screen and the list does not contain `disposeNotices`.

Do **not** go looking for a bug in Task 6 when this goes red: red here is the task's own
premise. An earlier draft of this step said "Expected: PASS if Task 6 is correct", which was
true of a version of the test that called `disposeNotices()` directly — and a test that is
green before the task is written is not a test of the task.

- [ ] **Step 3: Register the disposer**

In `RenovationPlannerPlugin.onload()`, alongside the existing `this.disposers.push(...)` calls, add:

```ts
		// Design slice 13's notices outlive any view — they report things that have nothing to
		// do with an open leaf — so the queue is plugin-scoped and its teardown belongs on the
		// list `onunload` drains. Not the first entry on it: Konva's global got there first.
		this.disposers.push(disposeNotices);
```

Add the import at the top of the file:

```ts
import { disposeNotices } from '../presentation/notices/notify';
```

- [ ] **Step 4: Run the plugin suite**

Run: `npx vitest run tests/plugin/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugin/RenovationPlannerPlugin.ts tests/plugin/noticeDisposal.test.ts
git commit -m "feat: the notice queue is released when the plugin unloads"
```

---

### Task 10: The save-state vocabulary

**Files:**
- Create: `src/presentation/editor/save-state/save-state.ts`
- Modify: `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`
- Test: `tests/presentation/editor/saveState/saveState.test.ts`

**Interfaces:**
- Consumes: `StringKey`.
- Produces:
  - `type SaveState = 'saved' | 'saving' | 'unsaved-changes' | 'save-error'`
  - `const SAVE_STATE_KEYS: Readonly<Record<SaveState, StringKey>>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { SAVE_STATE_KEYS, type SaveState } from '../../../../src/presentation/editor/save-state/save-state';
import { en } from '../../../../src/presentation/i18n/locales/en';
import { de } from '../../../../src/presentation/i18n/locales/de';

const STATES: SaveState[] = ['saved', 'saving', 'unsaved-changes', 'save-error'];

describe('the save-state vocabulary', () => {
	it.each(STATES)('resolves English copy for %s', (state) => {
		expect(en[SAVE_STATE_KEYS[state]]).toBeTruthy();
	});

	it.each(STATES)('resolves German copy for %s', (state) => {
		expect(de[SAVE_STATE_KEYS[state]]).toBeTruthy();
	});

	it('holds no English of its own — the copy lives in the locale tables', () => {
		expect(Object.values(SAVE_STATE_KEYS).every((key) => key.startsWith('save-state.'))).toBe(true);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/editor/saveState/saveState.test.ts`
Expected: FAIL — cannot resolve `save-state`.

- [ ] **Step 3: Write the module**

```ts
import type { StringKey } from '../../i18n/locales/en';

/**
 * PRD §67's four autosave states, its own literal wording preserved in the member names so
 * the type stays traceable to the requirement.
 *
 * `'unsaved-changes'` is UNREACHABLE through `SaveStateStore`'s action surface and is kept
 * anyway — see that store's header for the argument. Slice 6's transaction boundary means an
 * edit IS its command dispatch, so there is no moment where a change has been decided and no
 * command sent. It stays in the type for PRD fidelity and so the indicator renders correctly
 * if a later slice ever introduces a genuine edit buffer.
 */
export type SaveState = 'saved' | 'saving' | 'unsaved-changes' | 'save-error';

/**
 * Each state's copy key. NOT a literal map: `src/presentation/i18n/` already holds the one
 * lookup every user-facing string goes through, with a German table beside it, so a hardcoded
 * label map here would be a second string table — untranslated, and outside the file the
 * locale checks can see.
 */
export const SAVE_STATE_KEYS: Readonly<Record<SaveState, StringKey>> = {
	saved: 'save-state.saved',
	saving: 'save-state.saving',
	'unsaved-changes': 'save-state.unsaved-changes',
	'save-error': 'save-state.save-error',
};
```

- [ ] **Step 4: Add the locale entries**

`en.ts` — sentence case, per the marketplace rule the `obsidianmd` locale lint enforces in this file:

```ts
	'save-state.saved': 'Saved',
	'save-state.saving': 'Saving',
	'save-state.unsaved-changes': 'Unsaved changes',
	'save-state.save-error': 'Save error',
```

`de.ts`:

```ts
	'save-state.saved': 'Gespeichert',
	'save-state.saving': 'Wird gespeichert',
	'save-state.unsaved-changes': 'Nicht gespeicherte Änderungen',
	'save-state.save-error': 'Fehler beim Speichern',
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/presentation/editor/saveState/ tests/presentation/i18n/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/save-state/save-state.ts src/presentation/i18n/locales/ tests/presentation/editor/saveState/saveState.test.ts
git commit -m "feat: the save-state vocabulary and its copy"
```

---

### Task 11: `SaveStateStore`, and the batch that cannot settle early

**Files:**
- Create: `src/presentation/editor/save-state/save-state-store.ts`
- Test: `tests/presentation/editor/saveState/saveStateStore.test.ts`

**Interfaces:**
- Consumes: `SaveState` from `./save-state`.
- Produces: `useSaveStateStore` — a Pinia setup store exposing `state: SaveState`, `beginSaving(): void`, `resolveOk(): void`, `resolveErr(): void`, `resolveNeutral(): void`.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';

describe('the save-state store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('starts saved, because a fresh hydration has nothing unsaved by construction', () => {
		expect(useSaveStateStore().state).toBe('saved');
	});

	it('reports a dispatch in flight, then its outcome', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		expect(store.state).toBe('saving');
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('reports a failed dispatch', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		expect(store.state).toBe('save-error');
	});

	it('does not get stuck on a stale error', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		store.beginSaving();
		expect(store.state).toBe('saving');
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('never says saved while a sibling dispatch is still in flight', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.beginSaving();
		store.resolveOk();
		expect(store.state).toBe('saving');
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('lets one failure decide a whole batch, even where a sibling succeeded', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.beginSaving();
		store.resolveErr();
		expect(store.state).toBe('saving');
		store.resolveOk();
		expect(store.state).toBe('save-error');
	});

	it('does not let a validation refusal clear a real save error', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		expect(store.state).toBe('save-error');

		// A field edit refused for validation: nothing reached the repository, so the earlier
		// failed write is exactly as unsaved as it was.
		store.beginSaving();
		store.resolveNeutral();
		expect(store.state).toBe('save-error');
	});

	it('lets a write that actually succeeded clear a save error', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		store.beginSaving();
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('leaves a resting saved state alone after a refusal that wrote nothing', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveNeutral();
		expect(store.state).toBe('saved');
	});

	it('reports a batch that mixed a real write with a refusal as saved', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.beginSaving();
		store.resolveNeutral();
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('never reaches unsaved-changes through any sequence of its own actions', () => {
		const store = useSaveStateStore();
		const actions = [
			() => store.beginSaving(),
			() => store.resolveOk(),
			() => store.resolveErr(),
			() => store.resolveNeutral(),
		];

		// Every sequence of up to four actions. Exhaustive over the store's whole surface,
		// which is what backs the unreachability claim rather than asserting it in prose.
		const walk = (depth: number): void => {
			if (depth === 0) return;
			for (const act of actions) {
				act();
				expect(store.state).not.toBe('unsaved-changes');
				walk(depth - 1);
			}
		};
		walk(4);
	});

	it('exposes no action that could produce unsaved-changes', () => {
		const store = useSaveStateStore();
		expect(Object.keys(store)).toEqual(
			expect.arrayContaining(['state', 'beginSaving', 'resolveOk', 'resolveErr', 'resolveNeutral']),
		);
		expect(Object.keys(store)).not.toContain('markUnsaved');
	});

	it('gives each Plan Editor its own state, since two can save independently', () => {
		const first = useSaveStateStore();
		setActivePinia(createPinia());
		const second = useSaveStateStore();
		first.beginSaving();
		expect(first.state).toBe('saving');
		expect(second.state).toBe('saved');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/editor/saveState/saveStateStore.test.ts`
Expected: FAIL — cannot resolve `save-state-store`.

- [ ] **Step 3: Write the store**

```ts
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { SaveState } from './save-state';

/**
 * "Is this Plan's data safely written?", one instance per open Plan Editor.
 *
 * Per-view rather than plugin-global, and that follows from slice 6 rather than being a
 * preference: `CommandHistory` is scoped per open Plan, so the save state it produces is a
 * fact about THAT Plan's command history. Two editors on two plans can legitimately show
 * different states at once, one saving while the other is saved.
 *
 * **`pendingCount` exists because slice 6's choke point serializes per GESTURE, not
 * globally.** An Inspector field commit and a canvas gesture can each call the dispatcher
 * around the same time, so two commands can be in flight against one Plan Editor. Setting
 * `state` directly on each resolution would let the faster of two writes flip the indicator
 * to `saved` while the slower is still pending — reporting data as safely written before it
 * is. So a batch settles only when the last dispatch in it resolves, and one failure
 * anywhere in the batch decides the whole batch.
 *
 * This solves the INDICATOR, not the data. Two overlapping writes to one plan's geometry
 * sidecar is a lost-update hazard, and a counter in a Pinia store cannot prevent one — slice
 * 4's `PlanGeometryStore.mutate` serializes each plan's read-modify-write, and this store
 * assumes that guarantee rather than restating it. It would be wrong without it: an
 * indicator accurately reporting `saved` over silently lost data is worse than one that
 * misreports.
 *
 * **Nothing here produces `'unsaved-changes'`.** Slice 6's transaction boundary leaves no
 * moment where an edit has been decided and no command dispatched: a gesture's `pointerUp`
 * dispatches, and an Inspector field dispatches on blur or enter. There is no state between
 * "nothing decided" (still saved — a preview shape mid-drag has changed no persisted state)
 * and "a command is in flight" (saving). The value stays in the type and no action reaches
 * it, which `saveStateStore.test.ts` walks exhaustively rather than asserting here.
 */
export const useSaveStateStore = defineStore('rp-save-state', () => {
	const state = ref<SaveState>('saved');
	const pendingCount = ref(0);
	const hasErrorInBatch = ref(false);
	const hasWriteInBatch = ref(false);
	/** What the indicator read before this batch opened, for a batch that writes nothing. */
	const beforeBatch = ref<SaveState>('saved');

	/**
	 * Settle the batch once its last dispatch has resolved, and reset for the next one.
	 *
	 * **Three outcomes, not two, and the third is the one that is easy to miss.** A batch that
	 * FAILED reports `save-error`; a batch that WROTE something reports `saved`; a batch in
	 * which nothing was written at all reverts to whatever the indicator said before it opened.
	 * Collapsing that third case into `saved` is a lie with a real victim: after a persistence
	 * failure has settled the store to `save-error`, a later field edit refused for validation
	 * writes nothing — and reporting `saved` for it tells the user the earlier failed write is
	 * now safe. Only a write that actually succeeded may clear a save error.
	 */
	const settle = (): void => {
		if (pendingCount.value > 0) return;
		if (hasErrorInBatch.value) state.value = 'save-error';
		else if (hasWriteInBatch.value) state.value = 'saved';
		else state.value = beforeBatch.value;
		hasErrorInBatch.value = false;
		hasWriteInBatch.value = false;
	};

	return {
		state: computed(() => state.value),

		/**
		 * A new dispatch always shows `saving`. The state it replaces is remembered when the
		 * batch OPENS, so a batch that turns out to have written nothing can put it back.
		 */
		beginSaving(): void {
			if (pendingCount.value === 0) beforeBatch.value = state.value;
			pendingCount.value += 1;
			state.value = 'saving';
		},

		/** A write landed. */
		resolveOk(): void {
			pendingCount.value -= 1;
			hasWriteInBatch.value = true;
			settle();
		},

		/** A write may not have landed. */
		resolveErr(): void {
			pendingCount.value -= 1;
			hasErrorInBatch.value = true;
			settle();
		},

		/** Nothing was written — a refusal that never reached the repository. */
		resolveNeutral(): void {
			pendingCount.value -= 1;
			settle();
		},
	};
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/presentation/editor/saveState/saveStateStore.test.ts`
Expected: PASS — all nine.

- [ ] **Step 5: Prove the batching and neutral-settlement tests can fail**

Temporarily collapse `settle`'s three outcomes into two — `state.value = hasErrorInBatch.value
? 'save-error' : 'saved'` — and re-run. Expected: the two refusal cases go red, because a
validation refusal now clears a real save error. **Restore the three-way `settle`.**

Then temporarily change `settle` to ignore `pendingCount` (`state.value = hasErrorInBatch.value ? 'save-error' : 'saved';` as its whole body). Re-run. Expected: the two overlapping-dispatch cases go red. **Restore `settle`** and re-run to green.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/save-state/save-state-store.ts tests/presentation/editor/saveState/saveStateStore.test.ts
git commit -m "feat: the save-state store, and the batch that cannot settle early"
```

---

### Task 12: `withSaveStateTracking`, and the failures that are not save failures

**Files:**
- Modify: `src/application/ports/versioning.ts` — export the two write-boundary code
  suffixes and build the existing factories' codes from them. A deliberate small change
  outside `presentation/`: the alternative is a hand-copied list of those strings in the
  predicate below, and two copies of one table is the drift this repository refuses.
- Create: `src/presentation/editor/save-state/affects-save-state.ts`
- Create: `src/presentation/editor/save-state/with-save-state-tracking.ts`
- Test: `tests/presentation/editor/saveState/withSaveStateTracking.test.ts`

**Interfaces:**
- Consumes: `RefreshedHistory` from `../tools/with-editor-state-refresh` (already `Pick<CommandHistory, 'run' | 'undo' | 'redo'>` — reuse it rather than declaring a second alias); `AppError`; `useSaveStateStore`.
- Produces:
  - `function affectsSaveState(error: AppError): boolean`
  - `type SaveStateTracker = Pick<ReturnType<typeof useSaveStateStore>, 'beginSaving' | 'resolveOk' | 'resolveErr' | 'resolveNeutral'>`
  - `function withSaveStateTracking(history: RefreshedHistory, saveState: SaveStateTracker): RefreshedHistory`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok, type Result } from '../../../../src/core/result/Result';
import type { AppError, ErrorCategory } from '../../../../src/core/errors/AppError';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';
import { affectsSaveState } from '../../../../src/presentation/editor/save-state/affects-save-state';
import { withSaveStateTracking } from '../../../../src/presentation/editor/save-state/with-save-state-tracking';
import {
	externalModification,
	revisionConflict,
	WRITE_BOUNDARY_CODES,
} from '../../../../src/application/ports/versioning';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';

/**
 * Real-shaped, and NOT cast through `unknown`. An earlier draft built these with lowercase
 * categories and a cast, which compiled fine and concealed that `affectsSaveState` was
 * comparing against a literal outside `ErrorCategory` — a fake kinder than the real type,
 * hiding a source file that would not have built.
 */
const errorOf = (category: ErrorCategory, code = 'x'): AppError =>
	({ category, code: `zone.${code}`, message: 'developer text' }) as AppError;

const tracker = () => ({
	beginSaving: vi.fn(),
	resolveOk: vi.fn(),
	resolveErr: vi.fn(),
	resolveNeutral: vi.fn(),
});

const command = {} as UndoableCommand;

const historyResolving = (result: Result<void, AppError>) => ({
	run: vi.fn(async () => result),
	undo: vi.fn(async () => result),
	redo: vi.fn(async () => result),
});

const OPERATIONS = ['run', 'undo', 'redo'] as const;

describe('affectsSaveState', () => {
	it('ignores a pre-write validation refusal, which never reached the repository', () => {
		expect(affectsSaveState(errorOf('Validation', 'name-required'))).toBe(false);
	});

	it.each(['Persistence', 'Domain', 'Geometry', 'Migration', 'Reference', 'Calculation', 'Import'] as const)(
		'counts a %s failure, because the safe answer is "we might not have written your data"',
		(category) => {
			expect(affectsSaveState(errorOf(category))).toBe(true);
		},
	);

	// The two `ValidationError`s that mean the OPPOSITE of "wrote nothing": the command
	// reached the repository, the version had moved, and the user's edit was refused.
	it.each(WRITE_BOUNDARY_CODES)('counts a %s, despite its Validation category', (suffix) => {
		expect(affectsSaveState(errorOf('Validation', suffix))).toBe(true);
	});

	it('reads the codes from versioning.ts rather than a copy', () => {
		expect([...WRITE_BOUNDARY_CODES]).toEqual(['revision-conflict', 'external-modification']);
		expect(revisionConflict('zone', 'z1').code).toBe('zone.revision-conflict');
		expect(externalModification('zone', 'z1').code).toBe('zone.external-modification');
	});
});

describe('withSaveStateTracking', () => {
	it.each(OPERATIONS)('reports %s beginning and succeeding', async (operation) => {
		const history = historyResolving(ok(undefined));
		const save = tracker();
		const wrapped = withSaveStateTracking(history, save);

		await (operation === 'run' ? wrapped.run(command) : wrapped[operation]());

		expect(save.beginSaving).toHaveBeenCalledTimes(1);
		expect(save.resolveOk).toHaveBeenCalledTimes(1);
		expect(save.resolveErr).not.toHaveBeenCalled();
	});

	it.each(OPERATIONS)('reports %s failing on a persistence error', async (operation) => {
		const history = historyResolving(err(errorOf('Persistence')));
		const save = tracker();
		const wrapped = withSaveStateTracking(history, save);

		await (operation === 'run' ? wrapped.run(command) : wrapped[operation]());

		expect(save.resolveErr).toHaveBeenCalledTimes(1);
		expect(save.resolveOk).not.toHaveBeenCalled();
	});

	it.each(OPERATIONS)('settles %s NEUTRALLY for a validation refusal that wrote nothing', async (operation) => {
		const history = historyResolving(err(errorOf('Validation', 'name-required')));
		const save = tracker();
		const wrapped = withSaveStateTracking(history, save);

		await (operation === 'run' ? wrapped.run(command) : wrapped[operation]());

		// Neither a failure to report nor evidence of a save. `resolveOk` here would let a
		// refusal that never touched the repository clear a real save error.
		expect(save.resolveNeutral).toHaveBeenCalledTimes(1);
		expect(save.resolveOk).not.toHaveBeenCalled();
		expect(save.resolveErr).not.toHaveBeenCalled();
	});

	it.each(OPERATIONS)('returns %s\'s own Result unchanged', async (operation) => {
		const result = err(errorOf('Persistence'));
		const history = historyResolving(result);
		const wrapped = withSaveStateTracking(history, tracker());

		const returned = await (operation === 'run' ? wrapped.run(command) : wrapped[operation]());
		expect(returned).toBe(result);
	});

	it.each(OPERATIONS)('settles the batch when %s REJECTS rather than resolving', async (operation) => {
		const boom = new Error('the vault went away mid-write');
		const history = {
			run: vi.fn(async () => {
				throw boom;
			}),
			undo: vi.fn(async () => {
				throw boom;
			}),
			redo: vi.fn(async () => {
				throw boom;
			}),
		};
		const save = tracker();
		const wrapped = withSaveStateTracking(history, save);

		await expect(
			operation === 'run' ? wrapped.run(command) : wrapped[operation](),
		).rejects.toBe(boom);

		expect(save.beginSaving).toHaveBeenCalledTimes(1);
		expect(save.resolveErr).toHaveBeenCalledTimes(1);
		expect(save.resolveOk).not.toHaveBeenCalled();
	});

	it('leaves a later dispatch able to settle after a rejection, rather than wedging', async () => {
		// The real cost of a missed decrement: not a wrong reading, but an indicator that can
		// never settle again. Driven through the REAL store rather than a spy, because a spy
		// cannot show a counter that never returns to zero.
		setActivePinia(createPinia());
		const store = useSaveStateStore();

		const throwing = {
			run: vi.fn(async () => {
				throw new Error('boom');
			}),
			undo: vi.fn(async () => ok(undefined)),
			redo: vi.fn(async () => ok(undefined)),
		};
		await expect(withSaveStateTracking(throwing, store).run(command)).rejects.toThrow('boom');
		expect(store.state).toBe('save-error');

		const healthy = historyResolving(ok(undefined));
		await withSaveStateTracking(healthy, store).run(command);
		expect(store.state).toBe('saved');
	});

	it('begins before the operation resolves, not after', async () => {
		const order: string[] = [];
		const save = {
			beginSaving: vi.fn(() => order.push('begin')),
			resolveOk: vi.fn(() => order.push('ok')),
			resolveErr: vi.fn(),
			resolveNeutral: vi.fn(),
		};
		const history = {
			run: vi.fn(async () => {
				order.push('run');
				return ok(undefined);
			}),
			undo: vi.fn(async () => ok(undefined)),
			redo: vi.fn(async () => ok(undefined)),
		};

		await withSaveStateTracking(history, save).run(command);
		expect(order).toEqual(['begin', 'run', 'ok']);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/editor/saveState/withSaveStateTracking.test.ts`
Expected: FAIL — neither module resolves.

- [ ] **Step 3: Write `affects-save-state.ts`**

First, add the shared table to `src/application/ports/versioning.ts`, beside the two
factories that already spell those suffixes — one table with two importers cannot drift, and
two hand-spelled copies had nothing to notice them drifting:

```ts
/**
 * The two refusals the version check itself produces. They are `Validation` by CATEGORY and
 * WRITE-BOUNDARY by meaning: the command reached the repository, the version had moved, and
 * the user's edit was not saved. Exported because the save-state indicator has to tell them
 * apart from a pre-write field refusal, and a second hand-spelled copy of these strings is
 * exactly the drift this repository refuses.
 */
export const REVISION_CONFLICT = 'revision-conflict';
export const EXTERNAL_MODIFICATION = 'external-modification';
export const WRITE_BOUNDARY_CODES = [REVISION_CONFLICT, EXTERNAL_MODIFICATION] as const;
```

and change the two factories to build their codes from them
(`code: \`${entity}.${REVISION_CONFLICT}\``, and the same for the other). Then:

```ts
import type { AppError } from '../../../core/errors/AppError';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';

/**
 * Is this failure one the save indicator should report?
 *
 * **Not every failed `Result` is a save error.** A field commit that fails a domain rule
 * resolves a `ValidationError` and writes NOTHING — the repository was never reached.
 * Flipping the indicator for it would be wrong twice: it reports a persistence failure that
 * did not happen, and the user would get the inline field message they need plus a "save
 * error" badge about data exactly as safe as it was before they typed.
 *
 * **`Validation` is not a synonym for "wrote nothing", and an earlier draft of this function
 * assumed it was.** `versioning.ts` raises `revisionConflict` and `externalModification` as
 * `ValidationError`s, and both mean the OPPOSITE: the command reached the repository, the
 * version had moved, and the user's edit was refused and is gone. Reporting `saved` for one
 * of those is the false assurance this whole predicate exists to prevent. So the category is
 * the first cut and the write-boundary codes are carved back out of it, from the table
 * `versioning.ts` exports rather than from a copy.
 *
 * **The category comparison is TITLE case**, because `ErrorCategory` is
 * `'Domain' | 'Validation' | 'Persistence' | 'Geometry' | 'Import' | 'Migration' |
 * 'Reference' | 'Calculation'`. A lowercase literal here does not merely fail to match — it
 * fails to compile, and the earlier draft's tests hid that by casting hand-built objects
 * through `unknown`.
 *
 * **Stated as an inequality against one category rather than a list of the ones that count,
 * deliberately.** A new `AppError` category added by a later slice should default to
 * AFFECTING the indicator, because "we might not have written your data" is the safe answer
 * to give while nobody has thought about it. The unsafe default is silence.
 *
 * Slice 17 owns the mapping from an error to a surface, and this indicator is one of its
 * surfaces — so this predicate is DERIVED from that table rather than authored beside it,
 * and slice 17's no-double-reporting test is what keeps the two in agreement.
 */
export function affectsSaveState(error: AppError): boolean {
	if (error.category !== 'Validation') return true;
	return WRITE_BOUNDARY_CODES.some((suffix) => error.code.endsWith(`.${suffix}`));
}
```

- [ ] **Step 4: Write `with-save-state-tracking.ts`**

```ts
import type { AppError } from '../../../core/errors/AppError';
import { isErr, type Result } from '../../../core/result/Result';
import type { RefreshedHistory } from '../tools/with-editor-state-refresh';
import type { useSaveStateStore } from './save-state-store';
import { affectsSaveState } from './affects-save-state';

type VoidResult = Result<void, AppError>;

export type SaveStateTracker = Pick<
	ReturnType<typeof useSaveStateStore>,
	'beginSaving' | 'resolveOk' | 'resolveErr' | 'resolveNeutral'
>;

/**
 * Drive the save indicator from the dispatcher slice 6 already defines, without changing
 * `CommandHistory` itself.
 *
 * **All three writing operations are wrapped, not just `run`.** `undo` and `redo` each
 * execute a command, and each performs a repository write — slice 8's reversible delete
 * writes a snapshot back through the repository on undo. A decorator covering `run` alone
 * would leave the indicator reading `saved` throughout an in-flight undo and, worse, after
 * an undo that failed with a `PersistenceError`. The rule the indicator exists to express is
 * "is this Plan's data safely written", and an undo is a write like any other.
 *
 * Transparent: every wrapped method returns exactly what the wrapped history resolved.
 * `canUndo`, `canRedo` and `clear` are not part of `RefreshedHistory` and write nothing, so
 * they have no save state to report.
 *
 * `RefreshedHistory` is slice 8's own alias for `Pick<CommandHistory, 'run' | 'undo' |
 * 'redo'>` and is IMPORTED rather than restated. The spec called this shape
 * `TrackedHistory`; two names for one type in sibling directories is the defect slice 8
 * recorded under "There is ONE `EditorContext`".
 */
export function withSaveStateTracking(
	history: RefreshedHistory,
	saveState: SaveStateTracker,
): RefreshedHistory {
	const track = async (operation: () => Promise<VoidResult>): Promise<VoidResult> => {
		saveState.beginSaving();
		try {
			const result = await operation();
			if (!isErr(result)) saveState.resolveOk();
			else if (affectsSaveState(result.error)) saveState.resolveErr();
			// A refusal that never reached the repository wrote NOTHING, so it is neither a
			// failure to report nor evidence that anything was saved. Resolving it as `ok` would
			// let a validation refusal clear a `save-error` left by a real persistence failure.
			else saveState.resolveNeutral();
			return result;
		} catch (cause) {
			// **A THROWN fault settles the batch too, and forgetting this is worse than
			// misreporting.** SDD §65 reserves throws for technical faults and the dispatcher
			// propagates them — `withEditorStateRefresh` re-throws unchanged and `runtime.ts`'s
			// `reportFault` is what catches them. Decrementing only on resolution would leave
			// `pendingCount` permanently above zero: the indicator stuck on `saving` forever and
			// every later batch unsettleable, which is a DEAD indicator rather than a wrong one.
			//
			// `resolveErr` rather than `resolveOk` for the reason `affectsSaveState` defaults the
			// way it does: a fault says nothing about whether the write landed, and "we might not
			// have written your data" is the safe answer while nobody knows.
			//
			// Re-thrown UNCHANGED, because mapping and reporting it belongs to `reportFault`, and
			// a decorator that swallowed it would turn a fault into silence.
			saveState.resolveErr();
			throw cause;
		}
	};

	return {
		run: (command) => track(() => history.run(command)),
		undo: () => track(() => history.undo()),
		redo: () => track(() => history.redo()),
	};
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/presentation/editor/saveState/withSaveStateTracking.test.ts`
Expected: PASS — all sixteen table rows.

- [ ] **Step 6: Prove the rejection arm earns its place**

Temporarily remove the `try`/`catch` from `track`, leaving the three awaited lines bare.
Re-run. Expected: the three rejection rows and the wedging case go red. **Restore the
`try`/`catch`** and re-run to green. This is the arm a design review caught and no earlier
draft had — it is worth watching fail once.

- [ ] **Step 7: Prove the three-operation table earns its place**

Temporarily change the returned object so `undo` and `redo` pass straight through
(`undo: () => history.undo(), redo: () => history.redo(),`). Re-run. Expected: the `undo` and
`redo` rows go red while every `run` row stays green — which is the defect the table exists
to catch. **Restore the wrapping** and re-run to green.

- [ ] **Step 8: Commit**

```bash
git add src/application/ports/versioning.ts src/presentation/editor/save-state/ tests/presentation/editor/saveState/withSaveStateTracking.test.ts
git commit -m "feat: save-state tracking over run, undo and redo alike"
```

---

### Task 13: `SaveStateIndicator.vue` and the status bar's third region

**Files:**
- Create: `src/presentation/editor/save-state/SaveStateIndicator.vue`
- Modify: `src/presentation/editor/shell/StatusBar.vue`
- Modify: `styles/editor.css`
- Test: `tests/presentation/editor/saveState/saveStateIndicator.test.ts`

**Interfaces:**
- Consumes: `useSaveStateStore`, `SAVE_STATE_KEYS`, `tr`.
- Produces: a default-exported SFC with no props.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SaveStateIndicator from '../../../../src/presentation/editor/save-state/SaveStateIndicator.vue';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';

describe('the save-state indicator', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('renders the resting state as words, not as a colour or an icon alone', () => {
		expect(mount(SaveStateIndicator).text()).toBe('Saved');
	});

	it('follows the store into saving', async () => {
		const wrapper = mount(SaveStateIndicator);
		useSaveStateStore().beginSaving();
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toBe('Saving');
	});

	it('follows the store into a save error', async () => {
		const wrapper = mount(SaveStateIndicator);
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toBe('Save error');
	});
});
```

**Why there is no `'unsaved-changes'` render case here.** The store exposes `state` as a
`computed`, so a test cannot drive the component into that value — and no action produces it,
which Task 11 proves exhaustively. Faking it would mean asserting against a stub rather than
against this component. What actually needs checking is that the fourth key resolves to copy
in both locales, and Task 10 checks exactly that. A case that mounted the component and
asserted whichever string came out would assert nothing, which is the defect this repository
keeps a ledger of.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/editor/saveState/saveStateIndicator.test.ts`
Expected: FAIL — the component does not exist.

- [ ] **Step 3: Write the component**

```vue
<script setup lang="ts">
/**
 * §60's third status-bar region: "is this Plan's data safely written?".
 *
 * Text rather than an icon or a bare colour, per SDD §85 — the same "status not colour-only"
 * rule slice 5 applies to a zone's status. No props: it reads THIS Plan Editor's own store
 * from its own Pinia instance, so two open editors indicate independently.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { SAVE_STATE_KEYS } from './save-state';
import { useSaveStateStore } from './save-state-store';

const { state } = storeToRefs(useSaveStateStore());

const label = computed(() => tr(SAVE_STATE_KEYS[state.value]));
</script>

<template>
	<span
		class="rp-save-state-label"
		:class="`rp-save-state-${state}`"
	>{{ label }}</span>
</template>
```

- [ ] **Step 4: Mount it in the status bar**

In `src/presentation/editor/shell/StatusBar.vue`, add the import:

```ts
import SaveStateIndicator from '../save-state/SaveStateIndicator.vue';
```

and replace the self-closing save-state div with:

```html
		<div
			class="rp-editor-save-state"
			role="status"
			:aria-label="tr('editor.save-state')"
		>
			<SaveStateIndicator />
		</div>
```

Update that file's docblock: the region is no longer deliberately empty, and the sentence saying so must go rather than stand as an unchecked comment contradicting the markup beside it.

- [ ] **Step 5: Style the states**

Append to `styles/editor.css` — **check its line count first** (`wc -l styles/editor.css`); the assembler caps a partial at 400 lines, and this file has already been split once for crossing it. If appending would cross the cap, put these rules in a new `styles/editor-save-state.css` imported immediately after `editor-requirements.css`, and record in `styles/index.css` that its position is not load-bearing.

```css
/*
 * The class names are what `rp-save-state-${state}` GENERATES, so the error state is
 * `save-error` and its selector is `rp-save-state-save-error` — not `-error`. A selector one
 * word short of what the template emits simply never matches, and nothing here could catch
 * it: jsdom resolves no CSS, and the harness draws a state nobody is looking at.
 */
.rp-save-state-save-error {
	color: var(--text-error);
}

.rp-save-state-saving {
	color: var(--text-muted);
}
```

Confirm rather than trust the paragraph above: the template binds
``:class="`rp-save-state-${state}`"`` and `SaveState` is
`'saved' | 'saving' | 'unsaved-changes' | 'save-error'`, so the four classes it can emit are
`rp-save-state-saved`, `-saving`, `-unsaved-changes` and `-save-error`. Only two are styled;
the resting and unreachable states inherit the status bar's own colour deliberately.

- [ ] **Step 6: Run the tests and build**

Run: `npx vitest run tests/presentation/editor/ tests/harness/`
Expected: PASS — including `accessibility.test.ts`, which scans the real Plan Editor.

Run: `npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/save-state/SaveStateIndicator.vue src/presentation/editor/shell/StatusBar.vue styles/ tests/presentation/editor/saveState/saveStateIndicator.test.ts
git commit -m "feat: the status bar reports whether this plan is saved"
```

---

### Task 14: Wire the tracker into the one dispatcher a leaf hands out

**Files:**
- Modify: `src/presentation/editor/runtime.ts:461-478`
- Test: `tests/presentation/editor/saveState/saveStateWiring.test.ts`

**Interfaces:**
- Consumes: `withSaveStateTracking`, `useSaveStateStore`.
- Produces: nothing new — this changes what `buildRuntime` composes.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The wiring, asserted as a fact about the composition rather than about behaviour. A
 * behavioural test here would need a whole Plan Editor rig; what can go wrong is narrower
 * and structural — the tracker built but never composed, or composed on the wrong side of
 * the refresh decorator.
 *
 * Nesting matters both ways. OUTSIDE `withEditorStateRefresh`, so `saved` never appears
 * while the canvas still shows the pre-command state. INSIDE `wrapDispatcher`, which is the
 * one object every tool, the toolbar and the Inspector dispatch through — a tracker outside
 * it would miss nothing today and miss everything the moment the wrapping changes.
 *
 * **The ARGUMENTS, never the textual order.** An earlier draft compared `indexOf` positions,
 * which is the "address code by position" defect this repository writes down: it passed for
 * `withSaveStateTracking(history, …)` written below the refresh declaration — a composition
 * that settles the indicator before the refresh finishes — and said nothing at all about what
 * `wrapDispatcher` receives. Both of the two mistakes its own docblock claimed to prevent
 * could stay green.
 *
 * Still a source-shape check and not a behavioural one, which is a real limit: it holds the
 * bindings, not the runtime values. What it cannot see is written down rather than implied —
 * a renamed local that is threaded correctly fails this test, and a decorator that ignores
 * its argument passes it.
 */
const runtime = readFileSync('src/presentation/editor/runtime.ts', 'utf8');

/** Collapse whitespace so a reformat or a line break does not decide the outcome. */
const source = runtime.replace(/\s+/gu, ' ');

describe('save-state wiring', () => {
	it('composes the tracker in the runtime', () => {
		expect(source).toContain('withSaveStateTracking');
		expect(source).toContain('useSaveStateStore(');
	});

	it('hands the tracker the REFRESH decorator, not the bare history', () => {
		expect(source).toMatch(/withSaveStateTracking\( *dispatcher *,/u);
		expect(source).not.toMatch(/withSaveStateTracking\( *history *,/u);
	});

	it('hands wrapDispatcher the TRACKED dispatcher, not the untracked one', () => {
		expect(source).toMatch(/wrapDispatcher\( *history *, *tracked *\)/u);
		expect(source).not.toMatch(/wrapDispatcher\( *history *, *dispatcher *\)/u);
	});

	it('binds the tracker to a name, so the two assertions above address one value', () => {
		expect(source).toMatch(/const tracked = withSaveStateTracking\(/u);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/editor/saveState/saveStateWiring.test.ts`
Expected: FAIL — `runtime.ts` names neither symbol.

- [ ] **Step 2a: Prove the nesting assertions can fail**

After Step 3 has it green, temporarily rewrite the composition as
`const tracked = withSaveStateTracking(history, useSaveStateStore());` — the plausible wrong
version, tracking the bare history instead of the refreshed dispatcher. Re-run. Expected: the
"hands the tracker the REFRESH decorator" case goes red. Then temporarily pass `dispatcher`
rather than `tracked` to `wrapDispatcher` and watch the third case go red. **Restore both.**
The earlier draft of this file compared textual positions and stayed green under both of
those, which is why the reverts are steps rather than a suggestion.

- [ ] **Step 3: Wire it**

In `src/presentation/editor/runtime.ts`, add the imports:

```ts
import { useSaveStateStore } from './save-state/save-state-store';
import { withSaveStateTracking } from './save-state/with-save-state-tracking';
```

In `buildRuntime`, after the existing `const dispatcher = withEditorStateRefresh(history, {...});` block and before `wrapDispatcher`, replace the `wrapDispatcher` line with:

```ts
	// Outside the refresh decorator, so `saved` never appears while the canvas still shows the
	// pre-command state; inside `wrapDispatcher`, which is the one object a leaf hands out.
	const tracked = withSaveStateTracking(dispatcher, useSaveStateStore());

	const { dispatcher: wrappedDispatcher, canUndo, canRedo } = wrapDispatcher(history, tracked);
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/presentation/editor/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/runtime.ts tests/presentation/editor/saveState/saveStateWiring.test.ts
git commit -m "feat: every dispatch in a leaf reports its save state"
```

---

### Task 15: The manual case, the slice document's corrections, and the gate

**Files:**
- Create: `docs/tests/cases/Notices and save state.md`
- Modify: `docs/tasks/13-notifications-and-save-state-surfaces.md`
- Modify: `CLAUDE.md`
- Modify: `vitest.config.ts` (only if the ratchet applies — see Step 4)

**Interfaces:** none.

- [ ] **Step 1: Write the manual case**

Follow the shape of a sibling under `docs/tests/cases/` (read `Calibrate a Plan.md` first — match its heading structure and numbered-step style rather than inventing one). Cover what no automated gate here can:

1. An `info` notice appears and disappears on its own after about six seconds. **Raise it
   with the plan picker in a vault that has no plan notes** — `plan.none` is the one
   auto-dismissing notice a user can actually trigger. `notifySuccess` has no production
   caller in this slice (see its header for why), so a four-second success cannot be raised
   in a vault and is covered by the queue's node tests alone.
2. A `warning` notice stays until dismissed. Raise it by opening the background picker in a
   vault with no PNG, JPEG or PDF (`background.unsupported`).
3. Hovering that `info` notice holds it open; moving away starts its six seconds again.
4. The dismiss control is reachable by `Tab` and shows a visible focus ring — in a light
   theme, a dark theme and one third-party theme, since the ring is drawn from
   `var(--text-accent)` and a theme may set it to something with no contrast against the
   notice's own background. **No automated gate here can see this**: jsdom paints nothing and
   the harness cannot draw a `Notice` at all.
5. Four notices at once: three show, the fourth appears when one is dismissed.
6. The same message twice becomes one notice reading `(×2)`.
7. Severity colours are legible in a light theme, a dark theme, and one third-party theme.
8. Save state reads `Saving` then `Saved` when a zone is drawn, and `Save error` when a write fails.
9. Two Plan Editor leaves on two plans indicate independently.

Head the file with why it is manual: appearance and focus rings are measurements no layout engine in this repository performs, and `tests/harness/obsidian.css` carries no `.notice` rules, so the harness cannot draw one.

- [ ] **Step 2: Correct the slice document**

In `docs/tasks/13-notifications-and-save-state-surfaces.md`, mark the superseded parts rather than deleting them — the reasoning is worth keeping and the corrections are the record:

- Design §4 and §5: note that the plugin-global Vue app and `initNotifications` were NOT built, and point at the spec for why (`Notice` answers three of the four objections; the departure from SDD §12 bought nothing).
- The "carried forward" note about `reportFault` printing a raw `Error.message`: mark it fixed by slice 11.
- Definition of Done items 4, 5 and 6: replace with this plan's amended wording from the spec's "Definition of done" section.
- Add item 13: `NOTICE_DOOR` names every door this slice added.

- [ ] **Step 3: Update `CLAUDE.md`**

Add a slice 13 section in the style of its neighbours — what landed, and the rules that came out of it. At minimum:

- `Notice` is the container primitive and `duration: 0` is load-bearing, not incidental.
- A severity door added without widening `NOTICE_DOOR` is a door no gate can see, and `callee.name` is why `notify.success(...)` was refused.
- `handle.live` rather than a dismissal callback is the authority on a free slot, because Obsidian can dismiss without telling us.
- The `Notice` fake was a recorder, and what widening it turned red.
- Toast appearance is verified in a vault only — the vendored `obsidian.css` has no `.notice` rules.

Also correct the existing sentence in the "Deliberately absent" section if it now reads wrongly about `setIcon`, and update the Definition-of-done coverage line only from a measured figure.

- [ ] **Step 4: Run the gate**

```bash
npm run check
```

Expected: PASS — build, lint (both linters, `--max-warnings 0`), coverage-thresholded tests, fallow.

If coverage now measures above the floors, ratchet `vitest.config.ts` to the **rounded-down measured figures** and record which increment moved them, per that file's own policy. If the rounded-down figures equal the floors already in force, ratchet nothing — that is what slices 5, 11 and 15 did.

If `fallow` reports an unused export, it is a real finding: every export this slice adds has a caller in `src/` by the end of Task 14, except `disposeNotices`, which Task 9 wires into the plugin.

- [ ] **Step 5: Commit**

```bash
git add docs/ CLAUDE.md vitest.config.ts
git commit -m "docs: slice 13's manual case, and the corrections it made to its own plan"
```

- [ ] **Step 6: Push and open the pull request**

```bash
git push -u origin slice/13-notifications-and-save-state-surfaces
```

The branch already has PR #21 open for the design document. Push onto it rather than opening a second one.

---

## Self-review

**Spec coverage.** Every section of the spec maps to a task: §1 what-we-own → Tasks 6 and 8; §2 the API and the lint reason → Tasks 6 and 7; §3 files and policy values → Tasks 2–6; §4 the slot leak → Tasks 3 and 5; §5 save-state → Tasks 10–14; §6 German copy → Tasks 2 and 10; persistence impact → no task needed, the layer lint already enforces it and Task 15 runs it; testing strategy → distributed across every task; the "does not verify" section → Tasks 8 and 15; the four amended DoD items → Task 15.

**Two things this plan resolves that the spec left open.** The spec said severity is carried by "icon, translated label, colour"; the icon is dropped in Task 2, because this plugin has never called `setIcon`, the harness has no icon renderer pending the first call, and a text label satisfies §85 alone. And `withSaveStateTracking` reuses the existing `RefreshedHistory` alias rather than declaring the spec's `TrackedHistory` — they are the same `Pick`, and two names for one type in sibling directories is the defect slice 8 recorded under "There is ONE `EditorContext`".

**Two findings from the design review on PR #21, both verified against the tree before being
accepted.** A rejecting dispatcher would have left `pendingCount` permanently above zero —
the indicator stuck on `saving` and every later batch unsettleable — because `track`
decremented only on resolution while `withEditorStateRefresh` re-throws technical faults by
design. Task 12 now settles in a `catch` and re-throws unchanged, with a revert step over
that arm. And `notify` meaning `info` would have auto-dismissed two background cascade
warnings whose copy reads "figures may be wrong"; Task 6 classifies all four existing call
sites rather than preserving them unchanged.

**Four further findings from the second design-review pass, all verified and fixed.** The DOM
suites had no `@vitest-environment jsdom` directive and would have failed with `document is
not defined` before their first assertion — now a global constraint, since four suites need
it and four deliberately do not. The dedup path armed a timer on a HELD entry, whose callback
calls `release` — so a success repeated while three warnings held every slot would have been
silently deleted rather than promoted. The host wired no `click` listener on `containerEl`,
so Obsidian's own dismissal held its slot until some later push swept it — the spec described
that prompt and the code did not have it. And hover and focus were collapsed into one flag,
so leaving the notice resumed the timer while its dismiss button still held focus.

**A third review pass found four more, all real, all fixed.** `Notice.shown` would have
recorded empty strings, breaking ten content assertions across five existing suites — the
host passes the real text to the constructor now, and the step that claimed those suites were
unaffected has been replaced with a grep and an honest account of the one class that does
change. Task 3's promotion test could not have gone green: it sent a dismissal hint without
making the handle non-live, and `sweep` reads `handle.live`. `sweep` spliced the array it was
iterating, so a second externally dismissed notice stayed tracked as visible. And a duplicate
arriving while the user hovered restarted the clock underneath them.

**That last one is why `arm` was restructured rather than patched.** Three separate findings
across two review rounds were all "this call site should not have armed a timer" — held,
paused, persistent. They are now one rule inside `arm`, and every caller calls it
unconditionally, because a guard at a call site is a second copy of a rule and two copies
disagree. That is how the first two arrived.

**A fourth review pass found three more, in three areas none of the earlier rounds had
touched.** The dedup path returned before `promote()`, so a slot freed by an unobserved
dismissal stayed empty whenever the next push happened to be a repeat — breaking the design's
own "degrades to the next push" guarantee. `SaveStateStore` had two settlement outcomes where
it needs three: a validation refusal writes nothing, so resolving it as `ok` let it clear a
`save-error` left by a real persistence failure and tell the user unsaved data was safe;
`resolveNeutral` reverts to whatever the indicator read before the batch opened, and only a
write that actually succeeded may clear an error. And the save-error stylesheet selector was
`rp-save-state-error` where the template emits `rp-save-state-save-error`, so the colour never
applied — invisible to every gate here, since jsdom resolves no CSS.

**A fifth review pass found three more, and one of them says something about the other
nineteen.** `affectsSaveState` compared against `'validation'` where `ErrorCategory` is
`'Validation'` — it would not have compiled, and the plan's own test helper concealed that by
casting hand-built lowercase objects through `unknown`: a fake kinder than the real type, in
a plan whose first task is about fakes kinder than the real thing. Worse, correcting the case
alone would still have been wrong: `versioning.ts` raises `revisionConflict` and
`externalModification` as `ValidationError`s, and both mean the command reached the repository
and the user's edit was refused — the opposite of "wrote nothing". The predicate carves those
back out, from a table `versioning.ts` now exports rather than from a copy. The dismiss
control had no `:focus-visible` rule under a reset that removes both of Obsidian's focus
channels — a defect this repository has already shipped once, on the harness index, found by
reading a PNG. And the held-duplicate test called a dismissal hint without hiding its handle
— the same defect round three fixed one instance of, in a test round three itself added.

**A seventh pass found the round-five defect in a second file.** Task 6's notice fixture built
an `AppError` with a lowercase `'validation'` cast through `unknown`, exactly like the
tracking helper fixed two rounds earlier — and it was worse than inert: `CATEGORY_KEYS` is
keyed by the real union, so the lookup returned `undefined`, the notice body was empty, and
BOTH assertions passed for the wrong reason (`toContain('Error')` off the severity label,
`not.toContain(developerText)` off an empty string). It now asserts the category sentence
verbatim. **This is the second time in this plan that a fix was applied to an instance rather
than to a pattern** — the other was `handle.hide()` before a dismissal hint — so the global
constraint above now says to grep across files rather than fix the one that was flagged.

**An eighth pass found a Task 7 test that could not have passed.** It mapped `.ruleId` over
`lintText`'s result, which already resolves to an array of rule-id STRINGS — so the four
refusal cases would have failed against a correctly widened `NOTICE_DOOR` and the negative
case would have passed against an array of `undefined`. Written from memory beside four
correct examples in the same file, which is now a global constraint of its own.

**A tenth pass caught a fix that never landed.** Round nine rewrote the disposal test to
drive a real `plugin.onunload()` and reported that its "Expected" had been flipped from PASS
to FAIL. The edit that rewrote the test asserted its target; the edit that rewrote the step
did not, silently matched nothing, and left the old "Expected: PASS" standing under the new
test — so the plan claimed a green run for a case that now deterministically fails before
Step 3, and the reply on the pull request stating otherwise was wrong. The step is corrected,
and it now tells the implementer not to go hunting in Task 6 when red appears.

The same pass found `notifySuccess` has no production caller, so the manual case's
four-second and hover checks could not be performed in a vault at all. The door stays —
callerless on the slice-15 precedent, and the header says so — and the manual steps are
rewritten around `plan.none`, the one auto-dismissing notice a user can actually raise.

**A ninth pass found two tests that could not fail.** The disposal case called
`disposeNotices()` directly, so it was green whether or not the plugin ever registered the
disposer — the entire content of that task. It runs through a real `loadedPlugin()` and
`plugin.onunload()` now, its "Expected" flipped from PASS to FAIL before Step 3, and it names
the disposer in the list rather than counting the list. The save-state wiring case compared
`indexOf` positions, which passed for a tracker wrapping the bare history and said nothing
about what `wrapDispatcher` received — both of the two mistakes its own docblock claimed to
prevent. It asserts the ARGUMENT BINDINGS now, with a revert step per mistake, and states the
limit it still has: a source-shape check holds bindings, not runtime values.

**An eleventh pass found the source material this plan never read.** `docs/components/` holds
a contract per component and TWO of them name this slice — `Save-state indicator.md` and
`Toast.md`. Both require *a mark* beside the word, which is precisely the thing this plan
argued its way out of twice on `setIcon` grounds; the save-state contract also requires a
retry EMIT in the Save Error case, which neither the component nor the store can supply as
designed. Recorded in the spec's "Unresolved" section and banner-flagged above rather than
patched, because two of the three change what the components are. It also found
`set-plan-background` writing to the open plan outside the tracked dispatcher — real, and it
crosses this slice's boundary the same way `affectsSaveState` does.

**This corrects something stated three times in this review**: that the document had exhausted
what review could find and only execution remained. That was true of the defect classes being
found at the time and false in general — there was unread source material that changes the
design, and no amount of running the tests would have surfaced it.

**Known risk, front-loaded on purpose.** Task 1 widens a fake that has been drawing nothing, and CLAUDE.md's ledger says the two previous widenings of this kind turned 65 and 86 tests red. Those reds are findings about tests that were passing against a fake kinder than Obsidian. Budget for Task 1 taking longer than its five steps suggest, and read every failure before changing it.

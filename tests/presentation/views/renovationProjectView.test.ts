/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import type { ViewStateResult } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installObsidianDom } from '../../helpers/dom';
import { RENOVATION_PROJECT_VIEW, type RenovationProjectView } from '../../../src/presentation/views/RenovationProjectView';
import { RENOVATION_PROJECT_CONTEXT, type RenovationProjectDeps } from '../../../src/presentation/views/RenovationProjectContext';
import { t } from '../../../src/presentation/i18n/strings';
import { defaultRenovationProjectDeps, makeView } from '../../helpers/makeRenovationProjectView';
// Regular type imports rather than an inline dynamic-import type annotation: oxlint's
// `consistent-type-imports` forbids that form, and `noInlineConfig` means there is no
// suppression for it. These are the module SHAPES the two wrappers below spread.
import type * as VueModule from 'vue';
import type * as PiniaModule from 'pinia';

/**
 * Both modules are wrapped rather than replaced: the real `createApp` and `createPinia`
 * run, and the wrapper records what they returned. That is what lets the two claims ADR-004
 * actually makes be checked — that the app created on open is the one unmounted on close,
 * and that each view gets its OWN Pinia rather than a shared singleton. Neither is visible
 * in the DOM: an app left mounted and an app unmounted leave the same empty pane behind.
 */
const { apps, pinias, mountRecorders } = vi.hoisted(() => ({
	apps: [] as { unmount: () => void }[],
	pinias: [] as unknown[],
	/**
	 * What `makeViewRecordingMounts` registers. Called with the context a mount actually
	 * PROVIDED — the one place the `projectId` a mount was built for exists to be read, since
	 * `mount` spreads it over the bundle and hands the result to Vue and to nothing else.
	 */
	mountRecorders: [] as ((context: RenovationProjectDeps) => void)[],
}));

vi.mock('vue', async (importOriginal) => {
	const vue = await importOriginal<typeof VueModule>();

	return {
		...vue,
		createApp: (...args: Parameters<typeof vue.createApp>) => {
			const app = vue.createApp(...args);
			// `provide` is wrapped rather than replaced, for the reason the whole module is:
			// the real one runs and the wrapper only watches. It is the honest observation
			// point for which state a mount was built for — `RenovationProjectView.mount`
			// spreads this mount's `projectId` over the bundle and provides the result,
			// keeping no copy of it. Filtered on the KEY because `app.use(createPinia())`
			// provides too, one line above.
			const provide = app.provide.bind(app) as (key: unknown, value: unknown) => VueModule.App;
			app.provide = ((key: unknown, value: unknown) => {
				if (key === RENOVATION_PROJECT_CONTEXT) {
					for (const record of mountRecorders) record(value as RenovationProjectDeps);
				}
				return provide(key, value);
			}) as typeof app.provide;
			apps.push(app);
			return app;
		},
	};
});

vi.mock('pinia', async (importOriginal) => {
	const pinia = await importOriginal<typeof PiniaModule>();

	return {
		...pinia,
		createPinia: () => {
			const store = pinia.createPinia();
			pinias.push(store);
			return store;
		},
	};
});

installObsidianDom();

describe('the renovation project view', () => {
	let subject: RenovationProjectView;

	beforeEach(() => {
		apps.length = 0;
		pinias.length = 0;
		subject = makeView();
	});

	/**
	 * The view TYPE is persisted in the workspace layout, so it is data: renaming it orphans
	 * every leaf a user already has open. Asserted as a literal rather than against the
	 * exported constant, which would only prove the file agrees with itself.
	 */
	it('answers the persisted view type', () => {
		expect(subject.getViewType()).toBe('renovation-project');
		expect(RENOVATION_PROJECT_VIEW).toBe('renovation-project');
	});

	// Display text through the string table — the subject is that the view is wired
	// through `tr()`; the copy itself is en.ts's to own and its lint's to case.
	it('has a display name and an icon', () => {
		expect(subject.getDisplayText()).toBe(t('en', 'view.project.name'));
		expect(subject.getIcon()).not.toBe('');
	});

	it('draws one mount point into the content pane', async () => {
		await subject.onOpen();

		expect(subject.contentEl.querySelectorAll('.renovation-planner-view')).toHaveLength(1);
	});

	/**
	 * Obsidian keeps the leaf and reuses the view, so a second open must not stack a second
	 * tree — which is what a mount that appends without emptying does, and what a Vue app
	 * mounted twice into the same pane would do more expensively.
	 */
	it('does not stack a second tree when reopened', async () => {
		await subject.onOpen();
		await subject.onOpen();

		expect(subject.contentEl.querySelectorAll('.renovation-planner-view')).toHaveLength(1);
	});

	it('empties the content pane on close', async () => {
		await subject.onOpen();
		await subject.onClose();

		expect(subject.contentEl.children).toHaveLength(0);
	});

	/**
	 * `contentEl`, not `containerEl`: the outer element carries Obsidian's own view chrome —
	 * the header and the tab actions — and emptying it takes those with it. The fake nests
	 * the two the way the app does, so a view that reached for the wrong one fails here.
	 * The header asserted below is the fake's OWN `.view-header`, real chrome rather than a
	 * manually appended stand-in — the same element `styles/chrome.css` hides.
	 */
	it('leaves the view chrome alone', async () => {
		const chrome = subject.containerEl.appendChild(document.createElement('div'));
		const header = subject.containerEl.querySelector('.view-header');
		expect(header).not.toBeNull();

		await subject.onOpen();
		await subject.onClose();

		expect(chrome.parentElement).toBe(subject.containerEl);
		expect(subject.containerEl.querySelector('.view-header')).toBe(header);
	});

	/**
	 * `styles/chrome.css` matches `.workspace-leaf-content[data-type="…"] .view-header`, and
	 * `styles/view.css` gives `contentEl`'s child its height through the chain that starts at
	 * `.view-content` — Obsidian's own class on `contentEl`. Neither can be looked at in the
	 * harness (or matched by a real selector here) unless the fake carries the same class,
	 * attribute and nesting Obsidian's own `ItemView` does.
	 */
	it('nests the header and content pane the way Obsidian does', () => {
		expect(subject.containerEl.classList.contains('workspace-leaf-content')).toBe(true);
		expect(subject.containerEl.dataset.type).toBe(RENOVATION_PROJECT_VIEW);
		expect(subject.contentEl.classList.contains('view-content')).toBe(true);

		const children = [...subject.containerEl.children];
		expect(children[0]?.classList.contains('view-header')).toBe(true);
		expect(children[1]).toBe(subject.contentEl);
	});

	/**
	 * The container class is what `styles/chrome.css` keys its `.view-content` padding
	 * reset on, so it must be present after an open. Obsidian reuses the view, so a
	 * second open must not have to depend on the class being added twice — `addClass`
	 * is set-membership, and that is what survives here.
	 */
	it('marks its container for the padding reset', async () => {
		await subject.onOpen();
		await subject.onOpen();

		expect(subject.containerEl.classList.contains('renovation-planner-container')).toBe(true);
	});

	/**
	 * `styles/chrome.css` hides Obsidian's view header and resets the content pane's
	 * padding for THIS view only — one selector keyed on the persisted type, one on the
	 * class `onOpen` adds to `containerEl`. Both are strings CSS cannot import. This is
	 * the check that pairs each selector to its constant, so renaming either cannot
	 * silently leave chrome visible (or, worse, restyle some other plugin's pane).
	 */
	it('keys the hidden view header on this view type', () => {
		const chrome = readFileSync('styles/chrome.css', 'utf8');

		expect(chrome).toContain(`[data-type="${RENOVATION_PROJECT_VIEW}"]`);
		expect(chrome).toContain('.renovation-planner-container .view-content');
	});
});

describe('the Vue lifecycle', () => {
	let subject: RenovationProjectView;

	beforeEach(() => {
		apps.length = 0;
		pinias.length = 0;
		subject = makeView();
	});

	it('mounts one app into the content pane on open', async () => {
		await subject.onOpen();

		expect(apps).toHaveLength(1);
		expect(subject.contentEl.querySelectorAll('.renovation-planner-view')).toHaveLength(1);
	});

	/**
	 * ADR-004's actual claim: an isolated app per `ItemView`, not one long-lived app shared
	 * across views. A shared Pinia would let two open leaves mutate each other's state,
	 * which is invisible until the second leaf exists.
	 */
	it('gives each view its own Pinia instance', async () => {
		await subject.onOpen();
		await makeView().onOpen();

		expect(pinias).toHaveLength(2);
		expect(pinias[0]).not.toBe(pinias[1]);
	});

	// Unmount, not merely empty: an app left mounted keeps its effects and watchers alive
	// against a tree nobody can see, and both outcomes leave the same empty pane.
	it('unmounts the app it created on close', async () => {
		await subject.onOpen();
		const unmount = vi.spyOn(apps[0], 'unmount');

		await subject.onClose();

		expect(unmount).toHaveBeenCalledTimes(1);
		expect(subject.contentEl.children).toHaveLength(0);
	});

	// Obsidian may close a leaf whose view never opened; nothing here may throw on it.
	it('does nothing when closed without having opened', async () => {
		await expect(subject.onClose()).resolves.toBeUndefined();

		expect(apps).toEqual([]);
	});
});

/**
 * A view whose every MOUNT is observed, by the `projectId` that mount actually PROVIDED.
 *
 * Beside the cases rather than in `tests/helpers/`, because it exists to observe this one
 * class. It captures no deps FACTORY, and there is none to capture: `RenovationProjectDeps`
 * is a plain bundle, and `RenovationProjectView.mount` writes this mount's `projectId` over
 * it (`{ ...this.deps, projectId }`) on its way to `app.provide`. That provided object is
 * therefore the only place the answer exists, which is what the `provide` wrapper at the top
 * of this file reads.
 */
function makeViewRecordingMounts(mounted: (string | null)[]): RenovationProjectView {
	mountRecorders.push((context) => mounted.push(context.projectId));
	return makeView();
}

describe('the list and detail states', () => {
	beforeEach(() => {
		// Per test, because a recorder registered by one case would otherwise go on pushing
		// into that case's array from every later mount in this file.
		mountRecorders.length = 0;
	});

	/**
	 * `''` is a DESTINATION here, and it is the one place this view must not copy
	 * `PlanEditorView`. `planIdFrom` refuses an empty id and `setState` then leaves the field
	 * alone, which is right for a view whose empty case is *nothing to draw*. This view's
	 * empty case is the LIST — a state a user navigates to — so refusing `''` refuses the only
	 * state the back arrow ever restores, and the pane never leaves the detail state.
	 */
	it('accepts an empty projectId as the list state', async () => {
		const view = makeView();
		await view.onOpen();
		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);

		await view.setState({ projectId: '' }, {} as ViewStateResult);

		expect(view.getState()).toEqual({ projectId: '' });
	});

	it('round-trips detail → list → detail', async () => {
		const view = makeView();
		await view.onOpen();

		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);
		await view.setState({ projectId: '' }, {} as ViewStateResult);
		await view.setState({ projectId: 'project-01JBBB' }, {} as ViewStateResult);

		expect(view.getState()).toEqual({ projectId: 'project-01JBBB' });
	});

	/**
	 * A value that is not a string at all is a layout this build does not recognise, and the
	 * conservative answer is to go on drawing whatever is already drawn.
	 */
	it('refuses a non-string projectId and keeps the state it already had', async () => {
		const view = makeView();
		await view.onOpen();
		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);

		await view.setState({ projectId: 42 }, {} as ViewStateResult);

		expect(view.getState()).toEqual({ projectId: 'project-01JAAA' });
	});

	/**
	 * The other three shapes a persisted layout can arrive in, driven for the same reason
	 * `planEditorView.test.ts` drives its own four: `projectIdFrom` reads an `unknown` written
	 * by a user's hand or by another version of this plugin, so every arm of it is reachable in
	 * a real vault. A state that is not an object at all and one that IS `null` are two
	 * different conditions of the same guard, which is why both are here rather than one
	 * standing in for the other; a state with no `projectId` key lands on the same arm as the
	 * `42` above, and is what a leaf saved BEFORE this slice actually restores as.
	 */
	it.each([
		['no state at all', null],
		['a state that is not an object', 'project-01JBBB'],
		['a state with no projectId key', {}],
	])('refuses %s and keeps the state it already had', async (_name, state) => {
		const view = makeView();
		await view.onOpen();
		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);
		const result = {} as ViewStateResult;

		await view.setState(state, result);

		expect(view.getState()).toEqual({ projectId: 'project-01JAAA' });
		expect(result.history).toBeUndefined();
	});

	/**
	 * **The single assignment the back arrow works because of, and every other case in this
	 * slice passes without it.** `ViewStateResult.history` is documented as "there is a state
	 * change which should be recorded in the navigation history"; setting it puts each
	 * navigation into Obsidian's own leaf history. No gate here can check that Obsidian
	 * HONOURS it — `FakeLeaf` records asks rather than behaving — so this is the whole of what
	 * the suite can say, and `docs/tests/cases/` carries the rest.
	 */
	it('records each navigation in the leaf’s navigation history', async () => {
		const view = makeView();
		const result = {} as ViewStateResult;

		await view.setState({ projectId: 'project-01JAAA' }, result);

		expect(result.history).toBe(true);
	});

	/**
	 * A REFUSED state is not a navigation. `{ projectId: 42 }` is a layout this build does not
	 * recognise, so the pane goes on drawing what it draws — and a history entry for it would
	 * restore the state the pane is already in, an arrow that appears to do nothing.
	 */
	it('records no history for a state it refuses', async () => {
		const view = makeView();
		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);
		const result = {} as ViewStateResult;

		await view.setState({ projectId: 42 }, result);

		expect(result.history).toBeUndefined();
	});

	/** Nor is re-stating the project already open — `sync()` no-ops and so must the history. */
	it('records no history when the state names the project already open', async () => {
		const view = makeView();
		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);
		const result = {} as ViewStateResult;

		await view.setState({ projectId: 'project-01JAAA' }, result);

		expect(result.history).toBeUndefined();
	});

	/**
	 * What the `mounted` flag exists for. `PlanEditorView`'s guard returns on
	 * `planId === null` because there is nothing to draw; here `null` is the LIST, a real
	 * state — so a bare `projectId === mountedProjectId` guard skips the first open and the
	 * pane draws nothing at all.
	 *
	 * **Two assertions, because neither can answer for the other.** The DOM one is the only
	 * place in this file that proves a tree actually reaches `contentEl` — recording mount
	 * calls says a mount was ATTEMPTED, not that anything was drawn — and it is what goes red
	 * against the skipped-first-open defect above. The recorded value is what makes the word
	 * *list* in this case's name true: a node exists under every state, so the DOM assertion
	 * alone cannot see WHICH one mounted.
	 */
	it('mounts the list on a first open', async () => {
		const mounted: (string | null)[] = [];
		const view = makeViewRecordingMounts(mounted);

		await view.onOpen();

		expect(view.contentEl.querySelector('.renovation-planner-view')).not.toBeNull();
		expect(mounted).toEqual([null]);
	});

	/**
	 * `onOpen` and `setState` race and the order is not something a plugin may assume.
	 *
	 * **Counting surviving DOM nodes cannot see this, and that is what the case is about.**
	 * A remount is `onClose(); onOpen();` and `onClose` calls `contentEl.empty()`, so a build
	 * that wrongly remounts here still leaves exactly ONE `.renovation-planner-view` — the
	 * assertion this case used to carry read identically in both worlds while its name promised
	 * to catch a second mount. What the defect actually costs is invisible in the DOM: `mount`
	 * is where the context is provided, so a remount on Obsidian's ordinary `onOpen`/`setState`
	 * sequence re-hydrates both stores and re-registers the `onProjectsChanged` and
	 * `onPlansChanged` subscriptions, every open, with the pane looking correct. Reported by a
	 * review bot against this plan.
	 *
	 * It shares its assertion with the case above and is NOT a duplicate of it — the extra
	 * `setState` is the whole case, and against the remounting build this reads `[null, null]`.
	 * Two cases with identical bodies AND identical driving is the trap Task 4 fell into
	 * (`d9e81f3`); identical assertions under different driving is an ordinary pair.
	 */
	it('does not mount twice when setState follows onOpen', async () => {
		const mounted: (string | null)[] = [];
		const view = makeViewRecordingMounts(mounted);

		await view.onOpen();
		await view.setState({ projectId: '' }, {} as ViewStateResult);

		expect(mounted).toEqual([null]);
	});

	/**
	 * The whole of the spec's first review finding: a tree built from `projectId` and NOT
	 * remounted goes on drawing the state it was built for, after a `setState` that did
	 * everything it was asked. Every other case here passes against that build.
	 */
	it('remounts when navigating between two projects', async () => {
		const mounted: (string | null)[] = [];
		const view = makeViewRecordingMounts(mounted);
		await view.onOpen();

		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);
		await view.setState({ projectId: 'project-01JBBB' }, {} as ViewStateResult);

		expect(mounted).toEqual([null, 'project-01JAAA', 'project-01JBBB']);
	});

	/**
	 * Criterion 7: `projectId` is the VIEW's own field, so a rebind that replaces every
	 * dependency must not disturb it. `rebind` takes a `RenovationProjectDeps` BUNDLE — Task 5
	 * chose that over a `(projectId) => deps` factory and its commit body says why — so this
	 * case hands it a second, genuinely different bundle rather than the one the view already
	 * holds. `defaultRenovationProjectDeps()` is exported from `makeRenovationProjectView.ts`
	 * for exactly this; calling it twice gives two bundles over two independent in-memory
	 * repositories, which is what makes the assertion mean "survived a real swap".
	 */
	it('keeps the open project across a rebind', async () => {
		const view = makeView();
		await view.onOpen();
		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);

		view.rebind(defaultRenovationProjectDeps());

		expect(view.getState()).toEqual({ projectId: 'project-01JAAA' });
	});

	/**
	 * The other half of that rebind, and what makes the assertion above about the FIELD rather
	 * than about a pane that happens to look unchanged: the swap remounts, and it remounts on
	 * the state the view was already in. A `rebind` that went back through `sync` without
	 * clearing `mounted` would leave the retired root's tree on screen with every other case
	 * here green.
	 */
	it('remounts the open project on the new bundle', async () => {
		const mounted: (string | null)[] = [];
		const view = makeViewRecordingMounts(mounted);
		await view.onOpen();
		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);

		view.rebind(defaultRenovationProjectDeps());

		expect(mounted).toEqual([null, 'project-01JAAA', 'project-01JAAA']);
	});
});

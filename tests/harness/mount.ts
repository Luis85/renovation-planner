/**
 * Mount the REAL view outside Obsidian, for looking at rather than for asserting on.
 *
 * Everything here is shared with the test suite — the `obsidian` module mock, the fake
 * workspace, the construction order a view needs. The only thing this module adds is a
 * mount that does not depend on vitest, so the same view can be served to a browser
 * (`npm run harness`). It draws; it checks nothing. jsdom remains the substitute for
 * Obsidian in tests, and a real vault remains the only place appearance is verified.
 *
 * `makeView()` is called with no `deps` argument, which is what keeps this file compiling
 * unchanged now that design slice 14 gave the constructor a second parameter: the default
 * answers `ok({ projects: [], unreadable: 0 })` — an empty project list with nothing refused
 * — so the harness page shows the "no renovation projects yet" empty state, and that is the
 * new thing worth looking at here. The populated surface has nothing else to draw until a
 * later slice builds an actual project list; this slice explicitly does not.
 */
import type { RenovationProjectView } from '../../src/presentation/views/RenovationProjectView';
import { installObsidianDom } from '../helpers/dom';
import { makeView } from '../helpers/makeRenovationProjectView';

export interface MountedHarness {
	/** The workspace leaf the app would give the view. */
	leafEl: HTMLElement;
	/** The view itself, for a probe pasted into a console. */
	view: RenovationProjectView;
}

export function mountHarness(root: HTMLElement): MountedHarness {
	// Obsidian's DOM prototype extensions (`createEl`, `createDiv`, `empty`, `setText`,
	// `addClass`). The view calls them and a browser has none of them, so this is what
	// makes the same code run on a plain page. Installed first, because everything below
	// uses it.
	installObsidianDom();
	root.empty();

	// Real nesting on purpose. `containerEl` is what the app hands a view and `contentEl` is
	// the pane inside it, so a view that empties the wrong one is as visible here as in the
	// suite — and the leaf frame, together with the rules `tests/harness/theme.css` keys off
	// it, is what supplies the height Obsidian's own pane would.
	const leafEl = root.createDiv('rp-harness-leaf');
	const view = makeView();
	leafEl.appendChild(view.containerEl);
	// The view's own first draw. `void` rather than awaited: this function is called from a
	// page entry that cannot await, and `onOpen` does its work synchronously before the
	// promise it returns.
	void view.onOpen();

	return { leafEl, view };
}

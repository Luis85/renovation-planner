import { getLanguage, ItemView } from 'obsidian';
import { t } from '../i18n/strings';

/**
 * The workspace view the SDD names first (§11): the project surface.
 *
 * The view TYPE is persisted by Obsidian in the workspace layout, so it is data rather
 * than text — renaming it orphans every leaf a user already has open, exactly like a
 * frontmatter key. The display name beside it is text, and translatable.
 */
export const RENOVATION_PROJECT_VIEW = 'renovation-project';

/**
 * Draws nothing yet, and the empty root div is the point: it is the mount point the SDD's
 * §12 asks for — one isolated Vue app per Obsidian view, created in `onOpen` and unmounted
 * in `onClose`. When Vue lands, `createApp(ViewRoot).mount(root)` goes where the comment
 * says and `app.unmount()` joins `onClose`; nothing else about this file changes, and
 * nothing outside it learns that a view is Vue.
 *
 * `contentEl`, not `containerEl`: the outer element carries Obsidian's own view chrome —
 * the header and the tab actions — and emptying it takes those with it.
 */
export class RenovationProjectView extends ItemView {
	getViewType(): string {
		return RENOVATION_PROJECT_VIEW;
	}

	getDisplayText(): string {
		return t(getLanguage(), 'view.project.name');
	}

	getIcon(): string {
		return 'hammer';
	}

	onOpen(): Promise<void> {
		this.contentEl.empty();
		// The mount point. One class, which is also the stylesheet's only entry point into
		// this view — see styles/view.css.
		this.contentEl.createDiv('renovation-planner-view');
		return Promise.resolve();
	}

	/**
	 * Obsidian keeps the leaf and reuses the view, so leaving the old tree behind would
	 * draw it twice on the next open. It empties rather than detaching the leaf: detaching
	 * in a close handler loses the user's layout, which is one of the recurring plugin
	 * review rejections.
	 */
	onClose(): Promise<void> {
		this.contentEl.empty();
		return Promise.resolve();
	}
}

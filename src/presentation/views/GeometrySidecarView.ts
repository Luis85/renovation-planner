import { ItemView, normalizePath, TFile, type ViewStateResult } from 'obsidian';
import { tr } from '../i18n/strings';

/**
 * The read-only viewer behind the registered `rpgeo` extension (ADR-011): a sidecar is
 * deliberately an openable, visible file rather than binary noise, so a click shows its
 * JSON as text instead of "no app is available to open". Editing it by hand is
 * legitimate — which is exactly why every conditional write over sidecar content
 * carries an observation token and not just a revision.
 *
 * The view TYPE is data, like every other one here: Obsidian persists it in the
 * workspace layout.
 */
export const GEOMETRY_SIDECAR_VIEW = 'renovation-geometry-sidecar';

export class GeometrySidecarView extends ItemView {
	/** The sidecar's vault path, carried in the leaf's own view state by Obsidian. */
	private filePath = '';

	getViewType(): string {
		return GEOMETRY_SIDECAR_VIEW;
	}

	getDisplayText(): string {
		return tr('view.geometry.name');
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const file = (state as { file?: unknown } | null)?.file;
		if (typeof file === 'string') this.filePath = file;
		await super.setState(state, result);
	}

	onOpen(): Promise<void> {
		this.contentEl.empty();
		if (!this.filePath) return Promise.resolve();

		const abstractFile = this.app.vault.getAbstractFileByPath(normalizePath(this.filePath));
		if (!(abstractFile instanceof TFile)) return Promise.resolve();

		const pre = this.contentEl.createEl('pre', { cls: 'renovation-geometry-source' });
		void this.app.vault
			.cachedRead(abstractFile)
			.then((text) => {
				pre.setText(text);
				return undefined;
			})
			.catch(() => {
				pre.setText('');
				return undefined;
			});
		return Promise.resolve();
	}
}

import { FuzzySuggestModal, type App, type TFile } from 'obsidian';
import { backgroundKindFor } from '../domain/plan/PlanBackgroundRef';
import type { BackgroundPicker, DocumentRef } from '../presentation/designer/ports';
import { tr } from '../presentation/i18n/strings';

/**
 * Pick the Vault file an asset's designer is drawn over (Task B7) — the ONE place the
 * `BackgroundPicker` port `presentation/designer/ports.ts` declares is bound to Obsidian's own
 * file suggester, exactly as `PlanBackgroundSuggestModal` is for the Plan Editor's own command.
 *
 * `backgroundKindFor` is reused from the Plan's module here rather than re-derived a third
 * time: this is `src/plugin/`, which composes every layer and already reaches `obsidian`, so
 * the cross-domain-coupling argument `SetAssetBackground.ts`'s own copy exists for does not
 * apply to a plugin-level file that answers "what can Obsidian open as an image or a PDF" —
 * a question about the FILE SYSTEM rather than about either entity.
 *
 * The file is one already in the Vault and nothing is copied — the same PRD-driven scope
 * `PlanBackgroundSuggestModal`'s own docblock states.
 */
class AssetBackgroundSuggestModal extends FuzzySuggestModal<TFile> {
	private chosen = false;

	constructor(
		app: App,
		private readonly files: readonly TFile[],
		private readonly onChoose: (file: TFile) => void,
		private readonly onCancel: () => void,
	) {
		super(app);
		this.setPlaceholder(tr('designer.background.pick'));
	}

	getItems(): TFile[] {
		return [...this.files];
	}

	/** The full path, not the basename: two spec sheets called `spec.pdf` are the normal case. */
	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.chosen = true;
		this.onChoose(file);
	}

	/**
	 * Obsidian calls this on EVERY close, a chosen one included. Without it,
	 * `BackgroundPicker.pick()`'s promise would never settle when the user dismisses the modal
	 * with Escape or a click outside it.
	 *
	 * **Deferred by one microtask, and a synchronous check here would be a real bug rather
	 * than a theoretical one.** `SuggestModal.selectSuggestion` is widely believed to CLOSE
	 * before it delivers the choice, and `obsidian.d.ts` states no ordering either way — so a
	 * synchronous `if (!this.chosen)` here would read `chosen` as still `false` under a
	 * close-then-choose ordering, resolve the promise `null`, and then the real file arriving a
	 * statement later would find it already settled and silently discard the user's pick. A
	 * `Promise.resolve().then(...)` defers the check past whichever ordering Obsidian uses:
	 * `onChooseItem`, if it is coming at all, runs SYNCHRONOUSLY relative to `onClose` in both
	 * documented orderings, so by the time this microtask runs, `chosen` already reflects it.
	 */
	onClose(): void {
		void Promise.resolve().then(() => {
			if (!this.chosen) this.onCancel();
			return undefined;
		});
	}
}

export class ObsidianBackgroundPicker implements BackgroundPicker {
	constructor(private readonly app: App) {}

	pick(): Promise<DocumentRef | null> {
		const candidates = this.app.vault.getFiles().filter((file) => backgroundKindFor(file.path) !== null);
		return new Promise((resolve) => {
			const modal = new AssetBackgroundSuggestModal(
				this.app,
				candidates,
				(file) => {
					const kind = backgroundKindFor(file.path);
					// `getItems` already narrowed to supported kinds, so `kind` is never `null`
					// here in practice; refusing rather than asserting keeps this door honest
					// about what it can prove.
					resolve(kind === null ? null : { path: file.path, kind, page: kind === 'pdf' ? 1 : null });
				},
				() => resolve(null),
			);
			modal.open();
		});
	}
}

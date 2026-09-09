import { tr } from '../i18n/strings';

/**
 * What a DESKTOP-ONLY surface draws when it is reached on mobile — extension 2a of
 * `docs/requirements/Bound the mobile surface to what it can actually do.md`: "it says so, in a
 * sentence naming the reason, rather than drawing a canvas that cannot be drawn on".
 *
 * A function with two callers rather than the "REVIEWED CLONE" `AssetDesignerView` and
 * `PlanEditorView` already declare of each other's lifecycle, and the difference is which thing
 * is being shared: their clone is Obsidian's own `onOpen`/`onClose` INTERFACE, which each view
 * has to implement for itself, while this is ONE SENTENCE about the product's device scope.
 * Two copies of that is two places a reworded refusal has to be found.
 *
 * It EMPTIES first, so it is safe to run on every `sync()` — Obsidian calls `setState` and
 * `onOpen` in an order a plugin does not get to assume, and a refusal drawn twice would be the
 * sentence twice.
 *
 * The caller unmounts; this draws. Keeping the two apart is what lets each view use its own
 * `unmount`, which is the half that is genuinely per-view (one holds a Konva stage, the other a
 * host `div`).
 */
export function drawMobileRefusal(contentEl: HTMLElement): void {
	contentEl.empty();
	contentEl.createEl('p', { cls: 'rp-view-message', text: tr('view.mobile.desktop-only') });
}

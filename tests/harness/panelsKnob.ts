import { settleUntil } from '../helpers/settle';

/**
 * `?panels=collapsed|layers|inspector` (2026-09-12 side panels spec §4): collapses through the
 * real header buttons once the full layout has drawn them. Ends on the click, like
 * `selectMultipleOnceReady`; a caller that needs the strip waits for it itself.
 */
export async function collapsePanelsOnceReady(root: HTMLElement, which: string): Promise<void> {
	const sides = which === 'collapsed' ? ['layers', 'inspector'] : [which];
	await settleUntil(() => root.querySelector('.rp-side-panel__toggle') !== null, 'the side panel headers');
	for (const side of sides) {
		root.querySelector<HTMLButtonElement>(`.rp-side-panel__toggle[data-rp-panel-toggle="${side}"]`)?.click();
	}
}

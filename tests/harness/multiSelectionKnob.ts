import { settleUntil } from '../helpers/settle';
import { nextTick } from 'vue';

/** M11 is reached through the actual list controls, including at drawer widths. */
export async function selectMultipleOnceReady(root: HTMLElement, ids: readonly string[]): Promise<void> {
	await settleUntil(() => root.querySelector('.rp-editor-layers, [data-rp-rail="layers"]') !== null, 'the property panel or its rail');
	if (root.querySelector('.rp-editor-layers') === null) root.querySelector<HTMLButtonElement>('[data-rp-rail="layers"]')?.click();
	await settleUntil(() => root.querySelector('[data-rp-action="multiple-selection"]') !== null, 'the multiple selection control');
	root.querySelector<HTMLInputElement>('[data-rp-action="multiple-selection"]')?.click();
	await nextTick();
	for (const id of ids) {
		const row = [...root.querySelectorAll<HTMLButtonElement>('.rp-editor-layers [data-rp-id]')].find((candidate) => candidate.dataset.rpId === id);
		if (row === undefined) throw new Error(`No selection row for ${id}`);
		row.click();
	}
	const details = root.querySelector<HTMLButtonElement>('[data-rp-rail="details"]');
	if (details !== null) details.click();
	await settleUntil(() => root.querySelector('.rp-multi-selection') !== null, 'the multiple selection Inspector');
}

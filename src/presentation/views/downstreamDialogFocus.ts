import { nextTick } from 'vue';

/** A refreshed row may remove its dialog opener while the draft remains open. */
export function captureDownstreamDialogFocus(): () => Promise<void> {
	const opener = document.activeElement as HTMLElement;
	const root = opener.closest<HTMLElement>('.rp-project-downstream');
	return async () => {
		await nextTick();
		if (!root?.isConnected || opener.isConnected || document.activeElement !== document.body) return;
		root.querySelector<HTMLElement>('.rp-project-detail__back')?.focus();
	};
}

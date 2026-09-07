import { nextTick } from 'vue';

/** Capture the native event target before awaiting the root-owned dialog. */
export async function runInspectorAction(event: Event, action: string, invoke: () => Promise<void>): Promise<void> {
	const opener = event.currentTarget as HTMLElement, root = opener.closest<HTMLElement>('.renovation-plan-editor');
	await invoke();
	await nextTick();
	restoreInspectorActionFocus(opener, root, action);
}

/** Root-owned dialogs survive reflow, including when their persistent opener becomes hidden. */
export function restoreInspectorActionFocus(opener: HTMLElement, root: HTMLElement | null, action: string): void {
	if (!root?.isConnected) return;
	const hidden = opener.closest<HTMLElement>('[data-rp-shell-region]')?.style.display === 'none';
	if (opener.isConnected && !hidden) return;
	const target = root.querySelector<HTMLElement>('[data-rp-rail="details"], .rp-unsupported-width__action')
		?? root.querySelector<HTMLElement>(`[data-rp-action="${action}"]`)
		?? root.querySelector<HTMLElement>('[data-rp-region="inspector"]');
	target?.focus();
}

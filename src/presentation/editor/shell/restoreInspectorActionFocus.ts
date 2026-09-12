import { nextTick } from 'vue';

/** A hidden region, or a full-layout side panel collapsed to its strip, whose body is `v-show`n away. */
function hiddenRegion(element: HTMLElement): boolean {
	return element.closest<HTMLElement>('[data-rp-shell-region]')?.style.display === 'none'
		|| element.closest<HTMLElement>('.rp-side-panel__body')?.style.display === 'none';
}

/** Capture the native event target before awaiting the root-owned dialog. */
export async function runInspectorAction(event: Event, action: string, invoke: () => Promise<void>, fallbackRegion: 'layers' | 'inspector' = 'inspector'): Promise<void> {
	const opener = event.currentTarget as HTMLElement, root = opener.closest<HTMLElement>('.renovation-plan-editor');
	const origin = opener.closest<HTMLElement>('[data-rp-shell-region]')?.dataset.rpShellRegion;
	const region = origin === 'layers' || origin === 'inspector' ? origin : fallbackRegion;
	await invoke();
	await nextTick();
	restoreInspectorActionFocus(opener, root, action, region);
}

/** Root-owned dialogs survive reflow, including when their persistent opener becomes hidden. */
export function restoreInspectorActionFocus(opener: HTMLElement, root: HTMLElement | null, action: string, region: 'layers' | 'inspector' = 'inspector'): void {
	if (!root?.isConnected) return;
	if (opener.isConnected && !hiddenRegion(opener)) return;
	const rail = region === 'layers' ? 'layers' : 'details';
	const target = root.querySelector<HTMLElement>(`[data-rp-rail="${rail}"], .rp-unsupported-width__action`)
		?? [...root.querySelectorAll<HTMLElement>(`[data-rp-action="${action}"]`)].find(candidate => !hiddenRegion(candidate))
		?? [...root.querySelectorAll<HTMLElement>(`[data-rp-region="${region}"]`)].find(candidate => !hiddenRegion(candidate))
		?? root.querySelector<HTMLElement>(`[data-rp-strip="${region}"] [data-rp-panel-toggle]`);
	target?.focus();
}

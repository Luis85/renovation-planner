import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useDialogStore } from '../dialogs/dialog-store';
import { tr } from '../i18n/strings';

/** Per leaf; the form owns its values and registers only its abandonment action. */
export const useLibraryDraftGuard = defineStore('library-draft-guard', () => {
	const dirty = ref(false);
	const busy = ref(false);
	let discard: (() => void) | null = null;
	function register(action: (() => void) | null): void {
		discard = action;
		if (action === null) { dirty.value = false; busy.value = false; }
	}
	async function leave(action: () => void | Promise<void>): Promise<void> {
		const dialogs = useDialogStore();
		if (busy.value || dialogs.current !== null) return;
		if (dirty.value) {
			const answer = await dialogs.openDialog({
				kind: 'confirm', title: tr('view.asset-library.draft.title'),
				message: tr('view.asset-library.draft.leave'),
				confirmLabel: tr('view.asset-library.draft.discard-continue'),
				cancelLabel: tr('view.asset-library.draft.keep'),
			});
			if (answer !== 'confirm') return;
			discard?.();
		}
		await action();
	}
	return { dirty, busy, register, leave };
});

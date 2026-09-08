import { defineStore } from 'pinia';
import { nextTick, ref } from 'vue';
import { useDialogStore } from '../dialogs/dialog-store';
import { tr } from '../i18n/strings';

/** Per leaf; the form owns its values and registers its abandonment action, its baseline asset
 *  name and a refocus callback for a cancelled leave. */
export const useLibraryDraftGuard = defineStore('library-draft-guard', () => {
	const dirty = ref(false);
	const busy = ref(false);
	let draft: { discard: () => void; name: () => string; keep: () => void } | null = null;
	function register(registration: typeof draft): void {
		draft = registration;
		if (registration === null) { dirty.value = false; busy.value = false; }
	}
	async function leave(action: () => void | Promise<void>): Promise<void> {
		const dialogs = useDialogStore();
		if (busy.value || dialogs.current !== null) return;
		const pendingDraft = draft;
		if (dirty.value && pendingDraft !== null) {
			const answer = await dialogs.openDialog({
				kind: 'confirm', title: tr('view.asset-library.draft.title'),
				message: tr('view.asset-library.draft.leave', { name: pendingDraft.name() }),
				confirmLabel: tr('view.asset-library.draft.discard-continue'),
				cancelLabel: tr('view.asset-library.draft.keep'),
			});
			if (answer !== 'confirm') {
				// AL05: "Keep editing returns to the triggering field." DialogHost has already
				// restored focus to the control that opened the dialog (the row); the form's own
				// refocus runs after it, on the next tick, and wins.
				await nextTick();
				pendingDraft.keep();
				return;
			}
			pendingDraft.discard();
		}
		await action();
	}
	return { dirty, busy, register, leave };
});

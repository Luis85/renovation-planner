import type { useDialogStore } from '../../dialogs/dialog-store';
import { tr } from '../../i18n/strings';
import type { KnownDistanceSupplier } from '../tools/calibrate-tool';
import KnownDistanceForm from './KnownDistanceForm.vue';

/**
 * The `KnownDistanceSupplier` both calibrating surfaces bind — the Plan Editor's runtime and,
 * since Task B6, the asset designer's.
 *
 * A FUNCTION rather than fifteen lines written out twice: the two spellings were byte-identical
 * and `npm run analyze` reported them as a clone group the moment the second one existed. What
 * would drift is not the copy — the three keys are subject-neutral on purpose — but the
 * NARROWING below, which is the one line that decides whether an `unknown` reaches a command's
 * input.
 *
 * It takes the leaf's own store rather than calling `useDialogStore()` itself, because that is
 * the property both surfaces depend on: a calibration in one split pane must not trap the other,
 * and `DialogHost` is per view for exactly that reason.
 */
export function knownDistanceSupplier(
	dialogs: ReturnType<typeof useDialogStore>,
): KnownDistanceSupplier {
	return async (measured) => {
		const result = await dialogs.openDialog({
			kind: 'form',
			title: tr('editor.calibrate.distance.title'),
			component: KnownDistanceForm,
			props: { measured },
		});
		// `null` is this seam's word for "dismissed", and the tool refuses a non-number anyway —
		// but narrowing HERE keeps the `unknown` the form container deliberately carries from
		// reaching the command's input.
		if (result === 'cancel' || typeof result.values !== 'number') return null;
		return result.values;
	};
}

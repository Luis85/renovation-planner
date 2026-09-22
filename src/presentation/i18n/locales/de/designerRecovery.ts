import type { designerRecoveryEn } from '../en/designerRecovery';

/**
 * German half of W20-A's table; see the English file's header for why the notice's FIRST
 * sentence is not in this pair.
 *
 * „Objekt“, never „Material“ — the word every other line of the designer's section in `de.ts`
 * uses, including the `designer.refresh-failed` sentence this one follows.
 */
export const designerRecoveryDe: Record<keyof typeof designerRecoveryEn, string> = {
	'designer.refresh-failed.again':
		'Das erneute Lesen dieses Objekts ist wieder fehlgeschlagen; die Anzeige ist möglicherweise weiterhin nicht aktuell.',
	'designer.refresh-failed.retry': 'Erneut versuchen',
};

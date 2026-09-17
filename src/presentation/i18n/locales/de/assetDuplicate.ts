import type { assetDuplicateEn } from '../en/assetDuplicate';

/**
 * German counterpart of `en/assetDuplicate.ts`. **Sie throughout**, like every other German table here;
 * `strings.test.ts` asserts no du-form imperative anywhere in `de.ts`, and its verb list is
 * enumerated rather than exhaustive, so matching a neighbour is not evidence that a form is allowed.
 *
 * No string here is an imperative at all — every one is a label, a status line or a noun phrase —
 * so the register question does not arise in this table. Stated rather than left implicit, because
 * the next string added here is the one that will have to answer it.
 */
export const assetDuplicateDe: Record<keyof typeof assetDuplicateEn, string> = {
	'view.asset-library.used-in-plans': 'In Plänen verwendet',
	'view.asset-library.used-in-plans.loading': 'Wird geladen, welche Pläne dies platzieren …',
	'view.asset-library.used-in-plans.failed': 'Die Pläne, die dieses Objekt platzieren, konnten nicht gelesen werden, daher ist der Umfang unten unbekannt.',
	'view.asset-library.used-in-plans.none': 'Kein Plan platziert dieses Objekt',
	'view.asset-library.used-in-plans.plan': '{name} — {count} Platzierung(en)',
	'view.asset-library.used-in-plans.unreadable': '{count} Notiz(en) konnten nicht gelesen werden, daher ist diese Liste möglicherweise unvollständig',
	'view.asset-library.duplicate': 'Duplizieren',
	'view.asset-library.duplicate.title': 'Als neues Objekt duplizieren',
	'view.asset-library.duplicate.explains': 'Die Kopie ist eine neue Definition mit eigener Geometrie. Pläne, die dieses Objekt platzieren, behalten das Original.',
	'view.asset-library.duplicate.name': 'Name der Kopie',
	'view.asset-library.duplicate.suggested': '{name} (Kopie)',
	'view.asset-library.duplicate.confirm': 'Kopie erstellen',
	'view.asset-library.duplicate.cancel': 'Abbrechen',
};

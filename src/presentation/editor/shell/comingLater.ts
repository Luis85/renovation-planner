import { t } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import type { InspectorSection } from '../../read-models/roomOverview';

/**
 * Every section the Inspector cannot show yet, as one sentence (2026-09-12 side panels spec §3).
 * It replaced Task 16's two navigation lists, whose seven rows each said "Not available yet" and
 * took half a selected room's Inspector to say it. Pure and keyed on a language so both locales
 * are testable without the host's language.
 */
const LABELS: Readonly<Record<InspectorSection, StringKey>> = {
	existing: 'editor.inspector.question.existing',
	planned: 'editor.inspector.question.planned',
	work: 'editor.inspector.question.work',
	costs: 'editor.inspector.linked.costs',
	documents: 'editor.inspector.linked.documents',
	photos: 'editor.inspector.linked.photos',
	notes: 'editor.inspector.linked.notes',
};

export function comingLaterSentence(language: string, sections: readonly InspectorSection[]): string {
	if (sections.length === 0) return '';
	const labels = sections.map((section) => t(language, LABELS[section]));
	return t(language, 'editor.inspector.coming-later', { sections: new Intl.ListFormat(language, { type: 'unit' }).format(labels) });
}

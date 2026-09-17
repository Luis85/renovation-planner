import { tr } from '../../i18n/strings';
import { hasLocaleKey } from '../../i18n/toUserMessage';
import type { PartRow } from './partRows';

/**
 * A graphic's SEMANTIC name as words: its `designer.detail.<name>` translation where the
 * catalogue has one, and the stored name otherwise (symbols spec, Decision 8).
 *
 * Shared with `DesignerSelectionInspector`, which draws the same fallback in its Name field — two
 * copies of this three-line lookup is the clone family `npm run analyze` reports and the pair that
 * would drift the day a preset's key stops resolving.
 */
export function semanticLabel(name: string): string {
	const key = `designer.detail.${name}`;
	return hasLocaleKey(key) ? tr(key) : name;
}

/**
 * What one Parts row is CALLED.
 *
 * A graphic prefers the user's own `label` and falls back to its semantic name (C02: the label is
 * additive, and `name` stays the key presets and tests address). A group prefers its label and
 * falls back to the word Group. The shape's four special parts and the reference sheet are named
 * by their kind, reusing `designer.selection.*` rather than declaring a second set of words for
 * the same four things.
 */
export function rowName(row: PartRow): string {
	// `row.detail` is non-null on a graphic row BY TYPE (`GraphicRow`), so there is no null arm here
	// and no unreachable branch standing in for one.
	if (row.kind === 'detail') return row.detail.label ?? semanticLabel(row.detail.name);
	if (row.kind === 'group') return row.label ?? tr('designer.parts.group');
	if (row.kind === 'reference') return tr('designer.parts.reference');
	return tr(`designer.selection.${row.kind}`);
}

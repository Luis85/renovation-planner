/**
 * @vitest-environment node
 *
 * WCAG 2.5.3 label-in-name for every compact field row (AD18-R16 final-fix-wave, Important
 * item 1): `DesignerFieldRow` and `DesignerFieldRowShell` draw a short VISIBLE label beside the
 * input and carry the full sentence as the input's accessible name, so a screen-reader user's
 * spoken command ("click Rotate by") has to name something actually on the page — which fails
 * the moment the visible text is not a substring of the accessible name.
 *
 * `designerFieldRow.test.ts` pinned this for Width alone. This iterates every `*.short` key the
 * locale tables declare, in BOTH `en` and `de`, DERIVED from the tables rather than hand-listed —
 * a hand-list is exactly what let "Rotate by"/"Rotation to apply in degrees" and "Back"/"Behind"
 * ship unnoticed.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/presentation/i18n/strings';
import { en } from '../../../src/presentation/i18n/locales/en';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';

const SHORT_SUFFIX = '.short';

/** Every key this table declares whose name ends in the `.short` suffix every compact row's
 * `short` prop is passed. Derived rather than hand-listed, so a field added later is covered
 * without anybody remembering to add it here. */
const shortKeys = (Object.keys(en) as StringKey[]).filter((key) => key.endsWith(SHORT_SUFFIX));

/** The `.short` key's full-sentence partner, by the one naming convention every caller uses:
 * strip the suffix. */
const fullKeyOf = (shortKey: string): string => shortKey.slice(0, -SHORT_SUFFIX.length);

describe('every compact field row keeps its visible short label inside its accessible name (WCAG 2.5.3)', () => {
	it('found at least one `.short` key to check — an instrument that reaches nothing looks exactly like a clean tree', () => {
		expect(shortKeys.length).toBeGreaterThan(0);
	});

	it.each(shortKeys)('%s has a full-sentence partner in the same table', (shortKey) => {
		expect(fullKeyOf(shortKey) in en).toBe(true);
	});

	it.each(shortKeys)('%s nests in its full sentence, in English', (shortKey) => {
		const fullKey = fullKeyOf(shortKey) as StringKey;
		expect(t('en', fullKey).toLowerCase()).toContain(t('en', shortKey as StringKey).toLowerCase());
	});

	it.each(shortKeys)('%s nests in its full sentence, in German', (shortKey) => {
		const fullKey = fullKeyOf(shortKey) as StringKey;
		expect(t('de', fullKey).toLowerCase()).toContain(t('de', shortKey as StringKey).toLowerCase());
	});
});

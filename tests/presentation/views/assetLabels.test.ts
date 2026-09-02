/**
 * The other half of "impossible to add a category or a unit with no label":
 * `ASSET_CATEGORY_LABELS` and `MEASUREMENT_UNIT_LABELS` are each a `Record` over the full
 * union, so TypeScript already refuses to compile that file with a member missing — but the
 * type says nothing about whether the KEY it names resolves to real copy in the tables that
 * ship. That is the question the compiler cannot answer, and this is it.
 *
 * `projectStatusLabels.test.ts` states the same argument for the same shape one vocabulary
 * earlier; these two are read together deliberately.
 */
import { describe, expect, it } from 'vitest';
import { ASSET_CATEGORIES } from '../../../src/domain/asset/AssetCategory';
import { UNIT_KIND, type MeasurementUnit } from '../../../src/core/units/MeasurementUnit';
import {
	ASSET_CATEGORY_LABELS,
	MEASUREMENT_UNIT_LABELS,
} from '../../../src/presentation/views/assetLabels';
import { t } from '../../../src/presentation/i18n/strings';
import { de } from '../../../src/presentation/i18n/locales/de';

/**
 * Taken from `UNIT_KIND` rather than from the label table, so this asks about a set the
 * PRESENTATION layer does not own. Asking the label table would be asking it about itself —
 * every key it has would trivially have a label.
 */
const UNITS = Object.keys(UNIT_KIND) as MeasurementUnit[];

describe('ASSET_CATEGORY_LABELS', () => {
	it.each(ASSET_CATEGORIES)('gives %s a resolvable, non-empty English label', (category) => {
		const key = ASSET_CATEGORY_LABELS[category];

		expect(key).toBeDefined();
		expect(t('en', key)).not.toBe('');
	});

	/** The exact failure this table exists to close: a control showing `building-element`. */
	it.each(ASSET_CATEGORIES)('never renders %s as its own raw union member', (category) => {
		expect(t('en', ASSET_CATEGORY_LABELS[category])).not.toBe(category);
	});
});

describe('MEASUREMENT_UNIT_LABELS', () => {
	it.each(UNITS)('gives %s a resolvable, non-empty English label', (unit) => {
		const key = MEASUREMENT_UNIT_LABELS[unit];

		expect(key).toBeDefined();
		expect(t('en', key)).not.toBe('');
	});

	it.each(UNITS)('never renders %s as its own raw union member', (unit) => {
		expect(t('en', MEASUREMENT_UNIT_LABELS[unit])).not.toBe(unit);
	});
});

/**
 * **The German category label is where two rules meet, and the collision is the reason this
 * case exists rather than being left to the locale suite.**
 *
 * `strings.test.ts` refuses the substring `Material` ANYWHERE in `de.ts`, because slice 11
 * settled that the German UI calls an Asset `Objekt` and slice 14 reintroduced `Materialien`
 * forty lines below the comment recording that. The asset CATEGORY `material` is a genuinely
 * different noun from the entity — a building material, not a catalogue object — so the two
 * rules would collide if the obvious translation were used.
 *
 * `Baustoff` is what ships, and it is the better German for a building-material category on
 * its own merits. This case pins the pairing so that a future translator who "corrects" it
 * back to `Material` fails HERE, naming the reason, rather than in the locale suite's
 * forbidden-substring row, which would report only that some key somewhere says a banned
 * word.
 */
describe('the German category vocabulary', () => {
	it('calls the material category Baustoff, so Objekt stays the word for an Asset', () => {
		expect(de[ASSET_CATEGORY_LABELS.material]).toBe('Baustoff');
	});
});

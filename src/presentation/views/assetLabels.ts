import type { AssetCategory } from '../../domain/asset/AssetCategory';
import type { MeasurementUnit } from '../../core/units/MeasurementUnit';
import type { StringKey } from '../i18n/locales/en';

/**
 * One locale key per `AssetCategory` and per `MeasurementUnit`, so `NewAssetForm`'s two
 * select controls show real copy rather than the raw union member (`building-element`,
 * `m2`) — `PROJECT_STATUS_LABELS` states the whole argument and this is the same shape
 * applied to the two vocabularies an asset carries.
 *
 * A `Record` over each full union rather than a partial lookup: TypeScript refuses to
 * compile this file with a member missing, which is HALF of "impossible to add a category
 * with no label". The other half is `assetLabels.test.ts`, which asks whether the key each
 * entry names resolves to real copy in the shipped tables — the question this file's own
 * type cannot answer about `en.ts`/`de.ts`.
 *
 * **These two Records are also the ORDER the controls render in**, and that is deliberate
 * rather than incidental: neither vocabulary ships an ordered array (`ASSET_CATEGORIES`
 * exists, `MeasurementUnit` has no equivalent — only `UNIT_KIND`, a Record whose key order
 * is not a stated contract), so the form iterates these instead. A category added to the
 * domain union appears in the control the moment this file compiles again, which is the
 * point: there is no second list to remember.
 *
 * These are ordinary UI labels, not `AppError` codes — the "every key here must equal a
 * minted `AppError.code`" rule in `en.ts`'s error block does not apply to them.
 */
export const ASSET_CATEGORY_LABELS: Record<AssetCategory, StringKey> = {
	material: 'form.new-asset.category.material',
	furniture: 'form.new-asset.category.furniture',
	fixture: 'form.new-asset.category.fixture',
	plant: 'form.new-asset.category.plant',
	equipment: 'form.new-asset.category.equipment',
	'building-element': 'form.new-asset.category.building-element',
	custom: 'form.new-asset.category.custom',
};

export const MEASUREMENT_UNIT_LABELS: Record<MeasurementUnit, StringKey> = {
	piece: 'form.new-asset.unit.piece',
	m: 'form.new-asset.unit.m',
	m2: 'form.new-asset.unit.m2',
	m3: 'form.new-asset.unit.m3',
	hour: 'form.new-asset.unit.hour',
	day: 'form.new-asset.unit.day',
	fixed: 'form.new-asset.unit.fixed',
};

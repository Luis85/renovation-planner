import type { assetSymbolsEn } from '../en/assetSymbols';

export const assetSymbolsDe: Record<keyof typeof assetSymbolsEn, string> = {
	'asset.invalid-detail': 'Dieses Detail ist keine Form, die gespeichert werden kann.',
	'asset.degenerate-detail': 'Dieses Detail umschließt keine Fläche.',
	'asset.invalid-detail-id': 'Jedes Detail braucht eine eigene Kennung.',
	'asset.preset-value-out-of-range': 'Ein Wert liegt außerhalb dessen, was diese Vorlage erlaubt.',
	'asset.preset-incoherent': 'Diese Werte ergeben keine Form, die sich bauen lässt.',
};

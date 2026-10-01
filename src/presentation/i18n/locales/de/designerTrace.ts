import type { designerTraceEn } from '../en/designerTrace';

/** German half of W10-B's table. Created empty beside the English one; see that file's header. */
export const designerTraceDe: Record<keyof typeof designerTraceEn, string> = {
	'designer.trace': 'Schritte zum Nachzeichnen',
	// "Vorlage" because `de/assetReference.ts` already translates `designer.reference.sheet` that
	// way, and this step names that same document. It is NOT a new word: this table takes the
	// spelling the panel beside it uses rather than minting a second one.
	//
	// **The German word is already overloaded and this card does not resolve it.** `de/assetSymbols.ts`
	// and `de/assetEntryPaths.ts` translate the shape PRESET as "Vorlage" too — measured by
	// `grep -rn "Vorlage" src/presentation/i18n/locales/de/`, which prints both families. So German
	// has one word where English has "sheet" and "preset". Renaming either family is a change to
	// locale modules this card does not hold; it is reported rather than half-fixed here.
	'designer.trace.image': 'Vorlage wählen',
	'designer.trace.scale': 'Maßstab kalibrieren',
	'designer.trace.footprint': 'Umriss nachzeichnen',
	'designer.trace.details': 'Details hinzufügen',
	'designer.trace.dimensions': 'Maße prüfen',
	'designer.trace.done': 'Erledigt',
};

/**
 * One reading of a typed decimal for every numeric field the library owns (interaction rules
 * §5: "comma decimal separator accepted"). Trim, and when the text holds exactly one comma and
 * no dot, read the comma as the decimal separator. Anything else passes through trimmed, so
 * `1,000.5` and `1,2,3` still reach `Decimal` and are refused there as they were before —
 * this function decides nothing about validity, only about one glyph.
 */
export function normalizeDecimalInput(raw: string): string {
	const trimmed = raw.trim();
	const commas = trimmed.split(',').length - 1;
	if (commas === 1 && !trimmed.includes('.')) return trimmed.replace(',', '.');
	return trimmed;
}

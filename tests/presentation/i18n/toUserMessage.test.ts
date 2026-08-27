import { describe, expect, it } from 'vitest';
import { toUserMessage, trError } from '../../../src/presentation/i18n/toUserMessage';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import type { AppError, ErrorCategory } from '../../../src/core/errors/AppError';

/**
 * The message/log separation (SDD §66–68): what a user reads comes from the locale
 * tables, keyed by `error.code` — never from the error's own `message`, which is
 * developer English written at the raise site. The en/de case is what proves the text
 * really comes from the tables rather than from a literal that happens to read well.
 */

function error(partial: Partial<AppError>): AppError {
	return {
		category: 'Persistence',
		code: 'zone.save-failed',
		message: 'Internal: ENOSPC while writing /Users/x/Renovation/Zones/a.md',
		...partial,
	} as AppError;
}

describe('toUserMessage', () => {
	it('resolves a code the table knows through t()', () => {
		expect(toUserMessage('en', error({ code: 'vault.unexpected-failure' }))).toBe(
			'Reading or writing the vault failed unexpectedly. Try again.',
		);
	});

	it('falls back by suffix for a dynamic per-kind code', () => {
		const future = error({ category: 'Migration', code: 'zone.schema-version-unsupported' });
		expect(toUserMessage('en', future)).toContain('newer version of this plugin');
	});

	it('falls back per category when neither the code nor a suffix has an entry', () => {
		for (const category of [
			'Domain',
			'Validation',
			'Persistence',
			'Geometry',
			'Import',
			'Migration',
			'Reference',
			'Calculation',
		] as const) {
			const message = toUserMessage('en', error({ category, code: 'totally.unknown-code' }));
			expect(message.length).toBeGreaterThan(0);
			expect(message).not.toContain('ENOSPC');
		}
	});

	it('never returns the raw exception message, a stack fragment or a file path', () => {
		const leaky = error({
			category: 'Geometry',
			code: 'zone.self-intersecting',
			message: 'polygon self-intersects at (x=3, y=4): see tests/infrastructure/obsidian/repositories',
		});
		const message = toUserMessage('de', leaky);
		expect(message).not.toContain('self-intersect');
		expect(message).not.toContain('.ts');
		expect(message).not.toContain('/');
	});

	it('resolves different text per language, proving the copy comes from the locale tables', () => {
		const future = error({ category: 'Migration', code: 'plan.schema-version-unsupported' });
		const en = toUserMessage('en', future);
		const de = toUserMessage('de', future);
		expect(en).not.toBe(de);
		expect(de).toContain('neueren Version');
	});
});

/**
 * The binding nothing enforced: a locale key that does not EXACTLY equal a minted
 * `AppError.code`.
 *
 * `en` is a plain object literal and `StringKey = keyof typeof en`, so the compiler
 * accepts any key at all. A misspelt one is dutifully translated in `de.ts`, passes
 * `tests/presentation/i18n/strings.test.ts` (which only asks that `de` covers `en`),
 * and then never resolves — falling through to exactly the category sentence design
 * slice 11's Definition of Done item 3 exists to remove. Silent, and identical to the
 * defect this task was written to fix.
 *
 * The table below is the binding. It is copied from the RAISE SITES, not from the locale
 * file — a table derived from `en.ts` would agree with a typo — and each row names the
 * module that mints the code so the pairing is checkable by reading two files.
 *
 * Two assertions per row, because they fail for different reasons:
 *
 *   - the resolved copy IS the code's own entry, which is false the moment the key and
 *     the code differ by one character (`t` answers `undefined` for an unknown key, and
 *     `toUserMessage` then returns the category sentence);
 *   - the resolved copy is NOT the category sentence, in BOTH locales — the behavioural
 *     half, and the test under `en.ts`'s claim that each of these entries exists because
 *     the category sentence does not serve it.
 *
 * What this does NOT check, so the sentence is not read wider than it is: that a raise
 * site still mints the code the row names. Those are inline object literals, so there is
 * no symbol to import; a code renamed at its raise site leaves this green and the user
 * back on the category sentence. That is what the "and the module that mints it" column
 * is for — it is a pointer for a reader, not an instrument.
 */
const MINTED: ReadonlyArray<readonly [code: string, category: ErrorCategory, categoryKey: StringKey, mintedIn: string]> = [
	['reference.referents-exist', 'Reference', 'error.category.reference', 'application/reference/deleteResolution.ts'],
	['reference.set-changed', 'Reference', 'error.category.reference', 'application/reference/deleteResolution.ts'],
	['reference.resolution-required', 'Validation', 'error.category.validation', 'application/reference/deleteResolution.ts'],
	['reference.no-reassignment-target', 'Validation', 'error.category.validation', 'presentation/editor/deleteZoneFlow.ts'],
	['reference.self-reassign', 'Validation', 'error.category.validation', 'application/commands/zone/DeleteZone.ts'],
	['reference.cross-project-reassign', 'Validation', 'error.category.validation', 'application/commands/zone/DeleteZone.ts'],
	['requirement.unit-not-area', 'Validation', 'error.category.validation', 'application/commands/requirement/AssignAsset.ts'],
	['requirement.cross-project', 'Validation', 'error.category.validation', 'application/commands/requirement/AssignAsset.ts'],
	['requirement.negative-quantity', 'Domain', 'error.category.domain', 'application/commands/requirement/SetRequirementQuantityOverride.ts'],
];

describe("design slice 10's coded refusals", () => {
	it.each(MINTED)('%s resolves its own copy rather than the %s category sentence', (code, category, categoryKey) => {
		const refusal = error({ category, code });

		expect(toUserMessage('en', refusal)).toBe(t('en', code as StringKey));
		expect(toUserMessage('en', refusal)).not.toBe(t('en', categoryKey));
		expect(toUserMessage('de', refusal)).not.toBe(t('de', categoryKey));
	});
});

/**
 * `trError` is `tr` for the error path. The mock's `getLanguage()` answers 'en', so this pins
 * the DELEGATION — that it resolves the language through the one resolution point and maps
 * through `toUserMessage` — and the per-locale behaviour is already driven through
 * `toUserMessage` directly, per locale, above.
 */
describe('trError', () => {
	it('maps an error in the app language', () => {
		// `refusal`, not `error`: this file's own `error()` factory is in scope, and shadowing it
		// fails `no-shadow` under `oxlint --deny-warnings`. The name matches the sibling case above.
		const refusal = { category: 'Persistence', code: 'settings.unrecovered', message: 'dev' } as const;

		expect(trError(refusal)).toBe(toUserMessage('en', refusal));
	});
});

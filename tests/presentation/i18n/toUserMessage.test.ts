import { describe, expect, it } from 'vitest';
import { toUserMessage } from '../../../src/presentation/i18n/toUserMessage';
import type { AppError } from '../../../src/core/errors/AppError';

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

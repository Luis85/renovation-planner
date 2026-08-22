import { describe, expect, it } from 'vitest';
import { t } from '../../../src/presentation/i18n/strings';

/**
 * Pure lookups, asked of the function — no view, no mock, no language global. The
 * fallback cases are the contract that makes an incomplete locale safe to ship.
 */
describe('translating a string', () => {
	it('answers English', () => {
		expect(t('en', 'view.project.name')).toBe('Renovation project');
	});

	it('answers a translated locale', () => {
		expect(t('de', 'view.project.name')).toBe('Renovierungsprojekt');
		expect(t('de', 'command.open-project')).toBe('Renovierungsprojekt öffnen');
	});

	it('falls back to English for a language nothing translates', () => {
		expect(t('fr', 'view.project.name')).toBe('Renovation project');
	});
});

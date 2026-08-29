/**
 * The other half of "impossible to add a status with no label": `PROJECT_STATUS_LABELS`'s
 * own `Record<ProjectStatus, StringKey>` type already refuses to compile with a member
 * missing, but that type says nothing about whether the KEY it names actually resolves to
 * real copy in the locale tables that ship — this is the question TypeScript cannot answer.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_STATUSES } from '../../../src/domain/project/ProjectStatus';
import { PROJECT_STATUS_LABELS } from '../../../src/presentation/views/projectStatusLabels';
import { t } from '../../../src/presentation/i18n/strings';

describe('PROJECT_STATUS_LABELS', () => {
	it.each(PROJECT_STATUSES)('gives %s a resolvable, non-empty English label', (status) => {
		const key = PROJECT_STATUS_LABELS[status];

		expect(key).toBeDefined();
		expect(t('en', key)).not.toBe('');
	});

	/**
	 * The exact failure this task exists to close: a status control that shows the user
	 * `IDEA`/`AS_BUILT` instead of real copy. `t` falls back to English for an untranslated
	 * key, so a raw-enum regression would read here even if `de.ts` were forgotten.
	 */
	it.each(PROJECT_STATUSES)('never renders %s as its own raw code', (status) => {
		const key = PROJECT_STATUS_LABELS[status];

		expect(t('en', key)).not.toBe(status);
	});
});

import { describe, expect, it } from 'vitest';
import {
	AUTO_DISMISS_MS,
	MAX_VISIBLE_NOTICES,
	SEVERITY_LABEL_KEYS,
	type NoticeSeverity,
} from '../../../src/presentation/notices/severity';
import { en } from '../../../src/presentation/i18n/locales/en';

const SEVERITIES: NoticeSeverity[] = ['success', 'info', 'warning', 'error'];

describe('the notice severity vocabulary', () => {
	it('auto-dismisses the two severities with nothing to act on', () => {
		expect(AUTO_DISMISS_MS.success).toBe(4000);
		expect(AUTO_DISMISS_MS.info).toBe(6000);
	});

	it('keeps a warning up as long as an error, because both may need acting on', () => {
		expect(AUTO_DISMISS_MS.warning).toBeNull();
		expect(AUTO_DISMISS_MS.error).toBeNull();
	});

	it('shows three at once', () => {
		expect(MAX_VISIBLE_NOTICES).toBe(3);
	});

	it.each(SEVERITIES)('resolves a label for %s, so severity is never colour alone', (severity) => {
		expect(en[SEVERITY_LABEL_KEYS[severity]]).toBeTruthy();
	});
});

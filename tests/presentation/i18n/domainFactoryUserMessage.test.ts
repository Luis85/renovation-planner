import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toUserMessage } from '../../../src/presentation/i18n/toUserMessage';
import { t } from '../../../src/presentation/i18n/strings';
import type { AppError } from '../../../src/core/errors/AppError';

const DOMAIN_FACTORY_PATTERN = /(planError|assetError)\(\s*'([a-z][a-z-]*)'/gu;

function applicationReachableDomainCodes(): ReadonlySet<string> {
	const found = new Set<string>();
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name.endsWith('.ts'))
				for (const match of readFileSync(full, 'utf8').matchAll(DOMAIN_FACTORY_PATTERN)) {
					found.add(`${match[1] === 'planError' ? 'plan' : 'asset'}.${match[2]}`);
				}
		}
	};
	walk(join('src', 'application'));
	return found;
}

const error = (code: string): AppError => ({
	category: 'Validation', code, message: 'internal',
});

// The existing `toUserMessage` exclusion ledger documents both guards as unreachable through
// their forms, so their generic category sentence is deliberate rather than missing copy.
const GENERIC = new Set(['asset.unsupported-background', 'plan.unsupported-background']);

describe('application-reachable domain error factories', () => {
	it('keeps every discovered domain factory code out of the generic category message', () => {
		const codes = applicationReachableDomainCodes();
		expect(codes).toContain('plan.nothing-to-undo');
		expect(codes).toContain('plan.invalid-spatial-elements');
		expect(codes).toContain('asset.unsupported-background');
		for (const code of GENERIC) expect(codes).toContain(code);
		for (const code of codes) {
			if (GENERIC.has(code)) continue;
			expect(toUserMessage('en', error(code))).not.toBe(t('en', 'error.category.validation'));
		}
	});
});

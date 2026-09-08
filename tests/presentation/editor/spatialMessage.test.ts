import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { spatialMessage } from '../../../src/presentation/editor/structure/spatialMessage';
import { t } from '../../../src/presentation/i18n/strings';
import { toUserMessage } from '../../../src/presentation/i18n/toUserMessage';
import type { AppError } from '../../../src/core/errors/AppError';

/**
 * `spatialMessage` answers a DRAFT refusal (`spatial.numeric`, `spatial.pending`, ...) from its
 * own `editor.structure.error.*` table and hands every other code to `trError`. The codes that
 * take that second door are the connected-walls COMMANDS' refusals — `RoomBoundaryHistory`,
 * `StructureCommand` and `StructureEditForm.vue`'s catch — and each carries recovery guidance
 * ("reopen the floor", "your draft is retained") that the Persistence category sentence loses.
 * Derived from the raise sites rather than listed, so a seventh code arrives here red.
 */
function commandLevelSpatialCodes(): ReadonlySet<string> {
	const pattern = /persistenceError\(\s*'(spatial\.[a-z-]+)'/gu;
	const found = new Set<string>();
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (/\.(?:ts|vue)$/u.test(entry.name))
				for (const match of readFileSync(full, 'utf8').matchAll(pattern)) found.add(match[1]);
		}
	};
	walk(join('src', 'application', 'commands', 'spatial'));
	walk(join('src', 'presentation', 'editor', 'structure'));
	return found;
}

describe('spatialMessage', () => {
	it('answers every command-level spatial code with its own sentence in both locales', () => {
		const codes = commandLevelSpatialCodes();
		// An instrument that reaches nothing looks exactly like a clean tree.
		expect(codes.size).toBeGreaterThan(3);
		for (const code of codes) {
			const refusal = { category: 'Persistence', code, message: 'Internal: ENOSPC' } as AppError;
			expect(spatialMessage(refusal)).toBe(toUserMessage('en', refusal));
			expect(toUserMessage('en', refusal)).not.toBe(t('en', 'error.category.persistence'));
			expect(toUserMessage('de', refusal)).not.toBe(t('de', 'error.category.persistence'));
		}
	});
});

import { beforeAll, describe, expect, it } from 'vitest';
import { ESLINT_BOOT_MS, lintDetailed, warmUpEslint } from './eslint';

/**
 * One `beforeAll` for ESLint's boot AND for the first type-aware program build —
 * `warmUpEslint` resolves configuration only and never invokes the parser, so without the
 * second call the program build lands in whichever test body runs first, against vitest's
 * 5s default.
 */
beforeAll(async () => {
	await warmUpEslint();
	await lintDetailed('export const probe = 1;\n', 'src/core/identity/generateId.ts');
}, ESLINT_BOOT_MS);

const CORE = 'src/core/identity/generateId.ts';

describe('lintDetailed', () => {
	it('reports one diagnostic per planted import, each carrying its own line', async () => {
		const found = await lintDetailed(`import '../../domain';\nimport { ref } from 'vue';\n`, CORE);
		const restricted = found.filter((d) => d.ruleId === 'no-restricted-imports');

		expect(restricted.map((d) => d.line)).toEqual([1, 2]);
	});

	it('discriminates a silent spelling from a reporting one, which a rule-id array cannot', async () => {
		const found = await lintDetailed(`import '../../core/identity/generateId';\nimport { ref } from 'vue';\n`, CORE);
		const restricted = found.filter((d) => d.ruleId === 'no-restricted-imports');

		// Line 1 is `core` reaching itself — allowed. Only line 2 may report.
		expect(restricted.map((d) => d.line)).toEqual([2]);
	});

	it('names a parse failure rather than reporting an absent rule id', async () => {
		const found = await lintDetailed('export const broken = ;\n', CORE);

		expect(found.map((d) => d.ruleId)).toContain('PARSE_ERROR');
	});
});

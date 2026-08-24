import { describe, expect, it } from 'vitest';
import { observeFrontmatter, observeSidecar } from '../../../../src/infrastructure/obsidian/repositories/digest';

/**
 * What "external modification" MEANS, pinned: the note token covers plugin-owned
 * frontmatter keys ONLY (body prose and undeclared keys belong to the user); the sidecar
 * token covers the whole file (every key is plugin-owned and the type is openable).
 */
describe('observation tokens', () => {
	const base = {
		type: 'renovation-zone',
		'schema-version': 1,
		id: 'zone-x',
		revision: 2,
		name: 'Bathroom',
		status: 'planned',
		project: 'project-x',
		plan: 'plan-x',
		'zone-type': 'room',
	};

	it('is stable across key order and repeated minting', () => {
		const reordered = Object.fromEntries(Object.entries(base).toReversed());
		expect(observeFrontmatter(reordered)).toBe(observeFrontmatter(base));
	});

	it('ignores the note body and undeclared keys — they are outside the digest', () => {
		const withExtras = { ...base, unknownKey: 'mine', bodyProse: 'user content' };
		expect(observeFrontmatter(withExtras)).toBe(observeFrontmatter(base));
	});

	it('moves when an owned value changes', () => {
		expect(observeFrontmatter({ ...base, name: 'Bathroom ' })).not.toBe(observeFrontmatter(base));
	});

	it('covers the whole sidecar text, whitespace included', () => {
		const text = '{"schemaVersion":1,"planId":"plan-x","revision":1}';
		expect(observeSidecar(text)).toBe(observeSidecar(text));
		expect(observeSidecar(`${text}\n`)).not.toBe(observeSidecar(text));
	});
});

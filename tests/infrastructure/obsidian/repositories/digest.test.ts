import { describe, expect, it } from 'vitest';
import { observeFrontmatter, observeSidecar } from '../../../../src/infrastructure/obsidian/repositories/digest';
import { ProjectFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/projectFrontmatter';
import { PlanFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/planFrontmatter';
import { ZoneFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/zoneFrontmatter';
import { AssetFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/assetFrontmatter';
import { RequirementFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/requirementFrontmatter';

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

/**
 * WHAT THE PLUGIN OWNS IS THE SCHEMAS' ANSWER, NOT A SECOND LIST BESIDE THEM.
 *
 * `digest.ts` states the rule as a category — "ONLY the frontmatter keys this plugin owns
 * (the ones its schema declares)" — and then holds a hand-written `OWNED_KEYS` array that
 * nothing compared against a schema. Task 5a added `description`, `start` and
 * `target-completion` to `ProjectFrontmatterSchemaV1` and did not add them here, which
 * broke BOTH halves of that sentence at once: `writeOwnedFrontmatter`'s `Object.assign`
 * clobbers a user's hand-edited `description`, and `observeFrontmatter` — excluding it from
 * the token — cannot refuse the save that clobbers it. Latent only because
 * `CreateProjectCommand` (expectation `'absent'`) is the sole project save in the tree.
 *
 * So the expected set is DERIVED from the five `z.object` shapes rather than transcribed: a
 * hand-written second list is exactly how this drifted, and a hand-written third one in the
 * test would agree with the drift. Asked BEHAVIOURALLY rather than by exporting the array —
 * a key the digest ignores is one whose value can change without moving the token, which is
 * the property that actually matters and the one a user loses an edit to.
 */
describe('every schema-declared key is digested', () => {
	const declared = [
		...new Set(
			[
				ProjectFrontmatterSchemaV1,
				PlanFrontmatterSchemaV1,
				ZoneFrontmatterSchemaV1,
				AssetFrontmatterSchemaV1,
				RequirementFrontmatterSchemaV1,
			].flatMap((schema) => Object.keys(schema.shape)),
		),
	].toSorted();

	// Every declared key present with the same placeholder: the digest JSON-stringifies each
	// value, so the type never matters here — only whether the key is read at all.
	const frontmatter = Object.fromEntries(declared.map((key) => [key, 'seed']));

	it.each(declared)('moves the token when %s changes', (key) => {
		expect(observeFrontmatter({ ...frontmatter, [key]: 'changed' })).not.toBe(observeFrontmatter(frontmatter));
	});

	// The instrument's own guard: an empty or truncated derivation would make every case
	// above vacuous by having nothing to iterate.
	it('derives a key set large enough to be the real one', () => {
		expect(declared.length).toBeGreaterThan(30);
	});
});

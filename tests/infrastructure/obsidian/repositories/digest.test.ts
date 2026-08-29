import { describe, expect, it } from 'vitest';
import { observeFrontmatter, observeSidecar } from '../../../../src/infrastructure/obsidian/repositories/digest';
import { PROJECT_TYPE, ProjectFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/projectFrontmatter';
import { PLAN_TYPE, PlanFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/planFrontmatter';
import { ZONE_TYPE, ZoneFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/zoneFrontmatter';
import { ASSET_TYPE, AssetFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/assetFrontmatter';
import { REQUIREMENT_TYPE, RequirementFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/requirementFrontmatter';

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
 * WHAT THE PLUGIN OWNS IS THE SCHEMAS' ANSWER, NOT A SECOND LIST BESIDE THEM — AND IT IS
 * ONE KIND'S ANSWER, NOT THE UNION OF FIVE.
 *
 * `digest.ts` states the rule as a category — "ONLY the frontmatter keys this plugin owns
 * in a note of THAT KIND" — and held a hand-written array covering every kind at once,
 * which nothing compared against a schema. Both halves of that sentence were broken, one
 * after the other, and the second only became visible because the first was fixed:
 *
 * - Task 5a added `description`, `start` and `target-completion` to
 *   `ProjectFrontmatterSchemaV1` and did not add them to the array, so
 *   `writeOwnedFrontmatter`'s `Object.assign` clobbered a user's hand-edited `description`
 *   while the token — excluding it — could not refuse the save doing the clobbering.
 * - Adding them THERE then over-corrected in the other direction: the array was a union,
 *   so a ZONE note carrying a user's own `description` had it digested, and editing that
 *   property refused the zone's next save for a key no Zone schema declares and no Zone
 *   write ever touches. Pre-existing for an asset's `notes` on a plan note; slice 16 only
 *   widened it into keys a user is likely to have.
 *
 * So both directions are asked here, per kind, DERIVED from the five `z.object` shapes: a
 * hand-written second list is how this drifted, and a hand-written third one in the test
 * would agree with the drift. Asked BEHAVIOURALLY rather than by exporting the map — a key
 * the digest reads is one whose value cannot change without moving the token, and a key it
 * ignores is one whose value can, which is the property a user loses an edit to either way.
 */
describe("a note is digested against its own kind's schema", () => {
	const byType = [
		[PROJECT_TYPE, ProjectFrontmatterSchemaV1],
		[PLAN_TYPE, PlanFrontmatterSchemaV1],
		[ZONE_TYPE, ZoneFrontmatterSchemaV1],
		[ASSET_TYPE, AssetFrontmatterSchemaV1],
		[REQUIREMENT_TYPE, RequirementFrontmatterSchemaV1],
	] as const;

	const everyKey = [...new Set(byType.flatMap(([, schema]) => Object.keys(schema.shape)))].toSorted();

	// Every key ANY schema declares, present on every note under test with the same
	// placeholder — the digest JSON-stringifies each value, so the type never matters here,
	// only whether the key is read at all. `type` is overwritten per case, since that is the
	// field deciding which key set applies.
	const noteOf = (type: string): Record<string, unknown> => ({
		...Object.fromEntries(everyKey.map((key) => [key, 'seed'])),
		type,
	});

	const moves = (type: string, key: string): boolean =>
		observeFrontmatter({ ...noteOf(type), [key]: 'changed' }) !== observeFrontmatter(noteOf(type));

	for (const [type, schema] of byType) {
		const owned = Object.keys(schema.shape).toSorted();
		const foreign = everyKey.filter((key) => !owned.includes(key));

		describe(`a ${type} note`, () => {
			it.each(owned)('moves the token when its own %s changes', (key) => {
				expect(moves(type, key)).toBe(true);
			});

			it.each(foreign)("leaves the token alone when another kind's %s changes", (key) => {
				expect(moves(type, key)).toBe(false);
			});

			// The instrument's own guard, per kind: a truncated derivation would make the cases
			// above vacuous by having nothing to iterate, and an empty `foreign` set would make
			// the scoping half unasked for this kind.
			it('derives both key sets non-empty', () => {
				expect(owned.length).toBeGreaterThan(4);
				expect(foreign.length).toBeGreaterThan(0);
			});
		});
	}

	/**
 	 * The reported defect, spelled out rather than left implicit in the generated cases
 	 * above: a Zone note whose author added a `description` property of their own. It is a
 	 * project key, the Zone schema does not declare it, and slice 16's union digested it —
 	 * so editing it answered `zone.external-modification` on the next save.
 	 */
	it('leaves a zone note alone when a user edits their own description', () => {
		const zone = {
			type: ZONE_TYPE,
			'schema-version': 1,
			id: 'zone-x',
			revision: 2,
			name: 'Bathroom',
			status: 'planned',
			project: 'project-x',
			plan: 'plan-x',
			'zone-type': 'room',
		};
		expect(observeFrontmatter({ ...zone, description: 'mine' })).toBe(
			observeFrontmatter({ ...zone, description: 'edited after the zone was loaded' }),
		);
	});

	/**
 	 * The fallback, and why it is the WIDE one: a note whose `type` is not one of the five
 	 * is digested against every key any schema declares, so nothing this plugin might have
 	 * written can change under a conditional write that checked none of it.
 	 */
	it('falls back to every declared key when the type is not one of ours', () => {
		expect(moves('something-else', 'description')).toBe(true);
		expect(moves('something-else', 'zone-type')).toBe(true);
		expect(moves('something-else', 'unknownKey')).toBe(false);
	});
});

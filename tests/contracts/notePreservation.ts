import { expect } from 'vitest';
import type { EntityId } from '../../src/core/identity/EntityId';
import { parseFrontmatter, serializeFrontmatter, type RepositoryStack } from '../helpers/vault';

/**
 * Slice 11 DoD item 8, as ONE statement for every note-backed write path there is: a note
 * carrying frontmatter keys this version does not declare and a hand-authored body
 * survives a targeted property update unchanged in BOTH.
 *
 * `writeOwnedFrontmatter` is the mechanism — it merges through
 * `FileManager.processFrontMatter` rather than re-serializing the note — and
 * `observeFrontmatter` is the other half, digesting only the owned keys so neither edit
 * moves the observation token and refuses the next save. Both are single modules with many
 * callers, so the rule is written down once here and DRIVEN once per caller: the Project,
 * Plan, Zone, Asset and Requirement repositories' saves, plus
 * `ObsidianRequirementRepository.markStale`, which carries a `writeOwnedFrontmatter` call
 * of its own and is not an upsert, so no contract term over `save` would ever reach it.
 *
 * This lives beside `upsert.ts` rather than inside the five `*.contract.ts` files for one
 * reason: those suites run against the IN-MEMORY repositories too (slice 3), which have no
 * notes, no body and no undeclared keys at all. A contract term there could only be an
 * optional fixture hook the in-memory half declines — a shared helper that silently no-ops
 * for half its callers, which is the exact defect this task was written to remove. The
 * callers are therefore the note-backed suite alone
 * (`tests/infrastructure/obsidian/repositories/preservation.test.ts`), and each one proves
 * it ran: see `expectOwned` below.
 */
export interface TargetedUpdateCase {
	readonly stack: RepositoryStack;
	/** The entity whose note is edited out of band and then written through. */
	readonly id: EntityId<string>;
	/**
	 * The write under test, run AFTER the out-of-band edits and holding whatever
	 * expectation the caller read BEFORE them — so its success is itself the assertion
	 * that neither edit moved the observation token.
	 */
	write(): Promise<{ readonly ok: boolean; readonly error?: unknown }>;
	/**
	 * Owned frontmatter keys this write must have CHANGED, with their post-write values —
	 * the entity-specific proof that the call did something. Checked in both directions:
	 * every key must differ from what the note held before, and must equal this afterwards.
	 * A caller wiring a write that silently does nothing fails here rather than passing on
	 * the preservation assertions, which a no-op satisfies perfectly.
	 */
	readonly expectOwned: Readonly<Record<string, unknown>>;
}

const UNKNOWN_KEY = 'my-own-key';
const UNKNOWN_VALUE = 'kept by the user';
const BODY = '## My notes\n\nRetile before winter.\n';

function noteTextOf(stack: RepositoryStack, id: EntityId<string>): { path: string; text: string } {
	const path = stack.index.getPath(id);
	if (!path) throw new Error(`nothing indexed under ${id} — the case seeded no reachable note`);
	const text = stack.vault.entries.get(path);
	if (text === undefined) throw new Error(`no note at ${path}`);
	return { path, text };
}

/** Drives one note-backed write path against DoD item 8. See the header for the whole rule. */
export async function expectTargetedUpdatePreservesUserContent(testCase: TargetedUpdateCase): Promise<void> {
	const { stack, id } = testCase;
	const before = noteTextOf(stack, id);
	const parsedBefore = parseFrontmatter(before.text);

	// The instrument first: a note with no owned keys would pass every preservation
	// assertion below while proving nothing about a merge that never had anything to merge.
	expect(Object.keys(parsedBefore.frontmatter).length).toBeGreaterThan(0);
	const owned = Object.entries(testCase.expectOwned);
	expect(owned.length).toBeGreaterThan(0);
	for (const [key, value] of owned) {
		expect([key, parsedBefore.frontmatter[key]]).not.toEqual([key, value]);
	}

	// Both edits at once, out of band: a key no schema of this version declares, and prose
	// after the frontmatter block.
	parsedBefore.frontmatter[UNKNOWN_KEY] = UNKNOWN_VALUE;
	stack.vault.entries.set(before.path, `${serializeFrontmatter(parsedBefore.frontmatter)}${BODY}`);

	const result = await testCase.write();
	expect(result.ok, `the write refused: ${JSON.stringify(result.error)}`).toBe(true);

	const after = parseFrontmatter(noteTextOf(stack, id).text);
	expect(after.frontmatter[UNKNOWN_KEY]).toBe(UNKNOWN_VALUE);
	// Byte-for-byte, not "contains": SDD §87 rule 3 promises the user's prose back untouched.
	expect(after.body).toBe(BODY);
	for (const [key, value] of owned) expect([key, after.frontmatter[key]]).toEqual([key, value]);
}

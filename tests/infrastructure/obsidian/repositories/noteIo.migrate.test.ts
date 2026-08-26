import { describe, expect, it } from 'vitest';
import { migrateNote } from '../../../../src/infrastructure/obsidian/repositories/noteIo';
import { createVaultExceptionMapper } from '../../../../src/application/errors/exceptionMapper';
import { expectErr } from '../../../../tests/helpers/domain';
import type { MigrationRunner } from '../../../../src/infrastructure/persistence/migration/MigrationRunner';

/**
 * The migration read path's failure vocabulary, asked of the helper directly so every
 * arm is reachable without staging a vault: a runner refusal keeps its `Migration`
 * category, an unexpected (untagged) throw falls back to `Persistence`, and a
 * non-numeric version field refuses as `ValidationError` before the runner is touched.
 */
function runnerThat(behavior: () => never): MigrationRunner {
	return { migrateToLatest: behavior } as unknown as MigrationRunner;
}

describe('migrateNote', () => {
	it('keeps a tagged runner refusal a Migration error with its code', () => {
		const thrown = Object.assign(new Error('too new'), {
			code: 'zone.schema-version-unsupported',
			category: 'Migration' as const,
		});
		const result = migrateNote(runnerThat(() => {
			throw thrown;
		}), 'zone', { 'schema-version': 99 });
		const error = expectErr(result);
		expect(error.category).toBe('Migration');
		expect(error.code).toBe('zone.schema-version-unsupported');
	});

	/**
	 * The runner's own refusals are `Error`s, but a migration STEP is ordinary code and may
	 * throw anything — including a plain object carrying the tag. The category has to
	 * survive that, and the message falls back to `String(cause)` rather than to nothing:
	 * a `Migration` refusal flattened into `Persistence` tells the user their data is bad
	 * when the truth is that their build is too old.
	 */
	it('keeps the Migration category for a tagged throw that is not an Error', () => {
		const result = migrateNote(runnerThat(() => {
			throw { code: 'plan.schema-version-unsupported', category: 'Migration' };
		}), 'plan', { 'schema-version': 99 });
		const error = expectErr(result);
		expect(error.category).toBe('Migration');
		expect(error.code).toBe('plan.schema-version-unsupported');
		expect(error.message).toBe('[object Object]');
	});

	it('falls back to Persistence for a throw without the runner tag', () => {
		const result = migrateNote(runnerThat(() => {
			throw new TypeError('cannot read properties of undefined');
		}), 'plan', { 'schema-version': 1 });
		const error = expectErr(result);
		expect(error.category).toBe('Persistence');
		expect(error.code).toBe('plan.migration-failed');
		expect(error.cause).toBeInstanceOf(TypeError);
	});

	it('refuses a present but non-numeric version field as a ValidationError', () => {
		const result = migrateNote(runnerThat(() => {
			throw new Error('runner must never be reached');
		}), 'project', { 'schema-version': 'junk' });
		const error = expectErr(result);
		expect(error.category).toBe('Validation');
		expect(error.code).toBe('project.schema-version-malformed');
	});
});

describe('createVaultExceptionMapper', () => {
	const map = createVaultExceptionMapper('vault');

	it('uses an Error cause message verbatim', () => {
		const mapped = map(new Error('EACCES'));
		expect(mapped.category).toBe('Persistence');
		expect(mapped.code).toBe('vault.unexpected-failure');
		expect(mapped.message).toBe('EACCES');
		expect(mapped.cause).toBeInstanceOf(Error);
	});

	it('stringifies a non-Error throw instead of printing "undefined"', () => {
		const mapped = map('a string was thrown');
		expect(mapped.message).toBe('a string was thrown');
		expect(mapped.cause).toBe('a string was thrown');
	});
});

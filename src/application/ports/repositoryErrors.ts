import type { MigrationError, PersistenceError, ValidationError } from '../../core/errors/AppError';

/**
 * The error vocabulary of the repository ports, in one place so the same union isn't
 * re-spelled per method or per command.
 *
 * A LOAD runs the persisted document through schema-version gating before anything else
 * (SDD §44, §87 rule 7): a note written by a newer build refuses as a `MigrationError`,
 * scoped to that one entity (SDD §92 item 13), and a malformed version field refuses as
 * a `ValidationError`. A SAVE or DELETE can refuse with everything a load can — an
 * update reads current state first — plus the pre-write schema check's own
 * `ValidationError` refusals (SDD §87 rule 2). The two sets come out identical, which is
 * why this is one type and not a read/write pair that would drift.
 *
 * `MigrationError` arrived here with design slice 11: before it, a future
 * `schema-version` failed implicitly through a Zod literal mismatch and was reported
 * as a plain `PersistenceError`, which named the wrong defect — "your data is bad"
 * instead of "this build is too old".
 */
export type RepositoryError = PersistenceError | MigrationError | ValidationError;

import type { ValidationError } from '../../../core/errors/AppError';
import type { Expected, Loaded } from '../../../application/ports/versioning';
import { checkExpectedVersion } from '../../obsidian/repositories/versionCheck';

/**
 * The ONE comparison behind every in-memory mutating method — "every write is
 * conditional", and a second copy of the compare would be a second chance to get it
 * wrong. That is exactly why this DELEGATES rather than reimplements: an earlier version
 * held its own copy of revision-then-token, identical to `checkExpectedVersion` line for
 * line, which is two places for one rule to be corrected in.
 *
 * All that is left here is the difference in what each side has to hand — a `Loaded` on
 * this side, a bare `EntityVersion` on the repositories' — so this unwraps and asks.
 * `versionCheck` lives beside the Obsidian repositories because they were its first
 * callers, and it names nothing from `obsidian`; the same direction `persistence/index/`
 * already takes for `digest` and `paths`.
 */
export function checkExpected(
	entity: string,
	id: string,
	current: Loaded<unknown> | undefined,
	expected: Expected,
): ValidationError | null {
	return checkExpectedVersion(entity, id, current?.version, expected);
}

import type { AppError } from '../../core/errors/AppError';
import type { EntityId } from '../../core/identity/EntityId';
import type { DiagnosticEntityKind, DiagnosticsLedger, ValidationIssue } from '../../application/ports/diagnostics';

/**
 * The in-memory diagnostics ledger (SDD §68): where read-path refusals accumulate so
 * the snapshot query can report them. Deliberately NOT a file — diagnostics are
 * computed on demand, describe this session, and are persisted nowhere.
 *
 * Two guards keep it an honest "what is wrong right now" rather than a noisy log:
 * - **Duplicates collapse.** The Plan Editor re-hydrates on every committed command, so
 *   one broken plan would otherwise refill the whole cap with copies of itself and
 *   evict every other entity's issue. The FIRST record of a triple wins; a later read
 *   of the same broken entity adds nothing.
 * - **The cap bounds growth** across many distinct broken notes; the oldest entries
 *   fall off, which is honest for a surface whose purpose is the present state rather
 *   than an audit log.
 */
const MAX_ISSUES = 200;

function keyOf(issue: ValidationIssue): string {
	return `${issue.entityType}\u0000${issue.entityId}\u0000${issue.issue}`;
}

export class InMemoryDiagnosticsLedger implements DiagnosticsLedger {
	private readonly recorded: ValidationIssue[] = [];
	private readonly seen = new Set<string>();

	/**
	 * The one place a `ValidationIssue` is CONSTRUCTED, which is what makes the port's
	 * no-content guarantee structural rather than a convention. `error.code` is taken and
	 * the rest of the error is dropped on the floor: `message` is prose that quotes what it
	 * read (`migrateNote` interpolates the frontmatter value it refused) and `cause` is
	 * whatever was thrown, so both are exactly the content diagnostics may not hold. A
	 * caller handing the whole error over cannot choose which half survives.
	 */
	record(entityType: DiagnosticEntityKind, entityId: EntityId<string>, error: AppError): void {
		const issue: ValidationIssue = { entityType, entityId, issue: error.code };
		const key = keyOf(issue);
		if (this.seen.has(key)) return;
		this.seen.add(key);
		this.recorded.push(issue);
		if (this.recorded.length > MAX_ISSUES) {
			// Splice(0, 1) on an over-cap array is non-empty by construction, so this is
			// the evicted entry — no defensive undefined arm for coverage to chase.
			const evicted = this.recorded.splice(0, 1)[0];
			this.seen.delete(keyOf(evicted));
		}
	}

	issues(): readonly ValidationIssue[] {
		return [...this.recorded];
	}
}

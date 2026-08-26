import { isErr } from '../../../core/result/Result';
import type { EventBus } from '../../../core/events/EventBus';
import type { Logger } from '../../ports/Logger';
import type { Loaded } from '../../ports/versioning';
import type { Requirement } from '../../../domain/requirement/Requirement';
import { requirementInvalidated } from '../../../domain/requirement/Requirement.events';
import type { RequirementRepository } from '../../ports/RequirementRepository';

/** What the handlers need; the repositories stay ports, never concrete classes. */
export interface CascadeDeps {
	readonly requirements: RequirementRepository;
	readonly events: EventBus;
	readonly logger: Logger;
	recalculate(input: { readonly requirementId: string }): Promise<unknown>;
	/**
	 * Slice 13's toast surface, injected so slice 17 decides presentation. A failed LIST
	 * is loud WITHOUT a durable marker (there is no requirement to hang one on — this is
	 * the one branch that has to be noisy), and a failed MARKER write is loud too,
	 * because the durable fact that would justify staying quiet about a background
	 * failure is exactly the write that did not land.
	 */
	readonly notify?: {
		cascadeAborted(targetId: string): void;
		staleMarkerFailed(requirementId: string): void;
	};
}

/**
 * The bound-concurrency limit over the disk and Obsidian's adapter — small on purpose.
 * Five hundred simultaneous writes is a worse answer than sequential, not a better one.
 */
const CASCADE_CONCURRENCY = 4;

/**
 * The per-requirement half of the cascade: markStale FIRST (the durable fact, persisted
 * before any attempt at better numbers), then the invalidation notification, then the
 * recalculation whose own success clears the marker. Per-requirement failure isolation:
 * either failure skips ITS OWN remaining work and nothing else's; neither aborts the
 * cascade.
 */
async function recalculateOne(deps: CascadeDeps, requirementId: string): Promise<void> {
	const stale = await deps.requirements.markStale(requirementId as never);
	if (isErr(stale)) {
		deps.logger.error('requirement.stale-marker.failed', {
			requirementId,
			cause: stale.error,
		});
		deps.notify?.staleMarkerFailed(requirementId);
		return;
	}
	await deps.events.publish(requirementInvalidated(requirementId as never));
	// `recalculate` stays a `Promise<unknown>` port (the handler must not depend on the
	// command's own module), so both the flag and the cause are read through one narrowing
	// rather than two. `error` is optional in that shape because `unknown` cannot promise
	// it; a `Result` that refused always carries one.
	const result = (await deps.recalculate({ requirementId })) as {
		readonly ok: boolean;
		readonly error?: unknown;
	};
	if (!result.ok) {
		// No event fires for this failure — RequirementRecalculated would misrepresent
		// what happened. The persisted status stays "stale", which the Inspector renders.
		//
		// The CAUSE travels, exactly as the stale-marker branch above passes `stale.error`.
		// Slice 11's rule is that every mapped `AppError` is logged with the original that
		// produced it; without it, the single line a developer ever reads about a failed
		// background recalculation named the requirement and never said why.
		deps.logger.error('requirement.recalculation.failed', {
			requirementId,
			cause: result.error,
		});
	}
}

/**
 * Runs the pairs with BOUNDED concurrency. The ordering that matters is WITHIN a pair
 * (markStale before its own recalculation), never BETWEEN pairs; each requirement holds
 * its own level-2 lock inside the writes, so two pairs cannot contend or observe each
 * other.
 */
export async function runRecalculationCascade(
	deps: CascadeDeps,
	targets: readonly Loaded<Requirement>[],
): Promise<void> {
	let cursor = 0;
	async function worker(): Promise<void> {
		while (cursor < targets.length) {
			const requirement = targets[cursor];
			cursor += 1;
			await recalculateOne(deps, String(requirement.entity.id));
		}
	}
	const workers = Array.from(
		{ length: Math.min(CASCADE_CONCURRENCY, targets.length) },
		() => worker(),
	);
	await Promise.all(workers);
}

import { ref, type Ref } from 'vue';
import { isErr, type Result } from '../../core/result/Result';

/** How far one section of the inspector got. Per SECTION, never one status shared by two. */
export type SectionStatus = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * One asynchronous section, and the generation that decides whether an answer still belongs to
 * it — the design spec's §5.5 "one generation per read KIND", made an OBJECT so that a kind and
 * its ticket cannot be separated.
 *
 * That is the whole reason this is a type rather than two counters in a store. §5.5 records two
 * spellings that each broke a different half, and both are spellings a pair of loose counters
 * invites: one counter for every read strands the section holding the older ticket **loading
 * for ever**, and one counter per selection cycle over-restarts a vault-wide scan for a
 * geometry edit. A section that owns its own generation can be given a second reader without
 * anyone deciding which counter it shares.
 *
 * A result whose ticket is no longer current is DROPPED — successes and failures alike, which
 * is the half that reads as over-caution and is not: a late failure paints §3.5's refusal state
 * over a selection that read perfectly well.
 */
export interface TicketedSection<T, E> {
	readonly value: Ref<T>;
	readonly status: Ref<SectionStatus>;
	readonly error: Ref<E | null>;
	/**
	 * Take a fresh ticket and run. The read is a THUNK rather than a promise so that the ticket
	 * is taken before the work starts — handed a promise, this would be ticketing a read that
	 * was already out.
	 */
	run(read: () => Promise<Result<T, E>>): Promise<void>;
	/** Back to `idle`, holding nothing — and ticketed, so a read still out cannot repopulate it. */
	clear(): void;
}

export function createTicketedSection<T, E>(empty: T): TicketedSection<T, E> {
	const value = ref(empty) as Ref<T>;
	const status = ref<SectionStatus>('idle');
	const error = ref<E | null>(null) as Ref<E | null>;
	let generation = 0;

	async function run(read: () => Promise<Result<T, E>>): Promise<void> {
		const ticket = ++generation;
		// **`'loading'` only when there is nothing to draw** — the guard
		// `RenovationProjectStore.hydrate` states for the identical reason, met here at the
		// section rather than at the view. A §5.4 REFRESH re-reads a section that already holds
		// an answer, and flipping it to `loading` for the tick that read is out is precisely the
		// harm §5.5 names against the per-selection-cycle spelling: *Used in* flapping back into
		// loading and disabling `Delete` while somebody works next door. A selection CHANGE gets
		// its blank moment from `clear()` instead, which its caller runs first — a truer answer
		// than one asset's figures held under another asset's name.
		if (status.value !== 'ready') status.value = 'loading';
		error.value = null;

		const answered = await read();
		if (ticket !== generation) return;
		if (isErr(answered)) {
			// The section holds NOTHING behind a failure, which is `ProjectStore.fail`'s rule met
			// one layer up: data beside a message saying it could not be read is the worse of the
			// two wrong answers.
			value.value = empty;
			error.value = answered.error;
			status.value = 'failed';
			return;
		}
		value.value = answered.value;
		status.value = 'ready';
	}

	function clear(): void {
		generation += 1;
		value.value = empty;
		error.value = null;
		status.value = 'idle';
	}

	return { value, status, error, run, clear };
}

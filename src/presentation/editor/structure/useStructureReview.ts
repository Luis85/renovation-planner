import { computed, nextTick, onBeforeUnmount, ref, useId, type ComputedRef, type Ref } from 'vue';
import type { Structure } from '../../../domain/spatial/Structure';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { AppError } from '../../../core/errors/AppError';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import { persistenceError } from '../../../application/errors';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';

export interface StructureReviewProps {
	readonly structure: Structure;
	readonly busy: Ref<boolean>;
	readonly blocked: Readonly<Ref<boolean>>;
	readonly dispatch: (structure: Structure) => Promise<DispatchResult>;
	readonly preview: (structure: Structure | null) => void;
}

/**
 * The reviewed structural write both measurement dialogs share: an unparsable draft focuses its
 * field, an invalid structure names the refusal, the first valid submit previews and the second
 * dispatches. `invalidTarget` names the control an unparsable draft focuses when it is not a text
 * field marked invalid.
 */
export function useStructureReview(props: StructureReviewProps, proposal: ComputedRef<Structure | null>, done: () => void, invalidTarget = () => '[aria-invalid="true"]') {
	const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus(), errorId = useId(), numericId = useId();
	const error = ref<AppError | null>(null), invalid = ref(false), reviewed = ref(false), conflict = ref(false), submitting = ref(false);
	useDialogFormBusy(submitting, props.busy);
	let alive = true;
	onBeforeUnmount(() => { alive = false; props.preview(null); });
	const changed = computed(() => JSON.stringify(proposal.value) !== JSON.stringify(props.structure));
	const paused = computed(() => props.busy.value || props.blocked.value);
	const unavailable = computed(() => paused.value || conflict.value || !changed.value);
	const describedBy = computed(() => invalid.value ? numericId : error.value ? errorId : undefined);
	function edited(): void { reviewed.value = false; props.preview(null); }
	async function submit(): Promise<void> {
		if (unavailable.value) return;
		invalid.value = proposal.value === null;
		if (!proposal.value) {
			await nextTick(); formEl.value?.querySelector<HTMLElement>(invalidTarget())?.focus();
			return;
		}
		const valid = validateStructure(proposal.value, props.structure.boundaries.map(boundary => boundary.roomId));
		if (!valid.ok) { error.value = valid.error; await focusFirstInvalidControl(); return; }
		if (!reviewed.value) { reviewed.value = true; props.preview(proposal.value); return; }
		submitting.value = true;
		try {
			const result = await props.dispatch(proposal.value);
			if (!alive) return;
			if (result.ok) done();
			else { error.value = result.error; conflict.value = WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(code)) || result.error.code === 'undo.superseded'; }
		} catch (cause) { if (alive) error.value = persistenceError('spatial.write-failed', 'The spatial edit failed.', cause); }
		finally { submitting.value = false; }
	}
	return { formEl, errorId, numericId, error, invalid, reviewed, conflict, paused, unavailable, describedBy, edited, submit };
}

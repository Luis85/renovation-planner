import { computed, ref } from 'vue';
import type { Loaded } from '../../../application/ports/versioning';
import type { Logger } from '../../../application/ports/Logger';
import type { Zone } from '../../../domain/zone/Zone';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { RoomEditControls } from '../roomEditLifecycle';
import { useFormCommit } from '../../composables/use-form-commit';
import { trError } from '../../i18n/toUserMessage';
import { tr } from '../../i18n/strings';
import { dimensionProposal, dimensionTexts, type DimensionsText } from './roomDimensions';

/** A native scalar field preserves the other dimension and the original versioned polygon. */
export function createRoomDimensionDraft(baseline: Loaded<Zone>, controls: RoomEditControls,
	options: { axis: keyof DimensionsText; box: BoundingBox; logger: Logger; finish(): void; preview(polygon: Polygon | null): void }) {
	const { entity, version } = baseline, attempted = ref(false);
	const form = useFormCommit({ initial: dimensionTexts(options.box), logger: options.logger, errorMap: {}, toUserMessage: trError,
		dispatch: (text: DimensionsText) => controls.commit({ kind: 'geometry', zoneId: entity.id,
			forward: dimensionProposal(entity.geometry.points, options.box, text).polygon as Polygon, inverse: entity.geometry, expected: version }) });
	const proposal = computed(() => dimensionProposal(entity.geometry.points, options.box, form.values.value));
	const blocked = computed(() => controls.blocked.value || form.submitting.value || !controls.current.value || controls.latest.value !== null);
	const error = computed(() => {
		if (!attempted.value || proposal.value.polygon !== null) return null;
		const reason = proposal.value.errors[options.axis];
		if (reason === null) return tr('editor.resize.invalid');
		return tr(reason === 'not-positive' ? 'editor.room.error.not-positive' : reason === 'too-large' ? 'editor.room.error.too-large' : 'editor.room.error.not-a-number');
	});
	function input(value: string): void {
		if (blocked.value) return;
		form.setField(options.axis, value);
		options.preview(proposal.value.polygon);
	}
	async function submit(): Promise<void> {
		if (blocked.value) return;
		attempted.value = true;
		if (proposal.value.polygon === null) return;
		if (JSON.stringify(proposal.value.polygon.points) === JSON.stringify(entity.geometry.points)) { options.finish(); return; }
		controls.busy.value = true;
		try { if (await form.submit() && controls.current.value) options.finish(); }
		finally { controls.busy.value = false; }
	}
	return { id: entity.id, name: entity.name, axis: options.axis, box: options.box, form, controls, blocked, error, input, submit };
}
export type RoomDimensionDraft = ReturnType<typeof createRoomDimensionDraft>;

import { defineStore } from 'pinia';
import { shallowRef } from 'vue';
import type { AssetShape } from '../../domain/asset/AssetShape';
import type { AssetShapeAnswer } from '../read-models/assetShapes';

/** The shapes of the assets this leaf's placements name; `null` from `answerFor` means not read yet. */
export const useAssetShapeStore = defineStore('asset-shapes', () => {
	const answers = shallowRef<ReadonlyMap<string, AssetShapeAnswer>>(new Map());
	function set(next: ReadonlyMap<string, AssetShapeAnswer>): void { answers.value = next; }
	function answerFor(assetId: string): AssetShapeAnswer | null { return answers.value.get(assetId) ?? null; }
	function shapeOf(assetId: string): AssetShape | null {
		const answer = answers.value.get(assetId);
		return answer?.kind === 'placeable' ? answer.shape : null;
	}
	return { answers, set, answerFor, shapeOf };
});

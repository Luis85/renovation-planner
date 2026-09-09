<script setup lang="ts">
/**
 * AL03: "A similar name is a hint linking to existing results, not an automatic merge." One
 * sentence and one door; the match itself is the CALLER's (`findExisting`), so this draws
 * whatever it was handed and decides nothing. `role="status"` because it appears while the
 * user types and must be announced without stealing focus.
 */
import type { AssetId } from '../../domain/asset/AssetId';
import { tr } from '../i18n/strings';

defineProps<{ existing: { readonly assetId: AssetId; readonly name: string } }>();
const emit = defineEmits<{ show: [assetId: AssetId] }>();
</script>

<template>
	<p
		class="rp-similar-name"
		role="status"
	>
		{{ tr('form.new-asset.similar.exists', { name: existing.name }) }}
		<button
			type="button"
			@click="emit('show', existing.assetId)"
		>
			{{ tr('form.new-asset.similar.show') }}
		</button>
	</p>
</template>

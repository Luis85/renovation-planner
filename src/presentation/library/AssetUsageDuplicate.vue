<script setup lang="ts">
/**
 * **Duplicate as new asset** — the name of the copy, one sentence about what a copy is, and the
 * two doors out (AD13 item 4, C11).
 *
 * **Drawn only while the user has asked for it** (`AssetInspector`'s own `v-if`), which is the
 * whole of its cancel semantics: `Cancel` emits and the panel stops existing, having dispatched
 * nothing. AD13 criterion 4's *"no asset ID, reference or quantity link points to an orphan
 * after cancel"* is true here by construction rather than by cleanup — there is nothing to
 * clean up, because no command was reached.
 *
 * **The impact scope is drawn INSIDE this panel** (`AssetUsageScope`), which is AD13 item 3's
 * *"before impactful changes"* read literally: the plan list answers *which plans place this
 * definition, and will therefore keep the original once you diverge*, which is a question about
 * a duplicate rather than about a price edit. The always-on alternative was considered and
 * refused on two counts — it would run a vault-wide walk of every plan note and sidecar on every
 * SELECTION, for a question nobody had asked, and the scope an ordinary field edit needs is the
 * REQUIREMENT one `AssetInspectorUsedIn` already draws above, since a name or a price reaches
 * requirements and touches no geometry.
 *
 * **No `:disabled` on the submit, and the name field is PREFILLED so it is never empty by
 * default.** An emptied name reaches `Asset.create` and comes back as a refusal this panel
 * renders, which tells the user what is wrong; a dead button tells them nothing. Re-entry is
 * guarded by `busy` in the handler rather than by the attribute, because what must not happen
 * twice is the DISPATCH, and a guard on the attribute alone would still let a keyboard repeat
 * through.
 *
 * **It does not select the copy.** The new row reaches the catalogue through the existing
 * `AssetCreated` → `onLibraryChanged` → hydrate path, and selecting an id before that refresh
 * lands would resolve against a listing that has never seen it and draw the panel's *asset is
 * gone* state over a duplicate that worked.
 */
import { ref, useId } from 'vue';
import type { AppError } from '../../core/errors/AppError';
import { isErr } from '../../core/result/Result';
import type { AssetId } from '../../domain/asset/AssetId';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { useAssetLibraryContext } from './AssetLibraryContext';
import AssetUsageScope from './AssetUsageScope.vue';

const props = defineProps<{
	assetId: AssetId;
	/**
	 * The source definition's own name, for the prefill. REQUIRED and not defaulted: the only
	 * default available is the empty string, which would silently offer *" (copy)"* as a name
	 * for a vault note if the root ever stopped binding it — the invisible-permissive-default
	 * defect this expansion has already shipped once.
	 */
	sourceName: string;
}>();

const emit = defineEmits<{ cancel: []; duplicated: [] }>();

const context = useAssetLibraryContext();
const nameId = useId();
const name = ref(tr('view.asset-library.duplicate.suggested', { name: props.sourceName }));
const failure = ref<AppError | null>(null);
const busy = ref(false);

async function create(): Promise<void> {
	if (busy.value) return;
	busy.value = true;
	failure.value = null;
	try {
		const answered = await context.commands.duplicateAsset.execute({
			assetId: props.assetId,
			name: name.value,
		});
		if (isErr(answered)) {
			failure.value = answered.error;
			return;
		}
		emit('duplicated');
	} finally {
		busy.value = false;
	}
}
</script>

<template>
	<form
		class="rp-al-definition"
		@submit.prevent="void create()"
	>
		<h4 class="rp-al-inspector__title">
			{{ tr('view.asset-library.duplicate.title') }}
		</h4>
		<p class="rp-al-note">
			{{ tr('view.asset-library.duplicate.explains') }}
		</p>
		<AssetUsageScope :asset-id="assetId" />
		<dl class="rp-al-fields">
			<dt class="rp-al-fields__key">
				<label :for="nameId">{{ tr('view.asset-library.duplicate.name') }}</label>
			</dt>
			<dd class="rp-al-fields__value">
				<input
					:id="nameId"
					v-model="name"
					type="text"
					class="rp-al-fields__input"
					data-field="duplicate-name"
				>
			</dd>
		</dl>
		<p
			v-if="failure !== null"
			class="rp-al-inspector__refusal"
			role="alert"
		>
			{{ trError(failure) }}
		</p>
		<div class="rp-al-draft-actions">
			<button
				type="submit"
				data-action="duplicate-confirm"
			>
				{{ tr('view.asset-library.duplicate.confirm') }}
			</button>
			<button
				type="button"
				data-action="duplicate-cancel"
				@click="emit('cancel')"
			>
				{{ tr('view.asset-library.duplicate.cancel') }}
			</button>
		</div>
	</form>
</template>

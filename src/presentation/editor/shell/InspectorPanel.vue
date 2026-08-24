<script setup lang="ts">
/**
 * §60's inspector region. Empty: the Inspector's query pipeline and its behaviour are
 * §59, which is slice 6's, and there is nothing selectable in this slice to inspect.
 *
 * Here for the same reason the toolbar is — the five regions are the layout contract, and
 * a panel that appeared later would resize everything beside it on the day it did.
 */
import { tr } from '../../i18n/strings';
</script>

<template>
	<aside
		class="rp-editor-inspector"
		:aria-label="tr('editor.inspector')"
	>
		<h2 class="rp-editor-panel-title">
			{{ tr('editor.inspector') }}
		</h2>
	</aside>
</template>

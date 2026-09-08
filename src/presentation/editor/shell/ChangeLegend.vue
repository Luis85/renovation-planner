<script setup lang="ts">
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
</script>

<template>
	<div
		class="rp-change-legend"
		role="group"
		:aria-label="tr('editor.shell.legend')"
	>
		<div><span class="rp-change-legend__stroke" />{{ tr('editor.shell.existing-wall') }}</div>
		<div><span class="rp-change-legend__stroke rp-change-legend__stroke--removed" />{{ tr('editor.shell.removed-wall') }}<HostIcon name="circle-minus" /></div>
		<div><span class="rp-change-legend__stroke rp-change-legend__stroke--new" />{{ tr('editor.shell.new-wall') }}<HostIcon name="circle-plus" /></div>
	</div>
</template>

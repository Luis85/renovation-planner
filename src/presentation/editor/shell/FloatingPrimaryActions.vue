<script setup lang="ts">
/**
 * Select and Add, floating over the canvas (M01, component library §6). Select is the safe
 * state and says so with `aria-pressed`; Add opens Task 17's menu through the ONE `openAdd`
 * event — the menu is the root's to own, because it has to close on Escape before the canvas
 * hears the key.
 *
 * Add is live now: `aria-haspopup="menu"` names what pressing it does, and `aria-expanded`
 * (the `addOpen` prop, bound to `PlanEditorRoot`'s own `addMenuOpen`) says whether it is
 * currently open — both were withheld through Task 13, when this button opened nothing and
 * either attribute would have promised a menu that never arrived, exactly what slice 14's
 * live-control-that-does-nothing amendment refuses.
 */
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import { computed } from 'vue';
import HostIcon from '../../components/HostIcon.vue';

const runtime = useEditorRuntime();
const canSwitch = computed(() => runtime.activeToolId.value === null || runtime.toolManager.canDeactivateActiveTool());
const props = defineProps<{ addOpen: boolean }>();
const emit = defineEmits<{ openAdd: [] }>();
</script>

<template>
	<div
		class="rp-primary-actions"
		role="group"
		:aria-label="tr('editor.primary-actions')"
	>
		<button
			type="button"
			class="rp-primary-actions__button"
			data-rp-action="select"
			:aria-pressed="runtime.activeToolId.value === 'select'"
			:aria-disabled="!canSwitch"
			@click="runtime.setTool('select')"
		>
			<HostIcon name="mouse-pointer-2" />{{ tr('editor.primary.select') }}
		</button>
		<button
			type="button"
			class="rp-primary-actions__button"
			data-rp-action="add"
			aria-haspopup="menu"
			:aria-expanded="props.addOpen"
			:aria-disabled="!canSwitch"
			@click="canSwitch && emit('openAdd')"
		>
			<HostIcon name="plus" />{{ tr('editor.primary.add') }}
		</button>
	</div>
</template>

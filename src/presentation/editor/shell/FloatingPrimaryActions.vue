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

const runtime = useEditorRuntime();
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
			@click="runtime.setTool('select')"
		>
			{{ tr('editor.primary.select') }}
		</button>
		<button
			type="button"
			class="rp-primary-actions__button"
			data-rp-action="add"
			aria-haspopup="menu"
			:aria-expanded="props.addOpen"
			@click="emit('openAdd')"
		>
			{{ tr('editor.primary.add') }}
		</button>
	</div>
</template>

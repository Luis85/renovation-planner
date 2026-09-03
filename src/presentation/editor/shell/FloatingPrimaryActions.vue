<script setup lang="ts">
/**
 * Select and Add, floating over the canvas (M01, component library §6). Select is the safe
 * state and says so with `aria-pressed`; Add opens the menu Task 18 mounts, through the ONE
 * `openAdd` event — the menu is the root's to own, because it has to close on Escape before
 * the canvas hears the key.
 *
 * Add is `disabled` and carries no `aria-haspopup` until Task 17 builds the menu it would
 * announce — a live, focusable button whose click reached nothing and whose ARIA promised a
 * menu that never opened would be exactly the live-control-that-does-nothing slice 14's own
 * amendment refuses. The emit and the root's binding stay wired now so Task 17 only flips
 * these two attributes and supplies the real handler.
 */
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';

const runtime = useEditorRuntime();
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
		<!-- Task 17 enables this: flips `disabled` off, adds `aria-haspopup="menu"` back, wires the real menu. -->
		<button
			type="button"
			class="rp-primary-actions__button"
			data-rp-action="add"
			disabled
			@click="emit('openAdd')"
		>
			{{ tr('editor.primary.add') }}
		</button>
	</div>
</template>

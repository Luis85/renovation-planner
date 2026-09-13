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
import { computed, nextTick } from 'vue';
import HostIcon from '../../components/HostIcon.vue';
import { useRenovationSession } from '../renovation/renovationSession';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';

const runtime = useEditorRuntime();
const session = useRenovationSession();
const workspace = useWorkspaceStore();
const canSwitch = computed(() => runtime.activeToolId.value === null || runtime.toolManager.canDeactivateActiveTool());
const layoutAddAvailable = computed(() => session.perspective === 'plan');
const renovationContextAvailable = computed(() => session.perspective === 'renovate' && (session.roomId !== '' || session.targetId !== ''));
const workAvailable = computed(() => session.perspective === 'renovate' && runtime.renovation.canAddWork(session.roomId));
async function addWork(): Promise<void> { await runtime.renovation.addWork(session.roomId); }
function revealDetails(event: Event): void {
	const root = (event.currentTarget as HTMLElement).closest<HTMLElement>('.renovation-plan-editor');
	workspace.revealInspector();
	void nextTick(() => root?.querySelector<HTMLElement>('[data-rp-region="inspector"]')?.focus());
}
const props = defineProps<{ addOpen: boolean }>();
const emit = defineEmits<{ openAdd: [] }>();
</script>

<template>
	<div
		class="rp-primary-actions"
		:class="{ 'rp-primary-actions--renovate': session.perspective === 'renovate' }"
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
			data-rp-action="pan"
			:aria-pressed="runtime.activeToolId.value === 'pan'"
			:aria-disabled="!canSwitch"
			@click="runtime.setTool('pan')"
		>
			<HostIcon name="hand" />{{ tr('editor.input.pan') }}
		</button>
		<button
			v-if="layoutAddAvailable"
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
		<button
			v-if="workAvailable"
			type="button"
			class="rp-primary-actions__button rp-primary-actions__work"
			data-rp-action="add-work"
			:aria-disabled="runtime.renovation.blocked.value"
			@click="addWork"
		>
			<HostIcon name="plus" />{{ tr('renovation.add.work') }}
		</button>
		<button
			v-if="renovationContextAvailable"
			type="button"
			class="rp-primary-actions__button"
			data-rp-action="renovation-more"
			@click="revealDetails"
		>
			<HostIcon name="panels-top-left" />{{ tr('editor.structure.more') }}
		</button>
	</div>
</template>

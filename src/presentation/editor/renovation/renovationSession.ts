import { defineStore } from 'pinia';
import { ref } from 'vue';

export type RenovationMode = 'existing' | 'planned' | 'work';
export type Perspective = 'plan' | 'renovate' | 'review';
export const useRenovationSession = defineStore('renovation-session', () => {
	const perspective = ref<Perspective>('plan'), mode = ref<RenovationMode>('existing');
	const roomId = ref(''), focusedId = ref(''), visible = ref(true);
	return { perspective, mode, roomId, focusedId, visible };
});

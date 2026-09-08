import { defineStore } from 'pinia';
import { ref } from 'vue';

export type RenovationMode = 'existing' | 'planned' | 'work' | 'materials' | 'costs' | 'documents' | 'photos' | 'notes';
export type Perspective = 'plan' | 'renovate' | 'review';
export const useRenovationSession = defineStore('renovation-session', () => {
	const perspective = ref<Perspective>('plan'), mode = ref<RenovationMode>('existing');
	const evidencePhase = ref('');
	const roomId = ref(''), focusedId = ref(''), visible = ref(true);
	return { evidencePhase, perspective, mode, roomId, focusedId, visible };
});

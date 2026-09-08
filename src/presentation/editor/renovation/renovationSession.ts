import { defineStore } from 'pinia';
import { ref } from 'vue';

export type RenovationMode = 'overview' | 'existing' | 'planned' | 'work' | 'materials' | 'costs' | 'documents' | 'photos' | 'notes';
export type Perspective = 'plan' | 'renovate' | 'review';
export const useRenovationSession = defineStore('renovation-session', () => {
	const perspective = ref<Perspective>('plan'), mode = ref<RenovationMode>('overview');
	const evidencePhase = ref('');
	const roomId = ref(''), targetId = ref(''), focusedId = ref(''), visible = ref(true);
	return { evidencePhase, perspective, mode, roomId, targetId, focusedId, visible };
});

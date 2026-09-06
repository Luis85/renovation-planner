import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';

/** The planning projection and read status belong to this leaf, never to vault truth. */
export const usePlanningReadState = defineStore('rp-planning-read', () => {
 const baseline = shallowRef<PlanningBaseline | null>(null);
 const loading = ref(false), failed = ref(false), retriesFailed = ref(0), evidenceRevision = ref(0);
 return { baseline, loading, failed, retriesFailed, evidenceRevision };
});

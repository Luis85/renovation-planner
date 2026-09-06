import { computed, inject, provide, type InjectionKey, type Ref } from 'vue';
import type { EditorRuntime } from '../runtime';
import type { usePlanningContext } from '../planning/planningContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { notifyFault } from '../../notices/notify';
export interface NoteCreation { readonly available: Readonly<Ref<boolean>>; activate(): void }
export const NOTE_CREATION: InjectionKey<NoteCreation> = Symbol('editor-note-creation');
/** Add uses the same evidence form and ordinary Markdown file service as Room Notes. */
export function provideNoteCreation(runtime: EditorRuntime, planning: ReturnType<typeof usePlanningContext>) {
 const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession();
 const roomId = computed(() => {
  if (selection.selectedIds.length !== 1) return '';
  const id = selection.selectedIds[0];
  return project.zones.get(id)?.zoneType === 'Room' ? id : '';
 });
 const available = computed(() => roomId.value !== '' && !!planning.files && !!planning.context.commands.planning
  && runtime.renovation.available && !planning.blocked.value);
 function activate(): void {
  if (!available.value) return;
  const id = roomId.value, focusedId = session.roomId === id ? session.focusedId : '';
  runtime.returnToSelect(); runtime.renovation.focus(id, 'notes', focusedId);
  void planning.edit('evidence').catch(cause => notifyFault(cause, planning.context.commands.logger, 'editor.add-note.failed'));
 }
 const value = { available, activate }; provide(NOTE_CREATION, value); return value;
}

export function useNoteCreation(): NoteCreation {
 const value = inject(NOTE_CREATION); if (!value) throw new Error('Note creation context is missing.'); return value;
}

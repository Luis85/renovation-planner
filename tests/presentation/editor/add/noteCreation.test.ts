// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { provideNoteCreation, type NoteCreation } from '../../../../src/presentation/editor/add/noteCreation';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { useRenovationSession } from '../../../../src/presentation/editor/renovation/renovationSession';
import { EMPTY_STRUCTURE } from '../../../../src/domain/spatial/Structure';
import type { EditorRuntime } from '../../../../src/presentation/editor/runtime';
import type { usePlanningContext } from '../../../../src/presentation/editor/planning/planningContext';

const mounted: VueWrapper[] = [];
afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount(); });

/** `provideNoteCreation` over real stores, with the runtime and planning context reduced to the members it reads. */
function rig() {
	const pinia = createPinia();
	const focus = vi.fn<(roomId: string, mode: string, id?: string) => void>(), returnToSelect = vi.fn<() => void>();
	const edit = vi.fn<(kind: string) => Promise<void>>().mockResolvedValue(undefined);
	const runtime = { renovation: { available: true, focus }, returnToSelect } as unknown as EditorRuntime;
	const planning = { files: {}, context: { commands: { planning: {}, logger: {} } }, blocked: ref(false), edit } as unknown as ReturnType<typeof usePlanningContext>;
	let creation!: NoteCreation;
	mounted.push(mount(defineComponent({ setup() { creation = provideNoteCreation(runtime, planning); return () => null; } }), { global: { plugins: [pinia] } }));
	const project = useProjectStore(pinia);
	project.zones = new Map([['zone-kitchen', {} as never]]);
	project.structure = { ...EMPTY_STRUCTURE, walls: [{ id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150 }] };
	return { creation, focus, returnToSelect, edit, selection: useSelectionStore(pinia), session: useRenovationSession(pinia) };
}

it('adds a note to the selected Room and keeps the record the session already focuses there', () => {
	const { creation, focus, returnToSelect, edit, selection, session } = rig();
	selection.select(['zone-kitchen' as never]);
	Object.assign(session, { roomId: 'zone-kitchen', focusedId: 'work-sand' });
	expect(creation.available.value).toBe(true);
	creation.activate();
	expect(returnToSelect).toHaveBeenCalledOnce();
	expect(focus).toHaveBeenCalledExactlyOnceWith('zone-kitchen', 'notes', 'work-sand');
	expect(edit).toHaveBeenCalledExactlyOnceWith('evidence');
});

it('offers no note for a wall the session is not on, and activating it then does nothing', () => {
	const { creation, focus, edit, selection, session } = rig();
	selection.select(['wall-a' as never]);
	Object.assign(session, { roomId: 'zone-kitchen', targetId: 'wall-b' });
	expect(creation.available.value).toBe(false);
	creation.activate();
	expect(focus).not.toHaveBeenCalled(); expect(edit).not.toHaveBeenCalled();
});

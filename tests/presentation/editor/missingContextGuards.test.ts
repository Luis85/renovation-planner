// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useReviewPresentation } from '../../../src/presentation/editor/renovation/useReviewPresentation';
import { usePlanningContext } from '../../../src/presentation/editor/planning/planningContext';
import { useNoteCreation } from '../../../src/presentation/editor/add/noteCreation';

/**
 * Each of these hooks is the door a leaf takes to state its ancestor provides ONCE. A leaf
 * mounted outside that ancestor must fail loudly at setup rather than draw an empty region,
 * which is the same failure mode `regionsReachable.test.ts` guards from the other direction.
 */
it.each([
 ['review presentation', useReviewPresentation, 'Review presentation is missing'],
 ['planning context', usePlanningContext, 'Planning context is missing.'],
 ['note creation', useNoteCreation, 'Note creation context is missing.'],
])('refuses to mount a %s consumer outside its provider', (_name, hook, message) => {
 vi.spyOn(console, 'warn').mockImplementation(() => undefined);
 const Leaf = defineComponent({ setup() { hook(); return () => null; } });
 expect(() => mount(Leaf)).toThrow(message);
 vi.restoreAllMocks();
});

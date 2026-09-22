import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { selectionGuidance } from '../../../../src/presentation/editor/selection/selectionGuidance';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { FIXTURE_ZONES } from '../../../helpers/planFixtures';
import { WALL_LOOP } from '../../../helpers/structure';

/**
 * The expected sentences are WRITTEN OUT rather than rebuilt from the two keys they are made of.
 * An assertion that joins `editor.input.current-target` and `editor.input.overlap-cycle-guidance`
 * the way the function does cannot fail on how the function joins them — which is how the run-on
 * this file exists for survived the assertions already written about it. These are the English
 * renderings; nothing here grades the German ones.
 */
describe('selectionGuidance', () => {
	it('names the target as its own sentence before the Alt-click route, for a zone and for a wall', () => {
		setActivePinia(createPinia());
		const project = useProjectStore();
		project.zones = new Map(FIXTURE_ZONES.map(zone => [zone.id, zone]));
		project.structure = WALL_LOOP;

		expect(selectionGuidance(['zone-kitchen'], project)).toBe('Current target: Kitchen. Alt-click to select another overlapping item.');
		expect(selectionGuidance(['wall-a'], project)).toBe('Current target: Wall 1. Alt-click to select another overlapping item.');
	});

	it('answers nothing for an empty, multiple or unnameable selection', () => {
		setActivePinia(createPinia());
		const project = useProjectStore();
		project.zones = new Map(FIXTURE_ZONES.map(zone => [zone.id, zone]));
		project.structure = WALL_LOOP;

		expect(selectionGuidance([], project)).toBeNull();
		expect(selectionGuidance(['zone-kitchen', 'zone-terrace'], project)).toBeNull();
		expect(selectionGuidance(['no-such-id'], project)).toBeNull();
	});
});

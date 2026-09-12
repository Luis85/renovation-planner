import { describe, expect, it } from 'vitest';
import { defaultRenovationContext, type ContextSource } from '../../../../src/presentation/editor/renovation/defaultRenovationContext';
import { EMPTY_RENOVATION } from '../../../../src/domain/renovation/Renovation';
import { WALL_LOOP } from '../../../helpers/structure';

const source = (patch: Partial<ContextSource> = {}): ContextSource => ({ zoneIds: new Set(['room-a', 'garden']), structure: WALL_LOOP, renovation: EMPTY_RENOVATION, ...patch });

describe('the room a new record starts in', () => {
	it('is the selected zone itself, of any zone type', () => {
		expect(defaultRenovationContext(source(), 'garden', '')).toBe('garden');
	});
	it('is the room an existing subject, then Work item, on the target already names', () => {
		const renovation = { ...EMPTY_RENOVATION, work: [{ id: 'w', roomId: 'garden', targetId: 'wall-a', title: 'x', description: '', order: 0, progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: [] }] };
		expect(defaultRenovationContext(source({ renovation }), 'wall-a', '')).toBe('garden');
	});
	it('is the first room whose boundary holds the wall, or the host wall of an opening', () => {
		const structure = { ...WALL_LOOP, openings: [{ id: 'door', kind: 'door' as const, hostId: 'wall-b', offset: 100, width: 900, height: 2000, sill: 0 }], boundaries: [{ roomId: 'room-a', wallIds: WALL_LOOP.walls.map(wall => wall.id) }] };
		expect(defaultRenovationContext(source({ structure }), 'wall-a', '')).toBe('room-a');
		expect(defaultRenovationContext(source({ structure }), 'door', '')).toBe('room-a');
	});
	it('keeps a remembered room that still exists, and otherwise has none', () => {
		expect(defaultRenovationContext(source(), 'wall-a', 'room-a')).toBe('room-a');
		expect(defaultRenovationContext(source(), 'wall-a', 'deleted-room')).toBe('');
		expect(defaultRenovationContext(source(), 'wall-a', '')).toBe('');
		expect(defaultRenovationContext(source(), '', 'room-a')).toBe('');
	});
});

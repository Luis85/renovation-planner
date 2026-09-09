import { expect, it } from 'vitest';
import { createStructureDraft, openingFromDraft, pickHost, validateDraftStructure } from '../../../src/presentation/editor/structure/structureDraft';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { expectErr } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';

it('refuses incomplete Room enclosure and invalid opening swing data before constructing stored geometry', () => {
	const draft = createStructureDraft(); draft.points = [WALL_LOOP.walls[0].start, WALL_LOOP.walls[0].end]; draft.room = true; draft.roomName = 'Room';
	expect(expectErr(validateDraftStructure(draft, EMPTY_STRUCTURE, [])).code).toBe('spatial.boundary');
	draft.kind = 'place-door'; draft.swing.angle = 'invalid'; expect(openingFromDraft(draft)).toBeNull();
});
it.each(['invalid', '5'])('refuses host placement with opening width %s while preserving the entered data', width => {
	const draft = createStructureDraft(); draft.kind = 'place-window'; draft.text.width = width;
	const before = { ...draft.text }; pickHost(draft, { x: 2000, y: 0 }, WALL_LOOP.walls, 20);
	expect(draft.snapped).toBe(false); expect(draft.error?.code).toBe('spatial.opening-containment'); expect(draft.text).toEqual(before);
});

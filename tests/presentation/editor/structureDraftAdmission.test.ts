import { expect, it } from 'vitest';
import { createStructureDraft, openingFromDraft, pickHost, validateDraftStructure } from '../../../src/presentation/editor/structure/structureDraft';
import { WALL_LOOP } from '../../helpers/structure';

it('rejects invalid door swing text, while a generic opening ignores swing left from the previous placement tool', () => {
	const draft = createStructureDraft(); draft.kind = 'place-door'; draft.text.hostId = 'wall-a'; draft.swing.angle = 'invalid';
	expect(openingFromDraft(draft)).toBeNull(); expect(validateDraftStructure(draft, WALL_LOOP, []).ok).toBe(false);
	draft.kind = 'place-opening';
	expect(openingFromDraft(draft)).toMatchObject({ kind: 'opening', hostId: 'wall-a' });
	expect(openingFromDraft(draft)?.swing).toBeUndefined();
});

it.each(['invalid', '5'])('refuses host snapping for opening width %s without replacing the last accepted placement', width => {
	const draft = createStructureDraft(); draft.kind = 'place-window';
	pickHost(draft, { x: 1000, y: 0 }, WALL_LOOP.walls, 8);
	const accepted = { hostId: draft.text.hostId, offset: draft.text.offset };
	draft.text.width = width; pickHost(draft, { x: 2000, y: 0 }, WALL_LOOP.walls, 8);
	expect(draft.snapped).toBe(false); expect(draft.error?.code).toBe('spatial.opening-containment');
	expect({ hostId: draft.text.hostId, offset: draft.text.offset }).toEqual(accepted);
});

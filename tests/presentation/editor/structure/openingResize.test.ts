import { expect, it, vi } from 'vitest';
import { OpeningResize, type OpeningResizeDeps } from '../../../../src/presentation/editor/structure/OpeningResize';
import type { Opening, Wall } from '../../../../src/domain/spatial/Structure';
import type { EditorContext } from '../../../../src/presentation/editor/tools/editor-context';
import type { EditorPointerEvent } from '../../../../src/presentation/editor/tools/editor-tool';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 900, height: 2100, sill: 0 };

/**
 * A pointer event at a world x on the wall's own line, cast rather than fully typed: `OpeningResize`
 * reads only `worldPoint`, `button` and `modifiers.alt` off this, so a minimal double stands in for
 * the whole `EditorPointerEvent` (`worldPerScreenPixel` of 1 makes `CLICK_EPSILON_PX` (4) four world
 * millimetres).
 */
function at(x: number): EditorPointerEvent {
	return { worldPoint: { x, y: 0 }, button: 'primary', modifiers: { shift: false, alt: false } } as unknown as EditorPointerEvent;
}

/** The `EditorContext` double: only `writesBlocked` and `viewport.worldPerScreenPixel` are read. */
function contextWith(writesBlocked: () => boolean): EditorContext {
	return { writesBlocked, viewport: { worldPerScreenPixel: () => 1 } } as unknown as EditorContext;
}

function harness(host: Wall = wall) {
	const previewOpening = vi.fn<NonNullable<OpeningResizeDeps['previewOpening']>>();
	const commitOpening = vi.fn<NonNullable<OpeningResizeDeps['commitOpening']>>();
	const resize = new OpeningResize({ openingTarget: () => ({ opening: door, host }), previewOpening, commitOpening });
	const context = contextWith(() => false);
	return { resize, previewOpening, commitOpening, context };
}

it('is not an edit until the pointer has travelled past the click epsilon', () => {
	const { resize, previewOpening, context } = harness();
	resize.start(context, at(1250), 'opening-a', 'width-end');
	expect(resize.active).toBe(true);
	resize.move(context, at(1252));
	expect(previewOpening).not.toHaveBeenCalled();
	resize.move(context, at(1300));
	expect(previewOpening).toHaveBeenCalledWith('opening-a', { ...door, offset: 800, width: 500 });
});

it('drags the move grip by the opening centre, keeping its whole width on the host', () => {
	const { resize, previewOpening, context } = harness();
	resize.start(context, at(1250), 'opening-a', 'move');
	resize.move(context, at(2000));
	expect(previewOpening).toHaveBeenLastCalledWith('opening-a', { ...door, offset: 1550 });
	// Dragged past the end, the whole width still sits on the host.
	resize.move(context, at(9000));
	expect(previewOpening).toHaveBeenLastCalledWith('opening-a', { ...door, offset: 3100 });
});

it('drags the start-edge width grip, holding the far edge still', () => {
	const { resize, previewOpening, context } = harness();
	resize.start(context, at(800), 'opening-a', 'width-start');
	resize.move(context, at(200));
	// The far edge (offset + width = 1700) holds; the dragged edge lands at 200.
	expect(previewOpening).toHaveBeenLastCalledWith('opening-a', { ...door, offset: 200, width: 1500 });
});

it('leaves the last valid preview standing when a drag goes somewhere illegal', () => {
	const { resize, previewOpening, context } = harness();
	resize.start(context, at(1700), 'opening-a', 'width-end');
	resize.move(context, at(2500));
	const valid = previewOpening.mock.calls.length;
	// `projectOntoWall` clamps into the wall's own extent (verified: -50 projects to offset 0,
	// still a legal — if different — opening), so the refusal this width grip can actually reach
	// is `resizedOpening`'s width-collapses-to-zero guard: the dragged edge lands exactly on the
	// fixed one (opening.offset, 800).
	resize.move(context, at(800));
	expect(previewOpening).toHaveBeenCalledTimes(valid);
});

it('leaves the last valid preview standing when the move grip cannot fit the opening on its host', () => {
	// A host too short for the opening's own width: `openingOffsetAt` refuses every point on it.
	const shortWall: Wall = { id: 'wall-b', start: { x: 0, y: 0 }, end: { x: 500, y: 0 }, height: 2400, thickness: 200 };
	const { resize, previewOpening, context } = harness(shortWall);
	resize.start(context, at(200), 'opening-a', 'move');
	resize.move(context, at(300));
	expect(previewOpening).not.toHaveBeenCalled();
});

it('commits on release and keeps the preview up for the write to clear', () => {
	const { resize, commitOpening, previewOpening, context } = harness();
	resize.start(context, at(1700), 'opening-a', 'width-end');
	resize.move(context, at(2500));
	resize.finish(context, at(2500));
	expect(commitOpening).toHaveBeenCalledWith('opening-a', door, { ...door, offset: 800, width: 1700 });
	expect(previewOpening).toHaveBeenLastCalledWith('opening-a', { ...door, offset: 800, width: 1700 });
	expect(resize.active).toBe(false);
});

it('commits nothing for a press that never became a drag, and clears the preview', () => {
	const { resize, commitOpening, previewOpening, context } = harness();
	resize.start(context, at(1700), 'opening-a', 'width-end');
	resize.finish(context, at(1701));
	expect(commitOpening).not.toHaveBeenCalled();
	expect(previewOpening).toHaveBeenLastCalledWith(null);
});

it('starts nothing while writes are blocked, with Alt held, for an opening it cannot find, or with no commitOpening dep', () => {
	const blocked = harness();
	blocked.resize.start(contextWith(() => true), at(1250), 'opening-a', 'move');
	expect(blocked.resize.active).toBe(false);
	const alt = harness();
	alt.resize.start(alt.context, { ...at(1250), modifiers: { shift: false, alt: true } } as unknown as EditorPointerEvent, 'opening-a', 'move');
	expect(alt.resize.active).toBe(false);
	const gone = new OpeningResize({
		openingTarget: () => null,
		previewOpening: vi.fn<NonNullable<OpeningResizeDeps['previewOpening']>>(),
		commitOpening: vi.fn<NonNullable<OpeningResizeDeps['commitOpening']>>(),
	});
	gone.start(blocked.context, at(1250), 'opening-a', 'move');
	expect(gone.active).toBe(false);
	const bare = new OpeningResize({
		openingTarget: () => ({ opening: door, host: wall }),
		previewOpening: vi.fn<NonNullable<OpeningResizeDeps['previewOpening']>>(),
	});
	bare.start(blocked.context, at(1250), 'opening-a', 'move');
	expect(bare.active).toBe(false);
});

it('does nothing for a move or a finish with no gesture in flight', () => {
	const { resize, previewOpening, commitOpening, context } = harness();
	resize.move(context, at(1300));
	resize.finish(context, at(1300));
	expect(previewOpening).not.toHaveBeenCalled();
	expect(commitOpening).not.toHaveBeenCalled();
});

it('gives up a drag once writes block mid-gesture', () => {
	const { resize, previewOpening } = harness();
	let blocked = false;
	const context = contextWith(() => blocked);
	resize.start(context, at(1700), 'opening-a', 'width-end');
	resize.move(context, at(2500));
	previewOpening.mockClear();
	blocked = true;
	resize.move(context, at(2600));
	expect(previewOpening).toHaveBeenCalledExactlyOnceWith(null);
	expect(resize.active).toBe(false);
});

it('refuses a finish on a non-primary button and on blocked writes, without committing', () => {
	const { resize, commitOpening, context } = harness();
	resize.start(context, at(1700), 'opening-a', 'width-end');
	resize.move(context, at(2500));
	resize.finish(context, { ...at(2500), button: 'secondary' } as unknown as EditorPointerEvent);
	expect(commitOpening).not.toHaveBeenCalled();
	expect(resize.active).toBe(true);

	const second = harness();
	second.resize.start(second.context, at(1700), 'opening-a', 'width-end');
	second.resize.move(second.context, at(2500));
	second.resize.finish(contextWith(() => true), at(2500));
	expect(second.commitOpening).not.toHaveBeenCalled();
	expect(second.previewOpening).toHaveBeenLastCalledWith(null);
	expect(second.resize.active).toBe(false);
});

it('cancels to no preview', () => {
	const { resize, previewOpening, context } = harness();
	resize.start(context, at(1250), 'opening-a', 'move');
	resize.cancel();
	expect(resize.active).toBe(false);
	expect(previewOpening).toHaveBeenLastCalledWith(null);
});

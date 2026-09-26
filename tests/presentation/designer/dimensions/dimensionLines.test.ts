/**
 * The drafting marks each on-canvas dimension draws (AD18-R17, board 01): a dimension line, an
 * arrowhead at each end and an extension line up to each edge it measures — as SVG path data in
 * stage pixels, so the arithmetic is asked of a function rather than of a screen.
 *
 * Every number is exact because every input is an integer stage point: 6 px arrowheads 6 px wide,
 * extension lines running 4 px past the dimension line and past the edge.
 */
import { describe, expect, it } from 'vitest';
import { dimensionLine } from '../../../../src/presentation/designer/dimensions/dimensionLines';
import { screenPoint } from '../../../../src/presentation/editor/viewport/Viewport';

const p = screenPoint;

describe('the lines a dimension draws', () => {
	/**
	 * A label left on its own edge: the line runs along the edge, the arrows point OUT at the two
	 * corners, and each extension line is a short tick across the line's end.
	 */
	it('draws a line with an outward arrow at each end and a tick at each edge', () => {
		expect(dimensionLine('x', p(100, 50), p(300, 50), p(200, 50))).toEqual({
			line: 'M100 50L300 50M100 46L100 54M300 46L300 54',
			arrows: 'M100 50L106 47L106 53ZM300 50L294 47L294 53Z',
		});
	});

	/**
	 * **A label the collision rule moved takes its line with it**, and the extension lines grow to
	 * meet it — which is how a drafting chain stacks, and why a moved label still reads as measuring
	 * the edges it measures rather than whatever it now sits over.
	 */
	it('moves the line to a moved label and runs the extension lines out to it', () => {
		// From the edge itself, 4 px past the line — never back into the object.
		expect(dimensionLine('x', p(100, 50), p(300, 50), p(200, 80)).line)
			.toBe('M100 80L300 80M100 50L100 84M300 50L300 84');
		expect(dimensionLine('x', p(100, 50), p(300, 50), p(200, 35)).line)
			.toBe('M100 35L300 35M100 31L100 50M300 31L300 50');
	});

	/**
	 * A label moved ALONG its own line past an end — a depth stepped down beyond the edge it
	 * measures — is joined to it by the line itself, while the arrows stay on the edges.
	 */
	it('runs a vertical line on to a label moved past its end, arrows still on the edges', () => {
		expect(dimensionLine('y', p(50, 100), p(50, 300), p(50, 330))).toEqual({
			line: 'M50 100L50 330M46 100L54 100M46 300L54 300',
			arrows: 'M50 100L47 106L53 106ZM50 300L47 294L53 294Z',
		});
		// And past its START, the other way.
		expect(dimensionLine('y', p(50, 100), p(50, 300), p(50, 70)).line).toBe('M50 70L50 300M46 100L54 100M46 300L54 300');
	});

	/** A span too short for two arrowheads takes them OUTSIDE, pointing in, as a drafted narrow gap does. */
	it('turns the arrows round outside a span too short to hold them', () => {
		expect(dimensionLine('x', p(100, 50), p(108, 50), p(104, 50))).toEqual({
			line: 'M88 50L120 50M100 46L100 54M108 46L108 54',
			arrows: 'M100 50L94 47L94 53ZM108 50L114 47L114 53Z',
		});
	});

	/** A signed gap a part overhangs runs backwards; the marks are the same marks. */
	it('draws a backwards span exactly as a forwards one', () => {
		expect(dimensionLine('x', p(300, 50), p(100, 50), p(200, 50))).toEqual(dimensionLine('x', p(100, 50), p(300, 50), p(200, 50)));
	});
});

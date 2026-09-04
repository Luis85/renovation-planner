import { describe, expect, it } from 'vitest';
import { formatMetres, MAX_ROOM_SIDE_MM, parseMetres } from '../../../../src/presentation/editor/shell/formatLength';

describe('formatMetres', () => {
	it('prints world millimetres as metres with at most two decimals, en-US', () => {
		expect(formatMetres(4200)).toBe('4.2');
		expect(formatMetres(3800)).toBe('3.8');
		expect(formatMetres(4255)).toBe('4.26');
		expect(formatMetres(1_234_560)).toBe('1,234.56');
	});
});

describe('parseMetres', () => {
	it('reads a decimal point and a decimal comma alike, into millimetres', () => {
		expect(parseMetres('4.2')).toEqual({ ok: true, mm: 4200 });
		expect(parseMetres('4,2')).toEqual({ ok: true, mm: 4200 });
		expect(parseMetres(' 3.80 ')).toEqual({ ok: true, mm: 3800 });
	});
	it('refuses text and empties as not-a-number', () => {
		expect(parseMetres('')).toEqual({ ok: false, reason: 'not-a-number' });
		expect(parseMetres('four')).toEqual({ ok: false, reason: 'not-a-number' });
		expect(parseMetres('4.2.1')).toEqual({ ok: false, reason: 'not-a-number' });
	});
	it('refuses zero and negatives as not-positive', () => {
		expect(parseMetres('0')).toEqual({ ok: false, reason: 'not-positive' });
		expect(parseMetres('-3')).toEqual({ ok: false, reason: 'not-positive' });
	});
	it('refuses a side longer than a kilometre, and Infinity with it', () => {
		expect(parseMetres('1000.01')).toEqual({ ok: false, reason: 'too-large' });
		expect(parseMetres('Infinity')).toEqual({ ok: false, reason: 'too-large' });
		expect(parseMetres('1000')).toEqual({ ok: true, mm: MAX_ROOM_SIDE_MM });
	});
});

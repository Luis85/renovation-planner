/** @vitest-environment jsdom */
import { expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { installCanvas } from './canvas';
import { expectDefined } from './domain';
installCanvas();

it.each([
	['clockwise numeric flag', 0, false],
	['counterclockwise numeric flag', 1, true],
	['omitted direction', undefined, false],
] as const)('matches browser arc direction conversion for %s while drawing real pixels', (_label, input, expected) => {
	const element = document.createElement('canvas'); element.width = 32; element.height = 32;
	const context = expectDefined(element.getContext('2d'), 'bridged canvas');
	context.beginPath(); context.lineWidth = 2;
	// Konva's SVG Path renderer calls arc with numeric 0/1 rather than a typed boolean.
	(context.arc as (...args: unknown[]) => void).call(context, 16, 16, 10, 0, Math.PI, input);
	context.stroke();
	const reference = createCanvas(32, 32).getContext('2d'); reference.beginPath(); reference.lineWidth = 2;
	reference.arc(16, 16, 10, 0, Math.PI, expected); reference.stroke();
	expect([...context.getImageData(0, 0, 32, 32).data]).toEqual([...reference.getImageData(0, 0, 32, 32).data]);
	expect(context.getImageData(16, expected ? 6 : 26, 1, 1).data[3]).toBeGreaterThan(0);
	expect(context.getImageData(16, expected ? 26 : 6, 1, 1).data[3]).toBe(0);
});

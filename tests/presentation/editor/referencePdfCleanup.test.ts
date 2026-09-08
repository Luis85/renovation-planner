/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { renderPdfPage } from '../../../src/presentation/editor/layers/background/pdfRaster';

describe('failed reference PDF loading', () => {
	it('destroys the loading task when document parsing rejects before any page exists', async () => {
		const destroy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
		vi.spyOn(obsidian, 'loadPdfJs').mockResolvedValue({ getDocument: () => ({ promise: Promise.reject(new Error('invalid PDF')), destroy }) });
		await expect(renderPdfPage(new ArrayBuffer(4), 1)).rejects.toThrow('invalid PDF');
		expect(destroy).toHaveBeenCalledTimes(1);
	});
});

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { writeContactSheet } from '../../scripts/harnessContactSheet.mjs';

describe('harness contact sheet', () => {
	it('includes produced metadata entries and escapes unknown paths', () => {
		const dir = '.tmp-contact-sheet'; mkdirSync(dir, { recursive: true });
		writeFileSync(`${dir}/dark.png`, '');
		writeContactSheet(dir, [{ name: 'dark' }, { name: '<unknown>' }]);
		const html = readFileSync(`${dir}/index.html`, 'utf8');
		expect(html).toContain('dark.png'); expect(html).not.toContain('&lt;unknown&gt;.png');
		rmSync(dir, { recursive: true, force: true });
	});
});

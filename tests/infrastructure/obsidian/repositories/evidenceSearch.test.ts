import { expect, it, vi } from 'vitest';
import type { Vault, TFile } from 'obsidian';
import type { ProjectIndex } from '../../../../src/application/ports/ProjectIndex';
import { ObsidianEvidenceFiles } from '../../../../src/infrastructure/obsidian/repositories/ObsidianEvidenceFiles';

it('bounds image search before mapping or sorting a large vault and excludes document types', () => {
	let visited = 0;
	const paths = [...Array.from({ length: 200 }, (_, n) => `Photos/image-${n}.PNG`), ...Array.from({ length: 10000 }, (_, n) => `Notes/note-${n}.md`), 'Photos/layout.pdf', 'Photos/vector.svg', 'Photos/bathroom.jpg'];
	const records = paths.map(path => ({ get path() { visited++; return path; } }) as TFile);
	const getFiles = vi.fn<() => TFile[]>(() => records);
	const files = new ObsidianEvidenceFiles({ vault: { getFiles } as unknown as Vault, index: {} as ProjectIndex,
		workspace: { openLinkText: () => Promise.resolve(undefined) }, cache: { getFirstLinkpathDest: () => null } });
	expect(files.list({ imagesOnly: true, limit: 20 })).toHaveLength(20);
	expect(visited).toBe(20);
	visited = 0;
	expect(files.list({ imagesOnly: true, limit: 50000 })).toHaveLength(50);
	expect(visited).toBe(50);
	expect(files.list({ imagesOnly: true, query: 'BATHROOM' })).toEqual(['Photos/bathroom.jpg']);
	expect(files.list({ imagesOnly: true, query: 'layout' })).toEqual([]);
	expect(files.list({ imagesOnly: true, query: 'vector' })).toEqual([]);
	expect(files.list({ query: 'note-', limit: 3 })).toHaveLength(3);
	getFiles.mockClear();
	expect(files.list({ limit: 0 })).toEqual([]);
	expect(getFiles).not.toHaveBeenCalled();
	expect(files.list({ imagesOnly: true, limit: Number.POSITIVE_INFINITY })).toHaveLength(20);
});

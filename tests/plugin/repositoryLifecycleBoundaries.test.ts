// @vitest-environment jsdom
// Public repository/service boundaries over the real in-memory vault stack.
// The composition imports native views; no browser or live-host acceptance is claimed.
import { afterEach, expect, it, vi } from 'vitest';
import { TFile, type MetadataCache, type Workspace } from 'obsidian';
import { downstreamStack } from '../helpers/downstream';
import { expectDefined, expectErr, expectFound, expectOk } from '../helpers/domain';
import { Asset } from '../../src/domain/asset/Asset';
import { createSupplier } from '../../src/domain/supplier/Supplier';
import type { Quote } from '../../src/domain/quote/Quote';
import { createEntityId } from '../../src/core/identity/generateId';
import { of } from '../../src/core/money/Money';
import { saveQuote } from '../../src/application/commands/quote/QuoteServices';
import { buildProjectIndexEntries } from '../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { ObsidianEvidenceFiles } from '../../src/infrastructure/obsidian/repositories/ObsidianEvidenceFiles';

type Rig = Awaited<ReturnType<typeof downstreamStack>>;
const stacks: Rig[] = [];
afterEach(() => { for (const rig of stacks.splice(0)) rig.dispose(); vi.restoreAllMocks(); });
async function setup() { const rig = await downstreamStack(); stacks.push(rig); return rig; }
function fileAt(rig: Rig, path: string): TFile {
	const file = rig.stack.deps.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) throw new Error(`Expected an existing file at ${path}`);
	return file;
}
function reindex(rig: Rig): void {
	rig.stack.metadataCache.catchUp();
	const scan = buildProjectIndexEntries({ ...rig.stack.deps, echo: rig.persistence.vaultDeps.echo });
	rig.persistence.index.rebuild(scan.entries, scan.exclusions);
}

it('explicitly deletes an Asset and its schema-invalid JSON sidecar without touching other files', async () => {
	const rig = await setup(), sidecar = rig.persistence.assetGeometry;
	const before = expectOk(await sidecar.read(rig.asset.id)), paths = new Set(rig.stack.vault.entries.keys());
	expectOk(await sidecar.write(rig.asset.id, { calibration: null, shape: null }, before.version));
	const created = [...rig.stack.vault.entries.keys()].filter(path => !paths.has(path) && path.endsWith('.rpgeo'));
	expect(created).toHaveLength(1);
	const path = created[0], file = fileAt(rig, path);
	const document = JSON.parse(await rig.stack.deps.vault.read(file)) as Record<string, unknown>;
	expect(document.assetId).toBe(rig.asset.id);
	await rig.stack.deps.vault.modify(file, JSON.stringify({ ...document, shape: [] }));
	const note = expectDefined(rig.persistence.index.getPath(rig.asset.id), 'Asset note');
	const unrelated = [...rig.stack.vault.entries].filter(([name]) => name !== note && name !== path);
	expectOk(await rig.persistence.deleteAsset.execute({ assetId: rig.asset.id }));
	expect(rig.stack.vault.entries.has(note)).toBe(false);
	expect(rig.stack.vault.entries.has(path)).toBe(false);
	expect([...rig.stack.vault.entries]).toEqual(unrelated);
});

it('refuses a Quote insert when its Project disappears after link validation', async () => {
	const rig = await setup();
	const supplier = expectOk(createSupplier(createEntityId('supplier'), 'Local contractor'));
	expectOk(await rig.persistence.suppliers.save(supplier, 'absent'));
	const quote: Quote = { id: createEntityId('quote'), projectId: rig.plan.projectId, supplierId: supplier.id,
		title: 'Validated quotation', issuedOn: '2026-09-07', status: 'draft',
		items: [{ id: 'line', description: 'Floor work', amount: of('120', 'EUR'), assetIds: [rig.asset.id], work: [{ planId: rig.plan.id, workId: 'work-sand' }] }] };
	const projectPath = expectDefined(rig.persistence.index.getPath(quote.projectId), 'Project note');
	const originalSave = rig.persistence.quotes.save.bind(rig.persistence.quotes);
	let peerBytes: [string, string][] = [];
	const save = vi.spyOn(rig.persistence.quotes, 'save').mockImplementationOnce(async (entity, expected) => {
		// All service link reads have succeeded before this public write boundary.
		await rig.persistence.vaultDeps.fileManager.trashFile(fileAt(rig, projectPath));
		reindex(rig); peerBytes = [...rig.stack.vault.entries];
		return originalSave(entity, expected);
	});
	const create = vi.spyOn(rig.stack.deps.vault, 'create');
	expect(expectErr(await saveQuote(rig.persistence, { quote, expected: 'absent' })).code).toBe('quote.project-folder-unresolved');
	expect(save).toHaveBeenCalledOnce();
	expect(create).not.toHaveBeenCalled();
	expect(rig.persistence.index.getPath(quote.id)).toBeUndefined();
	expect([...rig.stack.vault.entries]).toEqual(peerBytes);
	expect(expectErr(await saveQuote(rig.persistence, { quote, expected: 'absent' })).code).toBe('quote.link-missing');
	expect(save).toHaveBeenCalledOnce();
	expect([...rig.stack.vault.entries]).toEqual(peerBytes);
});

it('preserves ordinary Markdown when the cache parsed removed frontmatter before the index reconciles', async () => {
	const rig = await setup(), loaded = expectFound(await rig.persistence.assets.getById(rig.asset.id));
	const path = expectDefined(rig.persistence.index.getPath(rig.asset.id), 'Asset path'), file = fileAt(rig, path);
	const body = '# Personal note\n\nKeep this text without planner ownership.\n';
	await rig.stack.deps.vault.modify(file, body); rig.stack.metadataCache.catchUp();
	expect(expectDefined(rig.stack.deps.metadataCache.getFileCache(file), 'parsed cache').frontmatter).toBeUndefined();
	expect(rig.persistence.index.getPath(rig.asset.id)).toBe(path);
	const bytes = [...rig.stack.vault.entries], modify = vi.spyOn(rig.stack.deps.vault, 'modify');
	const proposed = expectOk(Asset.create({ ...loaded.entity, name: 'Stale proposed name' }));
	expect(expectErr(await rig.persistence.assets.save(proposed, loaded.version)).code).toBe('asset.revision-conflict');
	expect(modify).not.toHaveBeenCalled();
	expect(await rig.stack.deps.vault.read(file)).toBe(body);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('does not replay a landed Asset write when a peer removes the note before echo stat observation', async () => {
	const rig = await setup(), loaded = expectFound(await rig.persistence.assets.getById(rig.asset.id));
	const proposed = expectOk(Asset.create({ ...loaded.entity, name: 'Saved before peer removal' }));
	const fileManager = rig.persistence.vaultDeps.fileManager;
	const actual = fileManager.processFrontMatter.bind(fileManager);
	let written = '', peerBytes: [string, string][] = [];
	const process = vi.spyOn(fileManager, 'processFrontMatter').mockImplementationOnce(async (file, update) => {
		await actual(file, update);
		written = await rig.stack.deps.vault.read(file);
		await fileManager.trashFile(file); peerBytes = [...rig.stack.vault.entries];
	});
	const create = vi.spyOn(rig.stack.deps.vault, 'create'), modify = vi.spyOn(rig.stack.deps.vault, 'modify');
	const result = expectOk(await rig.persistence.assets.save(proposed, loaded.version));
	expect(written).toContain(proposed.name);
	expect(result.entity.id).toBe(rig.asset.id);
	expect(result.entity.name).toBe(proposed.name);
	expect(process).toHaveBeenCalledOnce();
	expect(modify).toHaveBeenCalledOnce();
	expect(create).not.toHaveBeenCalled();
	expect(expectOk(await rig.persistence.assets.getById(rig.asset.id))).toBeNull();
	expect([...rig.stack.vault.entries]).toEqual(peerBytes);
});

it('resolves existing evidence through a root-relative host lookup after its Plan is unindexed', async () => {
	const rig = await setup();
	await rig.stack.deps.vault.create('Recovered guide.md', '# Heading\n\nExisting evidence.\n');
	const path = expectDefined(rig.persistence.index.getPath(rig.plan.id), 'Plan path');
	await rig.persistence.vaultDeps.fileManager.trashFile(fileAt(rig, path)); reindex(rig);
	expect(rig.persistence.index.getPath(rig.plan.id)).toBeUndefined();
	// Narrow host seam: this ordinary Markdown basename resolves to a real vault file.
	const resolve = vi.fn<MetadataCache['getFirstLinkpathDest']>((link, source) => {
		const folder = source.slice(0, source.lastIndexOf('/') + 1);
		const file = rig.stack.deps.vault.getAbstractFileByPath(`${folder}${link}.md`);
		return file instanceof TFile ? file : null;
	});
	const openLinkText = vi.fn<Workspace['openLinkText']>().mockResolvedValue(undefined);
	const files = new ObsidianEvidenceFiles({ vault: rig.stack.deps.vault, index: rig.persistence.index,
		cache: { getFirstLinkpathDest: resolve }, workspace: { openLinkText } });
	const bytes = [...rig.stack.vault.entries];
	const resolved = expectOk(files.resolve('Recovered guide#Heading', rig.plan.id));
	expect(resolve).toHaveBeenCalledWith('Recovered guide', '');
	expect(resolved).toEqual({ path: 'Recovered guide.md', subpath: '#Heading', image: null });
	expectOk(await files.open(resolved.path, resolved.subpath));
	expect(openLinkText).toHaveBeenCalledWith('Recovered guide.md#Heading', '', false);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

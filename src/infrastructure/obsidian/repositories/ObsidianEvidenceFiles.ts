import { normalizePath, parseLinktext, TFile, type Vault, type Workspace, type MetadataCache } from 'obsidian';
import type { EvidenceFiles } from '../../../application/ports/EvidenceFiles';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import { err, ok } from '../../../core/result/Result';
import { ensureFolder, persistenceError } from './noteIo';
import { parentOf } from './paths';
import { KeyedQueues } from './KeyedQueues';

export class ObsidianEvidenceFiles implements EvidenceFiles {
	private readonly queues = new KeyedQueues();
	constructor(private readonly deps: { vault: Vault; workspace: Pick<Workspace, 'openLinkText'>; cache: Pick<MetadataCache, 'getFirstLinkpathDest'>; index: ProjectIndex }) {}
	list(): readonly string[] { return this.deps.vault.getFiles().filter(file => /\.(md|pdf|png|jpe?g|gif|webp)$/i.test(file.path)).map(file => file.path).toSorted(); }
	resolve: EvidenceFiles['resolve'] = (input, planId) => {
		const text = input.trim().replace(/^\[\[|\]\]$/g, '').split('|')[0];
		const link = parseLinktext(text);
		const direct = this.deps.vault.getAbstractFileByPath(normalizePath(link.path));
		const file = direct instanceof TFile ? direct : this.deps.cache.getFirstLinkpathDest(link.path, this.deps.index.getPath(planId) ?? '');
		if (!file || !/\.(md|pdf|png|jpe?g|gif|webp)$/i.test(file.path)) return err(persistenceError('evidence.file-missing', 'The linked vault file is unavailable.'));
		return ok({ path: file.path, subpath: link.subpath, image: /\.(png|jpe?g|gif|webp)$/i.test(file.path) ? this.deps.vault.getResourcePath(file) : null });
	};
	open: EvidenceFiles['open'] = async (path, subpath) => {
		if (!(this.deps.vault.getAbstractFileByPath(path) instanceof TFile)) return err(persistenceError('evidence.file-missing', 'The linked vault file is unavailable.'));
		try { await this.deps.workspace.openLinkText(path + subpath, '', false); return ok(undefined); }
		catch (cause) { return err(persistenceError('evidence.open-failed', 'The file could not be opened.', cause)); }
	};
	createNote: EvidenceFiles['createNote'] = (planId, id, body) => this.queues.run(id, () => {
		if (!/^[a-zA-Z0-9-]+$/.test(id)) return Promise.resolve(err(persistenceError('evidence.name-invalid', 'Invalid note identity.')));
		return this.create(planId, `Note-${id}.md`, body);
	});
	importFile: EvidenceFiles['importFile'] = (planId, name, bytes) => this.queues.run(`${planId}:${name}`, () => this.create(planId, name, bytes));
	private async create(planId: Parameters<EvidenceFiles['createNote']>[0], name: string, content: string | ArrayBuffer): ReturnType<EvidenceFiles['createNote']> {
		const source = this.deps.index.getPath(planId);
		if (!source || !(this.deps.vault.getAbstractFileByPath(source) instanceof TFile) || [...name].some(character => character.charCodeAt(0) < 32) || /[<>:"/\\|?*#[\]]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name)) return err(persistenceError('evidence.name-invalid', 'The file name is not supported.'));
		const folder = normalizePath(`${parentOf(source)}/Evidence`), path = normalizePath(`${folder}/${name}`);
		if (this.deps.vault.getAbstractFileByPath(path)) return err(persistenceError('evidence.collision', 'A file already uses this name.'));
		try {
			await ensureFolder(this.deps.vault, folder);
			if (typeof content === 'string') await this.deps.vault.create(path, content);
			else await this.deps.vault.createBinary(path, content);
			return ok(path);
		} catch (cause) { return err(persistenceError('evidence.write-failed', 'The file could not be created.', cause)); }
	}
}

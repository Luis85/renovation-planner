import type { EntityId } from '../../../core/identity/EntityId';
import { normalizePath, TFile, type Vault } from 'obsidian';
import type { ReviewNotes } from '../../../application/ports/ReviewNotes';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import type { PlanId } from '../../../domain/plan/PlanId';
import { err, ok } from '../../../core/result/Result';
import { revisionConflict } from '../../../application/ports/versioning';
import { ensureFolder, persistenceError } from './noteIo';
import { parentOf } from './paths';
import { observeSidecar } from './digest';
import { KeyedQueues } from './KeyedQueues';

/** Generated projection only. Human changes make replacement refuse; no forced overwrite. */
export class ObsidianReviewNotes implements ReviewNotes {
	private readonly queues = new KeyedQueues();
	constructor(private readonly vault: Vault, private readonly index: ProjectIndex, private readonly kind: 'review' | 'shopping' = 'review') {}
	generate: ReviewNotes['generate'] = (planId, body) => this.queues.run(planId, () => this.write(planId, body));
	private async write(planId: PlanId, body: string): ReturnType<ReviewNotes['generate']> {
		const source = this.index.getPath(planId);
		if (!source || !(this.vault.getAbstractFileByPath(source) instanceof TFile)) return err(persistenceError('review.source-missing', 'The source note could not be found.'));
		let path = normalizePath([parentOf(source), `${this.kind === 'review' ? 'Review' : 'Shopping'}-${observeSidecar(planId)}.md`].filter(Boolean).join('/'));
		const owner = `<!-- rp-${this.kind}:${encodeURIComponent(planId)}:`;
		const linkedBody = body.replace(/\[\[rp-id:([^\]]+)\]\]/g, (_match, id: string) => { const target = this.index.getPath(id as EntityId<string>); return target ? `[[${target}]]` : id; });
		const content = `${owner}${observeSidecar(linkedBody)} -->\n${linkedBody}`;
		try {
			const owned = await this.findOwned(owner);
			if (owned.length > 1) return err(revisionConflict('review', planId));
			path = owned[0] ?? path;
			const file = this.vault.getAbstractFileByPath(path);
			if (!file) { await ensureFolder(this.vault, parentOf(path)); await this.vault.create(path, content); return ok(path); }
			if (!(file instanceof TFile)) return err(revisionConflict('review', planId));
			const previous = await this.vault.read(file);
			const newline = previous.indexOf('\n'), oldBody = previous.slice(newline + 1);
			if (previous.slice(0, newline) !== `${owner}${observeSidecar(oldBody)} -->`) return err(revisionConflict('review', planId));
			if (previous === content) return ok(path);
			let conflict = false;
			await this.vault.process(file, live => {
				if (live !== previous) { conflict = true; return live; }
				return content;
			});
			return conflict ? err(revisionConflict('review', planId)) : ok(path);
		} catch (cause) { return err(persistenceError('review.write-failed', 'The review note could not be written.', cause)); }
	}
 private async findOwned(owner: string): Promise<string[]> {
 const paths: string[] = [];
 for (const file of this.vault.getMarkdownFiles()) if ((await this.vault.read(file)).startsWith(owner)) paths.push(file.path);
 return paths;
 }
}

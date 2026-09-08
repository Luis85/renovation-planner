import { ok, type Result } from '../../../core/result/Result';
import type { Quote, QuoteId } from '../../../domain/quote/Quote';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { QuoteRepository, QuoteListing } from '../../../application/ports/QuoteRepository';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import type { Expected, Loaded } from '../../../application/ports/versioning';
import { quoteFromPersistence, quoteToPersistence } from '../../persistence/mappers/quoteMapper';
import { KeyedQueues } from './KeyedQueues';
import type { NoteVaultDeps } from './NoteVaultDeps';
import { joinFolder, projectFolderOf } from './paths';
import { readNoteBackedEntity, saveNoteBackedEntity, type NoteWriteSpec } from './noteEntityWrite';
function quoteEditRefusal(raw: unknown, projectId: ProjectId): RepositoryError | null {
 const current = quoteFromPersistence(raw);
 if (!current.ok) return current.error;
 if (current.value.status === 'received') return { category: 'Validation', code: 'quote.immutable', message: 'Received quotes cannot be changed. Record a revision as a new quote.' };
 if (current.value.projectId !== projectId) return { category: 'Validation', code: 'quote.project-immutable', message: 'A quote cannot be moved to another project.' };
 return null;
}
export class ObsidianQuoteRepository implements QuoteRepository {
 private readonly queues = new KeyedQueues();
 constructor(private readonly deps: NoteVaultDeps) {}
 getById(id: QuoteId): Promise<Result<Loaded<Quote> | null, RepositoryError>> { return readNoteBackedEntity(this.deps, 'quote', id, quoteFromPersistence, 'quote.entity-invalid'); }
 save(quote: Quote, expected: Expected): Promise<Result<Loaded<Quote>, RepositoryError>> { return this.queues.run('quote:' + quote.id, () => this.saveQueued(quote, expected)); }
 private saveQueued(quote: Quote, expected: Expected): Promise<Result<Loaded<Quote>, RepositoryError>> {
  const folder = projectFolderOf(this.deps.index, quote.projectId);
  const spec: NoteWriteSpec<Quote> = { kind: 'quote', indexType: 'renovation-quote', retiredKeys: ['validUntil'], notesFolder: folder === undefined ? undefined : joinFolder(folder, 'Quotes'), projectId: item => item.projectId, entryName: item => item.title, toPersistence: quoteToPersistence, preWriteValid: dto => quoteFromPersistence(dto).ok, validateCurrent: raw => quoteEditRefusal(raw, quote.projectId), validationCode: 'quote.pre-write-invalid', writeFailedCode: 'quote.write-failed' };
  return saveNoteBackedEntity(this.deps, spec, quote, expected);
 }
 async listByProject(projectId: ProjectId): Promise<Result<QuoteListing, RepositoryError>> {
  const projectIds = new Set(this.deps.index.getIdsByProject(projectId));
  const loaded: Loaded<Quote>[] = []; let refused = 0;
  for (const id of this.deps.index.getIdsByType('renovation-quote')) {
   if (!projectIds.has(id)) continue;
   const result = await this.getById(id as QuoteId);
   if (!result.ok) { refused++; this.deps.ledger.record('quote', id, result.error); }
   else if (result.value) loaded.push(result.value);
  }
  return ok({ loaded, refused });
 }
}

import { joinFolder, normalizeFolder } from './paths';
import { ok, type Result } from '../../../core/result/Result';
import type { EntityId } from '../../../core/identity/EntityId';
import type { NamedRecordListing, NamedRecordRepository } from '../../../application/ports/NamedRecordRepository';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import type { Expected, Loaded } from '../../../application/ports/versioning';
import type { NamedCatalogueMapper } from '../../persistence/mappers/namedCatalogueMapper';
import type { NoteVaultDeps } from './NoteVaultDeps';
import { KeyedQueues } from './KeyedQueues';
import { readNoteBackedEntity, saveNoteBackedEntity, type NoteWriteSpec } from './noteEntityWrite';

/** Catalogue notes use the existing conditional Markdown writer and global ProjectIndex. */
export class ObsidianNamedCatalogueRepository<T extends { readonly id: EntityId<string>; readonly name: string }> implements NamedRecordRepository<T> {
 private readonly queues = new KeyedQueues();
 constructor(private readonly deps: NoteVaultDeps, private readonly libraryFolder: string, private readonly mapper: NamedCatalogueMapper<T>) {}
 getById(id: T['id']): Promise<Result<Loaded<T> | null, RepositoryError>> {
  return readNoteBackedEntity(this.deps, this.mapper.kind, id, this.mapper.read, this.mapper.kind + '.entity-invalid');
 }
 save(entity: T, expected: Expected): Promise<Result<Loaded<T>, RepositoryError>> {
  return this.queues.run(this.mapper.kind + ':' + entity.id, () => {
   const spec: NoteWriteSpec<T> = { kind: this.mapper.kind, indexType: this.mapper.indexType,
    notesFolder: joinFolder(normalizeFolder(this.libraryFolder), this.mapper.folder), projectId: () => undefined,
    entryName: value => value.name, toPersistence: this.mapper.write,
    preWriteValid: dto => this.mapper.read(dto).ok, validationCode: this.mapper.kind + '.pre-write-invalid', writeFailedCode: this.mapper.kind + '.write-failed' };
   return saveNoteBackedEntity(this.deps, spec, entity, expected);
  });
 }
 async listAll(): Promise<Result<NamedRecordListing<T>, RepositoryError>> {
  const loaded: Loaded<T>[] = [], refused: { id: EntityId<string>; code: string; path: string }[] = [];
  for (const id of this.deps.index.getIdsByType(this.mapper.indexType)) {
   const found = await this.getById(id);
   if (!found.ok) { this.deps.ledger.record(this.mapper.kind, id, found.error); refused.push({ id, code: found.error.code, path: this.deps.index.getPath(id) ?? '' }); }
   else if (found.value) loaded.push(found.value);
  }
  return ok({ loaded, refused });
 }
}

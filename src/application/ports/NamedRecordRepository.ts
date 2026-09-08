import type { EntityId } from '../../core/identity/EntityId';
import type { Result } from '../../core/result/Result';
import type { RepositoryError } from './repositoryErrors';
import type { Expected, Loaded } from './versioning';

export interface NamedRecordListing<T> {
 readonly loaded: readonly Loaded<T>[];
 readonly refused: readonly { readonly id: EntityId<string>; readonly code: string; readonly path: string }[];
}
/** Shared note mechanics; Trade and Supplier retain separate domain identities and index kinds. */
export interface NamedRecordRepository<T extends { readonly id: EntityId<string>; readonly name: string }> {
 getById(id: T['id']): Promise<Result<Loaded<T> | null, RepositoryError>>;
 listAll(): Promise<Result<NamedRecordListing<T>, RepositoryError>>;
 save(entity: T, expected: Expected): Promise<Result<Loaded<T>, RepositoryError>>;
}

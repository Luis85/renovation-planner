import type { Result } from '../../core/result/Result';
import type { Quote, QuoteId } from '../../domain/quote/Quote';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { Loaded, Expected } from './versioning';
import type { RepositoryError } from './repositoryErrors';
export interface QuoteListing { readonly loaded: readonly Loaded<Quote>[]; readonly refused: number }
export interface QuoteRepository {
 getById(id: QuoteId): Promise<Result<Loaded<Quote> | null, RepositoryError>>;
 listByProject(id: ProjectId): Promise<Result<QuoteListing, RepositoryError>>;
 save(quote: Quote, expected: Expected): Promise<Result<Loaded<Quote>, RepositoryError>>;
}

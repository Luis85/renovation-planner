import type { AppError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { Quote } from '../../../domain/quote/Quote';
import { validateQuote, sameQuote } from '../../../domain/quote/Quote';
import type { Supplier } from '../../../domain/supplier/Supplier';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { NamedRecordRepository } from '../../ports/NamedRecordRepository';
import type { QuoteRepository } from '../../ports/QuoteRepository';
import type { Expected, Loaded } from '../../ports/versioning';
import { readProjectWork, type ProjectWorkDeps, type ProjectWorkRead } from '../../queries/schedule/ProjectWork';
import type { NamedCatalogueServices } from '../catalogue/NamedCatalogueServices';
export interface QuoteInput { readonly quote: Quote; readonly expected: Expected }
export interface QuoteComparisonRead {
 readonly work: ProjectWorkRead;
 readonly offers: readonly Loaded<Quote>[];
 readonly suppliers: readonly Supplier[];
 readonly assets: readonly { readonly id: string; readonly name: string }[];
 readonly unreadable: number;
}
export interface QuoteServices {
 read(id: ProjectId): Promise<Result<QuoteComparisonRead, AppError>>;
 save(input: QuoteInput): Promise<Result<Loaded<Quote>, AppError>>;
 readonly suppliers: NamedCatalogueServices<Supplier>;
 onChanged(listener: () => void): () => void;
}
export interface QuoteDeps extends ProjectWorkDeps {
 readonly quotes: QuoteRepository;
 readonly suppliers: NamedRecordRepository<Supplier>;
 readonly assets: AssetRepository;
}
export async function readQuoteComparison(deps: QuoteDeps, id: ProjectId): Promise<Result<QuoteComparisonRead, AppError>> {
 const work = await readProjectWork(deps, id);
 if (!work.ok) return work;
 const [quotes, suppliers, assets] = await Promise.all([deps.quotes.listByProject(id), deps.suppliers.listAll(), deps.assets.listAll()]);
 if (!quotes.ok) return quotes;
 if (!suppliers.ok) return suppliers;
 if (!assets.ok) return assets;
 return ok({ work: work.value, offers: quotes.value.loaded, suppliers: suppliers.value.loaded.map(item => item.entity), assets: assets.value.loaded.map(item => ({ id: item.entity.id, name: item.entity.name })), unreadable: quotes.value.refused + suppliers.value.refused.length + assets.value.skipped.length });
}
function missing(message: string): AppError { return { category: 'Reference', code: 'quote.link-missing', message }; }
async function checkWorkLink(deps: QuoteDeps, projectId: ProjectId, link: { planId: string; workId: string }): Promise<Result<void, AppError>> {
 const plan = await deps.plans.getById(link.planId as PlanId);
 if (!plan.ok) return plan;
 if (plan.value?.entity.projectId !== projectId || !plan.value.entity.renovation?.work.some(work => work.id === link.workId)) return err(missing('A linked Work item no longer exists in this project.'));
 return ok(undefined);
}
async function checkAssetLink(deps: QuoteDeps, id: string): Promise<Result<void, AppError>> {
 const asset = await deps.assets.getById(id as AssetId);
 if (!asset.ok) return asset;
 return asset.value ? ok(undefined) : err(missing('A linked asset no longer exists.'));
}
async function validateQuoteLinks(deps: QuoteDeps, quote: Quote): Promise<Result<void, AppError>> {
 const supplier = await deps.suppliers.getById(quote.supplierId);
 if (!supplier.ok) return supplier;
 if (!supplier.value) return err(missing('The supplier no longer exists.'));
 const assetIds = new Set(quote.items.flatMap(item => item.assetIds));
 const work = new Map(quote.items.flatMap(item => item.work).map(link => [JSON.stringify([link.planId, link.workId]), link]));
 for (const id of assetIds) { const result = await checkAssetLink(deps, id); if (!result.ok) return result; }
 for (const link of work.values()) { const result = await checkWorkLink(deps, quote.projectId, link); if (!result.ok) return result; }
 return ok(undefined);
}
/** Stable create identities allow a read-only retry to acknowledge an already landed save. */
export async function saveQuote(deps: QuoteDeps, input: QuoteInput): Promise<Result<Loaded<Quote>, AppError>> {
 const valid = validateQuote(input.quote);
 if (!valid.ok) return valid;
 const existing = await deps.quotes.getById(input.quote.id);
 if (!existing.ok) return existing;
 if (input.expected === 'absent' && existing.value && sameQuote(existing.value.entity, input.quote)) return ok(existing.value);
 const project = await deps.projects.getById(input.quote.projectId);
 if (!project.ok) return project;
 if (!project.value) return err(missing('The project no longer exists.'));
 const linked = await validateQuoteLinks(deps, input.quote);
 return linked.ok ? deps.quotes.save(input.quote, input.expected) : linked;
}

import { TradeFrontmatterSchemaV1, SupplierFrontmatterSchemaV1 } from '../dto/namedCatalogueFrontmatter';
import type { EntityId } from '../../../core/identity/EntityId';
import type { ValidationError } from '../../../core/errors/AppError';
import type { Result } from '../../../core/result/Result';
import { createTrade, type Trade } from '../../../domain/trade/Trade';
import { createSupplier, type Supplier } from '../../../domain/supplier/Supplier';
import { parsePersisted } from './parse';

export interface NamedCatalogueMapper<T extends { readonly id: EntityId<string>; readonly name: string }> {
 readonly kind: 'trade' | 'supplier';
 readonly indexType: 'renovation-trade' | 'renovation-supplier';
 readonly folder: 'Trades' | 'Suppliers';
 read(this: void, raw: unknown): Result<T, ValidationError>;
 write(this: void, entity: T, revision: number): Record<string, unknown>;
}
function mapper<T extends { readonly id: EntityId<string>; readonly name: string }>(kind: 'trade' | 'supplier', folder: 'Trades' | 'Suppliers', create: (id: T['id'], name: string) => Result<T, ValidationError>): NamedCatalogueMapper<T> {
 const indexType = kind === 'trade' ? 'renovation-trade' : 'renovation-supplier';
 const schema = kind === 'trade' ? TradeFrontmatterSchemaV1 : SupplierFrontmatterSchemaV1;
 return { kind, indexType, folder,
  read(raw) { const parsed = parsePersisted(schema, raw, kind + '.frontmatter-invalid', folder + ' note'); return parsed.ok ? create(parsed.value.id as T['id'], parsed.value.name) : parsed; },
  write(entity, revision) { return { type: indexType, 'schema-version': 1, id: entity.id, revision, name: entity.name }; },
 };
}
export const TRADE_MAPPER = mapper<Trade>('trade', 'Trades', createTrade);
export const SUPPLIER_MAPPER = mapper<Supplier>('supplier', 'Suppliers', createSupplier);

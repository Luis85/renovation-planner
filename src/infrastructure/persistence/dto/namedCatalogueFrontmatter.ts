import { z } from 'zod';
function catalogueSchema(type: 'renovation-trade' | 'renovation-supplier') {
 return z.object({ type: z.literal(type), 'schema-version': z.literal(1), id: z.string().min(1), revision: z.number().int().nonnegative().catch(0), name: z.string() });
}
export const TradeFrontmatterSchemaV1 = catalogueSchema('renovation-trade');
export const SupplierFrontmatterSchemaV1 = catalogueSchema('renovation-supplier');

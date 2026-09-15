/** Durable content ids, independent of host chrome and asset-library definitions. Absence means Default. */
export const ITEM_COLORS = ['slate', 'rose', 'amber', 'green', 'blue', 'violet'] as const;
export type ItemColor = typeof ITEM_COLORS[number];

/** Plain Items and placed library assets only; structural and drafting facts keep their own visual semantics. */
export function itemColorKind(kind: string): boolean { return kind === 'object' || kind === 'asset'; }
export function isItemColor(value: unknown): value is ItemColor { return typeof value === 'string' && ITEM_COLORS.includes(value as ItemColor); }

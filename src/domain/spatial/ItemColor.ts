/** Durable user appearance, independent of host chrome and asset-library definitions. Absence means Default. */
export const ITEM_COLORS = ['slate', 'rose', 'amber', 'green', 'blue', 'violet'] as const;
export type ItemColorPreset = typeof ITEM_COLORS[number];
/** A lowercase `#rrggbb` from the colour picker — the one custom form (plan colours design §1). */
export type HexColor = `#${string}`;
export type ItemColor = ItemColorPreset | HexColor;

export function isItemColorPreset(value: unknown): value is ItemColorPreset { return typeof value === 'string' && ITEM_COLORS.includes(value as ItemColorPreset); }
export function isHexColor(value: unknown): value is HexColor { return typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value); }
export function isItemColor(value: unknown): value is ItemColor { return isItemColorPreset(value) || isHexColor(value); }

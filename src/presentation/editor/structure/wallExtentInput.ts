import { Decimal } from 'decimal.js';

/** Current project length unit is metres. Expand without exponent notation or display quantization. */
export function formatWallExtent(mm: number): string { return new Decimal(mm).div(1000).toFixed(); }

/**
 * The error model (SDD §64): eight categories sharing one base shape, so application code
 * can narrow on `category` uniformly. These are plain data interfaces, deliberately not
 * classes — a domain error is a value carried inside a `Result`, never thrown.
 *
 * No category enumerates its own `code` values here; that catalog lives beside the module
 * that raises it (e.g. `domain/zone/Zone.errors.ts`, §78).
 */

export type ErrorCategory =
	| 'Domain'
	| 'Validation'
	| 'Persistence'
	| 'Geometry'
	| 'Import'
	| 'Migration'
	| 'Reference'
	| 'Calculation';

export interface BaseError<
	TCategory extends ErrorCategory,
	TCode extends string = string,
> {
	readonly category: TCategory;
	readonly code: TCode;
	readonly message: string;
	readonly cause?: unknown;
}

export type DomainError = BaseError<'Domain'>;
export type ValidationError = BaseError<'Validation'>;
export type PersistenceError = BaseError<'Persistence'>;
export type GeometryError = BaseError<'Geometry'>;
export type ImportError = BaseError<'Import'>;
export type MigrationError = BaseError<'Migration'>;

/**
 * Shadows the ambient JavaScript global of the same name. Kept as a plain data type —
 * never `class ReferenceError extends Error` — so `throw new ReferenceError(...)` can
 * only ever resolve to the built-in, and the collision never matters at the value level.
 */
export type ReferenceError = BaseError<'Reference'>;

export type CalculationError = BaseError<'Calculation'>;

export type AppError =
	| DomainError
	| ValidationError
	| PersistenceError
	| GeometryError
	| ImportError
	| MigrationError
	| ReferenceError
	| CalculationError;

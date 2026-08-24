import type { ZodType } from 'zod';
import type { ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';

/**
 * The one door every persisted shape passes through on read (SDD §43): Zod parse, and a
 * failure becomes a `ValidationError` carrying the schema's own message. Invalid data
 * never reaches a mapper, so it never constructs a domain entity.
 */
export function parsePersisted<T>(
	schema: ZodType<T>,
	raw: unknown,
	code: string,
	entityLabel: string,
): Result<T, ValidationError> {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		return err({
			category: 'Validation',
			code,
			message: `${entityLabel} failed validation: ${parsed.error.issues
				.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
				.join('; ')}`,
		});
	}
	return ok(parsed.data);
}

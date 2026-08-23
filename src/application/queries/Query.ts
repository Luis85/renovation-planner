/**
 * The shared query shape (SDD §35): read-only, no event emission.
 */
export interface Query<TInput, TResult> {
	execute(input: TInput): Promise<TResult>;
}

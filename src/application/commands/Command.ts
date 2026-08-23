/**
 * The shared command shape (SDD §29). No `UndoableCommand` here — that variant is a
 * slice 6 concern layered on top (ADR-007).
 */
export interface Command<TInput, TResult> {
	execute(input: TInput): Promise<TResult>;
}

/**
 * The logging port — SDD §67's four levels, and the whole of it.
 *
 * It lives in `application/ports/` and not in `infrastructure/logging/`, which is where the
 * IMPLEMENTATION lives (SDD §7.4): a port down there would force every application-layer
 * caller to import `infrastructure/`, the one direction §8 forbids. And not in `core/`
 * either, deliberately — a port in `core/` is reachable from `domain/`, and domain code
 * here does not log. A pure entity returns a `Result` and its caller decides what to record.
 *
 * `event` is a stable dot-delimited key (`'settings.load.failed'`), not a sentence: it is
 * what a reader greps for and what a test asserts on, while `context` carries the values.
 * Slice 11's rules for which level a given event takes attach to this interface without
 * changing it.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
	debug(event: string, context?: Record<string, unknown>): void;
	info(event: string, context?: Record<string, unknown>): void;
	warn(event: string, context?: Record<string, unknown>): void;
	error(event: string, context?: Record<string, unknown> & { cause?: unknown }): void;
}

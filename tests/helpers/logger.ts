import type { LogLevel, Logger } from '../../src/application/ports/Logger';

/**
 * Re-exported for `tests/helpers/vault.ts`'s `RepositoryStack.logger: Logger` — that
 * file imports it from here rather than from the port directly, and this module used to
 * carry the name only as a LOCAL, unexported type-only import, which type-checked nothing
 * until `tests/helpers/fixtureVault.test-d.ts` pulled `vault.ts` into a real program for
 * the first time and found it (`TS2459: declares 'Logger' locally, but it is not
 * exported`).
 */
export type { Logger };

/**
 * A `Logger` that records instead of printing, plus the `vi.mock` factory that makes the
 * plugin construct it.
 *
 * Bootstrap logging is asserted on the PORT, never on a console: what the adapter does with
 * a call is `tests/infrastructure/logging/consoleLogger.test.ts`'s subject, and a suite that
 * asserted on console methods here would be testing the adapter twice and the wiring never.
 *
 * There is no injection seam in the plugin for this, on purpose — `onload` constructs its
 * own logger, which is the property Task 2 asserts by identity. So the ADAPTER's module is
 * mocked instead. Vitest gives each test file its own module registry, so `recorder` below
 * is one instance per file and identity assertions mean what they say.
 */
export interface Line {
	level: LogLevel;
	event: string;
	context?: Record<string, unknown>;
}

/** Every line the code under test logged, in order. */
export const lines: Line[] = [];

/** Every `minLevel` the code under test asked the adapter factory for — one per construction. */
export const levels: LogLevel[] = [];

/** Every floor change asked of the adapter — slice 11's verbose-logging switch, observed. */
export const levelChanges: LogLevel[] = [];

const record =
	(level: LogLevel) =>
	(event: string, context?: Record<string, unknown>): void => {
		lines.push({ level, event, context });
	};

/**
 * The ADAPTER's shape, not just the port's: slice 11's verbose-logging setting reaches
 * `setLevel` through the concrete type only the plugin knows, so the mock carries it too
 * — a fake thinner than the real thing would crash exactly the wiring worth testing.
 */
export const recorder: Logger & { setLevel(level: LogLevel): void } = {
	setLevel: (level: LogLevel): void => {
		levelChanges.push(level);
	},
	debug: record('debug'),
	info: record('info'),
	warn: record('warn'),
	error: record('error'),
};

/** What `vi.mock` should return for `src/infrastructure/logging/consoleLogger`. */
export const consoleLoggerMock = (): { createConsoleLogger: (minLevel: LogLevel) => Logger } => ({
	createConsoleLogger: (minLevel: LogLevel): Logger => {
		levels.push(minLevel);
		return recorder;
	},
});

export const resetRecorder = (): void => {
	lines.length = 0;
	levels.length = 0;
	levelChanges.length = 0;
};

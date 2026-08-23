/**
 * The console sink, against a stubbed console — the one suite in this repository that
 * touches one at all.
 *
 * The subject is not "does it call the console": it is that four levels reach three
 * methods without becoming indistinguishable. `info` maps onto `console.debug` because
 * `eslint-plugin-obsidianmd` fails `console.info` and the marketplace bot lints with its
 * own config, so the level has to survive in the line's own text or level filtering
 * downstream rests on nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConsoleLogger } from '../../../src/infrastructure/logging/consoleLogger';

let debug: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
let log: ReturnType<typeof vi.spyOn>;
let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
	warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** The first argument of one call — the line a person actually reads. */
const lineOf = (spy: ReturnType<typeof vi.spyOn>, call = 0): string => String(spy.mock.calls[call][0]);

describe('the threshold', () => {
	it('drops debug and emits the other three at info', () => {
		const logger = createConsoleLogger('info');

		logger.debug('plugin.load.started');
		logger.info('index.rebuilt');
		logger.warn('sidecar.regenerated');
		logger.error('settings.load.failed');

		expect(debug).toHaveBeenCalledTimes(1);
		expect(lineOf(debug)).toContain('index.rebuilt');
		expect(warn).toHaveBeenCalledTimes(1);
		expect(error).toHaveBeenCalledTimes(1);
	});

	it('drops warn as well at error', () => {
		const logger = createConsoleLogger('error');

		logger.warn('sidecar.regenerated');
		logger.error('settings.load.failed');

		expect(warn).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledTimes(1);
	});
});

describe('the level in the line', () => {
	/**
	 * The case a method assertion cannot make: both of these reach `console.debug`, so if
	 * the level were carried only by which function was called, these two lines would be
	 * the same line. Asserted as "the level word appears", not as a full format — a later
	 * change to spacing or ordering is not a regression.
	 */
	it('tells a debug line from an info line although they share a method', () => {
		const logger = createConsoleLogger('debug');

		logger.debug('plugin.load.started');
		logger.info('index.rebuilt');

		expect(debug).toHaveBeenCalledTimes(2);
		expect(lineOf(debug, 0)).toContain('debug');
		expect(lineOf(debug, 1)).toContain('info');
	});

	it('names the level on warn and error too', () => {
		const logger = createConsoleLogger('info');

		logger.warn('sidecar.regenerated');
		logger.error('settings.load.failed');

		expect(lineOf(warn)).toContain('warn');
		expect(lineOf(error)).toContain('error');
	});
});

describe('what it passes through', () => {
	// Untouched, not stringified at the boundary: whoever reads the console wants the
	// Error with its stack, not this adapter's idea of how to print one.
	it('forwards a cause by identity', () => {
		const cause = new Error('data.json is a directory');
		const logger = createConsoleLogger('info');

		logger.error('settings.load.failed', { cause });

		expect((error.mock.calls[0][1] as { cause: unknown }).cause).toBe(cause);
	});

	it('passes context alongside the line', () => {
		const logger = createConsoleLogger('info');

		logger.warn('sidecar.regenerated', { path: 'Geometry/plan.rpgeo' });

		expect(warn.mock.calls[0][1]).toEqual({ path: 'Geometry/plan.rpgeo' });
	});

	// A reader should not be shown `undefined` for a call that had no context.
	it('emits one argument when there is no context', () => {
		const logger = createConsoleLogger('info');

		logger.warn('sidecar.regenerated');

		expect(warn.mock.calls[0]).toHaveLength(1);
	});
});

/**
 * The marketplace constraint, asserted at the forbidden thing rather than by reading a
 * config: the obsidianmd ruleset fails `console.log` and `console.info` and the review bot
 * lints with its own configuration, so no level may reach either method.
 */
it('never touches console.log or console.info', () => {
	const logger = createConsoleLogger('debug');

	logger.debug('a');
	logger.info('b');
	logger.warn('c');
	logger.error('d');

	expect(log).not.toHaveBeenCalled();
	expect(info).not.toHaveBeenCalled();
});

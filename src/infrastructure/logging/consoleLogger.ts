import type { LogLevel, Logger } from '../../application/ports/Logger';

/**
 * The only `Logger` implementation this slice builds, and the only file in the repository
 * allowed to name the console — `eslint.config.mjs` and `.oxlintrc.json` both carve
 * `no-console` off for this directory and nothing else.
 *
 * Two properties earn a console sink over a file-backed one, and both matter at bootstrap:
 * it keeps "no Vault access of any kind in this slice" true, and its construction cannot
 * fail — which matters precisely because it is constructed first, and a logger that needed
 * I/O to exist could fail at the one moment a failure most needs reporting.
 *
 * **`info` maps onto `console.debug`, and that is a marketplace constraint rather than a
 * preference.** The obsidianmd ruleset fails `console.log` and `console.info` while passing
 * `console.debug`, `console.warn` and `console.error` — measured — and the rule is
 * deliberately left ON inside the carve-out because the review bot lints a submission with
 * its own configuration, so a local override would not travel. The level therefore rides in
 * the emitted line's own text, which is what a reader greps for anyway. The cost, named
 * rather than glossed: `console.debug` lands in devtools' Verbose channel, hidden at the
 * default filter, so an `info` line is invisible until a user widens it. Slice 11's "copy
 * diagnostics" work is where a channel that does not depend on a devtools filter belongs.
 *
 * Returns void and never throws: a call site that had to handle a logging failure would
 * have two failures to report and no way to report either.
 */
const ORDER: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

/** One prefix, so a vault console with several plugins in it can be filtered to this one. */
const PREFIX = 'renovation-planner';

export function createConsoleLogger(minLevel: LogLevel): Logger & { setLevel(level: LogLevel): void } {
	// Mutable, via `setLevel` below: bootstrap constructs the logger BEFORE settings can
	// exist, and slice 11's verbose-logging setting then widens the floor once the load
	// has read it. The port stays four-methods; only the plugin knows its adapter can do
	// this.
	let floor = ORDER.indexOf(minLevel);

	const emit = (level: LogLevel, event: string, context?: Record<string, unknown>): void => {
		if (ORDER.indexOf(level) < floor) return;

		// Read off `console` at CALL time, through three static call sites: a reference
		// captured into a map at module load would not see a stubbed console (which is how
		// the suite drives this), and a computed `console[name]` would hide the method
		// being called from the obsidianmd rule that has to see it.
		const line = `${PREFIX} ${level} ${event}`;
		const args: [string, Record<string, unknown>?] = context === undefined ? [line] : [line, context];

		if (level === 'warn') console.warn(...args);
		else if (level === 'error') console.error(...args);
		else console.debug(...args);
	};

	return {
		setLevel(level: LogLevel): void {
			floor = ORDER.indexOf(level);
		},
		debug: (event, context) => emit('debug', event, context),
		info: (event, context) => emit('info', event, context),
		warn: (event, context) => emit('warn', event, context),
		error: (event, context) => emit('error', event, context),
	};
}

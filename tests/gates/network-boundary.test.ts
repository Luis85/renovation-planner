import { beforeAll, describe, expect, it } from 'vitest';
import obsidianmd from 'eslint-plugin-obsidianmd';
import { ESLINT_BOOT_MS, lintText, resolveConfig, warmUpEslint } from '../helpers/eslint';
import flatConfig from '../../eslint.config.mjs';

/**
 * Design slice 11's Definition of Done item 7 as a gate: **no dependency on a network
 * client, analytics SDK, or remote endpoint exists** in `infrastructure/logging/` or the
 * diagnostics query.
 *
 * The audit graded it PARTIAL for the reason this file exists. It was true by inspection —
 * `src/infrastructure/logging/` is two files importing two port modules, and
 * `GetDiagnosticsSnapshot.ts` imports two port types and `Query` — and NOTHING would have
 * caught its removal. The `no-restricted-globals` block banning `fetch` and friends is
 * scoped to `core/` and `domain/`, so both of these directories were free to name `fetch`,
 * `WebSocket`, `navigator.sendBeacon` or Obsidian's own `requestUrl`; `npm run analyze`'s
 * dependency hygiene sees packages, not calls. A snapshot that "never leaves the device"
 * was one line and a green `npm run check` away from being false.
 *
 * A rule at the forbidden thing rather than a list of the places, and the instrument tested
 * first: a rule that stops matching does not fail a lint run, it makes one quieter, and a
 * directory that never violates it looks identical either way. So each ban gets a snippet
 * that MUST report, the shapes the two directories actually use must NOT report, and the
 * blind spots `eslint.config.mjs` declares in prose are pinned as absences — writing down
 * that a computed member access escapes is not an endorsement, it is what stops the next
 * reader believing the rule covers a spelling it cannot see.
 *
 * Virtual paths, never files on disk: `lintText` resolves the REAL flat config for a path
 * without writing anything, which is what makes a fixture possible at all — a file under
 * `src/` that violates a rule on purpose would fail `npm run lint` for the whole repository.
 */

const GLOBALS = 'no-restricted-globals';
const IMPORTS = 'no-restricted-imports';

const LOGGING = 'src/infrastructure/logging/diagnosticsLedger.ts';
const QUERY = 'src/application/queries/GetDiagnosticsSnapshot.ts';

/** Where the ban deliberately does NOT reach, so "scoped" is measured rather than assumed. */
const REPOSITORY = 'src/infrastructure/obsidian/repositories/noteIo.ts';
const DOMAIN = 'src/domain/zone/Zone.ts';

/**
 * The GLOBAL NAMES a resolved `no-restricted-globals` rule value carries. Index 0 is the
 * severity; every entry after it is an option, and an option is either `{ name, message }`
 * or the bare-string spelling the rule also accepts.
 */
/** A rule entry as a list of its parts, or `[]` when it is absent or not configured as one. */
const toList = (rule: unknown): readonly unknown[] => (Array.isArray(rule) ? rule : []);

const namesIn = (rule: readonly unknown[]): string[] =>
	rule.slice(1).map((entry) => (typeof entry === 'string' ? entry : (entry as { name: string }).name));

/** Just enough of `no-restricted-imports`' option object for the superset comparison below. */
interface RestrictedImports {
	readonly paths?: ReadonlyArray<{ readonly name: string }>;
	readonly patterns?: ReadonlyArray<{ readonly group: readonly string[] }>;
}

/**
 * Which of `paths` reported `rule` for `code`, in order — an ARRAY compared against the
 * expected one rather than an assertion per path, so a failure names the path that went
 * quiet instead of stopping at the first. `expect`'s own second-argument message would say
 * the same thing and oxlint's `vitest(valid-expect)` refuses that spelling.
 */
const reportsIn = async (paths: readonly string[], code: string, rule: string): Promise<string[]> => {
	const reported = await Promise.all(paths.map(async (path) => [path, (await lintText(code, path)).includes(rule)] as const));
	return reported.filter(([, hit]) => hit).map(([path]) => path);
};

/** One `beforeAll` for ESLint's boot and for the first type-aware program build. */
beforeAll(async () => {
	await warmUpEslint();
	await lintText('export const probe = 1;\n', LOGGING);
}, ESLINT_BOOT_MS);

describe('the network boundary around diagnostics', () => {
	it.each([
		['fetch', 'export const send = (body: string) => fetch("https://example.test", { body });\n'],
		['an XMLHttpRequest', 'export const send = () => new XMLHttpRequest();\n'],
		['a WebSocket', 'export const send = () => new WebSocket("wss://example.test");\n'],
		['an EventSource', 'export const listen = () => new EventSource("https://example.test");\n'],
		['navigator.sendBeacon', 'export const send = (body: string) => navigator.sendBeacon("/t", body);\n'],
		['window as an indirect door', 'export const send = (body: string) => window.fetch("/t", { body });\n'],
		['globalThis as an indirect door', 'export const send = (body: string) => globalThis.fetch("/t", { body });\n'],
		['self as an indirect door', 'export const send = (body: string) => self.fetch("/t", { body });\n'],
	])('refuses %s in both directories', async (_what, code) => {
		expect(await reportsIn([LOGGING, QUERY], code, GLOBALS)).toEqual([LOGGING, QUERY]);
	});

	/**
	 * The IMPORT half. `requestUrl` is Obsidian's own network door and it is an import
	 * rather than a global, so the globals list above cannot see it at all — and
	 * `infrastructure/` may legitimately name `obsidian`, which is exactly why the member
	 * ban has to exist for this subtree.
	 */
	it.each([
		['requestUrl', 'import { requestUrl } from "obsidian";\nexport const send = () => requestUrl("https://example.test");\n'],
		['request', 'import { request } from "obsidian";\nexport const send = () => request("https://example.test");\n'],
	])('refuses the obsidian %s door in infrastructure/logging/', async (_what, code) => {
		expect(await lintText(code, LOGGING)).toContain(IMPORTS);
	});

	it.each([
		['node:https', 'import https from "node:https";\nexport const send = () => https;\n'],
		['bare https', 'import https from "https";\nexport const send = () => https;\n'],
		['node:net', 'import net from "node:net";\nexport const send = () => net;\n'],
		['a submodule of one', 'import x from "http2/lib/thing";\nexport const send = () => x;\n'],
		['electron', 'import { net } from "electron";\nexport const send = () => net;\n'],
	])('refuses an import of %s in both directories', async (_what, code) => {
		expect(await reportsIn([LOGGING, QUERY], code, IMPORTS)).toEqual([LOGGING, QUERY]);
	});

	/**
	 * **The override trap, and the reason `networkFree` composes `forbidden` instead of
	 * being written out.** Two flat-config blocks matching one file OVERRIDE
	 * `no-restricted-imports` rather than merging it, so a network-only block placed after
	 * the layer bans would have REPLACED each layer's own ban — trading a network hole for a
	 * layering hole, silently, with every existing lint test still green because none of
	 * them lints a path inside these two subtrees. This is the half a forgotten repeat would
	 * make invisible.
	 */
	it.each([
		['a query importing a repository', 'import { x } from "../../infrastructure/obsidian/y";\nexport const use = () => x;\n', QUERY],
		['a query importing Vue', 'import { ref } from "vue";\nexport const use = () => ref(1);\n', QUERY],
		['a query importing the composition root', 'import { x } from "../../plugin/composition-root";\nexport const use = () => x;\n', QUERY],
		['logging importing a view', 'import { x } from "../../presentation/y";\nexport const use = () => x;\n', LOGGING],
		['logging importing Konva', 'import Konva from "konva";\nexport const use = () => Konva;\n', LOGGING],
		['logging importing a prototype', 'import x from "../../prototypes/y";\nexport const use = () => x;\n', LOGGING],
	])('still refuses %s — the parent layer ban survived the override', async (_what, code, filePath) => {
		expect(await lintText(code, filePath)).toContain(IMPORTS);
	});

	/** What these two directories actually contain. A rule that refused these would fail the build. */
	it.each([
		['a port type import', 'import type { Logger } from "../../application/ports/Logger";\nexport const use = (l: Logger) => l;\n', LOGGING],
		['a core type import', 'import type { AppError } from "../../core/errors/AppError";\nexport const use = (e: AppError) => e.code;\n', LOGGING],
		['a domain type import', 'import type { Zone } from "../../domain/zone/Zone";\nexport const use = (z: Zone) => z;\n', QUERY],
	])('allows %s', async (_what, code, filePath) => {
		const reported = await lintText(code, filePath);
		expect(reported).not.toContain(IMPORTS);
		expect(reported).not.toContain(GLOBALS);
	});

	/**
	 * SCOPE, measured rather than assumed in both directions. The ban is per-directory: a
	 * repository may still name `requestUrl` (it has no reason to, but this rule is not what
	 * would stop it), and `core`/`domain`'s own DOM ban must still fire — that block matches
	 * different files, so nothing here should have disturbed it, and "should have" is not a
	 * check.
	 */
	it('does not reach a repository outside the two directories', async () => {
		const code = 'import { requestUrl } from "obsidian";\nexport const send = () => requestUrl("https://example.test");\n';
		expect(await lintText(code, REPOSITORY)).not.toContain(IMPORTS);
	});

	it('leaves the core/domain DOM ban firing', async () => {
		expect(await lintText('export const send = () => fetch("/t");\n', DOMAIN)).toContain(GLOBALS);
	});

	/**
	 * **The layer ban a `networkFree` block repeats is the PARENT's own object, not a copy**,
	 * and this is what says so without reading `eslint.config.mjs`'s source: the resolved
	 * `no-restricted-imports` for each of the two subtrees must be a SUPERSET of the resolved
	 * one for its parent layer.
	 *
	 * The six survival cases above drive the groups that exist today, which is exactly what a
	 * transcribed list defeats — a group added to `forbidden('application', ...)` and not to
	 * the copy would leave every one of them green. This compares two resolved configs against
	 * each other, so it holds for groups nobody has written yet, and it fails if the constants
	 * are ever un-hoisted and allowed to drift.
	 */
	it.each([
		['application/queries', QUERY, 'src/application/commands/zone/CreateZone.ts'],
		['infrastructure/logging', LOGGING, 'src/infrastructure/persistence/index/EchoWindow.ts'],
	])('%s repeats every group and package its parent layer bans', async (_what, child, parent) => {
		const banned = async (file: string): Promise<string[]> => {
			const [, options] = (await resolveConfig(file)).rules['no-restricted-imports'] as [unknown, RestrictedImports];
			return [
				...(options.paths ?? []).map((entry) => 'path:' + entry.name),
				...(options.patterns ?? []).flatMap((entry) => entry.group.map((glob) => 'group:' + glob)),
			].toSorted();
		};
		const parentBan = await banned(parent);
		expect(parentBan.length, 'the parent layer bans nothing - this comparison would be vacuous').toBeGreaterThan(0);
		expect((await banned(child)).filter((entry) => parentBan.includes(entry))).toEqual(parentBan);
	});

	/**
	 * **The override trap on the GLOBALS key, which is the one that nearly shipped.**
	 * `eslint-plugin-obsidianmd` already sets `no-restricted-globals` across every file in
	 * `src/` — `app`, `fetch`, `localStorage` — and a later block naming that rule for a
	 * subtree REPLACES the marketplace's list there rather than adding to it. `app` is the
	 * global the review bot rejects plugins for, so losing it is a submission failure that no
	 * local gate would report.
	 *
	 * The first version of the network block did exactly that, and the `core`/`domain` DOM
	 * block below it had been doing it since it was written — it happens to restate `fetch`
	 * and `localStorage`, which is why nobody noticed `app` going missing from the two layers
	 * least likely to reach for it. Both spread `OBSIDIAN_RESTRICTED_GLOBALS` now.
	 *
	 * Two halves, because neither is sufficient alone. This one DRIVES the four paths that
	 * exist today, which is what says the resolution actually works end to end; the case
	 * after it checks the CATEGORY, over every block the config declares rather than over
	 * the ones someone thought of.
	 */
	it.each([
		['app', 'export const use = () => app;\n'],
		['localStorage', 'export const use = () => localStorage;\n'],
	])('keeps the marketplace ban on %s in every subtree that names the rule', async (_what, code) => {
		const subtrees = [LOGGING, QUERY, DOMAIN, REPOSITORY];
		expect(await reportsIn(subtrees, code, GLOBALS)).toEqual(subtrees);
	});

	/**
	 * **The same invariant as a CATEGORY**, because the case above is a list of four places
	 * and the next block to name `no-restricted-globals` for a subtree of `src/` is the one
	 * that reintroduces the hole. This repository's own rule: a category invariant is checked
	 * at the forbidden thing, not by driving the paths someone thought of.
	 *
	 * The forbidden thing is a block that OVERRIDES the marketplace list without carrying it,
	 * so the subject is every block in the config whose `rules['no-restricted-globals']` is
	 * set — discovered from the imported config array, so a fifth block is in scope the moment
	 * it exists. It is compared against `eslint-plugin-obsidianmd`'s OWN declaration, read
	 * here from the plugin package rather than from `OBSIDIAN_RESTRICTED_GLOBALS`: that is the
	 * source of truth, and checking a block against it is a different list, not the same one
	 * twice. An earlier version of this file gave "the same list twice" as the reason for not
	 * doing this at all, which was wrong, and a four-place listing was what it bought.
	 *
	 * The plugin's own two blocks are in the discovered set and pass trivially — they ARE the
	 * declaration. Excluding them would need a rule for telling them apart, and a filter is
	 * one more thing that can quietly stop matching.
	 *
	 * What it does NOT check: which FILES a block applies to. A block could carry every
	 * marketplace name and be scoped to nothing at all. That is what the driven case above is
	 * for, and neither case is written as if it covered the other.
	 */
	it('carries the marketplace globals in every block that names the rule', () => {
		const declared = new Set(
			// Unannotated: the callback receives the plugin's own `Config`, and the hand-written
			// narrower shape is not something a `Config` is assignable to.
			obsidianmd.configs.recommendedWithLocalesEn.flatMap((config) =>
				// Guarded rather than defaulted: a configured rule is `RuleConfig`, which is not
				// necessarily an array — `?? []` only covers the ABSENT case, and `namesIn` takes a
				// list.
				namesIn(toList(config.rules?.['no-restricted-globals'])),
			),
		);
		expect(declared.size, 'the plugin declares no restricted globals - the derivation has gone silent').toBeGreaterThan(0);

		const blocks = (flatConfig as Array<{ files?: unknown; rules?: Record<string, readonly unknown[]> }>)
			.map((config, index) => ({ index, files: config.files, rule: config.rules?.['no-restricted-globals'] }))
			.filter((block): block is { index: number; files: unknown; rule: readonly unknown[] } => block.rule !== undefined);
		expect(blocks.length, 'no block names the rule - the discovery has gone silent').toBeGreaterThan(2);

		const missing = blocks
			.map((block) => ({ block, absent: [...declared].filter((name) => !namesIn(block.rule).includes(name)) }))
			.filter((entry) => entry.absent.length > 0)
			.map((entry) => 'block ' + String(entry.block.index) + ' ' + JSON.stringify(entry.block.files) + ' drops ' + entry.absent.join(', '));
		expect(missing).toEqual([]);
	});

	/**
	 * The spellings `eslint.config.mjs` states it CANNOT see, pinned as absences. Both are
	 * the same class of hole every `no-restricted-*` rule here declares for itself: the rule
	 * matches an identifier or a static specifier, and a computed access or a runtime string
	 * is neither. A reviewer is the backstop, and a reader deciding whether to trust this
	 * rule needs to know the hole is real.
	 */
	it.each([
		['a computed global access', 'export const send = (g: Record<string, (url: string) => void>) => g["fetch"]("/t");\n'],
		['a dynamic import', 'export const send = async () => await import("node:" + "https");\n'],
	])('cannot see %s, which the config says in prose and this pins', async (_what, code) => {
		const reported = await lintText(code, LOGGING);
		expect(reported).not.toContain(GLOBALS);
		expect(reported).not.toContain(IMPORTS);
	});
});

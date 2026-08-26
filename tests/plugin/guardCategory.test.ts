/**
 * @vitest-environment jsdom
 *
 * The Error Boundary as a CATEGORY (SDD §66), checked at the forbidden thing rather than
 * by listing the places.
 *
 * Slice 11's Definition of Done says no command or query's public contract can throw. That
 * is a claim about every service, including the ones nobody has written yet — and until
 * this file it was true by maintenance: someone remembered to wrap each member at the
 * composition root, and someone wrote one `not.toBeInstanceOf` line per member in a test.
 * A service composed next month without a guard passed all four gates, because nothing is
 * wrong with the code.
 *
 * So this file NAMES no service. It composes a real root, walks everything that root hands
 * out, and asks of each `execute`-bearing thing it finds:
 *
 * 1. **is it a guard wrapper at all** — `GUARDED_DOORS`, the mark every guard stamps, and
 *    the reason the check is a positive one rather than "not an instance of the class":
 *    the mark can only come from `guardCommand`/`guardQuery`, while "not the class" is
 *    also true of any other object; and
 * 2. **is every door a caller can reach guarded** — the mark records METHOD NAMES, so a
 *    service exposing `executeWithVersion` beside a wrapped `execute` is a finding. That
 *    is not hypothetical: it is the defect round 2 of this slice found, where the guard was
 *    present, the identity test was green, and the wrapper was on the method the app does
 *    not dispatch through.
 *
 * What this check deliberately does NOT reach, and the reason rather than a silence:
 * repository PORTS. `PlanEditorCommandServices.zones` and the requirement/asset ports leave
 * the root raw, and guarding a port is a different mechanism — every method, not one
 * `execute`. A port carries no `execute` at all, so the walk passes it by structurally
 * rather than by exception; closing that gap is somebody else's slice and this file would
 * have to grow a second question to hold it.
 *
 * Two halves, and the first one matters as much as the second: an instrument that finds
 * nothing passes silently. `walkForUnguarded` is therefore driven against FIXTURES — a
 * bundle with a raw command in it, a facade with an unguarded second door, a factory — and
 * only then against the real composition root.
 */
import { describe, expect, it } from 'vitest';
import { createCompositionRoot, planEditorDeps } from '../../src/plugin/composition-root';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { GUARDED_DOORS, guardCommand } from '../../src/application/errors/guardAgainstThrowing';
import { createVaultExceptionMapper } from '../../src/application/errors/exceptionMapper';
import { installObsidianDom } from '../helpers/dom';
import { recorder } from '../helpers/logger';

installObsidianDom();

/**
 * A member the walk finds and deliberately does not require a guard on, keyed by the PATH
 * it is found at and carrying its reason. A carve-out is what review argues about; a
 * silently skipped member is not.
 */
const CARVE_OUTS: Readonly<Record<string, string>> = {
	'persistence.queries.diagnostics':
		'GetDiagnosticsSnapshotQuery reads the migration runner, the manifest and the '
		+ 'in-memory issue ledger — no vault, nothing to map — so a guard would wrap a '
		+ 'function that cannot raise an infrastructure fault, and its `DiagnosticsSnapshot` '
		+ 'return is not even a `Result` for a mapped error to live in.',
};

interface Finding {
	readonly path: string;
	readonly problem: string;
}

interface WalkReport {
	/** Every service the walk decided to ask about, by path — the instrument's own reach. */
	readonly checked: readonly string[];
	readonly findings: readonly Finding[];
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** A bundle (an object literal the root composed), as opposed to a class instance. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (!isObject(value)) return false;
	const proto: unknown = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/** Anything with a callable `execute` is a command or a query, whatever it is called. */
function isService(value: unknown): value is Record<string, unknown> {
	return isObject(value) && typeof value.execute === 'function';
}

function guardedDoorsOf(service: object): readonly string[] | undefined {
	const mark: unknown = (service as Record<symbol, unknown>)[GUARDED_DOORS];
	return Array.isArray(mark) ? (mark as readonly string[]) : undefined;
}

/**
 * Every method a caller can actually reach on this object — own properties AND the
 * prototype chain, because a class instance keeps its methods on the prototype and it is
 * exactly a class instance that must not be here.
 */
function reachableDoors(service: object): string[] {
	const names = new Set<string>();
	let level: object | null = service;
	while (level !== null && level !== Object.prototype) {
		for (const key of Object.getOwnPropertyNames(level)) {
			if (key === 'constructor') continue;
			const descriptor = Object.getOwnPropertyDescriptor(level, key);
			if (typeof descriptor?.value === 'function') names.add(key);
		}
		level = Object.getPrototypeOf(level) as object | null;
	}
	return [...names];
}

function inspect(service: object, path: string, report: Finding[]): void {
	const doors = guardedDoorsOf(service);
	if (doors === undefined) {
		report.push({ path, problem: 'is not a guard wrapper — it left the composition root raw' });
		return;
	}
	for (const door of reachableDoors(service)) {
		if (!doors.includes(door)) {
			report.push({ path, problem: `exposes \`${door}\`, which no guard wraps` });
		}
	}
}

/**
 * Walk everything reachable from `root` and report every unguarded door.
 *
 * The traversal rules, each of which is a rule rather than a list:
 *
 * - a value with a callable `execute` is a SERVICE and is inspected, whatever its shape —
 *   which is what lets a raw command class be caught rather than skipped;
 * - a plain object or an array is a BUNDLE and is descended into, because that is what the
 *   root composes its groups out of (`queries`, `requirementQueries`, `commands`);
 * - a class instance that is not a service is NOT descended into: repositories, the index,
 *   the change adapter and the migration runner are collaborators, not service bundles,
 *   and walking their innards would report their private fields;
 * - a zero-argument FUNCTION is called, and its answer walked, because a factory is a door
 *   too — `calibratePlan` is handed to the editor as one and never passes through
 *   `PersistenceServices`. Anything that is not a service is ignored, and a call that
 *   throws is not one either. The root under test is a throwaway, so calling a member of
 *   it reaches nothing outside this file.
 */
export function walkForUnguarded(root: unknown, rootPath: string): WalkReport {
	const findings: Finding[] = [];
	const checked: string[] = [];
	const seen = new Set<unknown>();

	const visit = (value: unknown, path: string, depth: number): void => {
		if (depth > 8) return;
		if (typeof value === 'function') {
			if (value.length !== 0) return;
			let produced: unknown;
			try {
				produced = (value as () => unknown)();
			} catch {
				return;
			}
			if (isService(produced)) visit(produced, `${path}()`, depth + 1);
			return;
		}
		if (!isObject(value) || seen.has(value)) return;
		seen.add(value);

		if (isService(value)) {
			if (CARVE_OUTS[path] !== undefined) return;
			checked.push(path);
			inspect(value, path, findings);
			return;
		}
		if (Array.isArray(value)) {
			value.forEach((item, i) => {
				visit(item, `${path}[${i}]`, depth + 1);
			});
			return;
		}
		if (!isPlainObject(value)) return;
		for (const [key, member] of Object.entries(value)) {
			visit(member, `${path}.${key}`, depth + 1);
		}
	};

	visit(root, rootPath, 0);
	return { checked, findings };
}

const map = createVaultExceptionMapper('vault');
const guarded = (): { execute: (input: unknown) => Promise<never> } =>
	guardCommand({ execute: () => Promise.reject(new Error('never run')) }, 'test.failed', recorder, map) as never;

describe('the walk that checks the boundary', () => {
	it('finds a raw command sitting in a nested bundle', () => {
		class RawCommand {
			async execute(): Promise<void> {
				return await Promise.resolve();
			}
		}
		const report = walkForUnguarded({ inner: { ok: guarded(), raw: new RawCommand() } }, 'root');

		expect(report.checked).toContain('root.inner.raw');
		expect(report.findings).toEqual([
			{ path: 'root.inner.raw', problem: 'is not a guard wrapper — it left the composition root raw' },
		]);
	});

	/**
	 * The shape a "is it a wrapper?" check cannot see, and the one this slice actually
	 * shipped: `guardCommand` wraps `execute` only, so a facade that pairs it with a raw
	 * `executeWithVersion` is guarded, marked, and open on the door the Inspector uses.
	 */
	it('finds a second door beside a guarded one', () => {
		const facade = { ...guarded(), executeWithVersion: () => Promise.resolve() };
		Object.defineProperty(facade, GUARDED_DOORS, { value: ['execute'] });

		const report = walkForUnguarded({ overrides: facade }, 'root');

		expect(report.findings).toEqual([
			{ path: 'root.overrides', problem: 'exposes `executeWithVersion`, which no guard wraps' },
		]);
	});

	it('follows a factory to the service it hands back', () => {
		const report = walkForUnguarded({ make: () => ({ execute: () => Promise.resolve() }) }, 'root');

		expect(report.checked).toEqual(['root.make()']);
		expect(report.findings).toHaveLength(1);
	});

	it('passes a guarded bundle, a repository port and a cycle', () => {
		class Repository {
			async getById(): Promise<null> {
				return await Promise.resolve(null);
			}
			async save(): Promise<void> {
				return await Promise.resolve();
			}
		}
		const bundle: Record<string, unknown> = { queries: { one: guarded() }, zones: new Repository() };
		bundle.self = bundle;

		const report = walkForUnguarded(bundle, 'root');

		expect(report.checked).toEqual(['root.queries.one']);
		expect(report.findings).toEqual([]);
	});
});

const vaultStack = () =>
	({
		vault: { getAbstractFileByPath: () => null, getFiles: () => [], getMarkdownFiles: () => [] },
		fileManager: {},
		metadataCache: { getFileCache: () => null },
	}) as never;

describe('every service leaving the composition root is guarded', () => {
	function report(): WalkReport {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
		if (root.persistence === null) throw new Error('expected a composed persistence stack');
		const persistence = walkForUnguarded(root.persistence, 'persistence');
		// The editor's bundle is the second door out of the root, and the only one that
		// hands over a factory. Walked with the same instrument, into the same report.
		const editor = walkForUnguarded(planEditorDeps(root, {} as never, {} as never), 'editorDeps');
		return {
			checked: [...persistence.checked, ...editor.checked],
			findings: [...persistence.findings, ...editor.findings],
		};
	}

	it('hands out no unguarded command, query or door', () => {
		expect(report().findings).toEqual([]);
	});

	/**
	 * The instrument's own check, because a walk that reached nothing would report no
	 * findings and look identical to a guarded composition.
	 *
	 * A FLOOR rather than a count: this number rises with every slice and an exact one
	 * would be a second list to maintain — the very thing this file replaced. What the
	 * three named paths prove is REACH, not membership: one member of a nested bundle, one
	 * facade with two doors, and the product of a factory that never passes through
	 * `PersistenceServices` at all.
	 */
	it('actually reaches the services it is claiming to have checked', () => {
		const { checked } = report();

		expect(checked.length).toBeGreaterThanOrEqual(30);
		expect(checked).toContain('persistence.requirementQueries.listAssets');
		expect(checked).toContain('persistence.setRequirementQuantityOverride');
		expect(checked).toContain('editorDeps.commands.calibratePlan()');
	});

	/**
	 * The carve-out, asserted rather than commented: it is skipped BY PATH, and if the
	 * diagnostics query ever grows a vault read the fix is to guard it and delete this,
	 * never to widen the key.
	 */
	it('carves out only the diagnostics snapshot, which touches no vault', () => {
		expect(Object.keys(CARVE_OUTS)).toEqual(['persistence.queries.diagnostics']);
		expect(report().checked).not.toContain('persistence.queries.diagnostics');
	});
});

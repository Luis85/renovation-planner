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
 * So this file NAMES no service. It composes a real root, DETONATES eight named
 * collaborators underneath it — the six repositories, the geometry port and the file probe,
 * each port method replaced by a thrower — walks everything the root hands out, and drives a
 * hostile input through EVERY DOOR of everything it finds.
 *
 * Four hand-written lists live in this file — that detonation array, `SERVICE_CARVE_OUTS`,
 * `DOOR_CARVE_OUTS`, and the skip test's `owners`. The last three are each asserted by exact
 * key set, so a drift is named at an assertion. The detonation array is the one that is NOT,
 * deliberately: `index`, `vaultDeps`, `migrations`, `geometryStore`, `locks`, `markers` and
 * `changeAdapter` are left intact, which costs nothing only because of the fail-closed
 * property below — a service whose collaborators were not detonated answers a SUCCESS, and a
 * success is a finding, so a missing name is caught indirectly rather than by nothing at
 * all. Each door must
 * answer a resolved `vault.unexpected-failure`, which is the boundary's mapped refusal and
 * the only thing that can come back when the vault below a guarded service throws.
 *
 * **Behavioural, not structural, and that is the whole point.** A structural check — "is
 * this object a wrapper rather than the class?" — cannot see the defect this branch has
 * already shipped once: `guardCommand` wraps `execute`, the Inspector's reversible adapters
 * dispatch an override through `executeWithVersion`, and a facade pairing a wrapped
 * `execute` with a raw second door is a wrapper by every structural test anyone can write.
 * Driving the door is what makes the answer un-spoofable: a raw command REJECTS, and no
 * amount of declaring can make it resolve a mapped refusal.
 *
 * **It fails CLOSED.** A service whose collaborators the probe could not detonate answers a
 * success instead of a refusal, and a success is reported as a finding. So the failure mode
 * of the instrument is a red gate somebody has to look at, never a silent pass.
 *
 * What this check does NOT reach, said plainly rather than left as a silence:
 *
 * - **repository PORTS.** `PlanEditorCommandServices.zones` and the requirement/asset ports
 *   leave the root raw. Guarding a port is a different mechanism — every method, not one
 *   `execute` — and a port carries no `execute…` member, so the walk passes it by
 *   structurally rather than by exception. Closing that gap belongs to another slice, and
 *   this file would need a second question to hold it.
 * - **a service hiding inside a class instance.** The walk descends into bundles (plain
 *   objects and arrays) and never into a class instance that is not itself a service,
 *   because repositories, the index, the change adapter and the migration runner are
 *   collaborators whose innards are nobody's business here. A command composed as a FIELD
 *   of such an object is invisible.
 * - **a door-bearing object with no `execute…` member at all.** `isService` recognises a
 *   member whose name begins with `execute`, which covers `execute` and
 *   `executeWithVersion`, the two entry-point spellings this codebase has. An object whose
 *   only door were `undo`, or `run`, would not be recognised as a service — though `undo`
 *   IS driven once a service is recognised, since `reachableDoors` returns every reachable
 *   member (methods and accessors alike) rather than the ones matching that prefix.
 * - **anything past depth 8, a function that takes arguments, and a factory whose call
 *   throws.** Those three are RECORDED rather than silently skipped — see `Skip` — because
 *   a recorded skip is something review can see. The most probable next hole is the second:
 *   `calibratePlan` is zero-argument today, and a factory usually takes one.
 *
 * Two halves, and the first matters as much as the second: an instrument that reached
 * nothing would report no findings and look exactly like a guarded composition. `discover`
 * and `auditDoors` are therefore driven against FIXTURES first — a raw command in a nested
 * bundle, a facade whose second door is raw, a door that answers success, a factory, a
 * cycle, a port — and only then against the real composition root.
 */
import { describe, expect, it } from 'vitest';
import { createCompositionRoot, planEditorDeps } from '../../src/plugin/composition-root';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { guardCommand } from '../../src/application/errors/guardAgainstThrowing';
import { createVaultExceptionMapper } from '../../src/application/errors/exceptionMapper';
import { installObsidianDom } from '../helpers/dom';
import { recorder } from '../helpers/logger';

installObsidianDom();

/**
 * A service the walk finds and does not drive, keyed by the PATH it is found at and
 * carrying its reason. A carve-out is what review argues about; a silently skipped member
 * is not.
 */
const SERVICE_CARVE_OUTS: Readonly<Record<string, string>> = {
	'persistence.queries.diagnostics':
		'GetDiagnosticsSnapshotQuery reads the migration runner, the manifest and the '
		+ 'in-memory issue ledger — no vault, nothing to map — so a guard would wrap a '
		+ 'function that cannot raise an infrastructure fault, and its `DiagnosticsSnapshot` '
		+ 'return is not even a `Result` for a mapped error to live in.',
};

/** One DOOR of an otherwise driven service, same rule: named, with its reason. */
const DOOR_CARVE_OUTS: Readonly<Record<string, string>> = {
	'editorDeps.commands.calibratePlan()#undo':
		'An undo before any execute has nothing recorded to reverse, so it refuses with a '
		+ 'coded Result and never reaches the sidecar — no fault can be driven through it '
		+ 'from a fresh transaction, whatever the vault below is doing. It is driven at the '
		+ 'WRAPPER instead, by guardWiring.test.ts\'s "guards undo under its own event '
		+ 'name", which hands the guard a transaction whose undo throws.',
};

/** What the boundary answers when the vault below a guarded service throws. */
const MAPPED_REFUSAL = 'vault.unexpected-failure';

interface Finding {
	readonly path: string;
	readonly problem: string;
}

type SkipKind = 'function-with-arguments' | 'factory-threw' | 'depth-limit';

interface Skip {
	readonly path: string;
	readonly kind: SkipKind;
}

interface Discovery {
	/** Every service the walk found, in the order it found them. */
	readonly discovered: readonly { readonly path: string; readonly service: object }[];
	readonly skipped: readonly Skip[];
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

/**
 * Every method a caller can reach — own properties AND the prototype chain, because a
 * class instance keeps its methods on the prototype and it is exactly a class instance
 * that must not be here.
 *
 * An ACCESSOR counts, and that is not a formality: `get execute() { … }` is a door a
 * caller reaches by exactly the same expression as a method, and a version of this that
 * asked only for `descriptor.value` was structurally blind to it — `isService` would not
 * have recognised the object, `discover` would not have collected it, and `auditDoors`
 * would never have driven it. A whole raw service could sit in the tree looking guarded.
 * The getter itself is NOT called here (that would be a side effect on a walk whose whole
 * job is to look); it is called once, in `driveDoor`, by the same property read a caller
 * makes.
 *
 * What that widening costs, said rather than left to be discovered: a NON-function
 * accessor — `get canUndo(): boolean` — is now reported as a door too, and `driveDoor`
 * would call it and report the resulting `TypeError` as a finding. No service the walk
 * DISCOVERS has one today, which is what the green run of the real-composition cases below
 * measures rather than asserts; the instrument stays fail-closed either way, and the fix
 * when one appears is a door carve-out by name, like the two above.
 */
function reachableDoors(service: object): string[] {
	const names = new Set<string>();
	let level: object | null = service;
	while (level !== null && level !== Object.prototype) {
		for (const key of Object.getOwnPropertyNames(level)) {
			if (key === 'constructor') continue;
			const descriptor = Object.getOwnPropertyDescriptor(level, key);
			if (typeof descriptor?.value === 'function' || descriptor?.get !== undefined) names.add(key);
		}
		level = Object.getPrototypeOf(level) as object | null;
	}
	return [...names];
}

/** A command or a query, whatever it is called: something with an `execute…` entry point. */
function isService(value: unknown): value is Record<string, unknown> {
	return isObject(value) && reachableDoors(value).some((door) => door.startsWith('execute'));
}

/**
 * Walk everything reachable from `root`, collect the services, and record every place the
 * walk gave up.
 *
 * The traversal rules, each a rule rather than a list:
 *
 * - a value with an `execute…` member is a SERVICE and is collected whatever its shape —
 *   which is what lets a raw command class be caught rather than skipped;
 * - a plain object or an array is a BUNDLE and is descended into, because that is what the
 *   root composes its groups out of (`queries`, `requirementQueries`, `commands`);
 * - a class instance that is not a service is NOT descended into — see the header;
 * - a zero-argument FUNCTION is called and its answer walked, because a factory is a door
 *   too: `calibratePlan` is handed to the editor as one and never passes through
 *   `PersistenceServices`. A function taking arguments, and a call that throws, are
 *   RECORDED as skips rather than silently dropped.
 */
function discover(root: unknown, rootPath: string): Discovery {
	const discovered: { path: string; service: object }[] = [];
	const skipped: Skip[] = [];
	const seen = new Set<unknown>();

	function visit(value: unknown, path: string, depth: number): void {
		if (depth > 8) {
			skipped.push({ path, kind: 'depth-limit' });
			return;
		}
		if (typeof value === 'function') {
			if (value.length !== 0) {
				skipped.push({ path, kind: 'function-with-arguments' });
				return;
			}
			let produced: unknown;
			try {
				produced = (value as () => unknown)();
			} catch {
				skipped.push({ path, kind: 'factory-threw' });
				return;
			}
			if (isService(produced)) visit(produced, `${path}()`, depth + 1);
			return;
		}
		if (!isObject(value) || seen.has(value)) return;
		seen.add(value);

		// The ARRAY question first: `isService` narrows `value` to a shape with no index
		// signature, so asking `Array.isArray` after it leaves `never` and takes the callback's
		// parameters down with it. An array is a list of members to walk, never a service, so
		// this order is also the one that reads correctly.
		if (Array.isArray(value)) {
			value.forEach((item, index) => {
				visit(item, `${path}[${index}]`, depth + 1);
			});
			return;
		}
		if (isService(value)) {
			discovered.push({ path, service: value });
			return;
		}
		if (!isPlainObject(value)) return;
		for (const [key, member] of Object.entries(value)) {
			visit(member, `${path}.${key}`, depth + 1);
		}
	}

	visit(root, rootPath, 0);
	return { discovered, skipped };
}

/**
 * An input every door faults on, in whichever of three ways its command reaches for it:
 * reading a property THROWS; SPREADING it yields `{}` (the proxy target is empty, and a
 * spread asks `ownKeys`, not `get`), so the command faults a step later on the field it
 * needed; and a door that passes its input straight on to a repository meets a DETONATED
 * collaborator. The third is the backstop and the reason detonation is not optional — the
 * probe does not depend on which of the three a given command happens to hit.
 */
function hostileInput(): never {
	return new Proxy(
		{},
		{
			get: () => {
				throw new Error('the boundary probe: this input is hostile');
			},
		},
	) as never;
}

function describeSettled(settled: unknown): string {
	const value = settled as { ok?: unknown; error?: { code?: unknown } } | null | undefined;
	if (value?.ok === false) return `a failed Result coded \`${String(value.error?.code)}\``;
	if (value?.ok === true) return 'a SUCCESS';
	return `\`${String(settled)}\``;
}

/** Drive one door, and say what is wrong with what came back — or `null` if nothing is. */
async function driveDoor(service: object, door: string): Promise<string | null> {
	const call = (service as Record<string, (input: unknown) => unknown>)[door];
	let settled: unknown;
	try {
		settled = await call.call(service, hostileInput());
	} catch (cause) {
		return `\`${door}\` REJECTED (${String((cause as Error).message)}) — a throw past the application layer`;
	}
	const value = settled as { ok?: unknown; error?: { code?: unknown } } | null | undefined;
	if (value?.ok !== false || value.error?.code !== MAPPED_REFUSAL) {
		return `\`${door}\` answered ${describeSettled(settled)} while the vault below it threw — nothing mapped the fault`;
	}
	return null;
}

/** Drive every door of every discovered service, minus the carve-outs. */
async function auditDoors(discovery: Discovery): Promise<Finding[]> {
	const findings: Finding[] = [];
	for (const { path, service } of discovery.discovered) {
		if (SERVICE_CARVE_OUTS[path] !== undefined) continue;
		for (const door of reachableDoors(service)) {
			if (DOOR_CARVE_OUTS[`${path}#${door}`] !== undefined) continue;
			const problem = await driveDoor(service, door);
			if (problem !== null) findings.push({ path, problem });
		}
	}
	return findings;
}

const map = createVaultExceptionMapper('vault');

/** A collaborator that throws, with the boundary around it. */
function guardedThrower(): { execute: (input: unknown) => Promise<unknown> } {
	return guardCommand(
		{
			execute: () => {
				throw new Error('the vault exploded');
			},
		},
		'test.failed',
		recorder,
		map,
	) as never;
}

/** The same collaborator with no boundary around it. */
function rawThrower(): { execute: () => Promise<never> } {
	return {
		execute: () => {
			throw new Error('the vault exploded');
		},
	} as never;
}

describe('the instrument that checks the boundary', () => {
	it('finds a raw command sitting in a nested bundle', async () => {
		class RawCommand {
			async execute(): Promise<void> {
				await Promise.resolve();
				throw new Error('the vault exploded');
			}
		}
		const discovery = discover({ inner: { ok: guardedThrower(), raw: new RawCommand() } }, 'root');
		const findings = await auditDoors(discovery);

		expect(discovery.discovered.map((entry) => entry.path)).toEqual(['root.inner.ok', 'root.inner.raw']);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.path).toBe('root.inner.raw');
		expect(findings[0]?.problem).toContain('REJECTED');
	});

	/**
	 * The shape a structural check cannot see, and the one this branch already shipped
	 * once: `guardCommand` wraps `execute` only, so a facade pairing it with a raw
	 * `executeWithVersion` is a wrapper by every structural test there is — and open on the
	 * door the Inspector actually dispatches through.
	 */
	it('finds a raw second door beside a guarded one', async () => {
		const raw = rawThrower();
		const facade = { execute: guardedThrower().execute, executeWithVersion: () => raw.execute() };

		const findings = await auditDoors(discover({ overrides: facade }, 'root'));

		expect(findings).toHaveLength(1);
		expect(findings[0]?.path).toBe('root.overrides');
		expect(findings[0]?.problem).toContain('`executeWithVersion` REJECTED');
	});

	it('finds a door that answers a success while everything below it is broken', async () => {
		const findings = await auditDoors(
			discover({ q: { execute: () => Promise.resolve({ ok: true, value: [] }) } }, 'root'),
		);

		expect(findings[0]?.problem).toContain('answered a SUCCESS');
	});

	/**
	 * A door defined as an ACCESSOR, which `reachableDoors` was blind to until this branch's
	 * closing pass. A caller reaches `service.execute(input)` identically either way, so a
	 * walk that asked only for `descriptor.value` would have passed a raw service by without
	 * recognising it as a service at all — no finding, no carve-out, no recorded skip.
	 */
	it('finds a raw door defined as a getter', async () => {
		class AccessorCommand {
			get execute(): () => Promise<never> {
				return () => {
					throw new Error('the vault exploded');
				};
			}
		}
		const discovery = discover({ raw: new AccessorCommand() }, 'root');
		const findings = await auditDoors(discovery);

		expect(discovery.discovered.map((entry) => entry.path)).toEqual(['root.raw']);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.problem).toContain('REJECTED');
	});

	it('follows a factory to the service it hands back', async () => {
		const discovery = discover({ make: () => rawThrower() }, 'root');

		expect(discovery.discovered.map((entry) => entry.path)).toEqual(['root.make()']);
		expect(await auditDoors(discovery)).toHaveLength(1);
	});

	it('passes a guarded bundle, a repository port and a cycle', async () => {
		class Repository {
			async getById(): Promise<null> {
				return await Promise.resolve(null);
			}
		}
		const bundle: Record<string, unknown> = { queries: { one: guardedThrower() }, zones: new Repository() };
		bundle.self = bundle;

		const discovery = discover(bundle, 'root');

		expect(discovery.discovered.map((entry) => entry.path)).toEqual(['root.queries.one']);
		expect(await auditDoors(discovery)).toEqual([]);
	});

	/** The two holes the walk has, RECORDED — a skip review can see beats a silent return. */
	it('records the factories it could not call rather than dropping them', () => {
		const discovery = discover(
			{
				withArgument: (_id: string) => rawThrower(),
				broken: () => {
					throw new Error('cannot construct');
				},
			},
			'root',
		);

		expect(discovery.discovered).toEqual([]);
		expect(discovery.skipped).toEqual([
			{ path: 'root.withArgument', kind: 'function-with-arguments' },
			{ path: 'root.broken', kind: 'factory-threw' },
		]);
	});
});

const vaultStack = () =>
	({
		vault: { getAbstractFileByPath: () => null, getFiles: () => [], getMarkdownFiles: () => [] },
		fileManager: {},
		metadataCache: { getFileCache: () => null },
	}) as never;

/**
 * Replace every method of a collaborator with a thrower — as OWN properties shadowing the
 * prototype, so the class is untouched and the services already composed against THIS
 * instance fault the way a broken vault makes them fault. Walked rather than listed, so a
 * port that gains a method is detonated without anyone remembering to add it.
 *
 * The stand-in keeps the real method's ARITY, which is not decoration: `discover` treats a
 * zero-argument function as a factory and calls it, so a one-argument port method replaced
 * by a bare `() => { throw }` would be called by the walk and recorded as a factory that
 * could not be constructed. A fake thinner than the real thing, mangling the instrument
 * pointed at it.
 */
function detonate(collaborator: object): void {
	const done = new Set<string>();
	let level: object | null = collaborator;
	while (level !== null && level !== Object.prototype) {
		for (const key of Object.getOwnPropertyNames(level)) {
			if (key === 'constructor' || done.has(key)) continue;
			const descriptor = Object.getOwnPropertyDescriptor(level, key);
			if (typeof descriptor?.value !== 'function') continue;
			done.add(key);
			// Built inline: `Object.defineProperty` hands the function back, so the arity is
			// stamped on it without a local that captures nothing from this scope.
			Object.defineProperty(collaborator, key, {
				configurable: true,
				value: Object.defineProperty(
					(): never => {
						throw new Error('the vault exploded');
					},
					'length',
					{ value: (descriptor.value as () => void).length },
				),
			});
		}
		level = Object.getPrototypeOf(level) as object | null;
	}
}

describe('every service leaving the composition root is guarded', () => {
	function surveyed(): Discovery {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
		const persistence = root.persistence;
		if (persistence === null) throw new Error('expected a composed persistence stack');

		// Everything a command or query can read or write through. Detonated BEFORE the
		// walk, so a factory's product is built from broken collaborators too.
		for (const collaborator of [
			persistence.projects,
			persistence.plans,
			persistence.zones,
			persistence.assets,
			persistence.requirements,
			persistence.overrides,
			persistence.geometry,
			persistence.files,
		]) {
			detonate(collaborator);
		}

		const fromPersistence = discover(persistence, 'persistence');
		// The editor's bundle is the second door out of the root, and the only one handing
		// over a factory. Surveyed with the same instrument, into the same report.
		const fromEditor = discover(planEditorDeps(root, {} as never, {} as never), 'editorDeps');
		return {
			discovered: [...fromPersistence.discovered, ...fromEditor.discovered],
			skipped: [...fromPersistence.skipped, ...fromEditor.skipped],
		};
	}

	it("answers the boundary's mapped refusal at every door it hands out", async () => {
		expect(await auditDoors(surveyed())).toEqual([]);
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
		const paths = surveyed().discovered.map((entry) => entry.path);

		expect(paths.length).toBeGreaterThanOrEqual(30);
		expect(paths).toContain('persistence.requirementQueries.listAssets');
		expect(paths).toContain('persistence.setRequirementQuantityOverride');
		expect(paths).toContain('editorDeps.commands.calibratePlan()');
	});

	/** And it drives more DOORS than services — the two-door facades and the transaction. */
	it('drives every door, not one per service', () => {
		const { discovered } = surveyed();
		const doors = discovered.flatMap((entry) => reachableDoors(entry.service).map((door) => `${entry.path}#${door}`));

		expect(doors.length).toBeGreaterThan(discovered.length);
		expect(doors).toContain('persistence.setRequirementQuantityOverride#executeWithVersion');
		expect(doors).toContain('editorDeps.commands.calibratePlan()#undo');
	});

	/**
	 * Both carve-outs, asserted rather than commented, so the keys cannot quietly grow. If
	 * the diagnostics query ever grows a vault read the fix is to guard it and delete the
	 * key, never to widen it.
	 */
	it('carves out exactly two things, and both by name', () => {
		expect(Object.keys(SERVICE_CARVE_OUTS)).toEqual(['persistence.queries.diagnostics']);
		expect(Object.keys(DOOR_CARVE_OUTS)).toEqual(['editorDeps.commands.calibratePlan()#undo']);
		// And both name something the walk really finds — a carve-out for a path that does
		// not exist is a comment, and would go on reading as a live exception.
		const { discovered } = surveyed();
		expect(discovered.map((entry) => entry.path)).toContain('persistence.queries.diagnostics');
		const transaction = discovered.find((entry) => entry.path === 'editorDeps.commands.calibratePlan()');
		expect(reachableDoors(transaction?.service as object)).toContain('undo');
	});

	/**
	 * Where the walk gave up.
	 *
	 * `factory-threw` and `depth-limit` are the two kinds that could hide a real service,
	 * so both must be empty — that half is a guarantee.
	 *
	 * `function-with-arguments` cannot be: whether an argument-taking function is a factory
	 * is unknowable without calling it, and calling it is what this walk deliberately does
	 * not do. So the OWNERS are asserted instead — the objects those functions live on,
	 * rather than the functions themselves. Every one today is a `Logger`, the file probe,
	 * a read-model bundle, or the two change sources, and none of them hands back a
	 * service. Owners rather than paths because that is the axis that matters: adding a
	 * method to a bundle already on this list changes nothing, while an argument-taking
	 * factory appearing somewhere new — `editorDeps.commands` is where one would go —
	 * changes it and review has to look.
	 */
	it('records where it gave up, and gave up nowhere that could hide a service', () => {
		const { skipped } = surveyed();
		const owners = [...new Set(skipped.map((skip) => skip.path.slice(0, skip.path.lastIndexOf('.'))))].toSorted();

		expect(skipped.filter((skip) => skip.kind !== 'function-with-arguments')).toEqual([]);
		expect(owners).toEqual([
			'editorDeps',
			'editorDeps.commands.logger',
			'editorDeps.queries',
			'persistence.files',
			'persistence.planEditorQueries',
			'persistence.vaultDeps.logger',
		]);
	});
});

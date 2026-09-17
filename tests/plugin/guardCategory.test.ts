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
 * So this file NAMES no service. It composes a real root, DETONATES nine named
 * collaborators underneath it — the six repositories, the plan and asset geometry ports and
 * the file probe, each port method replaced by a thrower — walks everything the root hands
 * out, and drives a hostile input through EVERY DOOR of everything it finds.
 *
 * NINE re-derived at the merge of the price-override and asset-designer increments rather
 * than remembered, because each of those branches incremented this count on its own and both
 * sentences read right in isolation: the two increments added `overrides` and `assetGeometry`
 * respectively. The array below is the measurement —
 * `awk '/Detonated BEFORE the/{f=1} f&&/^\t\t\]\)/{f=0} f' tests/plugin/guardCategory.test.ts
 * | grep -oE 'persistence\.[a-zA-Z]+' | sort` prints one line per entry, and it printed nine.
 *
 * FIVE hand-written lists live in this file — that detonation array, `SERVICE_CARVE_OUTS`,
 * `DOOR_CARVE_OUTS`, the skip test's `owners`, and the class-instance set pinned by
 * `it('pins every raw class instance the root hands out, …')`. FIVE, not the four this
 * sentence said until BP-02 slice 4 task L-06 added the last of them.
 * The count is re-derived by NAMING them, which is
 * the only instrument there is for it — a grep cannot tell a maintained list from an
 * expectation — so the five names above are the measurement and this sentence is wrong the
 * moment one of them is not in it. The last four are each asserted by exact value, so a drift
 * is named at an assertion. The detonation array is the one that is NOT,
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
 *   structurally rather than by exception.
 *
 *   **The second question this bullet used to ask for now EXISTS, and it is smaller than the
 *   gap.** BP-02 slice 4 task L-06 made that structural pass-by a RECORDED skip
 *   (`class-instance`) and pinned the resulting set by exact value in the last case below.
 *   What that holds: a NEW raw class instance in the handoff — a new bypass surface — turns
 *   the gate red and its author has to justify it in the same edit. What it does NOT hold:
 *   the ports already on that list stay raw and stay unguarded, so the three live bypasses
 *   ADR-0034 records under tracker limitation L-06 are unchanged, and a `markUncompensated`
 *   stamp added behind one of them turns nothing red here. **The hole cannot get wider; it is
 *   not closed.**
 * - **a service hiding inside a class instance.** The walk descends into bundles (plain
 *   objects and arrays) and never into a class instance that is not itself a service,
 *   because repositories, the index, the change adapter and the migration runner are
 *   collaborators whose innards are nobody's business here. A command composed as a FIELD
 *   of such an object is invisible — recorded as a `class-instance` skip at the object's own
 *   path, which names where the walk stopped and never what is inside.
 * - **a door-bearing object with no `execute…` member at all.** `isService` recognises a
 *   member whose name begins with `execute`, which covers `execute` and
 *   `executeWithVersion`, the two entry-point spellings this codebase has. An object whose
 *   only door were `undo`, or `run`, would not be recognised as a service — though `undo`
 *   IS driven once a service is recognised, since `reachableDoors` returns every reachable
 *   member (methods and accessors alike) rather than the ones matching that prefix.
 * - **anything past depth 8, a function that takes arguments, a factory whose call throws,
 *   and a class instance that is not a service.** Those FOUR are RECORDED rather than
 *   silently skipped — see `SkipKind` — because a recorded skip is something review can see.
 *   The fourth is the newest and the only one pinned by exact value. The most probable next
 *   hole is the second: `calibratePlan` is zero-argument today, and a factory usually takes
 *   one.
 *
 * Two halves, and the first matters as much as the second: an instrument that reached
 * nothing would report no findings and look exactly like a guarded composition. `discover`
 * and `auditDoors` are therefore driven against FIXTURES first — a raw command in a nested
 * bundle, a facade whose second door is raw, a door that answers success, a factory, a
 * cycle, a port — and only then against the real composition root.
 */
import { describe, expect, it } from 'vitest';
import { createCompositionRoot } from '../../src/plugin/composition-root';
import { planEditorDeps } from '../../src/plugin/planEditorDeps';
import { createEditorClipboard } from '../../src/presentation/editor/clipboard/editorClipboard';
import { memoryDeviceStorage } from '../helpers/deviceStorage';
import { assetLibraryDeps } from '../../src/plugin/assetLibraryDeps';
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

type SkipKind = 'function-with-arguments' | 'factory-threw' | 'depth-limit' | 'class-instance';

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
 * - a class instance that is not a service is NOT descended into, and is RECORDED as a
 *   `class-instance` skip rather than dropped — see the header;
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
		if (!isPlainObject(value)) {
			// A class instance that is not itself a service. RECORDED rather than dropped, because
			// this is where a raw write PORT leaves the composition root — the bypass surface
			// ADR-0034's L-06 category is reached through. A recorded skip is something review can
			// see; a silent `return` is how the next one arrives unremarked.
			skipped.push({ path, kind: 'class-instance' });
			return;
		}
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
		// The port is passed by, and SAYS SO. This is the fixture half of the class-instance
		// skip: `discover` really does record a raw class instance at the path it sits on,
		// which is what makes the pinned real-composition set below an instrument rather than
		// an empty array that would look identical to a clean handoff.
		expect(discovery.skipped).toEqual([{ path: 'root.zones', kind: 'class-instance' }]);
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
			persistence.assetGeometry,
			persistence.files,
		]) {
			detonate(collaborator);
		}

		const fromPersistence = discover(persistence, 'persistence');
		// The editor's bundle is the second door out of the root, and the only one handing
		// over a factory. Surveyed with the same instrument, into the same report.
		const fromEditor = discover(planEditorDeps(root, {} as never, {} as never, createEditorClipboard(), memoryDeviceStorage()), 'editorDeps');
		// The library's own bundle, surveyed with the same instrument into the same report: a
		// view-deps builder that is not walked is a place a raw command can be composed with
		// every gate green. Two OTHERS are still unwalked and this comment says so rather than
		// letting the pair above read as a category — `renovationProjectDeps` and
		// `assetDesignerDeps` hand out only members `persistence` already carries, which is why
		// nothing here has missed a raw door yet, and is a reason rather than a guarantee.
		const fromLibrary = discover(
			assetLibraryDeps(root, {} as never, {} as never, { indexScanCompleted: () => false }),
			'libraryDeps',
		);
		return {
			discovered: [...fromPersistence.discovered, ...fromEditor.discovered, ...fromLibrary.discovered],
			skipped: [...fromPersistence.skipped, ...fromEditor.skipped, ...fromLibrary.skipped],
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
	 *
	 * `class-instance` is the fourth kind and arrived with BP-02 slice 4 task L-06. It is
	 * tolerated HERE and pinned by exact value in the case below, which is a stronger
	 * assertion than an owner set rather than a weaker one — so `owners` is now derived from
	 * the `function-with-arguments` skips alone, which is what this docblock has always said
	 * it was ("the objects those functions live on"). Widening it to every kind would have
	 * folded the new set into an owner list and lost the exact-value pin.
	 */
	it('records where it gave up, and gave up nowhere that could hide a service', () => {
		const { skipped } = surveyed();
		const owners = [
			...new Set(
				skipped
					.filter((skip) => skip.kind === 'function-with-arguments')
					.map((skip) => skip.path.slice(0, skip.path.lastIndexOf('.'))),
			),
		].toSorted();

		// TWO tolerated kinds, by exact name, so a THIRD appearing still turns this red.
		// `function-with-arguments` is tolerated because whether such a function is a factory is
		// unknowable without calling it, and calling it is what this walk deliberately does not
		// do — its owners are asserted below instead. `class-instance` is tolerated because a
		// collaborator's innards are nobody's business here — but it is NOT tolerated blindly:
		// the case below pins that set by exact value. `factory-threw` and `depth-limit` stay
		// forbidden outright, because either could hide a real service.
		expect(
			skipped.filter((skip) => skip.kind !== 'function-with-arguments' && skip.kind !== 'class-instance'),
		).toEqual([]);
		// The two the header names as the most probable next hole, arriving: BP-02 slice 4's
		// guarded zone-edit factories take the leaf's `WriteLedger`, so they land HERE rather
		// than in `discovered` and this walk drives neither. Named rather than left inside the
		// owner below, because `editorDeps.commands` was already on that list for another
		// member — so the owners assertion alone would not have noticed them arriving. Both
		// doors of both are driven by `guardWiring.test.ts` (a vault fault under each) and
		// `writeIncidentWiring.test.ts` (the ADR-0034 gate over each).
		//
		// **These two assertions are a PRESENCE check and nothing more — do not cite them as
		// the instrument that proves either factory is GUARDED.** Measured, not reasoned:
		// composing both factories WITHOUT `guardZoneEdit` leaves this file at 12 passed,
		// exit 0. What they hold is that both members exist on that bundle and take an
		// argument; if either ever becomes zero-argument it moves to `discovered` and these
		// redden. The two behavioural files named above are what would notice a lost guard.
		expect(skipped.map((skip) => skip.path)).toContain('editorDeps.commands.editZoneDetails');
		expect(skipped.map((skip) => skip.path)).toContain('editorDeps.commands.renameZone');
		expect(owners).toEqual([
			'editorDeps',
			// reviewNoteAction is exercised through actual repositories in guardedRenovation.test.ts.
			'editorDeps.commands',
			'editorDeps.commands.events',
			// Argument-taking Group factory: composed read/execute/undo boundaries and retry are driven by guardedGroups.test.ts.
			'editorDeps.commands.groups',
			'editorDeps.commands.logger',
			// Argument-taking factory: all three doors are exercised by guardedReferencePlan.test.ts.
			// Planning factory doors are driven by planningEditorServices.test.ts.
			// Argument-taking factory: execute/undo doors are exercised by guardedPlanNorth.test.ts.
			'editorDeps.commands.planNorth',
            'editorDeps.commands.planning',
            'editorDeps.commands.referencePlan',
			// All read/execute/undo factory doors are exercised in guardedRenovation.test.ts.
			'editorDeps.commands.renovation',
			// Argument-taking spatial factory: read/execute/undo checked in guardedStructure.test.ts.
			'editorDeps.commands.structure',
			// Actual composed Trade list/create exceptions and retry are driven by downstreamGuardBoundaries.test.ts.
			'editorDeps.commands.tradeCatalogue',
			// Workspace navigation returns no service; fault paths are covered by editorWorkspaceNavigation.test.ts.
			'editorDeps.navigation',
			// A per-device storage slot, not a command surface: `write` takes the value to persist
			// rather than dispatching anything, and DeviceLocalStore's own swallow-and-warn is
			// checked in deviceLocalStore.test.ts.
			'editorDeps.panelLayout',
			'editorDeps.queries',
			'libraryDeps',
			'libraryDeps.logger',
			'libraryDeps.queries',
			'persistence.files',
			'persistence.planEditorQueries',
			'persistence.vaultDeps.logger',
		]);
	});

	/**
	 * The file header's "second question", and **it is not an answer to ADR-0034's L-06
	 * category** — read the next two paragraphs before citing it as one.
	 *
	 * A `markUncompensated` stamp becomes a DURABLE write incident only if the dispatch that
	 * produced it reaches one of the two recorders (`guardAgainstThrowing.ts`'s
	 * `void incidents?.record(…)` and `evidenceRename.ts`'s
	 * `activeWriteIncidentRegistry()?.record(…)` — measured,
	 * `grep -rn "record(result.error as AppError & UncompensatedWrite)" src/` prints exactly
	 * those two lines). A stamp raised behind a RAW PORT the root hands to presentation reaches
	 * neither, which is how `reversible-delete-zone-command.ts`'s undo half stamps and nothing
	 * records it. Those raw ports are class instances, so the walk above passes them by — and
	 * now says so at the path it passed them at.
	 *
	 * **What this buys is that the hole cannot get WIDER, not that it is closed.** A NEW raw
	 * class instance in the handoff turns this red and its author has to justify it in the same
	 * edit. The three uncovered sites ADR-0034 NAMES stay live and stay silent — three is what has
	 * been named, not a completeness claim — and a SECOND `markUncompensated`
	 * added behind one of them — inside `reversible-delete-zone-command.ts`, which already has
	 * the shape — turns nothing red here. Closing the category would mean recording inside
	 * `markUncompensated` itself; ADR-0034's deferred-check bullet carries that option and the
	 * cost that made BP-02 slice 4 refuse it.
	 *
	 * Two halves to the set, and the comments below distinguish them because they are not the
	 * same fact. `persistence.*` is the root's OWN stack of collaborators, exposed so that this
	 * very file can `detonate` them — nine of them are, above — and reached by a view only
	 * through a guarded service. `editorDeps.*` is what a leaf is handed directly, and is where
	 * a bypass actually lives.
	 */
	it('pins every raw class instance the root hands out, so a new bypass surface cannot arrive quietly', () => {
		const instances = surveyed()
			.skipped.filter((skip) => skip.kind === 'class-instance')
			.map((skip) => skip.path)
			.toSorted();

		expect(instances).toEqual([
			// A Vue `shallowRef` holding what Copy last took. Data, not a door — no write reaches the vault through it.
			'editorDeps.clipboard',
			// `ObsidianEvidenceFiles`: resolves and opens an evidence link. A read/navigation port with no write door.
			'editorDeps.commands.evidenceFiles',
			// Raw `AssetRepository`. A LIVE bypass surface of the L-06 shape — a stamp raised behind it reaches no recorder.
			'editorDeps.commands.requirementEdits.assets',
			// `ReferenceLocks`: a lock set the link/unlink commands share, not a write door of its own.
			'editorDeps.commands.requirementEdits.locks',
			// Raw `RequirementRepository`. A LIVE bypass surface, same shape and same silence as `assets` above.
			'editorDeps.commands.requirementEdits.requirements',
			// Raw `ZoneRepository` — the bypass ADR-0034 names by name, the port `deleteZoneHistory` dispatches against.
			'editorDeps.commands.zones',
			// `AssetGeometrySidecar`, the asset design write port. Detonated above; every command over it leaves guarded.
			'persistence.assetGeometry',
			// `AssetRepositoryPort`. Detonated above; presentation reaches it only through guarded asset services.
			'persistence.assets',
			// `VaultChangeAdapter`: the vault-event pipeline into the index. Not a command surface at all.
			'persistence.changeAdapter',
			// `PlanGeometrySidecar`, slice 7's calibration port. Detonated above.
			'persistence.geometry',
			// `PlanGeometryStore`, the store the sidecar port sits over. A collaborator, never handed to a view.
			'persistence.geometryStore',
			// `ProjectIndex`: the in-memory index. Reads only; its writes are the change pipeline's, not a command's.
			'persistence.index',
			// `ProjectListFacts`: §8's plan count and last-worked instrument. A read collaborator of two query doors.
			'persistence.listFacts',
			// `ReferenceLocks` again, at the root's own stack. Same reason as the `requirementEdits` one.
			'persistence.locks',
			// `SequenceMarkerStore`: ADR-0019's delete/rebuild markers. Written through delete-resolution, itself guarded.
			'persistence.markers',
			// `LibraryOverlaps`: §83's overlap answer, shared by two read surfaces so they cannot disagree.
			'persistence.overlaps',
			// `AssetPriceOverrideRepositoryPort`. Detonated above; its three services all leave guarded.
			'persistence.overrides',
			// `PlanRepository`. Detonated above.
			'persistence.plans',
			// `ProjectRepository`. Detonated above.
			'persistence.projects',
			// `QuoteRepository`: the quote catalogue, reached through `quoteServices` — guarded doors, raw port here.
			'persistence.quotes',
			// `RequirementRepositoryPort`. Detonated above.
			'persistence.requirements',
			// `NamedRecordRepository<Supplier>`: the supplier catalogue, same shape as `quotes`.
			'persistence.suppliers',
			// `NamedRecordRepository<Trade>`: the trade catalogue, same shape as `quotes`.
			'persistence.trades',
			// `EchoWindow`: the repositories' own write-echo suppressor. Infrastructure plumbing, no door.
			'persistence.vaultDeps.echo',
			// `DiagnosticsLedger`: where read refusals land for §68's snapshot. Records, never writes the vault.
			'persistence.vaultDeps.ledger',
			// `MigrationRunner`: reached by every note read, and its writes travel out through the repositories above.
			'persistence.vaultDeps.migrations',
			// `ZoneRepository` at the root's own stack. Detonated above. The same port reaches a LEAF raw as
			// `editorDeps.commands.zones`; both appear because `surveyed` runs `discover` once per bundle, each with
			// its own `seen`, so the two entries are two HANDOFFS of one object rather than a duplicate.
			'persistence.zones',
		]);
		// An instrument that reached nothing would report an empty set and look exactly like a
		// clean handoff. This guards the PINNED ARRAY as much as the walk: emptying both halves
		// to clear a drift would otherwise pass.
		expect(instances.length).toBeGreaterThan(0);
	});
});

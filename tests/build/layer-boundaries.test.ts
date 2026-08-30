import { beforeAll, describe, expect, it } from 'vitest';
import { dirname, relative, sep } from 'node:path';
import eslintConfig from '../../eslint.config.mjs';
import { ESLINT_BOOT_MS, lintDetailed, warmUpEslint, type Diagnostic } from '../helpers/eslint';

/**
 * The layer boundary, checked AT THE FORBIDDEN THING.
 *
 * CLAUDE.md's headline claim is that `eslint.config.mjs` enforces the SDD's layering "so a
 * violation fails `npm run lint` rather than waiting for review". Before this file, six of
 * the 35 declared cells had ever been fired — five of them only at the two `networkFree`
 * paths, whose whole purpose is restating a parent ban — so that claim rested on reading the
 * config rather than on driving it.
 *
 * Two things are deliberately kept apart, and conflating them is what this file refuses:
 * WHICH blocks exist is discovered from the config, because a hand-written block list was
 * short three times running; WHAT each block must forbid is transcribed from an independent
 * oracle, because deriving expectations from the config under test is the self-declared-list
 * defect this repository already names.
 */
beforeAll(async () => {
	await warmUpEslint();
	await lintDetailed('export const probe = 1;\n', 'src/core/identity/generateId.ts');
}, ESLINT_BOOT_MS);

/**
 * Every block declaring the rule, as an ORDERED LIST — never a Map.
 *
 * A draft keyed a `Map` on each block's first `files` glob, which deduplicates the exact thing
 * this inventory exists to notice: two blocks beginning with the same glob collapse to one, so
 * ADDING or DUPLICATING a `no-restricted-imports` block leaves both the membership assertion
 * and the probe-key comparison unchanged. A pin whose stated purpose is "a block appearing or
 * disappearing fails here" cannot be built on a structure that silently merges appearances.
 *
 * Keyed on the WHOLE `files` array rather than its first entry, for the same reason: two blocks
 * can share a first glob and differ in the rest, and the scope is what identifies a block.
 */
const declaringBlocks = (): { files: readonly string[]; severity: string }[] => {
	const found: { files: readonly string[]; severity: string }[] = [];
	for (const block of eslintConfig as readonly { files?: unknown; rules?: Record<string, unknown> }[]) {
		const rule = block.rules?.['no-restricted-imports'];
		if (rule === undefined) continue;
		const files = (Array.isArray(block.files) ? block.files : [block.files]).map(String);
		found.push({ files, severity: rule === 'off' ? 'off' : 'error' });
	}
	return found;
};

/**
 * The `files` array is kept as an ARRAY and never joined into a delimited string.
 *
 * A draft joined on `,` and split on `,`, which is unsound for this data and not merely
 * fragile: two of the thirteen blocks are `**\/*.{js,cjs,mjs,jsx}` and `**\/*.{ts,cts,mts,tsx}`,
 * whose brace globs CONTAIN commas. Measured — `'**\/*.{js,cjs,mjs,jsx}'.split(',')[0]` is
 * `'**\/*.{js'`, and the derived extension list came out `{js|cjs|mjs|jsx}` against an expected
 * `{js,cjs,mjs,jsx}`. The prescribed test could not have passed at all.
 *
 * The lesson is narrower than "escape your delimiters": I invented a serialization for data
 * whose alphabet I had not checked, when the structure was already in hand and needed no
 * encoding. An array compared to an array has no delimiter to collide with.
 */
const firstGlob = (files: readonly string[]): string => files[0] ?? '';

/**
 * The nine extensions `SRC_EXTENSIONS` declares, transcribed rather than imported.
 *
 * Imported, the assertion would compare the config against itself; transcribed, a removed
 * extension is a failure here. Used to BUILD the expected `files` array for each block, so
 * every glob is pinned in full and not reduced to its extension.
 *
 * A draft pinned the extension SET beside the first glob, which was a deliberate trade
 * against thirteen verbose lines — and it was the wrong trade, because reducing a glob to its
 * extension discards everything else about it. Changing a block's `**\/src/core/**\/*.tsx`
 * entry to `**\/src/core/*.tsx` preserves both the first glob and the derived `tsx`, so the
 * assertion stays green while NESTED `.tsx` files lose the layer ban — and the executable
 * matrix cannot catch it, because `.tsx` is exactly what it records as unprobeable.
 *
 * Third revision of this one assertion: the first glob only, then the extension set, now the
 * complete arrays. Each intermediate form was a smaller projection chosen for readability,
 * and each discarded the part a mutation would use.
 */
const SRC_EXT = ['ts', 'tsx', 'mts', 'cts', 'vue', 'js', 'jsx', 'mjs', 'cjs'] as const;

/** The full nine-glob expansion a `srcFiles(...)` block produces for one path prefix. */
const scopeOf = (prefix: string): string[] => SRC_EXT.map((extension) => `${prefix}.${extension}`);

/** One planted import: the specifier, the shape it exercises, and how it is spelled. */
interface Planted {
	readonly specifier: string;
	readonly shape: 'barrel' | 'one-level' | 'nested' | 'package' | 'package-subpath' | 'member';
	/**
	 * Named bindings, for a ban keyed on `importNames` rather than on the specifier.
	 *
	 * Measured, and it is why this field exists rather than a sixth shape string: a bare
	 * `import 'obsidian';` from `infrastructure/logging` reports NOTHING, while
	 * `import { request } from 'obsidian';` reports `no-restricted-imports` and
	 * `import { TFile } from 'obsidian';` does not. A member ban is invisible to a probe that
	 * plants a side-effect import, so an entry written that way is a dead probe that looks
	 * exactly like a live one.
	 */
	readonly names?: readonly string[];
}

interface BlockProbe {
	/** The block's first `files` glob — the key the membership pin above is keyed on. */
	readonly key: string;
	/** A REAL `.ts` file in the block's scope. A nonexistent `.ts` path cannot be parsed. */
	readonly path: string;
	/** Every parseable shippable extension this block's `files` expansion covers. */
	readonly extensions: readonly string[];
	/** What the oracle says this block forbids. */
	readonly forbidden: readonly Planted[];
	/** One import the block must NOT report, keyed on the layer rather than firing always. */
	readonly allowed: string;
	/**
	 * Whether this block also bans the network GLOBALS. A separate flag because they report
	 * under a different rule key — `no-restricted-globals`, measured — so the matrix's
	 * `no-restricted-imports` assertions cannot see them at all.
	 */
	readonly networkGlobals?: boolean;
}

/**
 * Every parseable shippable extension. `.tsx`, `.mts` and `.cts` are absent and the reason
 * is NOT that no fixture exists for them: `eslint-plugin-obsidianmd` applies
 * `recommendedTypeChecked` to `**\/*.{ts,cts,mts,tsx}` while the only block granting
 * `parserOptions.projectService` is scoped to `**\/*.ts`, so those three get no parser
 * services and throw `@typescript-eslint/await-thenable`. `eslint.config.mjs`'s own comment
 * records the decisive measurement: a nonexistent path and a real file written to `src/` and
 * then removed throw the IDENTICAL error. The prerequisite is widening the parser-options
 * scope, not adding a fixture.
 */
const EXTENSIONS = ['ts', 'vue', 'js', 'jsx', 'mjs', 'cjs'] as const;

/**
 * How a file at `path` spells its way back up to `src/` — DERIVED, never hand-written.
 *
 * Four entries in the first draft of this table carried a hand-written depth and all four
 * were wrong, in BOTH directions: `presentation/dialogs`, `application/queries` and
 * `infrastructure/logging` sit two levels below `src/` and were given three, while the
 * `infrastructure` probe at `persistence/dto/planGeometry.ts` sits three levels down and was
 * given two. A review bot caught one of the four and read the rest as the same off-by-one;
 * they are not one error, they are a per-file fact got wrong four times by eye.
 *
 * The verdicts were unaffected — measured: `no-restricted-imports` matches the raw specifier
 * text, so `**\/application` matches `../../application` and `../../../application` alike, and
 * every cell reported identically at either depth. What was wrong is FIDELITY: a probe
 * spelling `../../../application` from a dialog exercises an import no dialog could contain,
 * since it resolves outside the repository. A matrix that fires on a specifier production
 * cannot write is testing a spelling nobody uses.
 *
 * Derived rather than corrected, because correcting four values leaves the fifth to be got
 * wrong by the next author.
 */
const toSrc = (path: string): string => `${relative(dirname(path), 'src').split(sep).join('/')}/`;

/** Every shape a group glob can protect. `**\/${g}` alone matches the barrel. */
const layerShapes = (layer: string, depth: string): readonly Planted[] => [
	{ specifier: `${depth}${layer}`, shape: 'barrel' },
	{ specifier: `${depth}${layer}/thing`, shape: 'one-level' },
	{ specifier: `${depth}${layer}/nested/thing`, shape: 'nested' },
];

/** Both entry forms a banned package expands to, which ARE independent of each other. */
const packageShapes = (name: string): readonly Planted[] => [
	{ specifier: name, shape: 'package' },
	{ specifier: `${name}/sub`, shape: 'package-subpath' },
];

const PKG = ['vue', 'pinia', 'konva', 'vue-konva', 'obsidian'] as const;

/**
 * What `networkFree(...)` adds ON TOP of its parent layer's ban — slice 11's Definition of
 * Done item 7, transcribed from there rather than read out of the config.
 *
 * Probing these is not optional and the reason is the override mechanic: two blocks matching
 * one file OVERRIDE `no-restricted-imports`, so if an extension were dropped from either
 * network block the PARENT layer block still matches and still reports every layer-shaped
 * import planted here. The layer probes would stay green while network access became allowed
 * in that extension — and `network-boundary.test.ts` would not see it either, since it drives
 * `.ts` paths only. The extension matrix promises this and only these probes deliver it.
 */
/**
 * EVERY module, not a representative sample — each is an independently removable entry in
 * `NETWORK_MODULES`, so a subset leaves the ones it omits free to be deleted with the whole
 * matrix green. A first draft transcribed four of the thirteen, which is the same
 * cells-versus-spellings error the layer probes already had to fix, one axis over: measured,
 * deleting `node:http` from the config leaves both this matrix and the existing `.ts` suite
 * green while `node:http` becomes importable in both protected subtrees.
 */
const NETWORK_MODULES = [
	'http',
	'https',
	'http2',
	'net',
	'tls',
	'dgram',
	'node:http',
	'node:https',
	'node:http2',
	'node:net',
	'node:tls',
	'node:dgram',
	'electron',
] as const;

const networkShapes = (): readonly Planted[] => [
	...NETWORK_MODULES.map((name) => ({ specifier: name, shape: 'package' as const })),
	// A subpath per module, exactly as `packageShapes` does for the other restricted packages.
	// The `patterns` entry is built as `${name}/*` PER MODULE, so each is independently
	// removable: a single representative (`node:https/agent`, in a draft) leaves `http/*` free
	// to be deleted with `http/client` importable in both protected subtrees and this whole
	// matrix green. Third appearance of cells-versus-spellings in this one probe set — the
	// module names, then the members, now the subpaths.
	...NETWORK_MODULES.map((name) => ({ specifier: `${name}/sub`, shape: 'package-subpath' as const })),
];
const PROTOTYPES = (depth: string): readonly Planted[] => [
	{ specifier: `${depth}prototypes`, shape: 'barrel' },
	{ specifier: `${depth}prototypes/ZoneSummary.vue`, shape: 'one-level' },
	{ specifier: `${depth}prototypes/nested/Thing.vue`, shape: 'nested' },
];

/**
 * SDD §8 for the six layers; slice 15's Definition of Done for `presentation/dialogs`;
 * slice 11's Definition of Done item 7 for the two `networkFree` subtrees; and
 * `src/prototypes/README.md`'s one-way-door rule for the prototypes group. Four sources,
 * because `presentation/dialogs` forbids more than the SDD's layering statement does —
 * transcribing from the SDD alone could not produce those cases.
 */
const BAN_BLOCKS: readonly BlockProbe[] = [
	{
		key: '**/src/core/**/*.ts',
		path: 'src/core/identity/generateId.ts',
		extensions: EXTENSIONS,
		forbidden: [
			...layerShapes('domain', toSrc('src/core/identity/generateId.ts')),
			...layerShapes('application', toSrc('src/core/identity/generateId.ts')),
			...layerShapes('infrastructure', toSrc('src/core/identity/generateId.ts')),
			...layerShapes('presentation', toSrc('src/core/identity/generateId.ts')),
			...layerShapes('plugin', toSrc('src/core/identity/generateId.ts')),
			...PKG.flatMap((name) => packageShapes(name)),
			...PROTOTYPES(toSrc('src/core/identity/generateId.ts')),
		],
		allowed: '../geometry/operations',
	},
	{
		key: '**/src/domain/**/*.ts',
		path: 'src/domain/requirement/Requirement.errors.ts',
		extensions: EXTENSIONS,
		forbidden: [
			...layerShapes('application', toSrc('src/domain/requirement/Requirement.errors.ts')),
			...layerShapes('infrastructure', toSrc('src/domain/requirement/Requirement.errors.ts')),
			...layerShapes('presentation', toSrc('src/domain/requirement/Requirement.errors.ts')),
			...layerShapes('plugin', toSrc('src/domain/requirement/Requirement.errors.ts')),
			...PKG.flatMap((name) => packageShapes(name)),
			...PROTOTYPES(toSrc('src/domain/requirement/Requirement.errors.ts')),
		],
		allowed: `${toSrc('src/domain/requirement/Requirement.errors.ts')}core`,
	},
	{
		key: '**/src/application/**/*.ts',
		path: 'src/application/editor/WriteLedger.ts',
		extensions: EXTENSIONS,
		forbidden: [
			...layerShapes('infrastructure', toSrc('src/application/editor/WriteLedger.ts')),
			...layerShapes('presentation', toSrc('src/application/editor/WriteLedger.ts')),
			...layerShapes('plugin', toSrc('src/application/editor/WriteLedger.ts')),
			...PKG.flatMap((name) => packageShapes(name)),
			...PROTOTYPES(toSrc('src/application/editor/WriteLedger.ts')),
		],
		allowed: `${toSrc('src/application/editor/WriteLedger.ts')}domain`,
	},
	{
		key: '**/src/infrastructure/**/*.ts',
		path: 'src/infrastructure/persistence/dto/planGeometry.ts',
		extensions: EXTENSIONS,
		// `obsidian` is this layer's job and is deliberately absent from the ban.
		forbidden: [
			...layerShapes('presentation', toSrc('src/infrastructure/persistence/dto/planGeometry.ts')),
			...layerShapes('plugin', toSrc('src/infrastructure/persistence/dto/planGeometry.ts')),
			...(['vue', 'pinia', 'konva', 'vue-konva'] as const).flatMap((name) => packageShapes(name)),
			...PROTOTYPES(toSrc('src/infrastructure/persistence/dto/planGeometry.ts')),
		],
		allowed: 'obsidian',
	},
	{
		key: '**/src/presentation/**/*.ts',
		path: 'src/presentation/editor/deleteZoneFlow.ts',
		extensions: EXTENSIONS,
		forbidden: [...layerShapes('infrastructure', toSrc('src/presentation/editor/deleteZoneFlow.ts')), ...layerShapes('plugin', toSrc('src/presentation/editor/deleteZoneFlow.ts')), ...PROTOTYPES(toSrc('src/presentation/editor/deleteZoneFlow.ts'))],
		allowed: 'vue',
	},
	{
		key: '**/src/plugin/**/*.ts',
		path: 'src/plugin/RenovationPlannerPlugin.ts',
		extensions: EXTENSIONS,
		// The composition root may reach every layer. Only the prototypes door stays shut.
		forbidden: PROTOTYPES(toSrc('src/plugin/RenovationPlannerPlugin.ts')),
		allowed: `${toSrc('src/plugin/RenovationPlannerPlugin.ts')}infrastructure/logging/diagnosticsLedger`,
	},
	{
		key: '**/src/*.ts',
		path: 'src/main.ts',
		extensions: EXTENSIONS,
		// The ROOT block, spelled from outside `forbidden()`'s machinery.
		forbidden: PROTOTYPES(toSrc('src/main.ts')),
		allowed: `${toSrc('src/main.ts')}plugin/RenovationPlannerPlugin`,
	},
	{
		key: '**/src/presentation/dialogs/**/*.ts',
		path: 'src/presentation/dialogs/dialog-store.ts',
		extensions: EXTENSIONS,
		// Slice 15's Definition of Done: dialogs reach neither application nor infrastructure
		// nor plugin nor the event bus. More than SDD §8 forbids, which is why the oracle is
		// four documents rather than one.
		//
		// `core/events` is the half a first draft of this table omitted while its own comment
		// named it — the oracle says "nor the event bus" and the array did not carry it.
		// Measured: `../../../core/events` and `../../../core/events/bus` both report from
		// this path, while plain `../../../core` does not. `vue-rules.test.ts` exercises one
		// `.ts` spelling of it, so dropping the barrel restriction or an extension would have
		// left the promised matrix green.
		forbidden: [
			...layerShapes('application', toSrc('src/presentation/dialogs/dialog-store.ts')),
			...layerShapes('infrastructure', toSrc('src/presentation/dialogs/dialog-store.ts')),
			...layerShapes('plugin', toSrc('src/presentation/dialogs/dialog-store.ts')),
			...layerShapes('core/events', toSrc('src/presentation/dialogs/dialog-store.ts')),
			...PROTOTYPES(toSrc('src/presentation/dialogs/dialog-store.ts')),
		],
		// `core` itself, deliberately — the SHARPEST negative available here, because it
		// proves the ban is keyed on `core/events` rather than on the whole of `core`. `vue`
		// would pass against a build that banned all of `core` from dialogs.
		allowed: `${toSrc('src/presentation/dialogs/dialog-store.ts')}core`,
	},
	{
		key: '**/src/application/queries/**/*.ts',
		path: 'src/application/queries/GetPlan.ts',
		extensions: EXTENSIONS,
		// Slice 11 item 7: the parent APPLICATION ban restated, because two blocks matching
		// one file override rather than merge. A group dropped from the parent goes quiet here.
		forbidden: [
			...layerShapes('infrastructure', toSrc('src/application/queries/GetPlan.ts')),
			...layerShapes('presentation', toSrc('src/application/queries/GetPlan.ts')),
			...layerShapes('plugin', toSrc('src/application/queries/GetPlan.ts')),
			...PKG.flatMap((name) => packageShapes(name)),
			...PROTOTYPES(toSrc('src/application/queries/GetPlan.ts')),
			...networkShapes(),
		],
		// The only two blocks with a network ban, so the only two carrying `networkGlobals`.
		networkGlobals: true,
		allowed: `${toSrc('src/application/queries/GetPlan.ts')}domain`,
	},
	{
		key: '**/src/infrastructure/logging/**/*.ts',
		path: 'src/infrastructure/logging/diagnosticsLedger.ts',
		extensions: EXTENSIONS,
		forbidden: [
			...layerShapes('presentation', toSrc('src/infrastructure/logging/diagnosticsLedger.ts')),
			...layerShapes('plugin', toSrc('src/infrastructure/logging/diagnosticsLedger.ts')),
			...(['vue', 'pinia', 'konva', 'vue-konva'] as const).flatMap((name) => packageShapes(name)),
			...PROTOTYPES(toSrc('src/infrastructure/logging/diagnosticsLedger.ts')),
			...networkShapes(),
			// `NETWORK_MEMBERS` — an `importNames` ban on `obsidian`'s `request`/`requestUrl`,
			// independently removable and probed nowhere else. It belongs to THIS block alone:
			// `networkFree` filters the member out for a layer that already bans the package
			// outright, and `application` bans `obsidian`, so probing it under
			// `application/queries` would report for the package ban and prove nothing about
			// the member one.
			// ONE LINE PER MEMBER, never both on one. Measured: ESLint reports each restricted
			// specifier separately, so `import { request, requestUrl } from 'obsidian';`
			// produces TWO `no-restricted-imports` diagnostics on the same line — and the
			// line-matched assertion expects exactly one per planted line, so a single
			// combined entry fails every extension cell of this block against a CORRECT
			// config. Separate lines also detect either member being removed on its own,
			// which a combined entry cannot.
			{ specifier: 'obsidian', shape: 'member', names: ['request'] },
			{ specifier: 'obsidian', shape: 'member', names: ['requestUrl'] },
		],
		// The only two blocks with a network ban, so the only two carrying `networkGlobals`.
		networkGlobals: true,
		allowed: 'obsidian',
	},
	{
		key: '**/src/**/*.ts',
		// The CATCH-ALL block: subtrees no `forbidden()` call names. `src/prototypes/` is the
		// only one, and it holds five `.vue` files and one `.md` — no `.ts` at all, measured.
		// So this block is probed at a nonexistent `.vue` path and NOT at `.ts`; see the
		// recorded gap in the extension loop below.
		path: 'src/nowhere/Fixture.vue',
		extensions: ['vue', 'js', 'jsx', 'mjs', 'cjs'],
		forbidden: PROTOTYPES(toSrc('src/nowhere/Fixture.vue')),
		allowed: `${toSrc('src/nowhere/Fixture.vue')}core`,
	},
];

describe('the blocks declaring no-restricted-imports', () => {
	/**
	 * Pinned by EXACT membership, the way `guardCategory.test.ts` and `entityRef.test.ts`
	 * pin their own sets: a block appearing or disappearing fails here instead of quietly
	 * changing the probe set below.
	 *
	 * The two `off` entries are the shared JS/TS base configs disabling the base rule. They
	 * are pinned WITH their severity because ordering is what makes them harmless: both sit
	 * before the layer blocks, so the layer bans win the override. An `off` block reordered
	 * after them would disable every layer ban at once.
	 */
	it('is exactly this set, with exactly these severities', () => {
		// Compared as a sorted LIST of pairs, not an object: an object keyed on the scope would
		// re-introduce the deduplication this inventory was rebuilt to avoid.
		// Compared as OBJECTS carrying the COMPLETE files array, sorted by first glob — no
		// delimiter anywhere, because the data contains commas and braces and any encoding
		// invites the defect above.
		//
		// CODE-UNIT order (`<`), not `localeCompare`. Measured, and the two DISAGREE on this
		// data: `localeCompare` puts `**/src/*.ts` before `**/src/**/*.ts` while code-unit
		// order puts them the other way, because `*` (0x2A) sorts below `.` (0x2E) but a
		// collator weights punctuation differently. A draft used `localeCompare` against an
		// expected list in code-unit order, so the assertion could not pass at all.
		//
		// Code-unit order is also the right choice independent of that: `localeCompare` is
		// locale- and ICU-dependent, so a comparator chosen for readability would make this
		// assertion's result a property of the runtime rather than of the config.
		const declared = declaringBlocks()
			.map((block) => ({ files: block.files, severity: block.severity }))
			.toSorted((a, b) => (firstGlob(a.files) < firstGlob(b.files) ? -1 : firstGlob(a.files) > firstGlob(b.files) ? 1 : 0));

		/** One ban-declaring block: its full nine-glob scope, built from the prefix it covers. */
		const banning = (prefix: string) => ({ files: scopeOf(prefix), severity: 'error' });

		expect(declared).toEqual([
			{ files: ['**/*.{js,cjs,mjs,jsx}'], severity: 'off' },
			{ files: ['**/*.{ts,cts,mts,tsx}'], severity: 'off' },
			banning('**/src/**/*'),
			banning('**/src/*'),
			banning('**/src/application/**/*'),
			banning('**/src/application/queries/**/*'),
			banning('**/src/core/**/*'),
			banning('**/src/domain/**/*'),
			banning('**/src/infrastructure/**/*'),
			banning('**/src/infrastructure/logging/**/*'),
			banning('**/src/plugin/**/*'),
			banning('**/src/presentation/**/*'),
			banning('**/src/presentation/dialogs/**/*'),
		]);
	});

	/**
	 * And no block is declared TWICE. Asserted separately from the list above rather than
	 * folded into it: the sorted comparison would catch a duplicate as a length mismatch, but
	 * the failure would read as "one unexpected entry" rather than "this block is declared
	 * twice", and the two call for different fixes.
	 */
	it('declares each block exactly once', () => {
		const scopes = declaringBlocks().map((block) => JSON.stringify(block.files));

		expect(scopes).toHaveLength(new Set(scopes).size);
	});

	it('has one probe entry per ban-declaring block', () => {
		const banning = declaringBlocks()
			.filter((block) => block.severity === 'error')
			.map((block) => firstGlob(block.files));

		expect(BAN_BLOCKS.map((block) => block.key).toSorted()).toEqual(banning.toSorted());
	});
});

/**
 * `lintText` takes ONE path, and the extension in that path is what selects the applicable
 * `files` globs — so imports combined into one synthetic module cannot exercise `.js`,
 * `.jsx`, `.mjs`, `.cjs` and `.vue` at once. One call per (block, extension) pair, each
 * carrying that block's every forbidden import in every shape.
 */
const plantedLine = (planted: Planted): string =>
	planted.names === undefined
		? `import '${planted.specifier}';`
		: `import { ${planted.names.join(', ')} } from '${planted.specifier}';`;

const sourceFor = (block: BlockProbe, extension: string): string => {
	const body = block.forbidden.map(plantedLine).join('\n');
	if (extension !== 'vue') return `${body}\n`;
	return `<template><div /></template>\n<script setup lang="ts">\n${body}\n</script>\n`;
};

/** The `.ts` probe uses the block's REAL path; every other extension is synthetic. */
const pathFor = (block: BlockProbe, extension: string): string =>
	extension === 'ts' ? block.path : block.path.replace(/[^/]+$/u, extension === 'vue' ? 'Fixture.vue' : `fixture.${extension}`);

/** An SFC's script block starts on line 3, so a planted import's line is offset. */
const lineOffset = (extension: string): number => (extension === 'vue' ? 2 : 0);

const probe = (block: BlockProbe, extension: string): Promise<Diagnostic[]> =>
	lintDetailed(sourceFor(block, extension), pathFor(block, extension));

/**
 * The catch-all block × `.ts` has NO probeable path, and its cause is deliberately not
 * filed with the `.tsx`/`.mts`/`.cts` gap above though the symptom is identical.
 *
 * Those three fail because no block grants them parser services. This one fails because no
 * real `.ts` file exists in an unnamed subtree: a nonexistent `.ts` is refused by the project
 * service; the only real `.ts` outside the six layer subtrees is `src/main.ts`, which selects
 * the ROOT block; and `src/prototypes/` — the only unnamed subtree — holds five `.vue` files
 * and one `.md`, measured, no `.ts` at all.
 *
 * Widening parser options would fix those three and not this one; adding a file would fix
 * this one and not those three. Attributing a limitation to the wrong cause sends the next
 * reader to do work that cannot help.
 *
 * The three ways out are refused for stated reasons: a benign real `src/` module contradicts
 * this slice's scope and would ship in the bundle; widening `parserOptions.projectService` is
 * the bigger unrelated fix already recorded; and dropping the cell quietly is what the whole
 * cross-product exists to prevent.
 */
const RECORDED_GAPS = ['**/src/**/*.ts × ts', 'every block × tsx', 'every block × mts', 'every block × cts'] as const;

it('records the cells it cannot fire rather than skipping them', () => {
	const catchAll = BAN_BLOCKS.find((block) => block.key === '**/src/**/*.ts');

	expect(catchAll?.extensions).not.toContain('ts');
	expect(RECORDED_GAPS).toHaveLength(4);
});

describe.each(BAN_BLOCKS)('$key', (block) => {
	describe.each(block.extensions)('.%s', (extension) => {
		it('reports one diagnostic for every forbidden import, on its own line', async () => {
			const found = await probe(block, extension);
			const reported = found
				.filter((d) => d.ruleId === 'no-restricted-imports')
				.map((d) => d.line - lineOffset(extension))
				.toSorted((a, b) => a - b);

			// One per planted line, in order. A COUNT alone survives one import going silent
			// while another reports twice; matching the lines does not.
			expect(reported).toEqual(block.forbidden.map((_, index) => index + 1));

			// Vacuity guard. On a POSITIVE case a parse error fails the assertion above
			// anyway, the rule id simply being absent — but asserting it explicitly is what
			// makes the failure say "this path could not be parsed" rather than "the rule
			// did not fire", which are different defects with different fixes.
			expect(found.map((d) => d.ruleId)).not.toContain('PARSE_ERROR');
			expect(found.map((d) => d.ruleId)).not.toContain('NOT_LINTED');
		});

		// The vacuity guard folded into the case above rather than made a second `it`: both
		// lint the IDENTICAL source at the IDENTICAL path, so a separate case bought a second
		// ESLint call per cell — 65 calls — for no additional coverage. Kept as its own
		// expectation with its own comment, so what it checks is still legible.

		/**
		 * The NEGATIVE direction. Without it, a rule that banned every import in every layer
		 * would pass the whole of the positive case above unnoticed — the negative half is
		 * what proves the ban is keyed on the LAYER rather than firing everywhere.
		 */
		it('stays silent on an import this block allows', async () => {
			const body = `import '${block.allowed}';`;
			const source =
				extension === 'vue' ? `<template><div /></template>\n<script setup lang="ts">\n${body}\n</script>\n` : `${body}\n`;
			const found = await lintDetailed(source, pathFor(block, extension));

			expect(found.map((d) => d.ruleId)).not.toContain('no-restricted-imports');

			// The discriminator, and it matters MOST here. On a positive case a parse error
			// fails the assertion anyway, the rule id simply being absent. On this one it
			// makes the test pass VACUOUSLY — the same `ignores`-vacuity defect wearing a
			// different hat.
			expect(found.map((d) => d.ruleId)).not.toContain('PARSE_ERROR');
			expect(found.map((d) => d.ruleId)).not.toContain('NOT_LINTED');
		});

		// A member probe binds identifiers nothing uses, so `no-unused-vars` reports beside
		// `no-restricted-imports` on that line. Both assertions above filter by rule id
		// rather than counting diagnostics, so the extra one is invisible to them by
		// construction — noted because a count-based assertion would have broken here.

		/**
		 * The network GLOBALS, which the assertions above cannot reach.
		 *
		 * They report under `no-restricted-globals`, a different rule KEY — measured — so a
		 * matrix built entirely on `no-restricted-imports` is blind to them however many cells
		 * it has. Slice 11's diagnostics-stay-on-the-device claim rests on both halves, and
		 * only the import half had a probe.
		 *
		 * **NOT `fetch`, and a draft used it.** `eslint-plugin-obsidianmd` bans `app`, `fetch`
		 * and `localStorage` across ALL of `src/`, so a `fetch` diagnostic says nothing about
		 * the network ban specifically. Measured:
		 *
		 * | planted | `application/queries` | `core` (no network ban) |
		 * | --- | --- | --- |
		 * | `fetch` | reports | **reports** |
		 * | `XMLHttpRequest` | reports | silent |
		 * | `WebSocket` | reports | silent |
		 *
		 * So a later `.vue` override keeping only the marketplace globals would allow every
		 * real network door while the `fetch` probe stayed green. Every independently
		 * removable network-only global is planted instead.
		 *
		 * I had measured this exact fact one round earlier — it is the reason the negative case
		 * below was skipped — and drew only half the conclusion from it. Knowing `fetch` is
		 * banned everywhere is precisely what makes it useless as the POSITIVE probe too.
		 */
		// ALL EIGHT for the positive cells — the complete `NETWORK_GLOBALS` list, transcribed.
		// A draft probed three and omitted `navigator`, `window`, `globalThis` and `self`, so an
		// extension-specific override keeping the three named ones would leave every cell green
		// while `navigator.sendBeacon(...)` and `globalThis.fetch(...)` became available there.
		// Cells-versus-spellings again, on the globals axis.
		const ALL_NETWORK_GLOBALS = [
			'fetch',
			'XMLHttpRequest',
			'WebSocket',
			'EventSource',
			'navigator',
			'window',
			'globalThis',
			'self',
		] as const;

		// A NARROWER list for the negative cells, and the asymmetry is measured rather than
		// cautious. Banned in a block with NO network ban:
		//   `fetch`               — everywhere, by `eslint-plugin-obsidianmd` across `src/`
		//   `navigator`, `window` — in `core`/`domain`, by the DOM block
		// The other five are silent wherever no network ban applies, so only they can carry a
		// negative. Asserting the full list negatively would assert something false.
		const NETWORK_ONLY_GLOBALS = ['XMLHttpRequest', 'WebSocket', 'EventSource', 'globalThis', 'self'] as const;
		// A plain REFERENCE, not `new ...`: `navigator`, `window`, `globalThis` and `self` are
		// not constructors, so a `new` form would be a TypeError in four of the eight cells and
		// the probe would be testing its own source rather than the rule.
		/**
		 * ONE module carrying every name, matched BY LINE — not one lint call per global.
		 *
		 * The import probes already work this way and for the same two reasons: a
		 * line-matched assertion tells "this one went silent" from "the others still fire",
		 * which a per-name loop only achieves by paying for a separate ESLint call each time.
		 * Batching takes this file from ~556 calls to ~195; see the budget in Step 7.
		 */
		const globalsSource = (names: readonly string[]): string => {
			const body = names.map((name) => `export const reach_${name} = () => ${name};`).join('\n');
			return extension === 'vue' ? `<template><div /></template>\n<script setup lang="ts">\n${body}\n</script>\n` : `${body}\n`;
		};

		it.runIf(block.networkGlobals === true)('reports every network global under its own rule', async () => {
			const found = await lintDetailed(globalsSource(ALL_NETWORK_GLOBALS), pathFor(block, extension));
			const reported = found
				.filter((d) => d.ruleId === 'no-restricted-globals')
				.map((d) => d.line - lineOffset(extension))
				.toSorted((a, b) => a - b);

			// One per planted line, in order — so a single global going silent is visible
			// rather than masked by its seven neighbours still reporting.
			expect(reported).toEqual(ALL_NETWORK_GLOBALS.map((_, index) => index + 1));
			expect(found.map((d) => d.ruleId)).not.toContain('PARSE_ERROR');
			expect(found.map((d) => d.ruleId)).not.toContain('NOT_LINTED');
		});

		/**
		 * And a block with no network ban stays SILENT on them — the negative half, which the
		 * network-only names make writable for the first time.
		 *
		 * A draft skipped this on the grounds that "this block does not ban `fetch`" is true of
		 * no block. That reasoning was right about `fetch` and wrong to stop there: "this block
		 * does not ban `XMLHttpRequest`" is true of every block without a network ban, measured
		 * above. Without this half, a rule that banned the network globals across all of `src/`
		 * would pass the positive case everywhere and the matrix would say nothing about where
		 * the ban is keyed.
		 */
		it.runIf(block.networkGlobals !== true)('stays silent on network globals where no network ban applies', async () => {
			const found = await lintDetailed(globalsSource(NETWORK_ONLY_GLOBALS), pathFor(block, extension));

			expect(found.map((d) => d.ruleId)).not.toContain('no-restricted-globals');
			expect(found.map((d) => d.ruleId)).not.toContain('PARSE_ERROR');
			expect(found.map((d) => d.ruleId)).not.toContain('NOT_LINTED');
		});
	});
});

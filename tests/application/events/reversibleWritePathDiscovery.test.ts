/**
 * Task 11, Part B: the static half of the reversible-write-path census.
 *
 * **This is deliberately NOT a check that anything publishes.** Six earlier versions of that
 * check shipped as containment booleans at successively finer grain — a sample of adapters, a
 * filter that was itself a sample, a metric counting literal `publish(` syntax, an enumeration
 * that trailed its own count, a per-file grep, a per-function AST walk — and each passed the
 * exact regression it existed to prevent, because "the body contains a publish" is not "this
 * path publishes". Whether a direction announces is settled by its ROW in
 * `reversibleWritePathCensus.test.ts`, which drives it and looks.
 *
 * What text CAN answer reliably is which modules exist, and that is the whole of this file: a
 * new reversible adapter fails here for being unenumerated, and its author then has to write a
 * row — the "holds for code not yet written" property the sweep was reaching for, relocated to
 * the question a scan can actually settle.
 *
 * Discovery is deliberately CRUDE and over-inclusive, and the unit is the CLASS, not the file —
 * keying by file was the sixth instance of this same defect, because adding an adapter class to
 * an already-disposed module leaves the file-key set unchanged and the assertion passes with no
 * behavioural row. So: every `class <Name>` declared in any file under `src/**` whose file
 * mentions `undo` anywhere, PLUS the transitive `extends` closure of that set — a standalone
 * `class NewAdapter extends ReversibleBase {}` in a file mentioning `undo` nowhere is still
 * caught, because its base is in the base set. This is still textual: no type resolution, no
 * layer list, no export filter.
 *
 * **What the walk cannot see, stated rather than claimed away** (six earlier claims of
 * completeness in this task's own history were each wrong within one round, and the review
 * that approved this file's rows found three MORE the first draft of this list omitted):
 *
 * - an adapter that is not a `class` at all — an object literal or a factory return satisfying
 *   `UndoableCommand` structurally;
 * - a class reaching `undo` neither by the word appearing in its own file nor by an `extends`
 *   chain rooted in such a file;
 * - a direction added to a class that already has a `rows:` disposition, if that disposition's
 *   direction list is not widened to match — the cross-check below catches only the directions
 *   a disposition already NAMES;
 * - a class EXPRESSION rather than a class DECLARATION — `const X = class {}` or
 *   `export const Y = class Z {}` — since the regex anchors on the `class` KEYWORD starting a
 *   statement, never on an assignment;
 * - a declaration whose `class` keyword is not on the SAME LINE as its `export`/`default`
 *   modifier — `export default\nclass Foo` — for the identical reason: the anchor is
 *   line-by-line;
 * - anything in a `.vue` file. `sourceFilesUnder` takes `.ts` only, so a class declared inside
 *   an SFC's `<script setup>` block is invisible to this walk regardless of what its file
 *   otherwise mentions.
 *
 * Two things worth keeping precise in the other direction, because they are easy to lose in
 * an edit and the review that approved this file measured both directly: the walk DOES catch
 * a subclass in a brand-new file whose text never contains "undo" at all, purely through the
 * `extends` closure (a standalone `class NewAdapter extends ReversibleBase {}` is still
 * found); and the `ReversibleSetPlanBackground` carve-out row in the census file is a
 * BEHAVIOURAL assertion, not a comment — making that adapter's `undo()` publish reddens it.
 *
 * The census table is maintained by people; this tripwire only lowers the odds of forgetting.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { toPosix } from '../../helpers/posix';
import { CENSUS_TABLE, type CensusDirection } from '../../helpers/reversibleWriteCensusTable';

interface ClassDecl {
	readonly file: string;
	readonly name: string;
	readonly extends: string | null;
}

function sourceFilesUnder(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) return sourceFilesUnder(full);
		return full.endsWith('.ts') && !full.endsWith('.d.ts') ? [full] : [];
	});
}

/**
 * A `class` declaration, read as TEXT rather than parsed: the line starting the declaration,
 * plus up to four more lines gathered until an opening brace appears, so a generic parameter
 * list or an `implements`/`extends` clause spanning several lines is still visible to the
 * `extends` search. The unit this answers is exactly "a class was declared here, named this,
 * extending that (if anything)" — nothing about exports, members, or reachability.
 */
function classDeclarationsIn(file: string): ClassDecl[] {
	const lines = readFileSync(file, 'utf8').split('\n');
	const found: ClassDecl[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const declared = /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(
			lines[index],
		);
		if (declared === null) continue;
		let chunk = lines[index];
		let cursor = index;
		while (!chunk.includes('{') && cursor < lines.length - 1 && cursor < index + 5) {
			cursor += 1;
			chunk += ` ${lines[cursor]}`;
		}
		const extended = /extends\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(chunk);
		found.push({ file: toPosix(file), name: declared[1], extends: extended?.[1] ?? null });
	}
	return found;
}

function allClassDeclarations(): readonly ClassDecl[] {
	return sourceFilesUnder('src').flatMap((file) => classDeclarationsIn(file));
}

/** Every module under `src/**`, matched by exact key against DISPOSITIONS below. */
function keyOf(decl: Pick<ClassDecl, 'file' | 'name'>): string {
	return `${decl.file}::${decl.name}`;
}

/**
 * The base set (a class whose FILE mentions `undo` anywhere) plus its transitive `extends`
 * closure, matched by class NAME rather than by file — a subclass declares `extends Base`
 * with no knowledge of which file `Base` lives in. Repeated until nothing new is added.
 */
function undoRelatedClasses(): readonly ClassDecl[] {
	const declarations = allClassDeclarations();
	const byKey = new Map<string, ClassDecl>(declarations.map((decl) => [keyOf(decl), decl]));
	const byName = new Map<string, string[]>();
	for (const decl of declarations) {
		const existing = byName.get(decl.name) ?? [];
		existing.push(keyOf(decl));
		byName.set(decl.name, existing);
	}

	const undoFiles = new Set(
		sourceFilesUnder('src')
			.filter((file) => readFileSync(file, 'utf8').includes('undo'))
			.map((file) => toPosix(file)),
	);
	const inScope = new Set<string>();
	for (const decl of declarations) {
		if (undoFiles.has(decl.file)) inScope.add(keyOf(decl));
	}

	let changed = true;
	while (changed) {
		changed = false;
		for (const decl of declarations) {
			const key = keyOf(decl);
			if (inScope.has(key) || decl.extends === null) continue;
			const superKeys = byName.get(decl.extends) ?? [];
			if (superKeys.some((superKey) => inScope.has(superKey))) {
				inScope.add(key);
				changed = true;
			}
		}
	}

	return [...inScope]
		.map((key) => byKey.get(key))
		.filter((decl): decl is ClassDecl => decl !== undefined)
		.toSorted((a, b) => keyOf(a).localeCompare(keyOf(b)));
}

type Disposition =
	| { readonly kind: 'rows'; readonly directions: readonly CensusDirection[]; readonly module: string }
	| { readonly kind: 'not-adapter'; readonly reason: string };

function rows(directions: readonly CensusDirection[], module: string): Disposition {
	return { kind: 'rows', directions, module };
}

function notAnAdapter(reason: string): Disposition {
	return { kind: 'not-adapter', reason };
}

/**
 * Every CLASS the walk above discovers, and what the census does about it. Keyed
 * `<repo-relative file>::<ClassName>` — a file key cannot see a class ADDED to a file that
 * already has one, which is the sixth instance of this task's own recurring defect.
 *
 * Two shapes: `rows(...)` points at the `CENSUS_TABLE` module carrying this class's
 * behavioural proof, one entry per direction named; `notAnAdapter(...)` states why a
 * discovered class is not a reversible write path at all — a query, a plain command a
 * reversible adapter wraps, an `EditorTool`, a repository, a view, prose mentioning "undo".
 *
 * Asserted by EXACT KEY SET in both directions below: a class with no entry fails, and an
 * entry for a class that no longer exists fails too.
 */
const DISPOSITIONS: Readonly<Record<string, Disposition>> = {
	// The reversible adapters this task's census covers, and the plain commands each wraps.
	'src/application/commands/zone/reversible-create-zone-command.ts::ReversibleCreateZoneCommand':
		rows(['execute', 'undo'], 'reversible-create-zone-command'),
	'src/application/commands/zone/reversible-delete-zone-command.ts::ReversibleDeleteZoneCommand':
		rows(['execute', 'undo'], 'reversible-delete-zone-command'),
	'src/application/commands/zone/DeleteZone.ts::DeleteZoneCommand': notAnAdapter(
		'plain command wrapped by ReversibleDeleteZoneCommand; declares execute only',
	),
	'src/application/commands/zone/MoveSpatialObject.ts::MoveSpatialObjectCommand': notAnAdapter(
		'plain command wrapped by ReversibleMoveZoneCommand (presentation/); declares execute only',
	),
	'src/presentation/editor/tools/reversible-move-zone-command.ts::ReversibleMoveZoneCommand':
		rows(['execute', 'undo'], 'MoveSpatialObject'),
	'src/application/commands/requirement/reversible-assign-asset-command.ts::ReversibleAssignAssetCommand':
		rows(['execute', 'undo'], 'reversible-assign-asset-command'),
	'src/application/commands/requirement/AssignAsset.ts::AssignAssetCommand': notAnAdapter(
		'plain command wrapped by ReversibleAssignAssetCommand; declares execute only',
	),
	'src/application/commands/requirement/reversible-override-commands.ts::ReversibleOverrideBase': notAnAdapter(
		'abstract base — its two concrete subclasses below are the dispatched adapters, ' +
			'inheriting execute/undo rather than declaring them',
	),
	'src/application/commands/requirement/reversible-override-commands.ts::ReversibleSetRequirementQuantityOverrideCommand':
		rows(['execute', 'undo'], 'reversible-override-commands (quantity)'),
	'src/application/commands/requirement/reversible-override-commands.ts::ReversibleSetRequirementCostOverrideCommand':
		rows(['execute', 'undo'], 'reversible-override-commands (cost)'),
	'src/application/commands/requirement/SetRequirementQuantityOverride.ts::SetRequirementQuantityOverrideCommand':
		notAnAdapter('plain command wrapped by the reversible quantity-override adapter'),
	'src/application/commands/requirement/SetRequirementCostOverride.ts::SetRequirementCostOverrideCommand':
		notAnAdapter('plain command wrapped by the reversible cost-override adapter'),
	'src/application/commands/requirement/DeleteRequirement.ts::DeleteRequirementCommand': notAnAdapter(
		'mentions "undo" only in a docblock about the delete resolutions; declares no undo member',
	),
	'src/application/commands/plan/ReversibleCalibratePlan.ts::ReversibleCalibratePlanCommand':
		rows(['execute', 'undo'], 'ReversibleCalibratePlan'),
	'src/application/commands/plan/ReversibleSetPlanBackground.ts::ReversibleSetPlanBackgroundCommand':
		rows(['execute', 'undo'], 'ReversibleSetPlanBackground'),
	'src/application/commands/asset/SetAssetBackground.ts::SetAssetBackgroundCommand': notAnAdapter(
		'plain command wrapped by ReversibleAssetBackgroundEdit; declares execute only',
	),
	'src/application/commands/asset/SetAssetHeight.ts::SetAssetHeightCommand': notAnAdapter(
		'plain command wrapped by ReversibleAssetNoteEdit; declares execute only',
	),
	'src/application/editor/asset/ReversibleAssetDesignCommands.ts::ReversibleAssetEdit': notAnAdapter(
		'abstract base providing runForward/supersededSince only — execute/undo are each ' +
			'declared separately by its three concrete subclasses below, not inherited',
	),
	'src/application/editor/asset/ReversibleAssetDesignCommands.ts::ReversibleAssetGeometryEdit':
		rows(['execute', 'undo'], 'ReversibleAssetGeometryEdit'),
	'src/application/editor/asset/ReversibleAssetDesignCommands.ts::ReversibleAssetNoteEdit':
		rows(['execute', 'undo'], 'ReversibleAssetNoteEdit'),
	'src/application/editor/asset/ReversibleAssetDesignCommands.ts::ReversibleAssetBackgroundEdit':
		rows(['execute', 'undo'], 'ReversibleAssetBackgroundEdit'),
	'src/application/editor/asset/ReversibleAssetDesignCommands.ts::ReversibleAssetDesignCommands': notAnAdapter(
		'the factory: mints a per-gesture adapter per method (setAnchor, setHeight, setBackground, ' +
			'…) and has no execute/undo of its own',
	),
	'src/application/editor/WriteLedger.ts::SessionWriteLedger': notAnAdapter(
		'the WriteLedger implementation every adapter above reads its generation from; declares ' +
			'record/observe/forget/generation/lastWritten, never execute or undo',
	),
	'src/application/queries/GetAssetDesign.ts::GetAssetDesignQuery': notAnAdapter(
		'a query — declares execute, never undo',
	),
	// Pulled into scope by the WORD rather than by any undo behaviour: the walk's file filter
	// is `text.includes('undo')`, and `ReferenceLocks`'s header now cites
	// `undoDeleteResolution.ts` and its test while stating the rule that a subscriber must
	// never acquire a reference lock. Neither class has an execute/undo pair of any kind.
	'src/application/reference/ReferenceLocks.ts::ReferenceLocks': notAnAdapter(
		'the two-level mutual-exclusion set; declares acquire/withLevel1/withLevel2/beginSession, ' +
			'never execute or undo — "undo" appears only in its header prose',
	),
	'src/application/reference/ReferenceLocks.ts::LockSessionImpl': notAnAdapter(
		'one ReferenceLocks session; declares acquire/release, never execute or undo',
	),
	'src/domain/plan/Plan.ts::Plan': notAnAdapter('a domain entity; "undo" appears only in prose'),
	'src/domain/requirement/Requirement.ts::Requirement': notAnAdapter(
		'a domain entity; "undo" appears only in prose',
	),
	'src/infrastructure/obsidian/repositories/AssetGeometryStore.ts::AssetGeometryStore': notAnAdapter(
		'the geometry sidecar port implementation the asset-design adapters write through; no ' +
			'execute/undo of its own',
	),
	'src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts::ObsidianPlanRepository': notAnAdapter(
		'a repository; "undo" appears only in prose',
	),
	'src/infrastructure/obsidian/repositories/ObsidianProjectRepository.ts::ObsidianProjectRepository':
		notAnAdapter('a repository; "undo" appears only in prose'),
	'src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts::ObsidianZoneRepository': notAnAdapter(
		'a repository; "undo" appears only in prose',
	),
	'src/plugin/RenovationPlannerPlugin.ts::RenovationPlannerPlugin': notAnAdapter(
		'the plugin bootstrap; "undo" appears only in prose',
	),
	'src/presentation/designer/AssetDesignerView.ts::AssetDesignerView': notAnAdapter(
		'an ItemView; "undo" appears only in prose about the toolbar',
	),
	'src/presentation/views/PlanEditorView.ts::PlanEditorView': notAnAdapter(
		'an ItemView; "undo" appears only in prose',
	),
	'src/presentation/designer/tools/set-anchor-tool.ts::SetAnchorTool': notAnAdapter(
		'implements EditorTool, not UndoableCommand — no execute/undo pair',
	),
	'src/presentation/designer/tools/set-facing-tool.ts::SetFacingTool': notAnAdapter(
		'implements EditorTool, not UndoableCommand — no execute/undo pair',
	),
	'src/presentation/editor/tools/calibrate-tool.ts::CalibrateTool': notAnAdapter(
		'implements EditorTool, not UndoableCommand — no execute/undo pair',
	),
	'src/presentation/editor/tools/draw-polygon-tool.ts::DrawPolygonTool': notAnAdapter(
		'implements EditorTool, not UndoableCommand — no execute/undo pair',
	),
	'src/presentation/editor/tools/select-tool.ts::SelectTool': notAnAdapter(
		'implements EditorTool, not UndoableCommand — no execute/undo pair',
	),
	'src/presentation/editor/tools/command-history.ts::CommandHistory': notAnAdapter(
		'CommandHistory, which CALLS undo rather than being one — it declares undo()/redo() over ' +
			'a stack of adapters, and run() rather than execute()',
	),
	'src/presentation/editor/snapping/snap-service.ts::SnapService': notAnAdapter(
		'a service the drawing tools consult; "undo" appears only in prose',
	),
};

describe('the discovery walk finds something at all', () => {
	it('discovers a non-trivial number of class declarations under src/**', () => {
		// A typo'd regex would find nothing and look exactly like a clean tree.
		expect(allClassDeclarations().length).toBeGreaterThan(50);
	});

	it('discovers a non-trivial number of undo-related classes', () => {
		expect(undoRelatedClasses().length).toBeGreaterThan(20);
	});
});

describe('every discovered class has a disposition, and every disposition names a real class', () => {
	it('the discovered key set and the DISPOSITIONS key set are exactly equal', () => {
		const discovered = undoRelatedClasses().map((decl) => keyOf(decl)).toSorted();
		const disposed = Object.keys(DISPOSITIONS).toSorted();

		expect(discovered).toEqual(disposed);
	});
});

describe('a rows: disposition is not a claim the census table fails to back', () => {
	it('every module a disposition names carries a row for every direction it claims', () => {
		const byModule = new Map<string, Set<CensusDirection>>();
		for (const row of CENSUS_TABLE) {
			const directions = byModule.get(row.module) ?? new Set<CensusDirection>();
			directions.add(row.direction);
			byModule.set(row.module, directions);
		}

		const missing: string[] = [];
		for (const [key, disposition] of Object.entries(DISPOSITIONS)) {
			if (disposition.kind !== 'rows') continue;
			const present = byModule.get(disposition.module) ?? new Set<CensusDirection>();
			for (const direction of disposition.directions) {
				if (!present.has(direction)) missing.push(`${key} claims ${direction} for module ${disposition.module}`);
			}
		}

		expect(missing).toEqual([]);
	});
});

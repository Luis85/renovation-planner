/**
 * "Nothing outside `src/plugin/` registers anything with Obsidian."
 *
 * `RenovationPlannerPlugin`'s header claimed something WIDER than that and stronger than the
 * tree — that this FILE is "the ONLY place anything is registered with Obsidian", repeated
 * fifty lines down as "the `addCommand` calls still happen here". Both were false when
 * written and nothing could see it: `planEditorCommands.ts` and `sampleProject.ts` each call
 * `host.addCommand` through the `PluginCommandHost` seam, three calls between them. The
 * sentence read as settled, which is exactly what makes an unchecked category claim worse
 * than no claim.
 *
 * The claim worth keeping is the one about the LAYER, and it is true: registration is a
 * `plugin/` concern, so a view, a repository or a composable reaching for `addCommand` is an
 * architecture violation the layer bans cannot catch — `obsidian` is importable in
 * `infrastructure/`, and a `Plugin` instance is passed around as `host`. This is that claim,
 * measured rather than asserted.
 *
 * **What the instrument sees**, stated rather than implied: it reads source TEXT for the
 * member name, so a registration reached through a differently-named wrapper or a computed
 * member (`host['add' + 'Command']`) is invisible to it. That is the same bound
 * `entityRef.test.ts` names for the same technique, and it is why this is a locality check
 * rather than a claim that these are the only registrations that exist.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

/**
 * Obsidian's registration surface, as this plugin actually uses it. A member added to this
 * list is a member the check starts covering — the list is the extension point, and it is
 * spelled with the leading dot so that a local identifier of the same name is not matched.
 */
const REGISTRATION_MEMBERS = [
	'.addCommand(',
	'.addRibbonIcon(',
	'.addSettingTab(',
	'.registerView(',
	'.registerEvent(',
	'.registerDomEvent(',
	'.registerInterval(',
	'.registerExtensions(',
	'.registerMarkdownCodeBlockProcessor(',
] as const;

function sourceFilesUnder(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sourceFilesUnder(path);
		return path.endsWith('.ts') || path.endsWith('.vue') ? [path] : [];
	});
}

function modulesRegistering(): string[] {
	return sourceFilesUnder('src')
		.filter((path) => {
			const source = readFileSync(path, 'utf8');
			return REGISTRATION_MEMBERS.some((member) => source.includes(member));
		})
		.map((path) => path.split(sep).join('/'))
		.toSorted();
}

describe('registering with Obsidian', () => {
	it('happens in src/plugin/ and nowhere else', () => {
		const outside = modulesRegistering().filter((path) => !path.startsWith('src/plugin/'));

		expect(outside).toEqual([]);
	});

	it('names the three modules that do it, so a fourth is a deliberate change', () => {
		// Pinned by exact set rather than by count: a module dropping OUT of this list is as
		// much a change worth seeing as one joining it, and a count cannot tell the two apart.
		// This is also the measurement the header sentence should have been written from —
		// three modules, not one.
		expect(modulesRegistering()).toEqual([
			'src/plugin/RenovationPlannerPlugin.ts',
			'src/plugin/planEditorCommands.ts',
			'src/plugin/sampleProject.ts',
		]);
	});

	it('finds something at all, so a passing check is not an empty search', () => {
		// The instrument's own guard: a typo'd member list would make both cases above pass by
		// reaching nothing, which is indistinguishable from a clean tree.
		expect(modulesRegistering().length).toBeGreaterThan(0);
	});
});

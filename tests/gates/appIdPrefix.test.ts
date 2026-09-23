/**
 * "Every `createApp()` in `src/` sets `app.config.idPrefix`."
 *
 * Vue's `useId()` is unique only PER APP, so two mounted apps mint the same ids — and this
 * plugin mounts one per leaf, which a user creates by splitting a pane. `app-id-prefix.ts`
 * closes that with a bundle-scoped counter, and closing it depends on every mount site
 * remembering to call it. Nothing checked that, and the consequence was not hypothetical: two
 * panes emitting the same `aria-controls` target resolve one pane's control to the other
 * pane's element, which is the hazard `ProjectHome.vue`'s own docblock describes.
 *
 * **This file exists because the CLAIM went stale by MERGE, which is the failure mode no
 * author of either branch is looking at.** Four separate docblocks said the prefix was set at
 * *BOTH* `createApp` sites — true when design slice 16 wrote it, when there were two. The
 * asset designer made it three and the asset library made it four, each on its own branch,
 * and the merge that brought them together left every one of those sentences reading
 * correctly in isolation while all four were wrong about the tree. `AssetLibraryView.ts`'s own
 * header even predicted it ("a fourth `createApp` call here is what moves it to four"), which
 * is a prediction with nothing to fire it.
 *
 * So the prose says EVERY rather than a number now, and this is what makes that true. The
 * pattern is the one CLAUDE.md already names for the registered view types: the assertion is
 * where the NEXT one arrives and fails, rather than a sentence that would read correctly
 * forever.
 *
 * TWO assertions, because they fail for different reasons and neither implies the other:
 *
 * - **the RULE** — every discovered mount site sets the prefix. That holds for files nobody
 *   has written yet, which a list cannot.
 * - **the SET** — the discovered sites are exactly the four below. An instrument that reaches
 *   nothing looks exactly like a clean tree, so this is what says the walk still finds the
 *   mounts at all; and it is deliberately the place a FIFTH surface announces itself, since a
 *   new view that forgot the prefix would otherwise be caught only by the rule and a new view
 *   that remembered it would slip in with no one reading this file's reasoning.
 *
 * **What the instrument sees**, stated rather than implied. It reads source TEXT with comments
 * stripped, so: a mount reached through a differently-named wrapper is invisible; the prefix is
 * matched by the identifier `idPrefix` appearing anywhere in the same FILE, so a file that
 * mounts two apps and prefixes only one satisfies it; and the scope is `src/` alone, so the
 * harness's own mounts (`tests/harness/`) are outside it — they are not the surface a user can
 * split, and the harness index deliberately mounts one entry at a time.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { toPosix } from '../helpers/posix';

/**
 * `source` with comments removed, because the shape being searched for is CODE and this
 * repository writes a great deal of prose about it: `DialogHost.vue` says `createApp()` three
 * times in its header and mounts nothing, so a raw-text scan reports it as a mount site that
 * never sets a prefix — a false finding, in the direction that gets a check disbelieved.
 *
 * Line comments are stripped only where the `//` opens a token, which leaves a `https://` in a
 * string alone. Over-stripping is the dangerous direction here: it would hide a real mount and
 * report a clean tree, so the `it` below drives both spellings through the walk rather than
 * trusting this regex pair.
 */
function withoutCommentary(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function sourceFilesUnder(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sourceFilesUnder(path);
		return path.endsWith('.ts') || path.endsWith('.vue') ? [path] : [];
	});
}

interface MountSite {
	readonly path: string;
	readonly setsPrefix: boolean;
}

function mountSites(): MountSite[] {
	return sourceFilesUnder('src')
		.map((path) => ({ path: toPosix(path), source: withoutCommentary(readFileSync(path, 'utf8')) }))
		.filter((file) => file.source.includes('createApp('))
		.map((file) => ({ path: file.path, setsPrefix: file.source.includes('idPrefix') }))
		.toSorted((a, b) => a.path.localeCompare(b.path));
}

describe('app id prefixes', () => {
	/**
	 * The instrument before the measurement, and it is driven against BOTH directions of the
	 * comment-stripping above rather than reasoned from the regex: a mount in live code must be
	 * found, and a mount named only in prose must not be.
	 */
	it('finds a mount in code and ignores one named in a comment', () => {
		const live = withoutCommentary('const app = createApp(Root);\napp.config.idPrefix = next();\n');
		expect(live.includes('createApp(')).toBe(true);
		expect(live.includes('idPrefix')).toBe(true);

		expect(withoutCommentary('/**\n * needs an `app.config.idPrefix` where `createApp()` runs.\n */\n')).not.toContain(
			'createApp(',
		);
		expect(withoutCommentary('// const app = createApp(Root);\n')).not.toContain('createApp(');

		// Over-stripping is the failure that would hide a real mount, so the one spelling most
		// likely to trip the line-comment regex is pinned as SURVIVING it.
		expect(withoutCommentary("const docs = 'https://vuejs.org';\nconst app = createApp(Root);\n")).toContain(
			'createApp(',
		);
	});

	it('sets idPrefix at every createApp site', () => {
		const missing = mountSites()
			.filter((site) => !site.setsPrefix)
			.map((site) => site.path);

		expect(missing).toEqual([]);
	});

	/**
	 * The exact set, so a fifth mounted surface fails HERE — beside the reasoning — rather than
	 * passing silently and leaving four docblocks to be re-checked by hand. Add the path when a
	 * view is added, having confirmed it calls `nextAppIdPrefix()`.
	 */
	it('mounts exactly these four apps, so the walk cannot quietly reach nothing', () => {
		expect(mountSites().map((site) => site.path)).toEqual([
			'src/presentation/designer/AssetDesignerView.ts',
			'src/presentation/library/AssetLibraryView.ts',
			'src/presentation/views/PlanEditorView.ts',
			'src/presentation/views/RenovationProjectView.ts',
		]);
	});
});

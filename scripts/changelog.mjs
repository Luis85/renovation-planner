import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fromMarkdown } from 'mdast-util-from-markdown';

/**
 * The Markdown layer `CHANGELOG.md` is read through, and the CLI the release workflow runs
 * to build the file `gh release create --notes-file` reads.
 *
 * **Parsed, not pattern-matched**, and that is the one design decision in this file. In the
 * source project every defect its register checker ever had came from hand-rolled parsing
 * rather than from a rule: a heading indented by CommonMark's permitted 0-3 spaces missed by
 * a `^## ` anchor, a CRLF checkout read as a file with no headings at all, a citation that
 * Markdown had wrapped across two lines matching nothing while the run stayed green. A
 * `## ` inside a fenced block is the same hazard here — it would end the extracted section
 * early, and the release body would be silently short.
 *
 * One dependency, not the three that project's register needs: the GFM table extension
 * exists there because the register IS tables, and a changelog's headings parse the same
 * with or without it.
 */

/**
 * Every `## ` heading, with its text and its offset in the document.
 *
 * The `startsWith('##')` guard is not redundant: a setext heading (`Title` over `---`) is
 * also depth 2, and a version line written that way is not the ATX heading this file's
 * callers mean.
 *
 * Typed by JSDoc rather than a sibling `.d.mts` — an annotation here cannot drift from
 * the implementation the way a hand-written declaration file can.
 *
 * @param {string} text
 * @returns {{ text: string, index: number }[]}
 */
export function headings(text) {
	const root = fromMarkdown(text);
	const found = [];
	for (const node of root.children) {
		if (node.type !== 'heading' || node.depth !== 2 || !node.position) continue;
		const start = node.position.start.offset;
		if (!text.slice(start, start + 2).startsWith('##')) continue;
		const first = node.children[0];
		const last = node.children.at(-1);
		const label = first && last ? text.slice(first.position.start.offset, last.position.end.offset) : '';
		found.push({ text: label.trim(), index: start });
	}
	return found;
}

/**
 * The body of one dated version heading — everything between it and the next `## `, or the
 * end of the file for the oldest entry, trimmed.
 *
 * Throws when the version has no dated heading, which is deliberate: it fails the release
 * workflow rather than publishing a release whose body says nothing.
 * `tests/release/changelog.test.ts` already keeps that state off `main`, so in practice this
 * only fires on a manual dispatch against an unusual ref.
 *
 * @param {string} changelog
 * @param {string} version
 * @returns {string}
 */
export function changelogNotes(changelog, version) {
	const dated = new RegExp(`^\\[${version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`);
	const all = headings(changelog);
	const at = all.findIndex((h) => dated.test(h.text));
	if (at === -1) throw new Error(`CHANGELOG.md has no dated heading for ${version}`);
	// A heading with no newline after it is the last line of a file that does not end in one:
	// `indexOf` returns -1, and `-1 + 1` would slice from 0 — the whole file, rather than the
	// empty body that heading actually has.
	const lineEnd = changelog.indexOf('\n', all[at].index);
	const from = lineEnd === -1 ? changelog.length : lineEnd + 1;
	return changelog.slice(from, all[at + 1]?.index ?? changelog.length).trim();
}

// CLI: `node scripts/changelog.mjs <version>`. Guarded on the real PATH rather than by
// comparing `import.meta.url` directly — that breaks on Windows, where the URL stays
// `file:///C:/…` against argv's `C:\…` — so importing this module for its exports never
// touches argv or the filesystem.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const version = process.argv[2];
	if (!version) {
		console.error('Usage: node scripts/changelog.mjs <version>');
		process.exit(1);
	}
	process.stdout.write(`${changelogNotes(readFileSync('CHANGELOG.md', 'utf8'), version)}\n`);
}

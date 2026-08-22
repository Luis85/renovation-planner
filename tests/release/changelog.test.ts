import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { changelogNotes, headings } from '../../scripts/changelog.mjs';

/**
 * Two subjects in one file, because one is worthless without the other: that this
 * repository's changelog says what it must, and that the extractor the release workflow
 * runs against it reads the section a human would.
 *
 * The first is what makes the rule in `RELEASING.md` a check rather than a habit — a pull
 * request that bumps the version and forgets the entry fails `npm run check` before it
 * reaches `main`, rather than producing a release body that says nothing.
 */

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const changelog = readFileSync('CHANGELOG.md', 'utf8');

const heading = (label: string) =>
	headings(changelog).filter((h: { text: string }) => h.text === label || h.text.startsWith(`[${label}]`));

describe('this repository’s changelog', () => {
	it('has a dated section for the version in the manifest', () => {
		const found = heading(manifest.version);

		expect(found).toHaveLength(1);
		// `[0.1.0] - 2026-08-22`. The date is what says a version shipped rather than being
		// planned, and it is what the extractor matches on.
		expect(found[0].text).toMatch(/^\[[\d.]+\] - \d{4}-\d{2}-\d{2}$/);
	});

	it('keeps an Unreleased section for what lands next', () => {
		expect(heading('Unreleased')).toHaveLength(1);
	});

	// A second section for one version makes "this version's entry" ambiguous for anyone —
	// or any script — extracting it.
	it('states each version once', () => {
		const versions = headings(changelog)
			.map((h: { text: string }) => h.text)
			.filter((text: string) => text.startsWith('['));

		expect(new Set(versions).size).toBe(versions.length);
	});

	it('extracts a body for the version being shipped', () => {
		expect(changelogNotes(changelog, manifest.version)).not.toBe('');
	});
});

describe('the extractor', () => {
	const doc = ['# Changelog', '', '## [Unreleased]', '', '## [1.2.0] - 2026-01-02', '', '- newer', '', '## [1.1.0] - 2026-01-01', '', '- older', ''].join(
		'\n',
	);

	it('stops at the next heading', () => {
		expect(changelogNotes(doc, '1.2.0')).toBe('- newer');
	});

	it('runs to the end of the file for the oldest entry', () => {
		expect(changelogNotes(doc, '1.1.0')).toBe('- older');
	});

	// The reason this reads a parsed tree rather than lines. A `## ` inside a fence would end
	// the section early with a line scan, and the release body would be silently short.
	it('does not treat a heading inside a code fence as a boundary', () => {
		const fenced = ['## [1.0.0] - 2026-01-01', '', '```md', '## [0.9.0] - 2025-12-01', '```', '', '- real content', ''].join('\n');

		expect(changelogNotes(fenced, '1.0.0')).toContain('- real content');
	});

	// An undated heading is not an entry: it is the `## [Unreleased]` section, or a section
	// somebody has not finished. Publishing its body as a release note would ship a summary
	// of work that is not in the release.
	it('refuses a version with no dated heading', () => {
		expect(() => changelogNotes(doc, '9.9.9')).toThrow(/no dated heading for 9\.9\.9/);
		expect(() => changelogNotes(doc, 'Unreleased')).toThrow(/no dated heading for Unreleased/);
	});

	// A file that does not end in a newline used to slice from offset 0 — the whole document
	// instead of the empty body that heading actually has.
	it('gives an empty body to a trailing heading with nothing after it', () => {
		expect(changelogNotes('## [1.0.0] - 2026-01-01', '1.0.0')).toBe('');
	});
});

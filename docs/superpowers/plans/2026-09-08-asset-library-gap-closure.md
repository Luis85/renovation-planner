# Asset Library Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the bounded residue between the Asset Library UX specification (AL00–AL11) and the shipped `src/presentation/library/` code, and reconcile the project's records to what shipped.

**Architecture:** Four work packages cut by file ownership (Styles, Form, List and navigation, Records) so WP-A, WP-B and WP-C run in parallel with no shared file; WP-D runs last because it records their evidence. Every behaviour lands TDD; styles that jsdom cannot measure are proved by regenerated harness captures.

**Tech Stack:** Vue 3 SFCs, Pinia, Vitest + @vue/test-utils under jsdom, decimal.js, plain CSS partials assembled by `scripts/styles-assemble.mjs`, Playwright captures via `scripts/asset-library-shots.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-08-asset-library-gap-closure-design.md`

## Global Constraints

- **Sequencing for shared files.** WP-A, WP-B (Tasks B1–B5) and WP-C run in parallel. Task B6 touches `AssetLibraryRoot.vue` and both `*-assetLibrary.ts` locale files, which WP-C also edits, so B6 runs only AFTER Tasks C1–C3 are committed. WP-D runs after everything else.

- Work in the worktree `.worktrees/codex/asset-library-gap-closure` on branch `codex/asset-library-gap-closure`. Every command below runs from that directory.
- Inner loop: `npm run check:fast -- <test paths>`. Never run two gates at once. The full `npm run check` runs ONCE, in Task D5, by the integrator.
- `max-lines` is 400 for `src/**` (blank lines and comments skipped). `NewAssetForm.vue` is near it; the hint is a child component for that reason.
- No user-visible literal outside the locale tables: every new string is a key in `en-assetLibrary.ts` (and `de-assetLibrary.ts`), read through `tr(...)`. Sentence case. No em-dash inside a new key's value.
- No hard-coded colour in CSS; Obsidian variables only. Partials stay under 400 lines.
- Commit after each task with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Do not create files the plan does not name. Do not touch a file owned by another package.
- The `obsidian` module mock answers `'en'` for the language; `tr` therefore resolves English in tests.
- Test helpers: `mountRoot` / `anEntry` / `definite` from `tests/helpers/assetLibraryRootHarness.ts`, `mountInspector` from `tests/helpers/assetInspectorHarness.ts`, `settle` from `tests/helpers/async.ts`, `installObsidianDom` from `tests/helpers/dom.ts`, `installNarrowComposition` from `tests/presentation/library/narrowComposition.ts`.

---

## WP-A Styles

Owner files: `styles/asset-shelf.css`, `styles/asset-library.css`, `styles/asset-library-inspector.css`, `src/presentation/library/AssetShelves.vue`, `src/presentation/library/AssetRow.vue`, `src/presentation/views/assetLabels.ts`, the `form.new-asset.unit-symbol.*` rows in `src/presentation/i18n/locales/en.ts` and `de.ts`, `tests/presentation/views/assetLabels.test.ts`, `tests/presentation/library/assetRow.test.ts`, `tests/build/libraryComponentStyles.test.ts`, `scripts/asset-library-shots.mjs`, `docs/user-experience/asset-library-delivery/captures/**`.

### Task A1: Unit symbols

**Files:**
- Modify: `src/presentation/views/assetLabels.ts` (append after `MEASUREMENT_UNIT_LABELS`)
- Modify: `src/presentation/i18n/locales/en.ts` (after the `form.new-asset.unit.fixed` row), `src/presentation/i18n/locales/de.ts` (same place)
- Modify: `src/presentation/library/AssetRow.vue`
- Test: `tests/presentation/views/assetLabels.test.ts`, `tests/presentation/library/assetRow.test.ts`

**Interfaces:**
- Produces: `export const MEASUREMENT_UNIT_SYMBOLS: Record<MeasurementUnit, StringKey>` in `assetLabels.ts`; locale keys `form.new-asset.unit-symbol.piece|m|m2|m3|hour|day|fixed`.

- [ ] **Step 1: Write the failing label test**

Append to `tests/presentation/views/assetLabels.test.ts`:

```ts
import { MEASUREMENT_UNIT_SYMBOLS } from '../../../src/presentation/views/assetLabels';

describe('MEASUREMENT_UNIT_SYMBOLS', () => {
	it.each(UNITS)('gives %s a short, non-empty symbol in both locales', (unit) => {
		const key = MEASUREMENT_UNIT_SYMBOLS[unit];
		expect(t('en', key)).not.toBe('');
		expect(t('en', key).length).toBeLessThanOrEqual(6);
		expect(de[key]).toBeDefined();
	});
	it('prints the square and cubic metre as m² and m³, not the raw key', () => {
		expect(t('en', MEASUREMENT_UNIT_SYMBOLS.m2)).toBe('m²');
		expect(t('en', MEASUREMENT_UNIT_SYMBOLS.m3)).toBe('m³');
	});
});
```

(Merge the import into the existing import line from `assetLabels`.)

- [ ] **Step 2: Run it and see it fail**

Run: `npm run check:fast -- tests/presentation/views/assetLabels.test.ts`
Expected: FAIL, `MEASUREMENT_UNIT_SYMBOLS` is not exported.

- [ ] **Step 3: Add the keys and the map**

In `en.ts`, directly after `'form.new-asset.unit.fixed': ...`:

```ts
	// Short symbols for a table cell, beside the long labels a form control shows. `m²` and
	// `m³` are glyphs rather than words; the rest are the shortest reading a row can carry.
	'form.new-asset.unit-symbol.piece': 'pcs',
	'form.new-asset.unit-symbol.m': 'm',
	'form.new-asset.unit-symbol.m2': 'm²',
	'form.new-asset.unit-symbol.m3': 'm³',
	'form.new-asset.unit-symbol.hour': 'h',
	'form.new-asset.unit-symbol.day': 'd',
	'form.new-asset.unit-symbol.fixed': 'fixed',
```

In `de.ts`, same place:

```ts
	'form.new-asset.unit-symbol.piece': 'Stk.',
	'form.new-asset.unit-symbol.m': 'm',
	'form.new-asset.unit-symbol.m2': 'm²',
	'form.new-asset.unit-symbol.m3': 'm³',
	'form.new-asset.unit-symbol.hour': 'Std.',
	'form.new-asset.unit-symbol.day': 'Tag',
	'form.new-asset.unit-symbol.fixed': 'pauschal',
```

In `assetLabels.ts`, after `MEASUREMENT_UNIT_LABELS`:

```ts
/**
 * The SHORT reading of a unit, for a shelf row's price cell (`AssetRow.vue`): `34,95 € / m²`
 * rather than `/ m2` (the raw key, which browse case step 4 recorded as a defect) or
 * `/ Square metres` (the form label, which does not fit a 5ch column). Same `Record` shape
 * and the same compile-time completeness argument as the two tables above.
 */
export const MEASUREMENT_UNIT_SYMBOLS: Record<MeasurementUnit, StringKey> = {
	piece: 'form.new-asset.unit-symbol.piece',
	m: 'form.new-asset.unit-symbol.m',
	m2: 'form.new-asset.unit-symbol.m2',
	m3: 'form.new-asset.unit-symbol.m3',
	hour: 'form.new-asset.unit-symbol.hour',
	day: 'form.new-asset.unit-symbol.day',
	fixed: 'form.new-asset.unit-symbol.fixed',
};
```

If `en.ts` trips `max-lines`, move the seven keys into `en-assetLibrary.ts` (and `de-assetLibrary.ts`) instead; both are spread into the same object.

- [ ] **Step 4: Run and see it pass**

Run: `npm run check:fast -- tests/presentation/views/assetLabels.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing row test**

Append to `tests/presentation/library/assetRow.test.ts` inside the existing `describe`:

```ts
	it('prints the unit as its symbol, not its raw key', () => {
		const wrapper = mountRow({ entry: anEntry({ unit: 'm2' }) });
		expect(wrapper.get('.rp-al-row__unit').text()).toBe('/ m²');
		expect(wrapper.text()).not.toContain('m2');
	});
```

- [ ] **Step 6: Run it and see it fail**

Run: `npm run check:fast -- tests/presentation/library/assetRow.test.ts`
Expected: FAIL, text is `/ m2`.

- [ ] **Step 7: Use the symbol in the row**

In `AssetRow.vue` script, add `import { MEASUREMENT_UNIT_SYMBOLS } from '../views/assetLabels';` and `import { tr } from '../i18n/strings';` (keep the existing `currentLanguage` import), then:

```ts
const unitSymbol = computed((): string => tr(MEASUREMENT_UNIT_SYMBOLS[props.entry.unit]));
```

In the template replace `<span class="rp-al-row__unit"> / {{ entry.unit }}</span>` with
`<span class="rp-al-row__unit">/ {{ unitSymbol }}</span>`.

- [ ] **Step 8: Run and see it pass**

Run: `npm run check:fast -- tests/presentation/library/assetRow.test.ts tests/presentation/views/assetLabels.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/presentation/views/assetLabels.ts src/presentation/i18n/locales/en.ts src/presentation/i18n/locales/de.ts src/presentation/library/AssetRow.vue tests/presentation/views/assetLabels.test.ts tests/presentation/library/assetRow.test.ts
git commit -m "feat(library): print a unit symbol in the shelf row

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task A2: Price column alignment

**Files:**
- Modify: `src/presentation/library/AssetRow.vue` (template), `src/presentation/library/AssetShelves.vue` (heading row), `styles/asset-shelf.css`
- Test: `tests/presentation/library/assetRow.test.ts`

**Interfaces:**
- Produces: the row grid has SIX columns: mark, name, amount, unit, waste, supplier. `.rp-al-row__amount` and `.rp-al-row__unit` are direct children of `button.rp-al-row`; `.rp-al-row__cost` no longer exists. The heading row's cost heading carries `class="rp-al-columns__cost"` and spans two columns.

- [ ] **Step 1: Write the failing test**

Append to `assetRow.test.ts`:

```ts
	it('places the amount and the unit in their own grid cells so the decimals align', () => {
		const wrapper = mountRow();
		const cells = [...wrapper.get('button.rp-al-row').element.children].map((el) => el.className);
		expect(cells).toEqual(expect.arrayContaining(['rp-al-row__amount', 'rp-al-row__unit']));
		expect(wrapper.find('.rp-al-row__cost').exists()).toBe(false);
	});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm run check:fast -- tests/presentation/library/assetRow.test.ts`
Expected: FAIL on the `rp-al-row__cost` assertion.

- [ ] **Step 3: Flatten the two spans and widen the grid**

`AssetRow.vue` template: remove the `<span class="rp-al-row__cost">` wrapper so the button's children are `AssetMark`, `.rp-al-row__name`, `.rp-al-row__amount`, `.rp-al-row__unit`, `.rp-al-row__waste`, `.rp-al-row__supplier`.

`AssetShelves.vue` heading row:

```html
		<div class="rp-al-columns">
			<span /><span>{{ tr('form.new-asset.name') }}</span><span class="rp-al-columns__cost">{{ tr('view.asset-library.unit-cost') }}</span><span>{{ tr('view.asset-library.waste') }}</span><span>{{ tr('view.asset-library.supplier') }}</span>
		</div>
```

(Leave `aria-hidden` for Task A3 to remove.)

`styles/asset-shelf.css`: change BOTH `grid-template-columns: 20px minmax(0, 1fr) 14ch 5ch minmax(0, 16ch);` (the row rule and `.rp-al-columns`) to `20px minmax(0, 1fr) 11ch 4ch 5ch minmax(0, 16ch);`. Replace the `.rp-al-row__cost` and `.rp-al-row__amount` rules with:

```css
/* The amount alone is right-aligned with tabular numerals, in its OWN track: with the unit
   word in the same cell the amount's right edge followed the unit's width (measured 22.3px
   of spread over eight rows, browse case step 2), so the decimal points never lined up. */
.rp-al-row__amount {
	text-align: end;
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
}

.rp-al-row__unit {
	color: var(--text-muted);
	white-space: nowrap;
}

.rp-al-columns__cost {
	grid-column: span 2;
	text-align: end;
}
```

In the `< 40rem` container block change the row columns to `20px minmax(0, 1fr) auto auto 5ch;` and in the `< 32.5rem` block to `20px minmax(0, 1fr) auto auto;` (Task A3 merges these blocks).

- [ ] **Step 4: Run and see it pass**

Run: `npm run check:fast -- tests/presentation/library/assetRow.test.ts tests/presentation/library/assetShelf.test.ts tests/build/libraryComponentStyles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/library/AssetRow.vue src/presentation/library/AssetShelves.vue styles/asset-shelf.css tests/presentation/library/assetRow.test.ts
git commit -m "fix(library): align the price column on its decimal point

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task A3: Headings and cells leave together, and headings are announced

**Files:**
- Modify: `styles/asset-shelf.css`, `src/presentation/library/AssetShelves.vue`
- Test: `tests/build/libraryComponentStyles.test.ts`, `tests/presentation/library/assetLibraryRoot.test.ts`

- [ ] **Step 1: Write the failing stylesheet test**

Append to `tests/build/libraryComponentStyles.test.ts` (it already imports `assembleStyles`):

```ts
describe('shelf column headings and cells', () => {
	/** Interaction rules §10: "Remove column headings together with their cells." */
	it('hide the heading row and the waste cell under ONE container threshold', () => {
		const sheet = assembleStyles().replace(/\/\*[\s\S]*?\*\//gu, '');
		const blocks = [...sheet.matchAll(/@container rp-al-shelves \(width < ([\d.]+rem)\)\s*\{([\s\S]*?)\n\}/gu)];
		const hidingHeadings = blocks.filter(([, , body]) => /\.rp-al-columns\s*\{[^}]*display:\s*none/u.test(body)).map(([, w]) => w);
		const hidingWaste = blocks.filter(([, , body]) => /\.rp-al-row__waste\s*\{[^}]*display:\s*none/u.test(body)).map(([, w]) => w);
		expect(hidingHeadings).toHaveLength(1);
		expect(hidingWaste).toEqual(hidingHeadings);
	});
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm run check:fast -- tests/build/libraryComponentStyles.test.ts`
Expected: FAIL, `40rem` versus `32.5rem`.

- [ ] **Step 3: Merge the two blocks**

In `styles/asset-shelf.css` delete the separate `@container rp-al-shelves (width < 40rem) { .rp-al-columns { display: none; } }` block and move `.rp-al-columns { display: none; }` INTO the `< 32.5rem` block beside `.rp-al-row__waste { display: none; }`. Keep the `< 40rem` block for the supplier column only. Add above the merged block:

```css
/* Headings leave WITH their cells (interaction rules §10, D02). The supplier column goes first
   at 40rem with no heading change, because its heading is the last cell of the row and the
   heading row still lines up over the four that remain; the waste cell and the whole heading
   row go together at 32.5rem, where a heading over "amount / unit" alone would label nothing
   a reader cannot see. Chosen from captures at 560 and 720 (Task A6). */
```

- [ ] **Step 4: Run and see it pass**

Run: `npm run check:fast -- tests/build/libraryComponentStyles.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing markup test**

Append to `tests/presentation/library/assetLibraryRoot.test.ts` inside its main `describe` (use its existing mount helper, whatever it names the mounted wrapper):

```ts
	it('exposes the column headings to assistive technology', async () => {
		const root = await mountRoot({ entries: [anEntry()], expanded: ref(['material']) });
		expect(root.get('.rp-al-columns').attributes('aria-hidden')).toBeUndefined();
		root.unmount();
	});
```

(Import `ref` from `vue` if the file does not already.)

- [ ] **Step 6: Run it and see it fail**

Run: `npm run check:fast -- tests/presentation/library/assetLibraryRoot.test.ts`
Expected: FAIL, attribute is `"true"`.

- [ ] **Step 7: Remove the attribute**

In `AssetShelves.vue` delete the line `aria-hidden="true"` on `.rp-al-columns`. Replace the surrounding comment (if one names the attribute) with: `<!-- Read once as context for the rows below. Below 32.5rem the row and the waste cell are display:none together, so nothing is announced that a sighted reader cannot see (§10). -->`

- [ ] **Step 8: Run and see it pass**

Run: `npm run check:fast -- tests/presentation/library/assetLibraryRoot.test.ts tests/harness/accessibilityAssetLibrary.test.ts`
Expected: PASS (axe must not report the heading row).

- [ ] **Step 9: Commit**

```bash
git add styles/asset-shelf.css src/presentation/library/AssetShelves.vue tests/build/libraryComponentStyles.test.ts tests/presentation/library/assetLibraryRoot.test.ts
git commit -m "fix(library): drop shelf headings with their cells and announce them

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task A4: Used-in row wraps instead of breaking the name

**Files:**
- Modify: `styles/asset-library-inspector.css`

- [ ] **Step 1: Replace the two rules**

`.rp-al-used__row`: add `flex-wrap: wrap;` after `justify-content: space-between;`.

Replace `.rp-al-used__name { overflow-wrap: anywhere; }` and its comment with:

```css
/* The name grows and keeps its words whole; the mark beside it never wraps and drops to its
   own line when the rail cannot hold both. `overflow-wrap: anywhere` broke a project name one
   CHARACTER per line beside a `flex: 0 0 auto` mark at the 240px rail (browse case step 12,
   measured 51.8px tall against 19.6px for the row below). */
.rp-al-used__project {
	flex: 1 1 12ch;
	min-width: 0;
}

.rp-al-used__name {
	overflow-wrap: normal;
	word-break: normal;
}

.rp-al-used__override {
	flex: 0 0 auto;
	white-space: nowrap;
}
```

If `.rp-al-used__override` already has a rule, merge these two declarations into it rather than declaring it twice.

- [ ] **Step 2: Run the stylesheet gate**

Run: `npm run check:fast -- tests/build/libraryComponentStyles.test.ts tests/presentation/library/assetInspectorUsedIn.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add styles/asset-library-inspector.css
git commit -m "fix(library): wrap the used-in row instead of breaking the project name

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task A5: Repair strip columns

**Files:**
- Modify: `styles/asset-library.css`

- [ ] **Step 1: Turn the row into a grid**

Replace `.rp-al-repair li { display: flex; align-items: baseline; gap: var(--size-4-2); }` with:

```css
/* A GRID rather than a flex row: with flex the reason's left edge followed each row's own
   path length (measured 858.9 and 788.7 in one strip, a 70px ragged edge, browse case step
   15). Three tracks put the path, the reason and the action in columns down the strip. */
.rp-al-repair li {
	display: grid;
	grid-template-columns: minmax(0, 1fr) max-content max-content;
	align-items: baseline;
	gap: var(--size-4-2);
}
```

Delete `flex: 1 1 auto;` from `.rp-al-repair .rp-view-notice__path` and `flex: 0 0 auto;` from `.rp-al-repair .rp-view-notice__reason` (both are meaningless in a grid). Rows with no button leave the third track empty, which is fine.

- [ ] **Step 2: Run the stylesheet gate**

Run: `npm run check:fast -- tests/build/libraryComponentStyles.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add styles/asset-library.css
git commit -m "fix(library): lay the repair strip out in columns

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task A6: Regenerate the captures and record the measurements

**Files:**
- Modify: `scripts/asset-library-shots.mjs`, `docs/user-experience/asset-library-delivery/captures/*.png`, `captures/manifest.json`, `docs/user-experience/asset-library-delivery/delivery-record.md` (append one section)

- [ ] **Step 1: Add the two measurements to the capture script**

In `scripts/asset-library-shots.mjs`, after the `capture` function, add:

```js
async function measure() {
	return page.evaluate(() => {
		const edges = [...document.querySelectorAll('.rp-al-row__amount')].map((el) => el.getBoundingClientRect().right);
		const spread = edges.length ? Math.max(...edges) - Math.min(...edges) : null;
		const used = [...document.querySelectorAll('.rp-al-used__row')].map((el) => el.getBoundingClientRect().height);
		return { amountRightEdgeSpread: spread, usedInRowHeights: used };
	});
}
```

and in the `[1440, 720, 560, 460]` loop push `metrics: { ...metrics, ...(await measure()) }` — the simplest edit is to change `capture` to accept an optional third argument `extra = {}` merged into `metrics`, and call `capture(\`AL10-${width}-dark\`, '...', await measure())` in that loop.

- [ ] **Step 2: Run the captures**

Run: `node scripts/asset-library-shots.mjs`
If it exits with the pinned-Chromium error, run `npx playwright install chromium` and retry; if that is impossible, set `RP_CHROMIUM_EXECUTABLE` to a named Chrome and record in the manifest note that the browser is a substitute (the script prints it).
Expected: `Captured 16 Asset Library states`, no page errors, `amountRightEdgeSpread` at 1440 below 1px, and every 460 record with `scrollWidth === width`.

- [ ] **Step 3: Look at the pictures**

Open `captures/AL10-560-dark.png` and `AL10-720-dark.png` (Read tool). Confirm the heading row and the waste cell are both present at 720 and both absent at 460, and that at 560 they are either both present or both absent. If at 560 the heading row overflows the shelf, lower the merged threshold in Task A3's block to `35rem` and re-run this task's Step 2.

- [ ] **Step 4: Record the numbers**

Append to `delivery-record.md`:

```markdown
### Gap closure captures (2026-09-08)

Regenerated with `scripts/asset-library-shots.mjs` at `<commit>`; browser `<version, pinned or substitute>`.
Price column: amount right-edge spread `<n>px` at 1440 (was 22.3px, browse case step 2).
Used-in rows at 460: heights `<list>` (was 51.8px against 19.6px, step 12).
Repair strip: reason and action in grid columns (step 15). Headings and waste cell share the `<threshold>` threshold.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/asset-library-shots.mjs docs/user-experience/asset-library-delivery/captures docs/user-experience/asset-library-delivery/delivery-record.md
git commit -m "docs(library): regenerate the AL10 captures with layout measurements

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## WP-B Form

Owner files: `src/presentation/library/decimalInput.ts` (new), `definitionDraft.ts`, `useDefinitionDraft.ts`, `AssetInspectorFields.vue`, `libraryDraftGuard.ts`, `src/presentation/views/NewAssetForm.vue`, `newAssetDialog.ts`, `SimilarNameHint.vue` (new), `ViewRoot.vue` (the `openNewAssetDialog` call only), `AssetLibraryRoot.vue` (the `createAsset` function only — coordinate: WP-C edits the same file's template and search code; keep this edit to those lines and rebase if both land), the `form.new-asset.similar.*` and `view.asset-library.draft.*` rows in `en-assetLibrary.ts` / `de-assetLibrary.ts`, and the tests named per task.

### Task B1: `normalizeDecimalInput`

**Files:**
- Create: `src/presentation/library/decimalInput.ts`
- Test: `tests/presentation/library/decimalInput.test.ts`

**Interfaces:**
- Produces: `export function normalizeDecimalInput(raw: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeDecimalInput } from '../../../src/presentation/library/decimalInput';

describe('normalizeDecimalInput', () => {
	it.each([
		['4,50', '4.50'],
		[' 4,5 ', '4.5'],
		['12', '12'],
		[' 12.50 ', '12.50'],
		['', ''],
		['-0', '-0'],
	])('turns %j into %j', (raw, expected) => {
		expect(normalizeDecimalInput(raw)).toBe(expected);
	});
	it.each(['1,000.5', '1,2,3', '1.000,5'])('leaves %j for Decimal to refuse', (raw) => {
		expect(normalizeDecimalInput(raw)).toBe(raw);
	});
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm run check:fast -- tests/presentation/library/decimalInput.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
/**
 * One reading of a typed decimal for every numeric field the library owns (interaction rules
 * §5: "comma decimal separator accepted"). Trim, and when the text holds exactly one comma and
 * no dot, read the comma as the decimal separator. Anything else passes through trimmed, so
 * `1,000.5` and `1,2,3` still reach `Decimal` and are refused there as they were before —
 * this function decides nothing about validity, only about one glyph.
 */
export function normalizeDecimalInput(raw: string): string {
	const trimmed = raw.trim();
	const commas = trimmed.split(',').length - 1;
	if (commas === 1 && !trimmed.includes('.')) return trimmed.replace(',', '.');
	return trimmed;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm run check:fast -- tests/presentation/library/decimalInput.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/library/decimalInput.ts tests/presentation/library/decimalInput.test.ts
git commit -m "feat(library): read a comma as the decimal separator

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task B2: The definition draft parses through it and compares trimmed

**Files:**
- Modify: `src/presentation/library/definitionDraft.ts`
- Test: `tests/presentation/library/definitionDraft.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `definitionDraft.test.ts` (reuse its existing entry fixture; if it has none, build one with `anEntry` from `tests/helpers/assetLibraryRootHarness`):

```ts
	it('accepts a comma decimal in price, waste and height and submits dot decimals', () => {
		const baseline = anEntry();
		const draft = { ...definitionDraft(baseline), unitCost: '4,50', waste: '12,5', height: '190,5' };
		expect(validateDefinition(draft, baseline.currency)).toEqual({});
		const changes = definitionChanges(draft, baseline);
		expect(changes.unitCost?.amount.toString()).toBe('4.5');
		expect(changes.wasteFactorDefault?.toString()).toBe('0.125');
		expect(changes.height).toBe(190.5);
	});
	it('answers the same no-op diff for a unit cost that only differs by whitespace', () => {
		const baseline = anEntry({ unitCostAmount: '12.50' });
		const draft = { ...definitionDraft(baseline), unitCost: ' 12.50 ' };
		expect(definitionChanges(draft, baseline)).toEqual({});
	});
```

- [ ] **Step 2: Run and see them fail**

Run: `npm run check:fast -- tests/presentation/library/definitionDraft.test.ts`
Expected: FAIL: `4,50` is refused; whitespace reports a change.

- [ ] **Step 3: Route the three numeric fields through the normalizer**

In `definitionDraft.ts` add `import { normalizeDecimalInput } from './decimalInput';`. In `validateDefinition` replace both `draft[key].trim()` with `normalizeDecimalInput(draft[key])` and the `draft[key].trim() === ''` guard with `normalizeDecimalInput(draft[key]) === ''`. In `definitionChanges` replace the three numeric lines with:

```ts
	const unitCost = normalizeDecimalInput(draft.unitCost);
	const waste = normalizeDecimalInput(draft.waste);
	const height = normalizeDecimalInput(draft.height);
	if (unitCost !== before.unitCost) changes.unitCost = moneyOf(unitCost, baseline.currency);
	if (waste !== before.waste) changes.wasteFactorDefault = new Decimal(waste).div(100);
	if (height !== before.height) changes.height = height === '' ? null : Number(height);
```

Update the docblock above `definitionChanges`: it says "trimmed" three times; say "normalized through `normalizeDecimalInput`" instead, and delete the sentence claiming `unitCost` compares untrimmed if any.

- [ ] **Step 4: Run and see them pass**

Run: `npm run check:fast -- tests/presentation/library/definitionDraft.test.ts tests/presentation/library/assetInspectorFields.test.ts`
Expected: PASS, including the existing `it.each` rejection cases.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/library/definitionDraft.ts tests/presentation/library/definitionDraft.test.ts
git commit -m "fix(library): normalize numeric drafts once for validation and diff

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task B3: New asset price accepts a comma

**Files:**
- Modify: `src/presentation/views/NewAssetForm.vue` (`createAssetAndFootprint` only)
- Test: `tests/presentation/views/newAssetForm.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the file's main `describe`, using its existing mount helper and `createAsset` spy pattern (copy the shape of the nearest "submits" case):

```ts
	it('reads a comma decimal price and dispatches a dot decimal', async () => {
		const createAsset = vi.fn<CreateAsset>(() => Promise.resolve(ok(makeAsset())));
		const wrapper = mountForm({ createAsset });
		await wrapper.get('[data-field="name"]').setValue('Tile adhesive');
		await wrapper.get('[data-field="unitCostAmount"]').setValue('4,50');
		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(createAsset).toHaveBeenCalledTimes(1);
		expect(createAsset.mock.calls[0]?.[0].unitCostAmount).toBe('4.50');
	});
```

(`mountForm` is whatever the file's helper is named; if there is none, mount `NewAssetForm` with `props: { createAsset, setFootprintFromDimensions: () => Promise.resolve(ok('wrote')), logger: recorder(), defaultCurrency: 'EUR' }`.)

- [ ] **Step 2: Run and see it fail**

Run: `npm run check:fast -- tests/presentation/views/newAssetForm.test.ts`
Expected: FAIL, `createAsset` not called (money refused).

- [ ] **Step 3: Normalize before `createMoney`**

In `NewAssetForm.vue` add `import { normalizeDecimalInput } from '../library/decimalInput';`. In `createAssetAndFootprint` replace `const money = createMoney(values.unitCostAmount, values.currency);` with:

```ts
	const unitCostAmount = normalizeDecimalInput(values.unitCostAmount);
	const money = createMoney(unitCostAmount, values.currency);
```

and pass `unitCostAmount` (not `values.unitCostAmount`) to `props.createAsset`.

- [ ] **Step 4: Run and see it pass**

Run: `npm run check:fast -- tests/presentation/views/newAssetForm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/views/NewAssetForm.vue tests/presentation/views/newAssetForm.test.ts
git commit -m "fix(views): accept a comma decimal price when creating an asset

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task B4: An undeclared category or unit stays visible in the select

**Files:**
- Modify: `src/presentation/library/AssetInspectorFields.vue`
- Test: `tests/presentation/library/assetInspectorFields.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
	it('keeps an undeclared category visible and never submits it unchanged (D04)', async () => {
		const entry = { ...anEntry(), category: 'stone' as CatalogueEntryDto['category'] };
		const execute = vi.fn<Update>(() => Promise.resolve(ok(makeAsset({ id: entry.assetId }))));
		const { panel } = await mountInspector({ assetId: entry.assetId, entries: [entry], commands: { updateAsset: { execute } } });
		const select = panel.get('[data-field="category"]').element as HTMLSelectElement;
		expect(select.value).toBe('stone');
		expect([...select.options].map((o) => o.text)).toContain('stone');
		await panel.get('[data-field="supplier"]').setValue('Quarry');
		await panel.get('.rp-al-definition').trigger('submit'); await settle();
		expect(execute.mock.calls[0]?.[0].changes).toEqual({ supplier: 'Quarry' });
		panel.unmount();
	});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm run check:fast -- tests/presentation/library/assetInspectorFields.test.ts`
Expected: FAIL, `select.value` is `''`.

- [ ] **Step 3: Append the baseline's own value**

Replace `options` and `optionLabel` in `AssetInspectorFields.vue`:

```ts
/**
 * The declared vocabulary, plus the baseline's OWN value when it is outside it (D04: an
 * unknown category is shown, never coerced). Without that option a `<select>` bound to an
 * undeclared value renders EMPTY, and the first save of any other field would carry whatever
 * the browser picked. The option is labelled with the raw value because no locale key exists
 * for a word this build does not declare; the parser side of that PBI is separate.
 */
function options(key: keyof DefinitionDraft): readonly string[] {
	const declared: readonly string[] = key === 'category' ? ASSET_CATEGORIES : Object.keys(UNIT_KIND);
	const own = props.entry[key === 'category' ? 'category' : 'unit'];
	return declared.includes(own) ? declared : [own, ...declared];
}
function optionLabel(key: keyof DefinitionDraft, option: string): string {
	if (key === 'category') return (ASSET_CATEGORIES as readonly string[]).includes(option) ? tr(ASSET_CATEGORY_LABELS[option as AssetCategory]) : option;
	return option in UNIT_KIND ? tr(MEASUREMENT_UNIT_LABELS[option as MeasurementUnit]) : option;
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npm run check:fast -- tests/presentation/library/assetInspectorFields.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/library/AssetInspectorFields.vue tests/presentation/library/assetInspectorFields.test.ts
git commit -m "fix(library): show an undeclared category or unit as written

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task B5: Keep editing returns to the edited field

**Files:**
- Modify: `src/presentation/library/libraryDraftGuard.ts`, `useDefinitionDraft.ts`, `AssetInspectorFields.vue`
- Test: `tests/presentation/library/assetDraftProtection.test.ts`

**Interfaces:**
- Produces: the guard registration widens to `register({ discard, name, keep })` where `keep: () => void` refocuses the edited field, and `leave(action)` calls `keep()` after a non-confirm answer; `useDefinitionDraft` returns `lastEdited: Ref<keyof DefinitionDraft | null>`, `markEdited(key)` and `onKeep(handler)`.

- [ ] **Step 1: Write the failing test**

Append to `assetDraftProtection.test.ts`:

```ts
	it('returns focus to the field being edited after Keep editing', async () => {
		const a = anEntry(); const b = anEntry({ name: 'Paint' });
		const root = await mountRoot({ entries: [a, b], assetId: ref(a.assetId), attach: true });
		await root.get('[data-field="sku"]').setValue('draft-sku');
		await root.get(`[data-asset-id="${b.assetId}"]`).trigger('click'); await settle();
		useDialogStore().resolve('cancel'); await settle();
		expect((document.activeElement as HTMLElement | null)?.dataset['field']).toBe('sku');
		root.unmount();
	});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm run check:fast -- tests/presentation/library/assetDraftProtection.test.ts`
Expected: FAIL, active element is the row button (or body).

- [ ] **Step 3: Thread the keep callback**

`libraryDraftGuard.ts`: change the registration type to `{ discard: () => void; name: () => string; keep: () => void }` and `leave` to:

```ts
	async function leave(action: () => void | Promise<void>): Promise<void> {
		const dialogs = useDialogStore();
		if (busy.value || dialogs.current !== null) return;
		const pendingDraft = draft;
		if (dirty.value && pendingDraft !== null) {
			const answer = await dialogs.openDialog({ /* unchanged */ });
			if (answer !== 'confirm') {
				// AL05: "Keep editing returns to the triggering field." DialogHost has already
				// restored focus to the control that opened the dialog (the row); the form's own
				// refocus runs after it, on the next tick, and wins.
				await nextTick();
				pendingDraft.keep();
				return;
			}
			pendingDraft.discard();
		}
		await action();
	}
```

(Import `nextTick` from `vue`.)

`useDefinitionDraft.ts`: add `const lastEdited = ref<keyof DefinitionDraft | null>(null);`, a `function markEdited(key: keyof DefinitionDraft): void { lastEdited.value = key; }`, reset `lastEdited.value = null` inside `discard`, and change the registration to `guard.register({ discard, name: () => baseline.value.name, keep: () => keepHandler?.() })` with a settable `let keepHandler: (() => void) | null = null;` and `function onKeep(handler: () => void): void { keepHandler = handler; }`. Return `lastEdited`, `markEdited` and `onKeep` from the composable.

`AssetInspectorFields.vue`: add `const formEl = ref<HTMLFormElement | null>(null);` with `ref="formEl"` on the `<form>`, `@input="form.markEdited(key)"` on both the `<select>` and the `<input>` (on the select use `@change`), and:

```ts
form.onKeep(() => {
	const key = form.lastEdited.value ?? fields[0];
	formEl.value?.querySelector<HTMLElement>(`[data-field="${key}"]`)?.focus();
});
```

- [ ] **Step 4: Run and see it pass**

Run: `npm run check:fast -- tests/presentation/library/assetDraftProtection.test.ts tests/presentation/library/assetInspectorFields.test.ts tests/presentation/library/assetLibraryKeyboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/library/libraryDraftGuard.ts src/presentation/library/useDefinitionDraft.ts src/presentation/library/AssetInspectorFields.vue tests/presentation/library/assetDraftProtection.test.ts
git commit -m "fix(library): return focus to the edited field after Keep editing

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task B6: Similar-name hint on create

**Files:**
- Create: `src/presentation/views/SimilarNameHint.vue`
- Modify: `src/presentation/views/newAssetDialog.ts`, `NewAssetForm.vue`, `ViewRoot.vue` (`onCreateAsset`), `src/presentation/library/AssetLibraryRoot.vue` (`createAsset` only), `en-assetLibrary.ts`, `de-assetLibrary.ts`
- Test: `tests/presentation/views/newAssetForm.test.ts`, `tests/presentation/library/assetLibraryRootDoors.test.ts`, `tests/presentation/views/viewRootCreateAsset.test.ts`

**Interfaces:**
- Produces in `newAssetDialog.ts`:
  ```ts
  export interface ExistingAsset { readonly assetId: AssetId; readonly name: string }
  export type NewAssetOutcome = { readonly assetId: AssetId; readonly created: boolean } | null;
  export interface NewAssetDialogDeps { …existing…; readonly findExisting?: (name: string) => ExistingAsset | null }
  export async function openNewAssetDialog(deps): Promise<NewAssetOutcome>
  ```
- `NewAssetForm` prop `findExisting?: (name: string) => ExistingAsset | null`; emits `submit: [outcome: { assetId: AssetId; created: boolean }]`.
- Locale keys: `form.new-asset.similar.exists` = `An asset named “{name}” already exists.`, `form.new-asset.similar.show` = `Show it`. German: `Ein Objekt namens „{name}“ gibt es bereits.`, `Anzeigen`.

- [ ] **Step 1: Write the failing form tests**

```ts
	it('hints at an existing asset with the same name and offers to show it instead', async () => {
		const existing = { assetId: makeAsset().id, name: 'Oak plank floor' };
		const createAsset = vi.fn<CreateAsset>(() => Promise.resolve(ok(makeAsset())));
		const wrapper = mountForm({ createAsset, findExisting: (name) => (name.trim().toLowerCase() === 'oak plank floor' ? existing : null) });
		expect(wrapper.find('.rp-similar-name').exists()).toBe(false);
		await wrapper.get('[data-field="name"]').setValue('  oak PLANK floor ');
		expect(wrapper.get('.rp-similar-name').text()).toContain('“Oak plank floor” already exists');
		await wrapper.get('.rp-similar-name button').trigger('click');
		expect(wrapper.emitted('submit')?.[0]).toEqual([{ assetId: existing.assetId, created: false }]);
		expect(createAsset).not.toHaveBeenCalled();
	});
	it('emits created: true after a real creation', async () => {
		const asset = makeAsset();
		const wrapper = mountForm({ createAsset: () => Promise.resolve(ok(asset)) });
		await wrapper.get('[data-field="name"]').setValue('Tile adhesive');
		await wrapper.get('[data-field="unitCostAmount"]').setValue('4.50');
		await wrapper.get('form').trigger('submit'); await flushPromises();
		expect(wrapper.emitted('submit')?.[0]).toEqual([{ assetId: asset.id, created: true }]);
	});
```

Also update every existing assertion in this file of the form `emitted('submit')?.[0]).toEqual([ASSET.id])` to `[{ assetId: ASSET.id, created: true }]`.

- [ ] **Step 2: Run and see them fail**

Run: `npm run check:fast -- tests/presentation/views/newAssetForm.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the keys, the hint component and the prop**

`en-assetLibrary.ts` (append before the closing `}`):

```ts
	'form.new-asset.similar.exists': 'An asset named “{name}” already exists.',
	'form.new-asset.similar.show': 'Show it',
```

`de-assetLibrary.ts`:

```ts
	'form.new-asset.similar.exists': 'Ein Objekt namens „{name}“ gibt es bereits.',
	'form.new-asset.similar.show': 'Anzeigen',
```

`SimilarNameHint.vue`:

```vue
<script setup lang="ts">
/**
 * AL03: "A similar name is a hint linking to existing results, not an automatic merge." One
 * sentence and one door; the match itself is the CALLER's (`findExisting`), so this draws
 * whatever it was handed and decides nothing. `role="status"` because it appears while the
 * user types and must be announced without stealing focus.
 */
import type { AssetId } from '../../domain/asset/AssetId';
import { tr } from '../i18n/strings';

defineProps<{ existing: { readonly assetId: AssetId; readonly name: string } }>();
const emit = defineEmits<{ show: [assetId: AssetId] }>();
</script>

<template>
	<p
		class="rp-similar-name"
		role="status"
	>
		{{ tr('form.new-asset.similar.exists', { name: existing.name }) }}
		<button
			type="button"
			@click="emit('show', existing.assetId)"
		>
			{{ tr('form.new-asset.similar.show') }}
		</button>
	</p>
</template>
```

`NewAssetForm.vue`: add the prop `findExisting?: (name: string) => { readonly assetId: AssetId; readonly name: string } | null;`, change the emit to `submit: [outcome: { readonly assetId: AssetId; readonly created: boolean }]`, add:

```ts
const similar = computed(() => props.findExisting?.(form.values.value.name) ?? null);
function showExisting(assetId: AssetId): void {
	emit('submit', { assetId, created: false });
}
```

In `onSubmit` emit `{ assetId: createdAssetId.value as AssetId, created: true }`. In the template, directly after the name `FieldError` block:

```html
		<SimilarNameHint
			v-if="similar !== null && !catalogueFrozen"
			:existing="similar"
			@show="showExisting"
		/>
```

Add a `.rp-similar-name` rule to the partial that already styles `.rp-new-asset__created` (find it with `grep -rn "rp-new-asset__created" styles/`): `margin: var(--size-2-1) 0 0; color: var(--text-muted); font-size: var(--font-ui-smaller);` and `.rp-similar-name button { margin-inline-start: var(--size-4-1); }`.

- [ ] **Step 4: Run and see the form tests pass**

Run: `npm run check:fast -- tests/presentation/views/newAssetForm.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing caller tests**

`assetLibraryRootDoors.test.ts`, inside the `describe` that has "hands the form the composed commands":

```ts
	it('selects the existing asset the form pointed at without creating or re-reading', async () => {
		const existing = anEntry({ name: 'Oak plank floor' });
		const listCatalogue = vi.fn(() => Promise.resolve(ok({ entries: [existing], unreadable: [] })));
		const root = await mountRoot({ entries: [existing], queries: { ...fakeQueries([existing], []), listCatalogue } });
		const reads = listCatalogue.mock.calls.length;
		await root.get('.rp-al-create').trigger('click'); await settle();
		await root.get('[data-field="name"]').setValue('oak plank floor');
		await root.get('.rp-similar-name button').trigger('click'); await settle();
		expect(root.attributes('data-selected-asset-id')).toBe(existing.assetId);
		expect(listCatalogue.mock.calls.length).toBe(reads);
		root.unmount();
	});
```

(`fakeQueries` is exported from the root harness; if its name differs, use the file's own query-factory.)

`viewRootCreateAsset.test.ts`: in the case that asserts `openAsset` was called after creation, nothing changes in behaviour; add one case that resolves the dialog through the hint and expects `openAsset` called with the existing id. If mounting the real form is awkward there, assert instead that `openNewAssetDialog` returning `{ assetId, created: false }` leads to `openAsset(assetId)` by resolving the dialog store with `{ action: 'submit', values: { assetId: 'existing', created: false } }` after clicking the create control.

- [ ] **Step 6: Run and see them fail**

Run: `npm run check:fast -- tests/presentation/library/assetLibraryRootDoors.test.ts tests/presentation/views/viewRootCreateAsset.test.ts`
Expected: FAIL (type error on `createdId === null` shape or no `.rp-similar-name`).

- [ ] **Step 7: Widen the dialog outcome and adapt both callers**

`newAssetDialog.ts`: add the two exported types from the Interfaces block, the optional `findExisting` dep passed into `props`, and end with:

```ts
	if (result === 'cancel') return null;
	return result.values as NewAssetOutcome;
```

`AssetLibraryRoot.vue` `createAsset`:

```ts
async function createAsset(): Promise<void> {
	if (dialogs.current !== null) return;
	const outcome = await openNewAssetDialog({
		dialogs, busy: newAssetBusy, commands: context.commands, logger: context.logger,
		findExisting: (name) => {
			const wanted = name.trim().toLowerCase();
			if (wanted === '') return null;
			const hit = store.entries.find((entry) => entry.name.trim().toLowerCase() === wanted);
			return hit === undefined ? null : { assetId: hit.assetId, name: hit.name };
		},
	});
	if (outcome === null) return;
	if (outcome.created) {
		await hydrate();
		const created = store.entryFor(outcome.assetId);
		if (created !== null) {
			store.query = '';
			expandedCategories.value = new Set([...expandedCategories.value, created.category]);
		}
	}
	performSelect(outcome.assetId);
}
```

(If `store.entries` is not the store's full list, use whatever member `entryFor` reads.)

`ViewRoot.vue`: `const outcome = await openNewAssetDialog({...}); if (outcome === null) return; await context.openAsset(outcome.assetId);`

- [ ] **Step 8: Run and see everything pass**

Run: `npm run check:fast -- tests/presentation/library tests/presentation/views`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/presentation/views/SimilarNameHint.vue src/presentation/views/newAssetDialog.ts src/presentation/views/NewAssetForm.vue src/presentation/views/ViewRoot.vue src/presentation/library/AssetLibraryRoot.vue src/presentation/i18n/locales/en-assetLibrary.ts src/presentation/i18n/locales/de-assetLibrary.ts styles tests/presentation/views tests/presentation/library/assetLibraryRootDoors.test.ts
git commit -m "feat(views): hint at an existing asset with the same name

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## WP-C List and navigation

Owner files: `src/presentation/library/AssetLibraryRoot.vue` (template and search/back code; NOT `createAsset`), `AssetLibraryBody.vue`, `styles/asset-library.css` (the `.rp-al-search*` rules only — coordinate with WP-A, which edits the repair-strip rules in the same file; keep edits to that block), the four label rows in `en-assetLibrary.ts` / `de-assetLibrary.ts`, `tests/presentation/library/assetLibraryKeyboard.test.ts`, `assetLibraryRoot.test.ts`, spec files named in C4.

### Task C1: Clear-search control on the field

**Files:**
- Modify: `src/presentation/library/AssetLibraryRoot.vue`, `styles/asset-library.css`
- Test: `tests/presentation/library/assetLibraryKeyboard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
	it('offers a clear control while the search holds text and returns focus to the field', async () => {
		const root = await mountLibrary();
		expect(root.find('.rp-al-search__clear').exists()).toBe(false);
		await root.get('.rp-al-search__input').setValue('alder');
		const clear = root.get('.rp-al-search__clear');
		expect(clear.attributes('aria-label')).toBe('Clear search');
		await clear.trigger('click'); await settle();
		expect((root.get('.rp-al-search__input').element as HTMLInputElement).value).toBe('');
		expect(active()?.classList.contains('rp-al-search__input')).toBe(true);
		expect(root.find('.rp-al-search__clear').exists()).toBe(false);
	});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm run check:fast -- tests/presentation/library/assetLibraryKeyboard.test.ts`
Expected: FAIL, no `.rp-al-search__clear`.

- [ ] **Step 3: Add the button**

`AssetLibraryRoot.vue` template, inside `<label class="rp-al-search">` after the `<input>`:

```html
					<button
						v-if="store.query !== ''"
						type="button"
						class="rp-al-search__clear"
						:aria-label="tr('empty.asset-library.no-matches.action')"
						@click.prevent="clearSearchField"
					>
						×
					</button>
```

Script:

```ts
/** AL02's "accessible clear action" on the field itself; the no-matches empty state keeps its own. */
function clearSearchField(): void {
	store.query = '';
	searchEl.value?.focus();
}
```

`styles/asset-library.css`, after `.rp-al-search__input { width: 100%; }`:

```css
/* The clear control sits over the field's trailing edge; the `×` is decorative, the accessible
   name is the aria-label. Obsidian's global `:focus { outline: none }` reaches it too. */
.rp-al-search { position: relative; }
.rp-al-search__clear {
	position: absolute;
	inset-inline-end: var(--size-2-2);
	top: 50%;
	transform: translateY(-50%);
	padding: 0 var(--size-2-2);
	background: none;
	border: none;
	box-shadow: none;
	color: var(--text-muted);
	cursor: pointer;
}
.rp-al-search__clear:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px; }
```

The `×` literal is decorative content, not a `.setText` call, so `I18N_LITERAL_BAN` does not reach it; keep the `aria-label` as the only name.

- [ ] **Step 4: Run and see it pass**

Run: `npm run check:fast -- tests/presentation/library/assetLibraryKeyboard.test.ts tests/harness/accessibilityAssetLibrary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/library/AssetLibraryRoot.vue styles/asset-library.css tests/presentation/library/assetLibraryKeyboard.test.ts
git commit -m "feat(library): clear the search from the field itself

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task C2: Back restores the shelves' scroll position

**Files:**
- Modify: `src/presentation/library/AssetLibraryBody.vue`, `AssetLibraryRoot.vue`
- Test: `tests/presentation/library/assetLibraryKeyboard.test.ts`

**Interfaces:**
- `AssetLibraryBody` exposes `shelvesEl: Ref<HTMLElement | null>` through `defineExpose`; `AssetShelves` needs no change because `AssetLibraryBody` can query `.rp-al-shelves` within its own root element.

- [ ] **Step 1: Write the failing test**

```ts
	it('restores the shelves scroll position on Back at a narrow width (AL10)', async () => {
		narrow();
		const root = await mountLibrary();
		const shelves = root.get('.rp-al-shelves').element;
		shelves.scrollTop = 120;
		await root.get(`[data-asset-id="${ALDER.assetId}"]`).trigger('click'); await settle();
		shelves.scrollTop = 0;
		await root.get('.rp-al-inspector__back').trigger('click'); await settle();
		expect(root.get('.rp-al-shelves').element.scrollTop).toBe(120);
	});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm run check:fast -- tests/presentation/library/assetLibraryKeyboard.test.ts`
Expected: FAIL, `0`.

- [ ] **Step 3: Save and restore**

`AssetLibraryBody.vue`: add `const bodyEl = ref<HTMLElement | null>(null);` with `ref="bodyEl"` on its root `<div class="rp-al-body">` (or whatever its root is), and

```ts
function shelvesElement(): HTMLElement | null {
	return bodyEl.value?.querySelector<HTMLElement>('.rp-al-shelves') ?? null;
}
defineExpose({ shelvesElement });
```

`AssetLibraryRoot.vue`: add `const bodyRef = ref<InstanceType<typeof AssetLibraryBody> | null>(null);` with `ref="bodyRef"` on `<AssetLibraryBody>`, `let savedScrollTop = 0;`, and:

```ts
/**
 * AL10: "Back restores the list with the same search, groups, and scroll position." Below
 * 35rem `.rp-al-body` is `display: none` while the inspector owns the pane, and a hidden
 * element's scroll offset is lost, so it is read before the swap and written back after it.
 */
watch(showingSelection, async (showing) => {
	const shelves = bodyRef.value?.shelvesElement() ?? null;
	if (shelves === null) return;
	if (showing) { savedScrollTop = shelves.scrollTop; return; }
	await nextTick();
	shelves.scrollTop = savedScrollTop;
}, { flush: 'sync' });
```

`flush: 'sync'` so the read happens BEFORE the DOM hides the body.

- [ ] **Step 4: Run and see it pass**

Run: `npm run check:fast -- tests/presentation/library/assetLibraryKeyboard.test.ts tests/presentation/library/assetDraftProtection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/library/AssetLibraryBody.vue src/presentation/library/AssetLibraryRoot.vue tests/presentation/library/assetLibraryKeyboard.test.ts
git commit -m "fix(library): restore the shelves scroll position on Back

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task C3: The four labels

**Files:**
- Modify: `src/presentation/i18n/locales/en-assetLibrary.ts`, `de-assetLibrary.ts`
- Test: `tests/presentation/library/assetLibraryRoot.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
	it('uses the specification wording for the neutral state and the empty-state action', async () => {
		const root = await mountRoot({ entries: [] });
		expect(root.text()).toContain('Create first asset');
		root.unmount();
		const selected = await mountRoot({ entries: [anEntry()] });
		expect(selected.text()).toContain('Select an asset to view its definition.');
		selected.unmount();
	});
```

- [ ] **Step 2: Run and see it fail**

Run: `npm run check:fast -- tests/presentation/library/assetLibraryRoot.test.ts`
Expected: FAIL.

- [ ] **Step 3: Change the values**

`en-assetLibrary.ts`:
- `'view.asset-library.unselected': 'Select an asset to view its definition.',`
- `'view.asset-library.used-in.overridden': 'Project-specific price',`
- `'view.asset-library.open-designer': 'Edit shape',`
- `'empty.asset-library.no-assets.action': 'Create first asset',`

`de-assetLibrary.ts`:
- `'view.asset-library.unselected': 'Wähle ein Objekt, um seine Definition zu sehen.',`
- `'view.asset-library.used-in.overridden': 'Projektspezifischer Preis',`
- `'view.asset-library.open-designer': 'Form bearbeiten',`
- `'empty.asset-library.no-assets.action': 'Erstes Objekt anlegen',`

Then grep the tests for the OLD English strings and update the assertions: `grep -rn "Nothing selected\|Overrides this price\|Open designer\|'New asset'" tests/ | grep -v "new-asset'"`. Leave `view.asset-library.new-asset` ("New asset", the toolbar button) alone.

- [ ] **Step 4: Run and see it pass**

Run: `npm run check:fast -- tests/presentation/library tests/build/localeModuleSentenceCase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/i18n/locales/en-assetLibrary.ts src/presentation/i18n/locales/de-assetLibrary.ts tests
git commit -m "fix(library): adopt the specification's wording for four labels

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task C4: Settle the chevron in the specification

**Files:**
- Modify: `docs/user-experience/asset-library-delivery/specification/interaction-rules.md` (§7 table) and any screen file spelling `‹ Back to library`

- [ ] **Step 1: Find and correct**

Run `grep -rn "‹" docs/user-experience/asset-library-delivery/specification/` and replace each `‹ Back to library` with `Back to library`, adding one sentence at the end of §7: "The control's label is the words alone; an earlier draft wrote a chevron in one table and not in §6.2, and the code follows §6.2."

- [ ] **Step 2: Commit**

```bash
git add docs/user-experience/asset-library-delivery/specification
git commit -m "docs(spec): spell Back to library one way

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## WP-D Records (after A, B and C have merged into the branch)

### Task D1: Tick EN-01 and EN-02 against evidence

**Files:**
- Modify: `docs/user-experience/asset-library-delivery/enablers/EN-01.md`, `EN-02.md`

- [ ] **Step 1: Tick each box with a pointer**

For each `- [ ]` line, change to `- [x]` and append ` — discharged: <delivery-record section or test file>`. Mapping: EN-01 rows 1–3 and 5–8 → `delivery-record.md` "Inspected baseline", "EN-01: baseline delta and evidence map", "Decisions D01–D14"; EN-01 row 4 (field mapping) → "Data ownership and field/command matrix". EN-02 rows → "EN-02: commit and conflict decision" and `tests/application/commands/asset/assetDefinitionCommit.test.ts`, `tests/presentation/library/assetInspectorFields.test.ts`. The EN-02 undo row → "D11 omits unsupported Undo". A row with no matching evidence stays `- [ ]` with ` — not discharged: <why>`.

- [ ] **Step 2: Commit**

```bash
git add docs/user-experience/asset-library-delivery/enablers
git commit -m "docs(library): tick the two enablers against the delivery record

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task D2: PBI statuses

**Files:**
- Modify: the fifteen PBI notes under `docs/requirements/` linked from `docs/user-experience/asset-library-delivery/README.md` whose delivery-record row is "Fulfilled" or "Adaptation" (PBI-01 through PBI-17 except none are excluded there; PBI-18's note and the two `New` notes stay untouched).

- [ ] **Step 1: Update frontmatter**

For each: `status: Done`, `finished: "2026-09-08"`. Append under the note's body a line: `Closed 2026-09-08 against the delivery record's evidence row and the gap-closure design (docs/superpowers/specs/2026-09-08-asset-library-gap-closure-design.md).`

- [ ] **Step 2: Run the docs-touching tests**

Run: `npm run check:fast -- tests/build`
Expected: PASS (no build test reads PBI frontmatter today; this confirms nothing new does).

- [ ] **Step 3: Commit**

```bash
git add docs/requirements
git commit -m "docs(backlog): mark the delivered asset-library PBIs done

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task D3: Decision register and adoption review

**Files:**
- Modify: `docs/user-experience/asset-library-delivery/specification/decision-register.md`, `docs/reviews/2026-09-05-design-package-adoption.md`

- [ ] **Step 1: Add a "Resolved by" column**

Extend the D01–D14 table with a final column `Resolved by`, one cell each citing `delivery-record.md` "Decisions D01–D14" (D01, D02, D05–D13), "EN-02" (D03), Task B4 of this plan (D04), and "D14 leaves damaged-sidecar repair to a separate dependency" (D14). Rewrite the "Outstanding visual verification" paragraph: "Captures exist for AL03–AL11 under `../captures/` (see `manifest.json`); real-vault acceptance remains open."

- [ ] **Step 2: Amend the adoption review**

Append a section `## Amendment 1 (2026-09-08)`: "Rows PBI-05, PBI-06, PBI-14 and EN-02 above describe the tree at adoption time. PR #70 shipped `useDefinitionDraft` (one explicit Save/Discard over one `UpdateAsset` write), so PBI-05 is Met, PBI-06 and PBI-14 are Met with it, and EN-02 is discharged; the rows are left as written and this amendment is the correction." Change the issue link's status in `docs/issues/A field edit commits on blur, and two design packages ask for an explicit Apply.md` to `status: Done`, `finished: "2026-09-08"` with one line naming `useDefinitionDraft.ts`.

- [ ] **Step 3: Commit**

```bash
git add docs/user-experience/asset-library-delivery/specification/decision-register.md docs/reviews/2026-09-05-design-package-adoption.md docs/issues
git commit -m "docs(library): close the decision register and amend the adoption review

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task D4: Browse case, issue note, delivery record and README

**Files:**
- Modify: `docs/tests/cases/Browse the asset library.md`, `docs/issues/The unit-cost draft comparison is untrimmed while its parse and its siblings trim.md`, `docs/user-experience/asset-library-delivery/delivery-record.md`, `README.md` (package), `CHANGELOG.md`

- [ ] **Step 1: Rewrite the five browse-case rows**

Steps 2, 4, 12, 15, 18: replace "Known to FAIL as shipped" / "Partially FAILS" / the chevron reasoning with the new expectation and a "was:" clause holding the old measurement, citing the Task (A2, A1, A4, A5, C4) and the capture measurement from A6. The Runs table stays "Not yet run in a vault."

- [ ] **Step 2: Close the issue note**

`status: Done`, `finished: "2026-09-08"`, and one line: "Closed by `normalizeDecimalInput` in `definitionDraft.ts`; `definitionDraft.test.ts` 'answers the same no-op diff for a unit cost that only differs by whitespace'."

- [ ] **Step 3: Delivery record and README**

Append to `delivery-record.md` a section `### Gap closure (2026-09-08)` listing items 1–14 of the design in one line each with their task ids. In the package `README.md` change "Status: implementation in review" to "Status: delivered; real-vault acceptance open" and the paragraph "final real-vault acceptance remains open" to name this design.

- [ ] **Step 4: CHANGELOG**

Under `## [Unreleased]` add:

```markdown
### Fixed
- Asset library: price column aligns on the decimal point and prints unit symbols; column headings leave with their cells and are announced; used-in rows wrap; the repair strip lays out in columns.
- Asset library: comma decimals accepted in price, waste and height; an undeclared category or unit stays visible; Keep editing returns focus to the edited field; Back restores the shelves' scroll position.

### Added
- Asset library: a clear control on the search field; a hint when a new asset's name matches an existing one.
```

- [ ] **Step 5: Commit**

```bash
git add docs CHANGELOG.md
git commit -m "docs(library): record the gap closure in the case, the issue and the changelog

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task D5: The gate

- [ ] **Step 1: Run the full gate once**

Run: `npm run check`
Expected: build, lint, coverage-thresholded tests and fallow all green. If `tests/build/` reports a `beforeAll` timeout, re-run `npx vitest run --project=build-lint --no-file-parallelism` before believing it.

- [ ] **Step 2: Read coverage for the changed files**

Run: `node -e "const c=require('./coverage/coverage-final.json');for(const f of Object.keys(c).filter(k=>/library\/(decimalInput|definitionDraft|useDefinitionDraft|libraryDraftGuard|AssetLibraryRoot|AssetLibraryBody|AssetInspectorFields)|views\/(SimilarNameHint|newAssetDialog|NewAssetForm)/.test(k))){const b=c[f].b;const miss=Object.entries(b).filter(([,v])=>v.some(x=>x===0));console.log(f.split(/[\\\\/]/).pop(),'uncovered branches:',miss.length)}"`
Expected: every file reports `0`; an uncovered arm gets a test before the push.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin codex/asset-library-gap-closure
gh pr create --title "Close the asset library specification gaps" --body-file docs/superpowers/specs/2026-09-08-asset-library-gap-closure-design.md
```

Append to the PR body the gate's four outcomes verbatim and the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

# Minimal photo entry and bounded vault search

Status: implemented with scoped verification. Integrated/native acceptance remains pending. This concern is separate from opening
geometry, grouping and the reference-scale viewport.

Add photo shows an image path/search, image import, optional caption, a native Details
disclosure and Add photo. Target, Work, type, date, phase, linked record, pin coordinates
and file policy remain under Details. Existing contextual defaults and edited values stay
in the same local planning draft. Changing evidence type retains the native type control's
focus across disclosure/layout changes.

An omitted photo caption uses the resolved image filename to satisfy the existing evidence
description contract. It adds no persisted field or schema version. Photo submission requires
an image from the existing resolver; the image picker refuses non-image imports before copying.
Add waits for an ongoing file import while the caption remains editable. Cancelling still
retains an already imported ordinary vault file; no new rollback/deletion policy is introduced.

`EvidenceFiles.list(options)` now accepts query, image-only filtering and a result limit.
The provider stops after enough matches and sorts only the bounded result, default 20/max 50.
The UI renders at most 20 suggestions, debounces query changes for 150 ms and caches results across
unrelated form renders. Queries may scan the vault until enough matches are found; this is
not a new persistent search index or a claimed sublinear search algorithm.

Verification:

- Scoped ESLint, scoped Oxlint and TypeScript passed. A test double was completed to satisfy
  the full EvidenceFiles contract; new test doubles follow the repository's mock/Promise rules.
- Eight search/planning/evidence/recovery files passed **63/63** cases.
- The final stylesheet/button/photo batch passed **298/298** cases: 292 stylesheet/button cases
  and six repeated photo/search cases after the test-only lint cleanup.
- The large-vault service case inspects only 20 matching paths for a 20-result request, caps an
  oversized request at 50, and still finds matching images beyond the initial results. The UI
  case caps a 2001-path legacy provider at 20 DOM options and combines two rapid query changes
  into one debounced search without relisting on unrelated renders.
- `git diff --check` passed.

Whole-tree Oxlint also identified the inherited openingSwingPersistence non-null assertion;
that separate foundation finding is already fixed by the opening continuation 618531b8 and
must be included in parent integration. No threshold or exclusion was changed here.
Integrated/native visual and actual-vault latency acceptance remains with the parent; these
checks establish bounded work/DOM and behavior rather than claiming a wall-clock speedup.

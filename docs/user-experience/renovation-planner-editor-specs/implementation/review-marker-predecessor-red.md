# M17 marker predecessor failure

Full CI [34147564049](https://github.com/Luis85/renovation-planner/actions/runs/34147564049)
tested head `bdca2910` before the private Requirement cleanup or UI Review correction.
All four Linux/Windows legs report the same two failures in
`reviewMarkerNavigation.test.ts`: native marker Click and Tap produce `renovate`
where the M17 contract requires `review`. No assertion or discovery setting was relaxed.

Linux24: 654 test files passed, one failed; 8093 tests passed, two failed, 69 skipped.
The failures occur at the perspective assertion after interacting with an existing
native Konva marker, not at a missing test selector or fixture setup. The three explicit
Work/Decision issue-button cases and planned-removal marker case pass.

Artifact `10028408368` uses tested merge
`4faebd96fab6874d7cf614fc9a45750072687f37`. Its overall tree differs from the head only in
Root's `RESUME.md` and `coverage-coordination.md` registration edits. Verified identical
subtrees:

- Source: `ccb153b2164835b01c9d0937ffa95feb8e103d72`.
- Tests: `fbd5d5066f87c93a5492ce14ff5aa3c931241a25`.

Original JSON, LCOV and Linux24 log are preserved at
`C:/Users/lum/AppData/Local/Temp/rp-coverage-finalization-ci-bdca2910-linux24/`.
Coverage JSON SHA256: `6e3c032ec8a3c4e6db10740bad2559d5b5a7241374c191cdef76888e028a148e`.

The complete counter comparison against `2c3c6360` has identical production and all
counter maps: exactly two branch and one statement gains, no losses. This confirms the
public command package's scoped result in a full run. Branches are 12408/12692; the
unchanged 98% threshold still fails. These are historical full counters with known
M17 test failures, not final acceptance and not current coverage after Requirement/UI changes.

UI owns the production fix. The following test revision uses its confirmed Review
Room marker/summary/issue selectors and still requires Review retention. Its future
pass must be tied to the joined source and new full evidence.

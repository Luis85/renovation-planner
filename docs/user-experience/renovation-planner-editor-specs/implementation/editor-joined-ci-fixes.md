# Joined editor CI presentation regressions

Root's full joined Linux 24 run `34150756164`, job `101832368840`, found nine unchanged warning
assertions failing across `backgroundInEditor`, `planEditorFailure` and `unreadableZonesNotice`:
the nested severity/message spans produced text such as `WarningThe…` or `Error3…`. The visual
spacing did not create a DOM text separator. An explicit Vue space now preserves the original
message contract without changing the text, live region, action or assertion.

The unchanged `buttonFocusRing.test.ts` also flagged the new editor flattening selectors. Their
focus rules now match the explicit subject/work reset selectors, including `:not(.rp-record-title)`,
and the full Review-finding container selector. The existing title focus rule remains. No test,
CSS matcher, asset-shelf rule or quality limit was altered; Root separately owns the audit of
unchanged asset-shelf reports if they remain.

Source/diff review only at this checkpoint. The three native warning suites and unchanged focus
gate, then the connected browser/recovery paths, must be run before claiming these fixes verified.

## Verified follow-up at ecbf7e27

The final severity expression contains exactly one trailing space. All 32 tests in the three
unchanged warning suites passed in 15.79 seconds. The unchanged focus test now reports only
two pre-existing asset-shelf selectors; no editor selector remains, and Root owns that separate
audit. The earlier seven-file run's three Review-neighbor files passed with the extracted Room
detail component. Current types, whole Oxlint and scoped lint passed.

The selected Room block moved to ReviewRoomDetails with identical DOM, selectors and focus
handling. Fallow reports zero functions above the unchanged limits (cognitive 15, cyclomatic
20, CRAP 32). It used the original 571 coverage JSON and official coverage-root mapping; moved
and new functions do not have current full coverage proved by that older file. This is not a
claim of a current full gate. Logs, the raw health report and hashes are in
`evidence/editor-joined-ci-fixes`. The extended browser/final matrix remains next.

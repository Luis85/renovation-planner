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

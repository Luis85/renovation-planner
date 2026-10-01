# Copy-paste prompt — integrated QA

Validate the asset-designer integration branch using ACCEPTANCE-AND-QA.md and AD15/AD16. Record the exact commit, package/runtime versions, browser/Obsidian availability, theme and fixture. Execute available test layers and mark unavailable ones not run.

Exercise the full library → create → design → group/align → save/reopen → place → edit/duplicate journey, not just direct component routes. Use the real current preset list or measurements; do not assume the mockup's vanity preset exists.

Prioritize data-loss and false-confidence failures: legacy migrations, future schema refusal, unscaled measurements, arc stretching, clearance review, write/read-back races, cross-leaf edits, undo after external changes, multi-resource partial creation and frozen/issued asset state. Assert canonical state and geometry in addition to screenshots.

Test light/dark themes, compact leaves, keyboard alternatives and focus boundaries with the Obsidian note editor. Measure performance only under recorded conditions. Distinguish browser harness behavior from real Obsidian lifecycle/navigation.

Report pass/fail/not-run by scenario and test layer, provide reproducible defects, and state whether any release-blocking verification is missing. Do not infer product readiness from green unit tests or visual similarity to a generated board.

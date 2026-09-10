# Partial audit of combined source a79baa83

The unchanged `node scripts/editor-visual-final-check.mjs` ran against committed source
`a79baa83e8e31d4c97d5b074221b31cbdafd235d`, using the explicitly selected local Edge
binary. The first four journeys passed their four scenarios. The fifth, overview,
failed its visible-Inspector assertion: Continue renovation ended at y=981.77 while
its Inspector ended at y=964. The runner exited 1. The remaining four journeys and
18-screen comparison generation did not run in this attempt.

The attached report files and log preserve this partial result. `light-existing.png`
shows the crowded pre-fix detail hierarchy inspected for the next concern branch.
It is audit evidence, not a final accepted screen. Reference comparisons and native
acceptance remain separate obligations. No assertion or tolerance was relaxed.

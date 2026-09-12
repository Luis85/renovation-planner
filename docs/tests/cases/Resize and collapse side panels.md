# Resize and collapse side panels

Contract: [2026-09-12 side panels design](../../superpowers/specs/2026-09-12-plan-editor-side-panels-design.md).

## Reproduce

Run `npm run test-build`, reload Obsidian in this repository's vault and enable the plugin. Open a
plan in the Plan editor in a tab at least 1200px wide.

1. Drag the Inspector's left edge toward the canvas. The line turns accent-coloured, the panel
   follows the pointer, and it stops at its maximum or where the canvas would drop below 320px.
2. Double-click the same edge. The Inspector returns to its default width.
3. Tab to a panel edge, press Arrow keys and Shift+Arrow keys. The edge moves 16px and 64px.
4. Press Enter on the edge. The panel collapses to a narrow strip and focus lands on its expand
   button.
5. On the left strip, click the Walls and openings icon. The panel expands with that section open.
6. Collapse the left panel, quit and restart Obsidian, reopen the plan. The left panel is still
   collapsed and the Inspector keeps the width from step 2.
7. Split the tab so two Plan editors sit side by side under 900px each. Both show the narrow rail;
   widen one past 900px and its panels come back as step 6 left them.
8. Open a second plan in a new tab. It opens with the same layout.

## Runs

| Date | Build | Result | Notes |
|---|---|---|---|
| — | — | Not run | Written with the implementation; nothing here has been walked in a vault. |

# Reorder plans in the Property tree

Contract: [ADR-0029](../../development/adrs/0029-a-plan-carries-a-kind-and-a-sibling-order.md).

## Reproduce

Run `npm run test-build`, reload Obsidian in this repository's vault and enable the plugin.

1. Open a project with a site plan, a house detail plan under it, and three floors under the
   house named `Attic`, `First floor` and `Ground floor` (see *Build detail plans from site to
   floor* — and in its New plan form choose **Kind = Site** for `Site` and **Kind = Building**
   for `House`, since that case leaves every plan a floor), in a vault whose plans have never
   been reordered. Open the ground floor.
2. The sidebar's **Property** section shows the project, then Site › House › the three floors in
   name order (Attic, First floor, Ground floor), each level indented one step, the open floor
   highlighted, a site icon on Site and a building icon on House. The context bar's crumbs carry
   the same icons.
3. Open Obsidian's *Read view* on `Ground floor.md`: no `kind` and no `order` key — a floor under
   a building takes the default kind, and a plan never reordered has no order written.
4. Drag **Attic** to just above **Ground floor** and drop it. The list redraws as First floor,
   Attic, Ground floor — exactly the order shown at the drop, since a first reorder writes every
   sibling whose stored order differs from its new index, not only the moved one:
   `Attic.md` now carries `order: 1`, `Ground floor.md` `order: 2`, and `First floor.md` still
   has no `order` key. Reload Obsidian: the order holds.
5. Drag **Attic** onto **Site**. No indicator appears and nothing changes. Drag it out of the
   Property section altogether: the indicator clears. Known and accepted: the `after` indicator
   on a row that has children (a second root dragged onto the lower half of **Site**) draws
   directly under that row — ABOVE its first child — while the drop lands after the whole
   subtree.
6. Right-click **First floor** › **Move down**. It swaps with Attic. Focus a row, press Alt+↑: it
   moves up and keyboard focus stays on the moved row. Shift+F10 on a row opens the same menu;
   Escape closes it and focus returns to the row.
7. Right-click **Site**: **Mark as site** is checked and no other kind is; choose **Mark as
   building**: the icon changes, and `Site.md`'s frontmatter now carries `kind: building`.

## Runs

| Date | Build | Result | Notes |
|---|---|---|---|
| — | — | Not run | Written with the implementation; nothing here has been walked in a vault. |

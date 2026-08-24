---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 10
---
**The walkthrough, which only a human in a vault can run.** `npm run test-build`, then in  
Obsidian:

1. Create a project, a plan and at least two zones from inside Obsidian  
    (`Create sample renovation project` does all three).
2. Open the Plan Editor for that plan (`Open plan editor` → pick it).
3. See §60's five shell regions: toolbar, layers panel, canvas, inspector, status bar.
4. See the zones drawn, each with its name and a status caption, with fills that differ by  
    zone type and dash patterns that differ by status.
5. Toggle a layer off in the Layers panel and watch it disappear.
6. Pan by dragging; zoom by wheel **and** by `+`/`-`; watch the zoom percentage and the  
    world-millimetre pointer readout in the status bar.
7. Set a **PNG** background through `Set plan background` and see it under the zones.
8. Set a **PDF** background and see the page rendered — the one thing only a vault can  
    prove, now that production uses Obsidian's pdf.js and the suite uses ours.
9. Switch Obsidian's theme and confirm the zone colours follow **without a reload**.
10. Open two different plans in two tabs at once; confirm each has its own camera, and that  
    opening the same plan twice reveals one leaf rather than two.
11. Close a Plan Editor tab and reopen it; confirm the zones render identically.
12. Restart Obsidian and confirm each Plan Editor leaf reopens onto the plan it was showing.

Anything on that list which does not work is a slice 5 defect, not a later slice's work.
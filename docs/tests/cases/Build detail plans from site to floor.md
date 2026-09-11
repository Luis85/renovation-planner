# Build detail plans from site to floor

Contract: [ADR-0028](../../development/adrs/0028-a-plan-may-detail-a-zone-of-another-plan.md),
[ADR-0027](../../development/adrs/0027-zone-lock-is-canonical-click-through.md).

## Reproduce

Run `npm run test-build`, reload Obsidian in this repository's vault and enable the plugin.

1. Open a project with a site plan that has a background image and a large site zone containing a
   House zone.
2. Lock the site zone from **Rooms and areas**. Click inside the House zone on the canvas: House is
   selected, not the site. Right-click inside it: the menu is House's.
3. Choose **New detail plan**. The dialog was titled `New detail plan for House`; a dashed outline captioned `House · outline from Site plan` sits at the top-left of the empty canvas, fully in view; with nothing selected the Inspector explains the outline. Press `Shift+1`: the outline stays framed. Turn off **Reference plan** in Layers: the outline hides.
4. Set up a reference image for `House` cropped at the building's top-left corner and calibrate
   it. The dashed outline and the drawing line up.
5. In `House`, draw a Footprint zone and create **New detail plan** `Ground floor` from it. The
   breadcrumb reads `Project › Site plan › House › Ground floor`. Click `Site plan` in it: the
   site tab comes forward rather than a second one opening.
6. Back on the site plan, right-click House: **Open House** is listed and brings that tab forward.
7. Close and reopen Obsidian. The site zone is still locked; every breadcrumb and guide is intact.
8. Delete the Footprint zone in `House`. Reopen `Ground floor`: no guide, and the Property tree
   says the room or area it details no longer exists.

## Runs

| Date | Build | Result | Notes |
|---|---|---|---|
| — | — | Not run | Written with the implementation; nothing here has been walked in a vault. |

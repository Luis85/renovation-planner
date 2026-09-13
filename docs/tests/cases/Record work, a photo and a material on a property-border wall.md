---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 210
sources:
  - Wall context records and materials design spec §3–§6
status: Ready
---

# Record work, a photo and a material on a property-border wall

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, a floor with
one Room and one wall drawn outside it, a vault image, and two library assets priced per m² —
"Clinker brick" with plan pattern Brick, "Lime render" with none.

## Steps

1. Right-click the outside wall. **Expected:** the menu shows **Add** with a chevron; hovering it opens Door, Window, Opening, Wall from here, a separator, Work item, Note, Photo beside the parent item.
2. Press Esc once. **Expected:** only the submenu closes. Press Esc again. **Expected:** the menu closes.
3. Add › Work item, title "Repoint", select **Review before applying**, then **Apply**. **Expected:** the room picker reads **No room**; the Work item lists under the wall.
4. Add › Photo, pick the image, apply. **Expected:** the photo shows in the wall's photo strip with no pin.
5. Inspector → Set material…, choose Clinker brick, select **Review before applying**, then **Apply**. **Expected:** Material reads Clinker brick; the wall draws a brick hatch in both light and dark themes.
6. Planned view, change: modify, material Lime render, select **Review before applying**, then **Apply**. **Expected:** Materials lists one Lime render entry measured by the wall's net area; the wall draws plain in the Planned view and hatched elsewhere.
7. Ctrl+Z. **Expected:** the planned material and its entry both disappear.
8. Delete Clinker brick in the Asset library. **Expected:** refused, naming the floor.
9. Right-click a Garden area → Add › Note. **Expected:** the note form opens with the area as its context.

## Runs

| Date | Build | Result | Notes |
| --- | --- | --- | --- |

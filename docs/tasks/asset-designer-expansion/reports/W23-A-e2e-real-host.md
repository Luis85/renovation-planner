# W23-A — the asset designer driven in a real Obsidian

**Date:** 2026-09-25. **Instrument:** `npm run test:e2e` (main's WebdriverIO harness, merged into this
branch at `305d70ce2`), Obsidian 1.13.7, Windows 11, `--lang=en`; the same suite runs on Linux under
xvfb in the `E2E` workflow at 1.13.7, `latest` and mobile emulation.

## What landed

Five case files under `tests/e2e/`, one per manual case, each case naming the step it discharges and
each manual case carrying a clause table (*Automated in Obsidian*) and a Runs row written from the run:

| File | Manual case | Cases |
| --- | --- | --- |
| `assetDesigner.e2e.ts` | Design an Asset | 7 |
| `assetDesignerRecovery.e2e.ts` | Recover an asset design rather than lose it | 5 |
| `twoDesigners.e2e.ts` | Two designers on one asset | 5 |
| `assetHandoff.e2e.ts` | Take an asset from the library into a plan | 7 (2 mobile) |
| `assetReference.e2e.ts` | Calibrate a sheet and reserve space | 3 |

`tests/e2e/designer.ts` is the page object: the designer as a user reaches it, the `.rpgeo` on disk
read as the instrument, a real pointer drag located through Konva's own stage registry, a drag HELD
across a peer's write, and Obsidian's reconcile hook for an edit made outside it.

Desktop leg, whole suite: 35 passed, 3 skipped (mobile-only), 353 s; mobile-emulation leg: 7 passed,
31 skipped (desktop-only).

## Findings — where the host disagreed with a row

1. **Obsidian does not reconcile an external write.** A `.rpgeo` — and, as the control, a `.md`
   note — written outside Obsidian raises `raw` within 10 ms and then neither `modify` nor a `stat`
   change for 15 s. So "the stale notice arrives unprompted" (Recover step 8) cannot happen through
   the host's watcher in a driven 1.13.7. The plugin's own pipeline is intact from the next link on:
   `adapter.reconcileFile(path, path)`, the call the watcher makes when it does act, produces the
   notice, the qualified header, the retry and the unprompted heal exactly as the rows say. Whether an
   interactive Obsidian reconciles on focus or on a timer is not settled by this run.
2. **A drag held across a peer LEAF's write is dropped silently.** Two designers step 8 expects
   `Save error` in the held leaf. Measured with the peer's keystroke 918 ms into a 2.5 s hold: the
   peer's write lands, the held leaf redraws it, and its own drag is abandoned — nothing written, the
   header still the plain `Saved` of a leaf that never wrote, no history entry, no toast. One step
   quieter than the silent badge step 9 records as the hole. The external-rewrite variant (step 14)
   DOES refuse with the badge. Pinned as measured; the ruling is the author's.
3. **The read-only bit is a rejected write** on Windows — `Save error`, revision unchanged, no toast,
   the part back where it was. Recover's fault 1 stands as written.
4. **Disabling and re-enabling the plugin detaches every designer leaf**, and enabling restores
   none. Design an Asset step 24's "reopen both" is a reopen, not a return. The console carries no
   `Several Konva instances` line, and does carry Konva's `The stage has 7 layers` warning at every
   designer mount.
5. **A pair of leaves on one asset is obtainable** through `app.workspace.duplicateLeaf(leaf,
   'split')` — Split right — and survives a restart. Two designers step 1 is answered.
6. **With nothing traced, Remove reference withdraws the whole Reference block** rather than reading
   "None chosen" (Calibrate a sheet steps 12 and 14): the value needs a pending line to keep the
   section, which is step 2's own rule.
7. **The clearance-review block passes axe-core** with the flag set by a real resize — `role="status"`
   present, the button named — which no scan in the repository had reached before.

## What the instrument taught, so the next file does not relearn it

- WebDriver serialises its commands: a `browser.execute` issued during an action chain runs AFTER
  the chain. Anything that must overlap a held press comes from a timer inside the page or from the
  file system. `browser.keys` ends with `releaseActions`, which lifts a held pointer; a key action
  with `perform(true)` does not.
- A second action chain gets a fresh pointer source at (0, 0), so a press and its release must share
  one chain.
- The toilet's anchor dot sits at the bowl's centre and wins the hit there by design; a press meant
  for the bowl lands three quarters down its rect.
- A click on the canvas's centre in a narrowed leaf lands on empty canvas and clears the selection;
  the canvas is focused by script before a key press.
- Obsidian's notice and settings window, the picker's `.prompt`, and the leaf's `.mod-active` state
  are all real here and all addressable; a hidden tab's controls exist and are not interactable, so
  a leaf is activated before it is read.

## Not automated, and why

Judgement rows (Design an Asset 56, 70, 103, 104, 109, 121; Recover 20; Two designers 10; Take an
asset 23; Calibrate 29); screen-reader announcement (Calibrate 32's other half, Design 88b); two
pointing devices (Two designers step 8's primary setup — replaced by the in-page timer); Recover
12a–12d (the overflow needle) and 19 (a half-undone compensation); everything under Compose an asset
from parts, whose `obsidian` rows are keyboard-focus behaviour and context menus this pass did not
reach; and every `browser`-tier layout measurement, which the harness captures own.

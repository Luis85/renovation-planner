# R01 browser review — synthetic fixtures

The primary supplied opening-handles image was inspected. Adoption uses labeled task buttons
and compact menus; no arrow semantics, endpoint resizing or competitor assets were copied.
Product Design audit/reference guidance and Impeccable Operate guided this review.

## Captures and findings

1. Selected door: capture 01 shows the initial task cluster. Capture 02 found only 118 px
   remaining for the form after list selection tightly framed the opening. This was corrected
   with a dock fallback and full-opening framing. Captures 03/04 and 17 show that correction.
2. Responsive fallback: the first 400 px attempt crossed the pre-existing unsupported-width
   boundary. Coordinator authorized a nonspatial fallback without changing the 400 px floor.
   Captures 06 and 09 are rejected intermediate layouts: the unsupported shell's centering
   caused overflow into the header. Captures 10/11 confirm the final bounded scroll container,
   explicit refusal and reachable footer. Capture 17 confirms the supported 400 px dock.
3. German dark curved window: 07 shows the compact menu; 08 shows hinge/side/angle focus.
   Changing hinge to end, side to right and angle to 30, then Apply/Undo/Redo succeeded.
4. Magnification: 12 found the taskbar overlapping a small opening when the camera imposed a
   minimum fit height. 13 confirms the corrected available-height fit. This is 200% CSS zoom,
   explicitly labeled in the dedicated harness page, with a 460 × 400 CSS-pixel inner viewport.
5. English light floating form: 14 confirms a floating panel where more than 420 px of clear
   vertical space remains. Keyboard context 15 found 24 px rows; 16 confirms 44 px opening
   actions and a 24 px gap above the taskbar. The same context offset action focuses offset;
   Escape returns to the invoking canvas. Inspector Escape returns to Size and swing.

The bounded review captured actual defects, applied the corresponding fixes, and confirmed
them. Intermediate rejected/superseded captures are retained for audit, not acceptance.

## Behavioral evidence

Browser width/offset sequence: 0.9004/1.2002 m → 0.9104/1.1952 → 0.9104/1.2052 →
0.9204/1.2002. Apply saves once; Undo/Redo restored the expected displayed measurements.
Typed invalid width reports containment refusal. Cancel preserves saved values. Exact persisted
geometry, IDs, metadata, current/intended independence, colors and history are checked by tests.

All measured direct form buttons/inputs/selects and corrected context actions are at least
44 CSS px high; widths are at least 44 px. The dock does not overlap its canvas/taskbar.
The fallback keeps the editor's status and header outside its own scroll area. Focus and
geometry assertions supplement screenshots; no screen-reader, native-vault or human claims
are derived from these captures.

The host's default light/dark tokens and English/German copy are used. Browser was the Codex
in-app browser at devicePixelRatio 1. Screenshots are original JPEG bytes at the viewport
dimensions shown; file hashes are in the accompanying image ledger.

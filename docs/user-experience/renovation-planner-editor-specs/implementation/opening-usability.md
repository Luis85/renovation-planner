# Opening placement and plan symbols

User-authorized extension to M01 and ADR-0020. Sidecar schema **5** reserves optional
`Opening.swing: { hinge: 'start' | 'end', side: 'left' | 'right', angle: number }` for
Doors and Windows, in current and intended structures. Angles are finite degrees in
the inclusive range 0–180. The hinge selects the opening endpoint along the directed
host; side means left/right looking from host start toward host end. In downward-y
coordinates the left normal is `(dy, -dx) / length`.

Absent swing remains absent through legacy read/write/history. Rendering defaults to a
start hinge on the left, Door angle90 and Window angle0. A plain Opening has no leaf and
rejects swing. The migration4→5 changes only the discriminator in memory; writes use5
only when current/intended openings contain swing. All other geometry and Plan metadata
retain their existing authority. Rotation/calibration carry swing without changing its
relative hinge/side/angle, and projection equality includes these facts for peer guards.

## Schema foundation verification

Scoped ESLint and `vue-tsc --noEmit` passed. The three repository/migration test files
`openingSwingPersistence.test.ts`, `structurePersistence.test.ts` and
`persistence-wiring.test.ts` passed **20/20** cases. They verify legacy read-only defaults,
version5 round-trip/current+intended preservation, exact Undo/Redo, lower-version restoration,
invalid/plain-opening refusal and the registered migration version.

Pointer placement, move-to-point, editable fields and native symbol rendering are the next
continuation and are not claimed complete by this foundation commit.

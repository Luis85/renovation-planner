# Downstream browser acceptance

Preparation only. The driver and opt-in adapter are connected in source, but have not yet been
verified; no passing result is claimed.

The final runner retains its original eight journeys and all eighteen image comparisons, adding
a ninth journey for the M10 and M13 downstream requirements. Its intended native interaction path
starts with a Room, Existing/Planned facts and a Work item created through the editor, then opens
Project Work outside the Inspector. It creates a Trade, previews and applies responsibility and
manual dates, verifies Undo/Redo, and returns to the same Room. From Costs it creates two Suppliers
and received quotes covering the same Work, compares their separate totals, creates a separate
draft revision while retaining both received originals, and returns without changing the room's
spending facts.

The opt-in `&reference&planning&downstream` adapter reuses the connected reference workspace vault and metadata. One
production composition root provides both editor and Project services and notifications after
initial fixture seeding. Native `PlanEditorView` and `RenovationProjectView` state parsing and
context arrival remain the navigation path. The editor instance remains mounted while the Project
surface is visible; before/after Room dimension bounds and selection identify camera/context loss.

The browser adapter supplies only host leaf construction/reveal behavior. It cannot establish
actual Obsidian leaf/history, real MetadataCache timing or native host restart behavior. Those
observations remain separate from this browser evidence.

`tests/harness/downstreamWorkspace.ts` constructs production view dependencies from that root.
The browser leaf adapter constructs a Project view on its first native view-state write; the
existing FakeLeaf forwards all subsequent writes to the real view. Native `navigateToProject`
and `revealPlanEditor` retain their production selection, serialization and arrival behavior.
The adapter only switches container visibility and disposes mounted views and subscriptions on
page hide. It does not assign editor stores or fabricate schedule, catalogue or comparison rows.

Planned validation: light/dark/custom-accent/German constrained native keyboard matrix, schedule
and quote preview screenshots, both downstream views, sixteen axe scans, and context/cost
assertions. Production findings belong to the finalization branch; fixture and driver fixes stay
with this UI branch. Final implementation and complete acceptance remain open.

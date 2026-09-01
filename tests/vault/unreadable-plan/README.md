# unreadable-plan

**Two healthy plans in one project, and nothing planted.** `unreadable-zone`'s sibling, built
the same way and for the same reason: each case in `planListingSkips.test.ts` corrupts
`Plans/First.md` its own way at run time, so the defect sits in the case that asserts against
it rather than in this folder.

`plan-ground` is the survivor and `plan-first` is the casualty.

**Both plans carry a sidecar, and that is a requirement rather than decoration.**
`ObsidianPlanRepository.getById` reads `Geometry/<planId>.rpgeo` for every plan and refuses
with `plan.sidecar-unreadable` when the index resolves no path — so a plan with no sidecar
cannot be loaded at all, and a fixture without one would make every case here pass for the
wrong reason. (`tests/vault/valid-project` has no `Geometry/` folder, which is why nothing
loads a plan from it.)

**The asymmetry with `unreadable-zone` is the thing to carry.** A ZONE's geometry lives in its
PLAN's sidecar, one document shared by every zone on that plan, so one unreadable sidecar
refuses all of them and must not be counted as N note failures. A PLAN's sidecar is keyed by
its own id, so `plan.sidecar-unreadable` is note-local and IS skippable. Same code shape, two
different answers, and the reason is which document the failure is about.

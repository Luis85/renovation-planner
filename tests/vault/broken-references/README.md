# broken-references

One planted record: **a zone whose `plan` frontmatter names a plan that does not exist.**

Named as that exact edge rather than as "a broken reference", because not every dangling
reference is validated on a read. `ObsidianPlanRepository.getById` never resolves the owning
project (`plan.project-folder-unresolved` is raised on a WRITE path), and a zone's
`projectId` is not resolved on load either — so a plan or zone whose `project` is missing is
genuinely broken and produces no refusal at all, leaving an assertion about a refusal
unsatisfiable against a fixture that looks correct by description.

This edge fails on a path the read actually walks: `ObsidianZoneRepository.getById` calls
`loadOne(id, (planId) => this.geometry.read(planId))` with `parsed.value.plan`, and no
sidecar path is indexed for a plan that does not exist — `plan-missing`, the planted zone's
`plan` value, names nothing in this fixture. `PlanGeometryStore.read` refuses with
`plan-geometry.path-unresolved`, which `loadOne` wraps as `zone.sidecar-unreadable` carrying
that refusal as its cause.

`kitchen` is the healthy zone in the same fixture. Both are load-bearing: the plugin still
working is equally true of a fixture that has quietly become valid.

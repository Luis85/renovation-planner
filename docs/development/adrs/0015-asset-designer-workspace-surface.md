---
adr: 15
title: The Asset Designer Is Its Own Workspace View
status: Accepted
date: 2026-09-01
area: presentation
---

# ADR-0015: The Asset Designer Is Its Own Workspace View

## Context

An `Asset` is gaining a shape (ADR-0014, and the geometry sidecar under it): a footprint, a
clearance boundary, an anchor, a facing angle. Somebody has to draw it, and drawing it is a
canvas gesture — the same class of interaction the Plan Editor already performs over a Plan.

So the question is where that canvas lives. There are three candidate answers, and one of them
is already implemented for a neighbouring case:

- a third **workspace view type**, per asset;
- a **mode** of the existing Renovation Project view, in the shape
  `docs/issues/The plan editor is a mode, not a second view.md` chose for the Plan Editor;
- a **dialog** over whichever surface the user is on.

## The supersession this ADR has to record first

`docs/issues/The plan editor is a mode, not a second view.md` is `status: Done`, dated
2026-08-23. It decides **one view type, `renovation-project`, with the plan editor as a mode
inside it**, and its Consequences say in as many words: *"Slice 05 registers no new view type.
It adds a mode to the existing one and a `getState()` contract for it."*

**The code did the opposite.** `src/presentation/views/PlanEditorView.ts` declares
`PLAN_EDITOR_VIEW = 'renovation-plan-editor'` and `RenovationPlannerPlugin.ts` calls
`this.registerView(PLAN_EDITOR_VIEW, …)`. The Plan Editor is a second registered view type,
per plan, with its own icon, its own display name and its own `open-plan-editor` command. That
is precisely the **rejected alternative** — *"Two separate view types"* — implemented without
the note being revisited.

**This ADR follows the code, not the note.** Two reasons, in that order:

1. **A view type is data.** Obsidian persists it in the workspace layout. Every vault that has
   opened a plan since design slice 05 holds `renovation-plan-editor` in its layout, and every
   user who bound a hotkey to `open-plan-editor` bound it to that id. Un-registering the view
   type to make the note true would orphan both. The note's own argument for care —
   *"a view type cannot be renamed for tidiness once a workspace layout holds it"* — is the
   argument against reversing it now.
2. **The note's own *Revisit when* has been met.** It reads: *"A use case needs the canvas and
   the project overview visible at the same time."* Tracing a spec sheet is that use case with
   the nouns changed — the whole point of designing an asset is that it will be placed into a
   plan, so the object's outline and the room it has to fit are wanted side by side. A mode
   cannot show two things at once; the note says so itself and calls that *"the accepted
   loss"*.

The note is annotated with a one-line pointer back to this ADR in the same change, so the
contradiction is findable from either side. It is not marked superseded in its frontmatter:
its `status: Done` records that the decision was taken and written down, which is true, and
what changed is the world it described.

## Decision

**The asset designer is a workspace view of its own, `renovation-asset-designer`, one per
asset, with the open asset carried in Obsidian's own per-leaf view state as
`{ assetId: string }`.**

Three consequences of that sentence are decisions in their own right:

- **Per asset, not a singleton.** Two leaves may show two different assets at once, exactly as
  two Plan Editor leaves may show two plans. The view TYPE is one constant; the subject is
  ephemeral per-leaf state.
- **`''` means "no asset yet", never an absent key.** `AssetDesignerView.getState()` writes
  `{ assetId: '' }` when it has no asset, which is what `PlanEditorView` already writes for a
  plan-less leaf. A key that is sometimes present is a different shape for every reader to
  reason about, and two per-subject views spelling the same absence differently is drift with
  nothing to catch it.
- **A restored state is a trust boundary.** The workspace layout is a file the user can edit
  and a file another version of this plugin wrote, so the id arrives as `unknown` and is
  validated rather than cast — the same argument `settingsFrom` makes about `data.json`, and
  the same one the superseded note listed under its own Consequences.

## Alternatives

**A mode of the Renovation Project view.** This is the shape the superseded note chose for the
Plan Editor, so consistency argues for it. Rejected for the reason above — the object and the
room it goes in are wanted side by side — and for a second one the note could not have seen:
the Renovation Project view is now a two-state surface of its own (design slice 21: a list and
a project detail state), and a designer mode would be a third state of a view whose state is
already a discriminated `projectId`. An asset belongs to no project since design slice 19, so
that state would have to be independent of the very field the view's state is keyed on.

**A dialog.** Cheapest to build and wrong for the work: designing an asset is not a question
with an answer, it is a session with a camera, an undo stack and several tools. Slice 15's
dialog framework is deliberately sequential and modal — it makes the rest of the view `inert`
— which is the opposite of a surface a user works in beside something else.

**A view per asset CATEGORY, or one designer view showing a picker.** A singleton designer
with an internal asset picker would keep the view-type count at three. Rejected because it
re-introduces the exact problem the plan editor's multiplicity solved: comparing two assets
means opening one, remembering it, and opening the other.

## Consequences

- One more persisted view type, one more `registerView` call in `src/plugin/`, one more entry
  in `rebindOpenViews`. Every view already on screen must be pointed at a new composition root
  when settings are saved; a third view type that forgot that loop would go on reading through
  an index nothing maintains.
- `SDD §11`'s two primary views become three surfaces in `src/`. The Sitemap's inventory gains
  a row.
- **The dangling-asset state is NOT decided here, and that is a real gap with a trigger.**
  `GetAssetDesign` refuses an absent asset with a coded `ReferenceError` (`asset.not-found`)
  rather than answering `ok(null)` the way `GetPlan` does, so the designer has no structural
  equivalent of slice 17's dangling-plan state and its failure surface offers a retry for every
  refusal, including that one. Retrying is harmless and honest — the sentence the user reads is
  `asset.not-found`'s own — but it is not the useful action, which is closing the tab. **Decide
  it in Task B9**, which is where a leaf restored onto a deleted asset first becomes an
  ordinary thing rather than a hypothetical: that task opens the designer from a picker and
  from the create-asset dialog, so it owns what a stale leaf does. Closing it needs a
  `closeLeaf()` member on the designer context — the same narrow callback
  `PlanEditorContext.closeLeaf` already is, added for the same reason.

## Revisit when

Obsidian gains a way for one view type to declare several subjects, or the asset designer and
the plan editor turn out to want the same camera, the same tool framework and the same shell
badly enough that one view type with a `subject` discriminator is less code than two. Task B1
already extracted the gesture surface both share, and Task B2 made the tool context name a
`subject` rather than a Plan — so the shared half is real, and the surviving difference is what
the leaf IS, which is what a view type expresses.

## References

- ADR-0014 (where an asset's geometry lives), ADR-0004 (one Vue app per view), ADR-0013
  (a derived folder, and the trust boundary shape).
- `docs/issues/The plan editor is a mode, not a second view.md` — the decision this ADR records
  the code as having taken the rejected half of, and which now points here.
- SDD §11 (workspace views), §12 (one Vue app per view).
- `obsidian@1.13.0` typings: `View.getState()`, `View.setState()`, `ViewState` — the pinned
  floor, so an API `minAppVersion` promises.

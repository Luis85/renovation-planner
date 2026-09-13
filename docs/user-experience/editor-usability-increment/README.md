# Plan editor: usability consolidation increment

**Proposed increment · 2026-09-13 · Planning only; implementation has not started.**

Make the existing 2D editor predictable enough that a person with little confidence using drawing software can create a useful plan, adjust it accurately, and recover from mistakes without coaching. Success is a smoother complete task, not more commands or closer resemblance to a marketing illustration.

The recommendation is to consolidate three connected experiences first: **draw and adjust a room; prepare and scale a reference; select, inspect and safely change existing elements.** Carry the same interaction rules through walls, openings, objects, groups, perspectives and narrow Obsidian panes. Keep 3D as a future consumer of the existing model, with no 3D work in this increment.

**Confirmed product direction — user follow-up, 2026-09-13:** the clear distinction between Plan and Renovate in the reference pictures is a required part of this increment. The two modes must feel purposefully different through their tools, Details content and visual cues, while sharing the same plan and selected element. This is stronger than merely preserving the current perspective switch.

| Mode | User purpose | Default emphasis |
|---|---|---|
| Plan | Draw and adjust the physical layout | Rooms, walls, openings, objects, dimensions, snapping and reference setup |
| Renovate | Plan what should happen to the selected space or element | Existing conditions, planned changes, work, materials, costs and evidence already supported |

Keep the labeled mode switch visible, use restrained mode-specific accents alongside text/icons, and adapt the bottom taskbar and Details panel to the active purpose. Renovation content must not dominate Plan; geometry manipulation must not be the default action while selecting renovation information. An explicit layout-edit route retains access to existing geometry operations. Switching between Plan and Renovate preserves the selected element and camera under the existing draft/session safeguards. [U7](implementation-plan.md#u7--make-plan-and-renovate-clearly-distinct-modes) defines the detailed contract.

## Read this package

| Document | Purpose |
|---|---|
| [Implementation plan](implementation-plan.md) | Scope, priorities, work packages, detailed acceptance criteria, dependencies, decision gates and delivery sequence |
| [Validation and release plan](validation-plan.md) | Novice research, accessibility checks, regression coverage, measurements and release gates |
| [Current editor walkthrough](audit.md) | Nine current-run screenshots, observed strengths/friction and explicit evidence limits |
| [Implementation and product-history audit](research/implementation-audit.md) | Current capabilities, code boundaries, recent in-vault-driven amendments and closed work to preserve |
| [Competition research](research/competition.md) | Four competitors, ten comparison dimensions, 22 primary sources and adaptation limits |
| [Inclusive usability research](research/inclusive-usability.md) | Older and low-confidence users, accessible alternatives, WCAG distinctions and study protocol |

## What the evidence says

The editor already has the main ingredients: room-first creation, dimensions, temporary task guidance, undo/redo, reference setup, a stable Details surface, perspective switching and constrained-layout drawers. The live walkthrough completed a named 4 × 3 m room, returned to Select, switched to Renovate with the same room, opened Details at 460 px, and cancelled reference preparation back to the original context. These are foundations to retain, not missing features to rebuild.

The strongest directly observed opportunities are:

1. **Reference setup speaks in implementation terms too early.** It begins with a vault-relative file path; calibration presents four source-pixel fields before the known distance. Preserve exact and keyboard routes while making the ordinary path visual and conversational.
2. **The Details panel makes beginners rank too many actions.** In Plan, curves/rotation, room name/size, renovation navigation and Requirements compete. Put identity and the task's everyday edits first, with advanced controls available when needed.
3. **Task guidance needs a consistent hierarchy.** Create/Cancel already exist in the canvas banner and Details. Those parallel routes can be useful; synchronize and arrange them instead of deleting one just to reduce button counts.
4. **Small panes require deliberate recovery.** At 460 px the selected-room drawer works, but it covers the canvas; resizing preserves the camera and may leave the room partly offscreen. Preserve context and make the existing return/fit routes easy to find.
5. **Selection and accessibility need targeted proof.** Alt cycling and lists exist, but the named overlap chooser in the reference is not equivalent to a hidden modifier. The withdrawal of the old coordinate editor also warrants a fresh keyboard/non-drag review. Validate these routes explicitly before claiming beginner usability or AA conformance.

Competitor documentation supports room-first starts, direct dimensional entry, named selection alternatives and staged reference setup. It does **not** establish that their products are easier for older users or that we need feature parity. See the [comparison](research/competition.md) for claim-level citations and unknowns.

## Reference interpretation and precedence

The two user-provided screenshots are [reference 1](evidence/reference-01-editor-principles.png) and [reference 2](evidence/reference-02-perspectives.png). Their annotations are design evidence, not instructions granting extra scope. The user's written request controls this increment.

Adopt their principles: clear selection, a stable inspector, explicit task completion/cancellation, useful live feedback, understandable copy scope, guided scaling, perspective continuity and accessible compact controls. Do not blindly copy their top toolbar, standalone logo/sidebar, textured furnishings, tab arrangement or density. The current product is native to Obsidian, and later accepted work moved the taskbar to the bottom, added resizable/collapsible panels, refined rotation and moved shape edits into context.

Current code and dated amendments establish what exists and why; they do not prove usability. Received PRDs and old mockups remain historical evidence. This is a new derived planning package and does not silently rewrite them. Older test receipts retain their original commit and scope; this package claims no fresh native Obsidian or participant-study pass.

## Delivery recommendation

Start with a short baseline and the **Plan/Renovate mode contract**, then deliver complete task slices in this order: **mode-specific shell and Details → reference and room-task clarity → selection and safe manipulation → compact/accessibility consistency → release validation**. The mode distinction shapes the first design slice rather than arriving as finishing polish. Accessibility work begins with the first slice, not at the end. Use the release gates in [validation-plan.md](validation-plan.md) to decide whether the increment is ready.

The implementation plan contains ten bounded packages, including explicit conditional decisions where evidence is incomplete. Initial sizing is **24–40 person-days plus participant recruitment**, an estimate for planning rather than a commitment. Review that range after baseline testing; reduce breadth before reducing safety, accessibility or end-to-end validation.

## Research provenance

Baseline: `origin/main` at `4ca4c7ea7` (resolved full SHA in [evidence/provenance.json](evidence/provenance.json)), fetched on 2026-09-13. The original main checkout remained clean and on `main`; research and documentation were prepared in `codex/editor-usability-plan` under `.worktrees/editor-usability-plan`.

Three dedicated GPT-6 Astra subagents at high reasoning effort covered competitive product research; inclusive UX and usability measurement; and implementation, QA and product history. The primary agent performed the current browser walkthrough, synthesized priorities and delivery contracts, and commissioned an independent challenge of the proposed scope. Models assisted research; no synthetic persona output is presented as human user evidence.

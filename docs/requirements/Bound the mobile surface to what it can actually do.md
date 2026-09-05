---
type: PBI
parent: "[[Release hardening]]"
order: 90
status: Active
started: "2026-09-05"
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# Bound the mobile surface to what it can actually do

`PRODUCT.md` states the device scope as **desktop-first, mobile read-only**, and `manifest.json`
keeps `isDesktopOnly: false` — which is what makes that a promise rather than a preference: the
plugin loads on Obsidian mobile, so whatever it draws there is what it claims to support.

Nothing enforces the bound. `grep` for `Platform.isMobile` or `Platform.isPhone` across `src/`
finds nothing; the only member of that API in use is `Platform.isMacOS`, for a modifier glyph. So
every write control this plugin draws is drawn on mobile too — the project creation form, the asset
price rows, the asset library's nine definition fields, the plan editor's tools — on a surface
whose own product document says writing is not supported there.

## Why the narrow work does not cover it

Both design packages ran into this from opposite sides and neither could close it.
`renovation-planner-project-specs` PBI-10 asks for it and says *"Check actual capabilities before
implementation"*; `asset-library-delivery` PBI-15 draws the line explicitly — *"460px tests a leaf,
not mobile platform certification"*. That is the distinction this item rests on: a narrow desktop
leaf is a **width**, answered by container queries that already ship and by
[[Use the editor in Obsidian themes and constrained layouts]] beside this note, while mobile is a
**platform**, answered by nothing.

## Actor

An Obsidian user who has this plugin installed and opens their vault on a phone or tablet — which
is every user of a synced vault, not a separate audience.

## Main flow

1. The renovator opens the vault on Obsidian mobile.
2. They open a renovation surface that mobile supports.
3. They read their projects, their plans' names, their asset definitions and their prices.
4. No control invites them to write something the scope does not support.
5. They return to a desktop to change anything.

## Extensions

- **2a. They reach a surface that is desktop-only** — the plan editor, the asset designer. It says
  so, in a sentence naming the reason, rather than drawing a canvas that cannot be drawn on.
- **4a. A write control exists on a supported surface.** It is disabled with its reason visible,
  never hidden — a control that vanishes on one device and appears on another reads as a bug in
  whichever one the user is holding.
- **4b. A gesture would write anyway** — a synced note edited in Obsidian's own editor. Untouched.
  This item bounds what *this plugin's own surfaces* offer, and never what the host can do to a
  Markdown file.
- **3a. A read fails on mobile.** The same coded refusal desktop would show. No mobile-specific
  error vocabulary.

## Guarantee

**No surface this plugin draws on mobile offers a gesture the product scope does not support.**
Whatever is reachable there is readable, and every refusal is stated where the control would have
been rather than discovered by pressing it.

## What has to be measured first

Which surfaces mobile can actually render is a question no gate in this repository can answer:
jsdom has no platform, the browser harness's `?phone` sets a body class rather than reporting a
device, and `Platform` is Obsidian's. So this item starts as a **measurement in a real mobile
vault** — what loads, what draws, what a touch gesture reaches — and the enforcement is written
against what that finds. Writing the guard first would be guarding a guess.

## Acceptance criteria

- With the platform reported as mobile, every write control on a supported surface is disabled and
  carries its reason.
- A desktop-only surface reached on mobile draws an explanation naming the reason, not an empty or
  broken canvas.
- With the platform reported as desktop, nothing above applies and no control changes.
- A manual case records what was actually reachable in a real mobile vault, and what was not.

## Project-surface implementation (2026-09-05)

Partially implemented for the project surface: Platform.isMobile selects readable project/price presentation, creation controls are hidden and plan-editor launch controls are disabled. This does not complete this PBI’s disabled-with-reason policy or its plugin-wide scope: restored editor/designer leaves, other entry points and real-device capability measurement remain open. Narrow desktop editing is preserved.

Evidence and remaining limitations: [execution record](../user-experience/renovation-planner-project-specs/implementation/execution-record.md).

## Sources

`PRODUCT.md` (Capabilities and Constraints — the confirmed device scope, and §105's resolution);
`manifest.json` (`isDesktopOnly: false`);
`docs/user-experience/renovation-planner-project-specs/implementation/repository-reconciliation-and-backlog.md`
PBI-10 and its §1 device-scope row; `docs/user-experience/asset-library-delivery/pbis/PBI-15.md`;
[[The alternative list route is a Bases view]], which made the Bases route the mobile read surface
and is what this item leaves standing rather than duplicating.

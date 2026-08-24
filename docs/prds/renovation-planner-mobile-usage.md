# Product Requirements Document — Mobile Renovation Companion

**Product:** Renovation Planner  
**Status:** Draft  
**Version:** 0.1  
**Target:** Consumer homeowners / serious DIY renovators  
**Host:** Obsidian Mobile

## 1. Vision

Mobile is not a smaller desktop editor. Renovation happens while walking through rooms, measuring, speaking to trades, buying materials, discovering problems, taking photos, checking work and collecting receipts.

> **Renovation Planner Mobile is the homeowner's contextual renovation companion for capturing reality, checking plans, recording decisions and keeping the project current while moving through the property.**

Core jobs: **Capture · Inspect · Decide · Act**.

## 2. Research Rationale

Research shows the phone camera is already a default renovation tool, but photos later lose context. Receipts often live separately from budgets. Unexpected work is discovered physically. Decisions happen during conversations. Material information is needed while shopping. Desktop trackers are inconvenient on site.

Current behavior fragments:

```text
Camera + Notes + WhatsApp + Tasks + Spreadsheet
```

Mobile should preserve relationships at capture time:

```text
Project → Space → Work / Problem / Decision → Evidence
```

## 3. Principles

1. Capture first.
2. Context before form filling.
3. Camera is a primary input.
4. Mobile is not desktop shrunk down.
5. Core actions should work one-handed.
6. Retrieval matters as much as capture.
7. Core workflows are local/offline-first.
8. Incomplete capture is valid; refine later.
9. Evidence retains context.
10. Use consumer language before construction jargon.

## 4. Mobile vs Desktop

| Capability | Mobile | Desktop |
|---|---|---|
| Overview / next actions | Strong | Strong |
| Spaces | Strong | Strong |
| Work | Strong | Strong |
| Photos / evidence | **Primary** | Secondary |
| Problems / quick notes | **Primary** | Strong |
| Measurements | Strong | Strong |
| Decisions | Strong | Strong |
| Receipts / purchases | **Primary** | Secondary |
| Shopping/material lookup | **Primary** | Strong |
| Tasks / progress | **Primary** | Strong |
| Detailed plan editing | Limited | **Primary** |
| Complex geometry | Limited | **Primary** |
| Detailed estimation | Limited | **Primary** |
| Budget analysis | Summary | **Primary** |
| Scheduling | Summary/update | **Primary** |
| Bulk organization | Limited | **Primary** |

Feature parity is not the goal.

## 5. Primary Mobile JTBDs

- **M01 Capture Photo:** When I see something relevant, I want to photograph it with context preserved so I can understand it later.
- **M02 Capture Problem:** When I discover a problem, I want to record it immediately with photos/notes so it is not forgotten.
- **M03 Quick Note:** When I learn something away from my desk, I want to record it in context rather than rely on memory.
- **M04 Attention:** When I arrive at the property, I want to see what needs attention now.
- **M05 Inspect Room:** When standing in a room, I want its work, problems, decisions, costs and evidence available.
- **M06 Measurement:** When I need a dimension, I want to capture it in the relevant context.
- **M07 Hidden Infrastructure:** Before surfaces close, I want to document pipes, cables, framing and services in context.
- **M08 Receipt:** When I buy something, I want its receipt linked to relevant work/material.
- **M09 Shopping:** At a supplier, I want to know what, how much and where it is needed.
- **M10 Decision:** When a decision is made on site, I want to record it immediately.
- **M11 Progress:** When work changes state, I want to update it quickly.
- **M12 Retrieval:** When I need evidence, I want to retrieve it through room/work context rather than search unrelated files.

## 6. Navigation

Recommended bottom navigation:

```text
Home     Spaces     Capture     Tasks     More
```

`Capture` is visually prominent.

- Home — What needs attention?
- Spaces — Where am I working?
- Capture — What do I need to record?
- Tasks — What needs doing?
- More — Budget, Materials, Schedule, Documents, Settings.

## 7. Mobile Home

```text
HOUSE RENOVATION 2026

NEXT
⚠ Bathroom — Investigate damp wall
[Open]

TODAY
○ Pick up kitchen tiles
○ Photograph electrical rough-in
○ Confirm sink position

PROJECT
Planning        62%
Budget          €31,200 / €42,000
Open problems   3

RECENT
Kitchen — Flooring photos added
Bathroom — Problem created
```

Emphasize action over analytics.

## 8. Spaces / Space Detail

```text
SPACES

Ground Floor
Kitchen       6 work · 1 problem
Living Room   2 work
Bathroom      4 work · 2 problems
```

Kitchen:

```text
KITCHEN
Planning · Budget €14,200

NEXT
Choose flooring

WORK
Replace floor
Paint walls
Replace kitchen

PROBLEMS
⚠ Uneven floor

RECENT PHOTOS
[ ][ ][ ]

[ + Capture ]
```

A plan miniature is optional.

## 9. Capture Hub

```text
What do you want to capture?

📷 Photo
⚠ Problem
📝 Note
📏 Measurement
◇ Decision
🧾 Receipt
✓ Progress
```

When context exists:

```text
Adding to: Kitchen / Replace Floor
```

Allow context change before save.

## 10. Photo Capture

Target:

```text
Kitchen → Capture → Photo → Camera → Save
```

Optional classification:

```text
Progress
Problem
Before
After
Hidden infrastructure
Product / reference
Other
```

Minimal metadata is always enough.

### Multi-photo session

```text
Start Session → capture → capture → capture → Done
```

All inherit project, space, selected object, timestamp and session.

## 11. Hidden Infrastructure

Dedicated flow:

```text
Capture → Hidden Infrastructure

Kitchen / North Wall
Type: Electrical / Plumbing / Heating / Structure / Other

[Take Photos]
[Save]
```

Future: annotation and approximate location.

## 12. Problem Capture

```text
NEW PROBLEM — Kitchen

[Take Photo]

What did you find?
[ Floor is uneven ]

Severity      Optional
[ Unknown ▾ ]

[Save Problem]
```

Do not require cause, solution or cost during capture.

## 13. Quick Note

```text
Kitchen / Replace Floor

[ Need to ask tiler whether old adhesive
  must be removed completely. ]

[Save]
```

Later: Turn into Task / Decision / Problem.

## 14. Measurement

V1 manual capture:

```text
Type: Length / Width / Height / Area / Opening / Other
Value: [4.25] m
Description: [North wall]
[Save]
```

Later: camera measurement, LiDAR, Bluetooth laser. None block V1.

## 15. Decision

```text
DECISION — Kitchen

What?
[ Sink position ]

Decision
[ Move sink to window wall ]

Why?
[ Better workflow ]

Impact       Optional
Cost [ +€1,200 ]
Time [ +1 day ]

[Save]
```

Unresolved decisions can be saved as Open.

## 16. Receipt Capture

```text
Capture → Receipt → Camera

Supplier [Bauhaus]
Amount   [€184.32]
For      [Kitchen / Replace Floor]
Date     [Today]

[Save]
```

V1 uses manual metadata. OCR/receipt parsing is later.

## 17. Shopping / Materials

```text
SHOPPING — Kitchen / Replace Floor

Tiles
Need: 17.8 m²
Selected: Porcelain Grey

Adhesive
Need: 4 bags
[Mark Purchased]

Grout
Need: 2 bags
[Mark Purchased]
```

Show quantity, product, reference, dimensions, budget, supplier and purchase state.

### Product reference capture

```text
Porcelain Tile Grey
Store: Bauhaus
Price: €42/m²
For: Kitchen / Replace Floor
Status: Considering
```

## 18. Tasks / Execution

```text
TODAY

KITCHEN
○ Pick up tiles
○ Remove skirting boards

BATHROOM
⚠ Investigate damp wall

GARDEN
○ Photograph drainage route
```

Actions: Complete · Block · Add Photo · Add Note.

Do not become a generic task manager.

## 19. Progress

```text
Planned → Start Work
In Progress → Photo / Problem / Complete
Complete → final photos + optional actual cost
```

Completion naturally invites evidence.

## 20. Contractor Conversation View

```text
KITCHEN / ELECTRICAL

WORK
Add 6 outlets
Move oven connection
Island power

OPEN DECISIONS
◇ Outlet height
◇ Island socket type

DOCUMENTS
Electrician Quote.pdf

[Add Note] [Add Decision] [Take Photo]
```

Goal: informed, documented homeowner conversation — not CRM.

## 21. Quick Context Switching

Provide Recent:

```text
Kitchen
Bathroom
Garden
Replace Floor
Damp Wall
```

plus search. Capture always displays active context.

## 22. Mobile Renovation Canvas

Transform, do not shrink, the desktop Canvas:

```text
┌─────────────────────────┐
│ Ground Floor       ⋯    │
├─────────────────────────┤
│                         │
│        CANVAS           │
│      [ Kitchen ]        │
│                         │
├─────────────────────────┤
│ Kitchen                 │
│ €14.2k · 1 problem      │
│ [Open]    [+ Capture]   │
└─────────────────────────┘
```

Selection opens a bottom sheet replacing the desktop inspector.

V1 supports select/inspect, conceptual spaces, simple positioning, pan/zoom, viewing zones, contextual capture and simple measurement.

V1 does not optimize for precise wall drawing, complex polygons, dense snapping or advanced CAD operations.

## 23. Offline / Local First

Without network, users must be able to:

- browse locally available project data,
- capture photo,
- create note/problem/decision,
- add measurement,
- update work/task state,
- capture receipt metadata.

Never imply evidence is saved until local persistence succeeds.

No cloud service is required for core use.

## 24. Fast-Capture Requirement

For active context:

```text
Capture → type → input/camera → Save
```

Avoid repeated project/space selection.

## 25. Accessibility / Physical Context

Use may happen while standing, wearing gloves, in poor light, on a ladder or during conversation.

Requirements:

- large touch targets,
- strong hierarchy,
- minimal typing,
- no tiny icon-only actions,
- draft preservation on interruption,
- safe destructive actions,
- Obsidian theme support.

Voice capture is a promising later accelerator.

## 26. Privacy

Renovation photos can expose interiors, addresses, valuables and documents.

Requirements:

- local-first storage,
- no mandatory upload,
- no content telemetry,
- explicit consent for future external processing,
- clear image-metadata handling.

## 27. Performance

- Home/Space Detail feel immediate.
- Photo save does not block whole UI.
- Lazy-load large photo collections.
- Use thumbnails.
- Do not load the whole evidence library for every space.

## 28. MVP

### Must
- Mobile Home
- Spaces / Space Detail
- Capture Hub
- Photo + multi-photo
- Problem
- Quick Note
- manual Measurement
- Decision
- Receipt with manual metadata
- Tasks/progress
- context inheritance
- recent contexts
- mobile Canvas inspect mode
- bottom-sheet inspector
- offline/local save
- responsive Obsidian Mobile UI

### Should
- Shopping/material mode
- product reference capture
- contractor conversation view
- hidden-infrastructure classification
- actual cost on completion

### Later
- OCR / receipt parsing
- LiDAR / camera measurement
- Bluetooth laser
- photo annotation
- voice capture
- barcode scanning
- notifications
- advanced mobile geometry

## 29. Success Criteria

A homeowner can:

1. open project on phone,
2. find Kitchen,
3. save a contextual photo,
4. create a problem with photo,
5. add measurement,
6. record decision,
7. find planned work,
8. update progress,
9. capture receipt,
10. retrieve everything later through Kitchen.

The experience should feel faster than Camera + Notes + spreadsheet for contextual capture.

## 30. High-Risk Assumptions

1. Home / Spaces / Capture / Tasks / More is the right IA.
2. Capture deserves central prominence.
3. Photo classification provides enough value.
4. Users will capture receipts here rather than Camera.
5. Problem is meaningfully distinct from Note.
6. On-site Decisions are worth explicit capture.
7. Read/inspect-first mobile Canvas is sufficient.
8. Detailed plan editing can remain desktop-first.
9. Recent context meaningfully reduces friction.
10. Local-first works with expected cross-device continuity.

Cross-device continuity is particularly important. This PRD does not prescribe a sync provider, but the same renovation must be reliably accessible on desktop and phone for the product thesis to work.

## 31. Prototype Scenario

```text
Arrive at house
→ Home shows today's work
→ Open Kitchen
→ Check Replace Floor
→ Discover uneven floor
→ Capture Problem + 2 photos
→ Measure affected area
→ Add note for tiler
→ Photograph wiring before wall closes
→ Complete task
→ Go to hardware store
→ Open shopping list
→ Capture product reference
→ Buy material
→ Capture receipt
→ Return later
→ Retrieve problem/photos/measurement/receipt through Kitchen
```

## 32. Product Boundary

Mobile should excel at:

> **being with the homeowner when renovation reality happens.**

Desktop should excel at:

> **making sense of the accumulated project and planning what happens next.**

```text
DESKTOP
Plan / Structure / Analyze / Design
          ↕
        Vault
          ↕
MOBILE
Capture / Inspect / Decide / Execute
```

## 33. Product Principles Summary

> **The phone is a renovation sensor, notebook, evidence camera, checklist and pocket project view.**

> **Capture reality where it happens.**

> **Preserve context automatically.**

> **Make the next action obvious.**

> **Do not make the homeowner reconstruct the project later.**

> **Mobile and desktop share the project model, not the same interface.**

---

# Appendix — Research Traceability

# Comprehensive User Research Synthesis
## Renovation Planner for Obsidian

**Status:** Research synthesis  
**Version:** 0.1  
**Date:** 2026-08-24  
**Purpose:** Capture recurring user problems, pains, wishes, current-tool friction, workarounds, unmet needs, and product implications for homeowner-led renovation planning.

---

# 1. Executive Summary

Renovation is not one job. It is a prolonged coordination problem spanning:

```text
understanding the property
→ deciding what to change
→ controlling scope
→ estimating cost
→ comparing alternatives
→ coordinating DIY and professionals
→ buying materials
→ sequencing work
→ responding to surprises
→ keeping evidence
→ remembering decisions
→ understanding what actually happened
```

The strongest pattern across public user discussions and industry research is **fragmentation**.

Homeowners commonly assemble a personal operating system from:

```text
spreadsheets
+ phone notes
+ camera roll
+ messaging apps
+ paper
+ contractor PDFs
+ calendars
+ floor-plan apps
+ task apps
+ browser bookmarks
+ memory
```

Each tool solves a narrow problem, but the renovation itself is cross-cutting. Users repeatedly lose the relationships between:

```text
room ↔ work ↔ quote ↔ material ↔ receipt ↔ decision ↔ photo ↔ contractor ↔ schedule
```

This fragmentation creates secondary problems:

- spreadsheets drift away from reality,
- receipts are difficult to reconcile,
- decisions are forgotten,
- quotes are hard to compare,
- scope changes become invisible,
- costs cannot be attributed cleanly,
- photos become an unstructured archive,
- partner adoption fails,
- project information is difficult to use on site,
- users reconstruct context repeatedly,
- current apps feel either too shallow or too professional.

The core opportunity for Renovation Planner is therefore not merely better task management or a better floor-plan editor.

> **The unmet need is a coherent homeowner workspace that preserves context across the full renovation lifecycle.**

---

# 2. Research Method

This synthesis combines:

- public homeowner discussions on Reddit,
- home-improvement and renovation communities,
- recent Houzz homeowner and professional research,
- Harvard Joint Center for Housing Studies remodeling research,
- Consumer Reports remodeling guidance,
- user discussions about floor-planning and renovation software.

This is **secondary qualitative research**.

It is useful for:

- identifying recurring themes,
- generating research hypotheses,
- prioritizing interview topics,
- finding language used by renovators,
- challenging product assumptions.

It is not a substitute for direct interviews with target users.

---

# 3. Key Research Sources

## Industry / Market Research

- Harvard JCHS — *Improving America's Housing 2025*  
  https://www.jchs.harvard.edu/sites/default/files/reports/files/Harvard_JCHS_Improving_Americas_Housing_2025.pdf

- Harvard JCHS — *Improving America's Housing 2025: Key Facts*  
  https://www.jchs.harvard.edu/sites/default/files/interactive-item/files/Harvard_JCHS_Improving_Americas_Housing_2025_Key_Facts.pdf

- Houzz — common client budget challenges  
  https://www.houzz.com/magazine/how-pros-handle-5-common-client-budget-challenges-stsetivw-vs~150327136

- Houzz — communicating project delays  
  https://www.houzz.com/magazine/how-to-better-communicate-project-delays-to-homeowners-stsetivw-vs~147196113

- Consumer Reports — remodeling on budget / schedule  
  https://www.consumerreports.org/home-improvement-remodeling/how-to-remodel-on-a-budget-stay-on-schedule/

## Community / User Discussions

- DIY renovation tracking methods  
  https://www.reddit.com/r/DIY/comments/1u0r4gv/how_do_you_manage_and_track_your_home_renovation/

- Two years of renovation tracking across Excel, Notion, Trello, etc.  
  https://www.reddit.com/r/Remodel/comments/1ulc3fk/what_do_you_actually_use_to_track_your_renovation/

- Renovation budgeting with lump-sum contractor quotes  
  https://www.reddit.com/r/AusRenovation/comments/1uasmkq/reno_planning_and_budgeting/

- Renovation cost-sharing, receipts, defects, craftsmen notes  
  https://www.reddit.com/r/SideProject/comments/1vw2izn/renovating_a_house_with_my_fianc%C3%A9e_and_a_friend/

- Undiscussed renovation variations / additional charges  
  https://www.reddit.com/r/AusRenovation/comments/1vhyjo0/being_charged_for_variations_that_were_never/

- Floor-plan software friction: local/offline, no unnecessary 3D  
  https://www.reddit.com/r/selbermachen/comments/18v6bh7/2d_raumplanungssoftware_gesucht/

- Floor-plan import/tracing usability friction  
  https://www.reddit.com/r/floorplan/comments/1fbbmoy/easiest_app_to_import_existing_floor_plan/

- Floor-plan software pricing / export / interoperability frustration  
  https://www.reddit.com/r/floorplan/comments/ocboaw/magicplan_is_great_but_doesnt_automatically/

- Renovators wanting simple tools rather than professional complexity  
  https://www.reddit.com/r/VisionPro/comments/1iis6pc/has_anyone_tried_the_planner5d_vp_app_and_is_it/

- Renovation evidence / photos / documentation lessons  
  https://www.reddit.com/r/HomeImprovement/comments/1rjlr3b/

---

# 4. Core User Segments

The research suggests the product should distinguish at least these behavioral segments.

## 4.1 First-Time Home Renovator

Characteristics:

- limited understanding of construction sequence,
- uncertain budget expectations,
- learns terminology while planning,
- higher anxiety around mistakes,
- needs strong guidance.

Primary risk:

> The product assumes knowledge the user does not yet have.

---

## 4.2 Serious DIY Renovator

Characteristics:

- personally executes part of the work,
- hires specialists for electrical/plumbing/etc.,
- researches materials deeply,
- tracks costs,
- uses spreadsheets and notes,
- values control.

Primary frustration:

> Existing tools do one part well but not the whole job.

---

## 4.3 Hybrid Homeowner / Trade Coordinator

Characteristics:

- homeowner is effectively acting as light project manager,
- multiple trades are involved,
- homeowner owns many decisions,
- contractor communication matters,
- schedule dependencies become important.

Primary frustration:

> The homeowner is responsible for coordination but is not equipped with contractor-grade information systems.

---

## 4.4 Contractor-Led Homeowner

Characteristics:

- contractor performs most work,
- homeowner mainly makes decisions,
- wants transparency into cost, scope and progress,
- needs evidence and documentation.

Primary frustration:

> The homeowner does not necessarily know what was included, changed, decided or billed.

---

## 4.5 Long-Term Property Owner

Characteristics:

- renovation is one episode in ongoing property ownership,
- maintenance and replacement continue later,
- installed-product knowledge matters,
- plans/photos/warranties retain long-term value.

Primary frustration:

> Renovation knowledge disappears once the project is over.

---

# 5. Problem Landscape

The user problem can be summarized as eleven connected areas:

```text
1. I don't know where to start.
2. I don't know exactly what exists.
3. I struggle to define and control scope.
4. I cannot trust my budget.
5. My information is scattered.
6. I cannot easily compare options and quotes.
7. Coordination with trades is opaque.
8. My schedule changes constantly.
9. Unexpected work destroys the original plan.
10. I cannot reconstruct decisions and evidence later.
11. Current tools do not match the way homeowners actually renovate.
```

The following sections examine these in detail.



# 6. Problem Cluster — Renovation Feels Overwhelming Before Work Begins

## Observed Problem

Renovators frequently begin with an outcome in mind but do not know how to translate it into a structured project.

The user may know:

```text
"redo the kitchen"
"make the ground floor more open"
"fix the bathroom"
"make the house livable"
```

but not:

```text
what decisions are needed
what order to work in
what information to gather
what a realistic budget is
which work requires professionals
what should be decided first
```

## Pain

- cognitive overload,
- uncertainty,
- fear of expensive mistakes,
- repeated research,
- procrastination,
- premature product/material decisions,
- difficulty separating "must do" from "would like."

## User Wish

> "Tell me what I should figure out next without forcing me through a rigid process."

## Current Workarounds

- YouTube,
- Reddit,
- contractor advice,
- spreadsheets,
- checklists,
- Pinterest/Houzz inspiration,
- asking friends,
- notes.

## Friction With Current Tooling

Generic project tools expect the user to already know the project structure.

Professional construction software assumes construction knowledge.

Design tools often pull the user toward visualization before scope, budget and sequence are understood.

## Product Implication

The product should support **guided incompleteness**:

```text
you do not need everything now
→ capture what you know
→ expose the next useful decision
→ refine over time
```

This reinforces:

- Project Home,
- Next-Best-Action,
- progressive disclosure,
- rough-to-detailed estimates,
- optional floor plan.

---

# 7. Problem Cluster — Existing Property Information Is Unreliable or Incomplete

## Observed Problem

Renovators frequently work from:

- old plans,
- sales floor plans,
- handwritten dimensions,
- phone photos,
- memory,
- architect PDFs,
- sketches.

Floor-plan discussions show substantial friction around:

- tracing,
- scaling,
- importing PDFs,
- editable exports,
- wall thickness,
- metric precision,
- 2D vs unnecessary 3D.

One user explicitly wanted "no 3D gimmicks," local/offline use, centimeter-accurate grids and precise object placement.

Another struggled to trace and scale an existing plan despite having found the right import feature.

## Pain

- recreating existing information,
- measurement mistakes,
- incompatible file formats,
- uncertainty about what is accurate,
- expensive software for simple needs,
- tool learning curves,
- inability to reuse plans elsewhere.

## User Wish

> "Let me start from whatever information I already have."

## Tooling Friction

Common pattern:

```text
I have a PDF
→ app wants an image
→ import works but edit does not
→ tracing is confusing
→ export is proprietary or image-only
→ 3D features are included even though I only need accurate 2D
```

## Product Implication

Support multiple entry modes:

```text
Import Plan
Draw Plan
Structure Spaces Without Plan
```

and do not make plan sophistication synonymous with project sophistication.

Interoperability and open storage are potential differentiators.

---

# 8. Problem Cluster — Scope Is Difficult to Define and Control

## Observed Problem

Users frequently struggle with understanding what individual renovation decisions actually cost.

A recent renovator received contractor quotes containing one overall price for around ten modifications. Because the contractor would not break costs down, the homeowner could not decide which changes to remove to fit the budget.

Another homeowner was charged roughly $30,000 in "variations" after completion, despite believing much of the work was inside the original scope and reporting that additional spending had not been explicitly approved.

## Pain

- inability to make trade-offs,
- uncertainty about what is included,
- loss of control,
- budget shock,
- disputes,
- distrust,
- inability to distinguish baseline from change.

## User Wish

> "Show me what every major part of the renovation contributes to cost and what changes when scope changes."

## Current Workarounds

- ask contractor for itemized quote,
- create own spreadsheet,
- request several quotes,
- manually compare line items,
- negotiate after the fact,
- keep email evidence.

## Tooling Friction

Contractor software may manage change orders well, but the homeowner often does not own or control that system.

Generic tools lack a semantic concept of:

```text
baseline
proposed change
approved change
cost delta
schedule delta
```

## Product Implication

Scope and change should be first-class concepts.

Potential product pattern:

```text
Original scope
+ proposed change
→ affected work
→ cost delta
→ schedule impact
→ decision
→ approved/rejected
→ updated project
```

This may be one of the strongest differentiating opportunities.

---

# 9. Problem Cluster — Budgets Start as Guesses and Drift Away From Reality

## Evidence

Houzz research consistently shows budget uncertainty and overruns.

Recent user discussions reinforce:

- difficulty obtaining itemized costs,
- desire for real completed-project cost examples,
- frustration with lump-sum contractor estimates,
- spreadsheets being used as a primary tool.

One renovator described their spreadsheet as becoming "fiction" after months of manually reconciling work and receipts.

## Why Budgets Fail

Common causes:

- initial information is incomplete,
- scope evolves,
- actual material choice differs from placeholder assumption,
- labor cost is unknown,
- unexpected work appears,
- purchase data lives elsewhere,
- contractor estimates use different structures,
- receipts are not reconciled,
- costs are remembered rather than recorded,
- budget does not reflect committed orders.

## User Wish

> "Let me start rough and become accurate as I learn more."

This is different from:

> "Require me to estimate everything precisely before I begin."

## Product Implication

Use a layered financial model:

```text
budget ceiling
→ rough work estimates
→ detailed estimates
→ quotations
→ committed purchases/contracts
→ actual invoices/receipts
```

Preserve earlier values to make variance understandable.

Important dimensions:

```text
project
space
trade
work
material/product
phase
```

---

# 10. Problem Cluster — Information Is Fragmented Across Tools

## Strongest Repeated Theme

A user who renovated for two years described cycling through:

- Excel,
- phone receipt folders,
- Notion,
- Trello/Todoist,
- HomeZada,
- camera roll and memory.

Their assessment illustrates the fragmentation problem:

### Excel

Strength:

- flexible,
- powerful formulas,
- custom categories.

Pain:

- receipts live separately,
- reconciliation is manual,
- poor on-site usability,
- data becomes stale.

### Notion

Strength:

- relational data,
- visually attractive.

Pain:

- too much system-building,
- mobile photo handling,
- partner non-adoption.

### Trello / Todoist

Strength:

- fast tasks,
- sharing.

Pain:

- no budget or receipts,
- forces second system.

### Camera Roll

Strength:

- zero friction to capture.

Pain:

- nearly zero structure to retrieve.

## User Wish

> "I want one place where the relationships remain intact."

Not necessarily one monolithic application, but one **source of project truth**.

## Product Implication

Renovation Planner's most important architecture may be the relationship model:

```text
Photo
→ Kitchen
→ Electrical Work
→ Contractor
→ Decision
→ Invoice
```

rather than any individual feature.

This strongly supports an Obsidian-backed model.

---

# 11. Problem Cluster — Tool Setup Becomes Work of Its Own

## Observed Problem

Users appreciate flexible tools but frequently report spending excessive time configuring them.

The clearest expression:

> "I spent more time building the system than renovating."

This is the risk of generic knowledge/database tools.

## Pain

- schema design,
- templates,
- relationships,
- formulas,
- dashboards,
- naming conventions,
- manually keeping structures synchronized.

## User Wish

> "Give me useful renovation structure immediately, but don't lock me in."

## Product Tension

Too little structure:

```text
blank Obsidian vault
→ user must invent renovation system
```

Too much structure:

```text
construction ERP
→ homeowner must understand the software's domain model
```

Desired position:

```text
opinionated defaults
+ editable/open data
+ progressive complexity
```

## Product Implication

Renovation Planner should provide the domain scaffolding automatically.

Users should customize their renovation, not configure the software before using it.

---

# 12. Problem Cluster — Tools Are Either Too Simple or Too Professional

A DIY homeowner recently described available renovation tools as either:

> too simple, such as basic checklists,

or:

> aimed at contractors rather than DIYers doing their own work.

This is a critical market signal.

## Too Simple

Typical tools cover:

- task list,
- notes,
- photos.

Missing:

- property hierarchy,
- quantities,
- costs,
- scope,
- trades,
- schedule,
- procurement.

## Too Professional

Typical products introduce:

- CRM,
- lead management,
- proposals,
- client portals,
- accounting,
- business margins,
- subcontractor administration.

## User Wish

> "Give me construction-aware planning without forcing me to run a construction company."

## Product Implication

Homeowner remains the primary actor.

Trade/professional concepts are included only insofar as they help the homeowner plan and coordinate the renovation.

---

# 13. Problem Cluster — Floor-Planning Software Often Solves the Wrong Depth of Problem

## Evidence

User discussions reveal a recurring mismatch:

- users need simple precise 2D but are sold expensive 3D,
- tools require accounts before drawing,
- basic wall drawing can feel difficult,
- premium subscriptions gate useful functions,
- file import/export is inconsistent,
- workflows may be easy for experienced users but opaque to first-timers.

One recent user described trying multiple web planners and finding them expensive, subscription-heavy, download-dependent or overly complicated before writing their own simpler planner.

## User Wish

> "Let me do the planning job I came here to do, without buying a visualization suite."

## Product Implication

The spatial editor should optimize for renovation decisions:

```text
accurate enough
editable
fast
linked to rooms/zones/work
```

rather than maximizing rendering sophistication.

The first question for every visual feature should be:

> "Which renovation decision does this help the user make?"

---

# 14. Problem Cluster — Collaboration Fails When Only One Person Adopts the System

## Evidence

Public discussions include:

- partner adoption of Notion being effectively zero,
- renovation expense splitting between fiancée/friends,
- desire for shared responsibilities,
- plans for multi-person sharing because one person otherwise becomes the information bottleneck.

## Pain

- one person becomes project secretary,
- others communicate through messages rather than system,
- expenses arrive late,
- decisions are made outside the tracker,
- duplicate or contradictory information,
- partner cannot easily see current state.

## User Wish

> "Make it easy for someone else to participate without learning my entire system."

## Product Challenge

Obsidian is primarily a personal/local tool, so full collaboration is not an immediate strength.

## Product Implication

Even before real-time collaboration, design for **shareable outputs** and low-friction participation:

- contractor scope exports,
- printable room briefs,
- shopping lists,
- decision summaries,
- project snapshots,
- partner-friendly dashboards,
- simple external artifacts.

Collaboration should be researched carefully rather than assumed.

---

# 15. Problem Cluster — Contractor Communication and Responsibility Are Opaque

## Observed Problems

Homeowners may not know:

- what was agreed,
- what was assumed,
- whether something was included,
- who owns a prerequisite,
- whether a variation was approved,
- what a trade needs before arrival,
- why something is delayed.

Houzz specifically addresses the need for better communication around delays caused by unavailable subcontractors, shipping, stock and changing conditions.

## Pain

- repeated conversations,
- verbal agreements with no record,
- surprise charges,
- idle trades,
- homeowner uncertainty,
- blame after the fact.

A Reddit user summarized their current system as hoping contractors "remember what we talked about."

## User Wish

> "I need a reliable record of what we agreed, what changed, and what each person needs."

## Product Implication

Consider lightweight:

```text
Trade
→ scope
→ responsible work
→ quote
→ decisions
→ prerequisites
→ notes/meetings
→ documents
```

Do not build CRM; build homeowner coordination.

---

# 16. Problem Cluster — Receipts, Quotes and Documents Lose Their Context

## Observed Problem

Financial evidence often exists separately from the cost model.

Typical state:

```text
spreadsheet says €2,500
receipt is a photo
quote is a PDF
invoice is in email
material photo is in camera roll
```

Later, the user must manually reconstruct the relationship.

## Pain

- reconciliation,
- lost receipts,
- duplicate purchases,
- poor warranty evidence,
- inability to know actual cost per room/work,
- difficult tax/insurance/warranty follow-up.

## User Wish

> "When I save evidence, it should already know what it belongs to."

## Product Implication

Contextual capture is valuable:

```text
Add receipt from Kitchen / Replace Floor
→ pre-link to project
→ room
→ work
→ supplier/product
```

Obsidian's file model can support durable evidence without hiding it in a proprietary database.

---

# 17. Problem Cluster — Photos Are Valuable but Become an Unusable Archive

## Evidence

Renovators and contractors emphasize the value of progress photos, including photographs of hidden infrastructure before walls are closed.

One discussion specifically noted the later need to locate a wire behind drywall and regretted not having photographed inside the walls.

## Pain

- camera roll has no construction context,
- hard to know date/location,
- hidden-service information is lost,
- before/after cannot be reconstructed,
- evidence for disputes is weak.

## User Wish

> "Let me capture photos now and understand them months or years later."

## Product Implication

Photos should support metadata/context such as:

```text
space
zone
work item
date
phase
before/during/after
hidden infrastructure
issue
decision
```

This is a strong bridge between project management and long-term property knowledge.

---

# 18. Problem Cluster — Unexpected Conditions Are Normal but Poorly Managed

## Industry Evidence

Budget and schedule research repeatedly identifies:

- structural discoveries,
- hidden conditions,
- material problems,
- scope changes,
- unavailable products,
- contractor/subcontractor delays.

Renovation is inherently uncertain.

## Current Tooling Failure

Many systems assume:

```text
plan
→ execute plan
```

Reality is:

```text
plan
→ open wall
→ discover problem
→ research
→ change work
→ change materials
→ change budget
→ change schedule
→ communicate
```

## User Wish

> "When reality changes, help me understand what else changes."

## Product Implication

Unexpected work should not simply become another task.

It should preserve relationship to:

- original scope,
- affected room,
- cause,
- cost delta,
- schedule impact,
- decision,
- evidence.

---

# 19. Problem Cluster — Users Cannot Reconstruct the Project Later

## Observed Need

Public advice around poor workmanship emphasizes:

- taking many photos,
- recording dates,
- writing down conversations,
- keeping contracts/certificates,
- preserving evidence and timelines.

This becomes essential during:

- warranty claims,
- disputes,
- repairs,
- future drilling/cutting,
- later renovations,
- resale,
- insurance.

## Pain

The project tracker is often abandoned at completion.

Knowledge becomes:

```text
boxes
emails
old phone photos
forgotten contractor names
unlabeled paint tins
```

## User Wish

> "I want to know what was actually installed, where, when and by whom."

## Product Implication

Completion should create an **as-built property record**, not merely close tasks.

Potential durable record:

```text
Room
├── what changed
├── products installed
├── paint/material references
├── concealed services photos
├── invoices
├── warranties
├── contractor
└── maintenance notes
```

This could materially extend retention beyond the renovation itself.



# 20. Friction Matrix — Current Tools

| Tool / Method | Why Users Choose It | Primary Friction |
|---|---|---|
| Excel / Sheets | flexible, familiar, formulas | manual reconciliation, weak evidence/context, poor site use, stale data |
| Notion | relational, attractive, configurable | setup burden, mobile capture friction, low partner adoption |
| Trello / Todoist | excellent task capture | no integrated budget, receipts, spatial context |
| Camera roll | effortless capture | retrieval and context collapse over time |
| Notes app | immediate and familiar | no structured project model |
| WhatsApp / messaging | easy collaboration | decisions become buried and unsearchable |
| Paper | fast, tactile | cannot aggregate/update/share reliably |
| Floor-planning apps | spatial visualization | over-complex, expensive, 3D-heavy, import/export friction |
| Contractor software | strong project controls | business-first complexity, price, homeowner mismatch |
| Contractor PDF quotes | formal scope | often lump-sum, difficult to compare/re-plan |
| Memory | zero setup | fails as project duration and complexity grow |

---

# 21. User Wishes — Consolidated

Across the evidence, users appear to want:

## Orientation

- "Tell me where I am in the project."
- "Tell me what matters next."
- "Do not make me understand construction software first."

## Simplicity

- "Let me begin with incomplete information."
- "Do not force detailed estimating too early."
- "Do not require 3D if I only need a useful plan."

## Context

- "Keep room, work, cost, product, photo and decision connected."
- "When I add something from the Kitchen, remember that I am in the Kitchen."

## Financial Control

- "Show me what each decision costs."
- "Let me compare planned vs committed vs actual."
- "Help me understand scope-change impact."

## Contractor Transparency

- "Show what was included."
- "Record what changed."
- "Remember what we agreed."
- "Tell me what each trade is responsible for."

## Execution

- "Show what I need to do now."
- "Show what is blocked."
- "Tell me what needs ordering before work begins."

## Documentation

- "Put receipts and photos where they belong."
- "Let me find evidence later."
- "Remember what is behind the wall."

## Long-Term Value

- "Keep the renovation useful after the renovation."
- "Remember installed products, finishes, warranties and maintenance."

---

# 22. Emotional Jobs

Renovation software competes not only on functional efficiency.

Repeated underlying emotional needs include:

## Feel in Control

The project involves large spending and physical disruption.

Users want:

> "I know what is happening."

## Reduce Fear of Expensive Mistakes

Especially for first-time renovators:

> "I want to make decisions before they become expensive to reverse."

## Build Confidence When Speaking to Professionals

Users often lack construction vocabulary.

Desired outcome:

> "I can have an informed conversation and ask the right questions."

## Reduce Cognitive Load

Instead of remembering:

```text
what did we decide?
who said what?
did I order that?
where is the receipt?
which tile did we choose?
```

the system should externalize memory.

## Preserve Trust Between Partners

Shared renovation decisions often involve money and taste.

Transparency reduces:

- forgotten decisions,
- conflicting recollections,
- hidden spending,
- unequal mental load.

---

# 23. Social Jobs

Users may want to appear:

- organized with contractors,
- competent when requesting quotes,
- financially responsible with partner/family,
- prepared when trades arrive,
- knowledgeable without pretending to be professionals.

This suggests value in professional-looking but homeowner-owned artifacts:

- room scope brief,
- quotation comparison,
- work list,
- materials list,
- decision summary.

---

# 24. Opportunity Areas Ranked by Evidence

## Opportunity 1 — Unified Context Model
**Evidence strength: Very High**

Connect:

```text
property → space → work → cost → material → document → decision
```

This directly addresses fragmentation.

## Opportunity 2 — Budget & Scope Control
**Evidence strength: Very High**

Support:

- rough budget,
- itemized scope,
- estimate refinement,
- committed cost,
- actual cost,
- change delta.

## Opportunity 3 — Simple Homeowner Project Guidance
**Evidence strength: High**

The gap between simple checklist and professional system is repeatedly visible.

## Opportunity 4 — Contractor/Trade Coordination Without CRM
**Evidence strength: High**

Scope, responsibility, prerequisites, quotes, meeting notes and decisions matter.

## Opportunity 5 — Contextual Evidence Capture
**Evidence strength: High**

Photos, receipts, invoices and notes need durable context.

## Opportunity 6 — Unexpected Work / Change Management
**Evidence strength: High**

Real renovations diverge from plan; homeowner-oriented tools rarely make this explicit.

## Opportunity 7 — Long-Term As-Built Property Record
**Evidence strength: Medium-High**

Strong observed value, especially around concealed infrastructure, warranties, defects and future maintenance.

## Opportunity 8 — Collaboration / Partner Participation
**Evidence strength: Medium**

Real pain exists, but Obsidian architecture makes the right implementation less obvious. Validate before major investment.

## Opportunity 9 — Advanced 3D Visualization
**Evidence strength for core value: Low-Medium**

Users value visualization, but many also explicitly reject expensive or unnecessary 3D. This should remain subordinate to renovation planning.

---

# 25. High-Risk Product Assumptions to Validate

The following current product assumptions should be directly tested.

## Assumption A — Project → Space → Work Is the Right Backbone

Research supports spatial context, but users may naturally organize around:

- phases,
- contractors,
- problems,
- decisions,
- budgets.

Test which dimension becomes the primary mental anchor.

## Assumption B — Project Home Is Valuable

Validate whether users want a dashboard/next-action hub or prefer immediately reopening their last working context.

## Assumption C — Open vs Continue Is Understandable

The distinction is conceptually useful but may be unnecessary UI complexity.

## Assumption D — Spaces and Design Are Separate Concepts

This terminology may be obvious internally but unclear to users.

## Assumption E — Rough Estimate First Matches Real Behavior

Evidence supports it, but validate the transitions users expect between rough budget, quote and actual cost.

## Assumption F — Users Want a Local-First Renovation System

Likely strong among Obsidian users, but possibly irrelevant to mainstream homeowners.

## Assumption G — Users Will Maintain Structured Data

The central challenge is reducing maintenance enough that data does not become stale like the spreadsheet.

## Assumption H — Full Project Continuity Is More Valuable Than Specialized Best-of-Breed Tools

This is the core strategic hypothesis.

---

# 26. Direct User Research Questions

## Starting

1. Tell me about the moment you first realized you were going to renovate.
2. What did you do first?
3. What information did you have at that point?
4. What did you wish you knew?

## Property Understanding

5. What plans, measurements or photos did you start with?
6. How did you record dimensions?
7. What information turned out to be wrong later?

## Scope

8. How did you decide what was included?
9. What did you postpone or remove?
10. Tell me about something that was added later.

## Budget

11. How did you establish your first budget?
12. How did you estimate individual pieces?
13. When did your budget first stop matching reality?
14. How did you track purchases and contractor costs?

## Tools

15. Show me the tools/files you actually used.
16. Which one became the source of truth?
17. Which information lived somewhere else?
18. What stopped being maintained?

## Contractors

19. How did you communicate scope?
20. How did you remember what was agreed?
21. Tell me about a quote you found difficult to understand.
22. Tell me about a surprise cost.

## Materials

23. How did you choose products/materials?
24. How did you keep track of what to buy?
25. What did you buy too early, too late or twice?

## Execution

26. How did you decide what needed to happen next?
27. Tell me about a blocker.
28. Tell me about something unexpected after work started.

## Documentation

29. Show me where your renovation photos live.
30. How would you find a receipt from six months ago?
31. Do you know where pipes/wires were installed behind finished surfaces?
32. Where are warranties and manuals now?

## Completion

33. How did you know the project was done?
34. What information from the renovation is still useful today?
35. What do you wish you had recorded?

---

# 27. Research Behaviors to Observe

Do not rely only on what participants say.

Ask them to **show**:

- spreadsheet,
- WhatsApp conversation,
- photos,
- contractor quote,
- task board,
- receipts,
- folder structure,
- plan,
- notes,
- shopping lists,
- calendar.

Observe:

```text
how long retrieval takes
whether names are consistent
where duplicate information exists
what has stopped being maintained
which tool they trust
which tool they avoid
what lives only in memory
```

Especially valuable moments:

- "I know I have it somewhere."
- "We stopped updating that."
- "My partner never used it."
- "The contractor has that."
- "I think this was included."
- "I can't remember."
- "We changed that halfway through."
- "I had to make a new spreadsheet."

These statements expose real opportunity.

---

# 28. Suggested Research Sample

For an initial qualitative round:

```text
12–18 interviews
```

Suggested mix:

| Segment | Interviews |
|---|---:|
| First-time renovators | 3 |
| Experienced DIY renovators | 3 |
| Hybrid DIY + trades | 4 |
| Contractor-led homeowners | 3 |
| Whole-house / long projects | ensure ≥4 across sample |
| Single-room projects | ensure ≥3 |
| Obsidian users | 3–4 |
| Non-Obsidian users | majority |

Avoid recruiting only productivity-tool enthusiasts.

---

# 29. Research Artifact Model

Each interview should produce:

```text
Interview Note
├── Participant context
├── Project context
├── Timeline
├── Trigger
├── Tools used
├── Decisions
├── Problems
├── Workarounds
├── Quotes
├── Artifacts shown
├── JTBD evidence
└── New hypotheses
```

Then synthesize into:

```text
JTBD Notes
Pain Point Notes
Opportunity Notes
Journey Evidence
Product Assumption Log
```

---

# 30. Pain Point Backlog

Candidate pain notes to track separately:

```text
PAIN-001 Renovation information is fragmented
PAIN-002 Budget becomes stale
PAIN-003 Contractor quotes are not itemized enough
PAIN-004 Scope changes are poorly documented
PAIN-005 Receipts lose project context
PAIN-006 Camera roll becomes unsearchable
PAIN-007 Users spend too much time configuring tracking systems
PAIN-008 Partner adoption is low
PAIN-009 Floor-plan tools are over-complex or over-featured
PAIN-010 Floor-plan import/export is unreliable
PAIN-011 Users cannot easily connect spatial plans to project work
PAIN-012 Contractor conversations are not recorded
PAIN-013 Responsibility between DIY and trades is unclear
PAIN-014 Material procurement becomes disconnected from schedule
PAIN-015 Unexpected work destroys estimates
PAIN-016 Users cannot see cost impact of choices
PAIN-017 Users do not know the next sensible step
PAIN-018 Professional software is excessive for homeowners
PAIN-019 Generic tools lack renovation semantics
PAIN-020 As-built knowledge is lost after completion
```

---

# 31. Product Principles Supported by Research

The research strongly supports the following principles.

## Project Before Feature

Users need one coherent renovation context.

## Context Before Configuration

Manual re-linking is one of the causes of data decay.

## Start Simple

Users frequently reject over-complex applications.

## Progressive Complexity

Real renovations evolve from uncertain to precise.

## No Mandatory Floor Plan

Spatial modeling is useful, but many users do not want complex 3D.

## Guide Rather Than Enforce

First-time users need guidance; experienced users need flexibility.

## Local / Open Data as Trust Feature

Especially for the Obsidian segment, files that remain usable outside the plugin reduce lock-in anxiety.

## Preserve History

Scope, decisions and cost should not overwrite their earlier state without trace.

---

# 32. Product Implications for the Prototype

Based on the research, the current prototype should particularly test:

1. **Can users start without a floor plan?**
2. **Does Project Home reduce uncertainty or add an extra navigation step?**
3. **Does Kitchen context make work/cost easier to understand?**
4. **Can a user create a rough estimate without feeling forced into detail?**
5. **Can the prototype explain what to do next without feeling prescriptive?**
6. **Does contextual creation reduce setup friction?**
7. **Do users understand where documents/photos would belong?**
8. **Would they trust the system enough to replace or reduce spreadsheet usage?**

A useful prototype test prompt is not:

> "Do you like this dashboard?"

Instead ask:

> "You just discovered the bathroom needs new plumbing and the contractor says it will cost another €3,000. Show me what you would do."

That tests whether the underlying product model survives real renovation change.

---

# 33. Strategic Research Conclusion

The deepest user problem is not lack of planning tools.

It is lack of **continuity**.

Users can already:

- draw a floor plan,
- make a spreadsheet,
- create tasks,
- photograph receipts,
- message contractors,
- save inspiration.

What is difficult is maintaining a reliable model of the renovation as those activities interact and change over months or years.

The strongest opportunity is therefore:

> **A renovation system that remembers relationships and history so the homeowner does not have to.**

The winning experience should make this feel simpler than the improvised stack, not more sophisticated.

The product should help the user move from:

```text
"I have information everywhere"
```

to:

```text
"I know what we are doing, why, where, what it costs, what changed, and what happens next."
```

That is the research hypothesis Renovation Planner should now validate directly with users.

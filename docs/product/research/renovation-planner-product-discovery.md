---
title: Renovation Planner product discovery
type: research-paper
status: complete
date: 2026-09-09
canvas: "[[Renovation Planner Product Discovery.canvas]]"
---

# Renovation Planner product discovery

## Abstract

Renovation Planner addresses a credible but incompletely validated opportunity: private
homeowners coordinating renovation work lack a durable way to connect places, work, costs,
materials, decisions, people, and evidence as the renovation changes. Secondary research
consistently supports fragmentation, budget drift, and weak continuity between planning and
execution. The market also contains increasingly capable homeowner renovation trackers, spatial
planners, and professional construction platforms, so a broad "all-in-one renovation app" is not
itself differentiated.

The strongest product hypothesis is narrower: an Obsidian-native workspace can turn a
homeowner's existing vault into a user-owned renovation record and use renovation-specific
relationships to explain what is known, what is unresolved, and what to do next. Local,
human-readable storage creates immediate trust and portability; accumulated property history and
validated guidance could compound into a harder-to-copy advantage. Neither willingness to pay
nor the value of next-action guidance has yet been tested with target users.

This paper follows the [[Product Discovery Blueprint]] with two deliberate adaptations:

1. the visual plan is an editable [[Renovation Planner Product Discovery.canvas|Obsidian Canvas]],
   not Excalidraw;
2. no prototype is produced or specified.

## Discovery brief

- **Audience:** Private homeowners planning and coordinating renovations themselves.
- **Audience constraints:** Existing Obsidian users; limited professional renovation experience;
  finite household time and budget; a mix of DIY and hired trades; desktop planning with
  read-only mobile access.
- **Starting scope:** The [[Product Vision]], [[Problem Definition]], current product definition,
  existing research, PRDs, and software architecture are fixed inputs. The product remains an
  Obsidian plugin and is not CAD, BIM, accounting software, contractor ERP, or a collaboration
  SaaS.
- **Time box:** Desk research completed on 2026-09-09. No primary study was conducted.
- **Decision to make:** Which opportunity should guide the next validation effort, and what
  smallest connected journey should be tested before expanding the product?
- **Out of scope:** A prototype, production implementation, direct participant contact,
  quantitative market sizing beyond cited studies, pricing decisions, and claims of product
  validation.

## Method and evidence standard

This is secondary discovery research. It triangulates:

- the repository's August 2026 user-research synthesis and competitive landscape;
- original public homeowner discussions preserved by those research notes;
- a directly accessible first-person renovator account;
- current official product, pricing, and help pages;
- the 2026 Houzz homeowner survey and Harvard JCHS market outlook;
- the repository's product and architecture authorities.

Product pages demonstrate supply and positioning, not customer demand. Testimonials hosted by a
vendor are treated as selected marketing evidence. Reddit pages returned HTTP 403 during this
research pass; observations from them are retained only where the dated repository synthesis
already recorded the conversation and original URL. Those rows have reduced confidence and must
not be treated as independently reverified quotations.

## 1. The customer

### Opportunity comparison

| Opportunity | Customer | Situation | Current struggle | Frequency | Severity | Evidence strength |
| --- | --- | --- | --- | --- | --- | --- |
| Guided renovation decomposition | First-time renovator | Turning an intention such as "renovate the bathroom" into work | Generic tools require the user to know tasks, sequence, and trades already | High during planning | High | Moderate |
| Connected renovation context | Hybrid DIY/trade coordinator | Managing work over months across rooms, purchases, quotes, and documents | Relationships fragment across spreadsheets, messages, photos, notes, and memory | High throughout | High | Strong |
| Budget and scope control | Budget-conscious homeowner | Moving from estimates to quotes, commitments, and actual spend | The initial budget becomes stale; quote scope and changes are hard to reconcile | High throughout | High | Strong |
| Lightweight spatial planning | Homeowner with a plan, sketch, or measurements | Establishing where work and quantities apply | Existing tools emphasize 3D, accounts, exports, or professional workflows | Medium | Medium | Moderate |
| Long-term property record | Long-term owner | Retrieving installed products, evidence, and decisions after completion | Project artifacts lose context and become difficult to find | Lower during work; high when needed | Medium-high | Moderate |

### Chosen opportunity

**Continuity plus guidance for homeowner-led renovation:** preserve the relationships among
property areas, work, quantities, costs, materials, people, decisions, and documents, then use
that context to identify the next useful decision or action.

### Why this opportunity

Fragmentation is the most repeated problem across the available evidence and is present in every
phase of renovation. Budget drift, lost receipts, weak contractor communication, and forgotten
decisions are consequences of the same continuity failure rather than independent markets. The
opportunity also fits the product's North Star—"I understand my renovation and know what to do
next"—better than a standalone floor planner or cost tracker.

The alternatives were not selected as the primary opportunity:

- **Guidance alone** risks becoming generic advice detached from the homeowner's real project.
- **Budgeting alone** has low-priced specialist competitors and spreadsheets remain adequate for
  small jobs.
- **Spatial planning alone** enters a mature market led by products with mobile capture, AI
  conversion, 3D, and large catalogues.
- **Property history alone** creates delayed value and is a weak acquisition wedge.

Continuity creates immediate organizational value; guidance is the interpretation layer that can
turn that context into differentiated progress.

### Assumptions still to test

- Homeowners naturally understand a property/room/work backbone.
- Existing Obsidian users experience enough renovation-specific friction to install a dedicated
  plugin instead of assembling templates and plugins.
- Users will maintain structured links when work moves from desk planning to the site.
- A recommended next action reduces uncertainty rather than feeling prescriptive.
- Local, Markdown-native storage materially affects adoption or payment.
- Continuity is more valuable than using best-of-breed tools for design, budgeting, and tasks.
- A homeowner will pay for the plugin despite free spreadsheets, free app tiers, and Obsidian's
  expectation of local ownership.

## 2. The evidence

### Customer evidence

| Source | Customer and context | Observation or quote | Signal type | Supports or contradicts | Confidence |
| --- | --- | --- | --- | --- | --- |
| [Create / Enjoy renovation budgeting account](https://www.create-enjoy.com/2018/03/3-ways-we-budget-for-reno-projects.html) | Homeowner/DIY renovator reflecting on several projects | A large room-and-item spreadsheet helped estimate affordability, but the author "did NOT update this spreadsheet" and "got way behind real quickly" once work started. | Workaround, pain | Supports planning/execution continuity and low-maintenance capture | High |
| [DIY renovation tracking discussion](https://www.reddit.com/r/DIY/comments/1u0r4gv/how_do_you_manage_and_track_your_home_renovation/) | Public DIY discussion recorded in the repository synthesis | Renovators compare improvised tracking methods rather than converging on one durable system. | Workaround | Supports fragmentation | Low: original blocked during recheck |
| [Two-year renovation tracking discussion](https://www.reddit.com/r/Remodel/comments/1ulc3fk/what_do_you_actually_use_to_track_your_renovation/) | Renovator using Excel, phone folders, Notion, Trello/Todoist, HomeZada, camera roll, and memory | The recorded account says the spreadsheet became "fiction"; Notion required system-building; task apps omitted costs and receipts; partner adoption was weak. | Pain, workaround, switching | Strongly supports continuity; challenges maintenance burden | Moderate: detailed prior capture, original blocked |
| [Renovation planning and budgeting discussion](https://www.reddit.com/r/AusRenovation/comments/1uasmkq/reno_planning_and_budgeting/) | Homeowner evaluating lump-sum contractor changes | Without itemized costs, the homeowner could not decide which modifications to remove to fit the budget. | Pain, decision | Supports scope-to-cost traceability | Moderate: prior capture, original blocked |
| [Unapproved variation charges discussion](https://www.reddit.com/r/AusRenovation/comments/1vhyjo0/being_charged_for_variations_that_were_never/) | Homeowner disputing approximately $30,000 of additions | The recorded discussion describes uncertainty over what was in baseline scope and what had been approved. | Pain, counterparty risk | Supports explicit change and decision history | Moderate: prior capture, original blocked |
| [Simple 2D planning discussion](https://www.reddit.com/r/selbermachen/comments/18v6bh7/2d_raumplanungssoftware_gesucht/) | Homeowner seeking local/offline, centimetre-accurate 2D planning | The user explicitly wanted accurate 2D without "3D gimmicks." | Switching, counterevidence | Supports lightweight spatial context; contradicts 3D-led scope | Moderate: prior capture, original blocked |
| [Existing-plan import discussion](https://www.reddit.com/r/floorplan/comments/1fbbmoy/easiest_app_to_import_existing_floor_plan/) | Homeowner trying to reuse an existing plan | Import existed, but tracing and scale setup remained difficult. | Pain | Supports accepting imperfect existing artifacts and optional plans | Moderate: prior capture, original blocked |
| [magicplan customer reviews](https://magicplan.app/pricing) | App-store users quoted on magicplan's official site, 2024–2026 | Users value rapid LiDAR measurement, room planning, and reports; one calls the app a bridge between sketches and CAD. | Satisfaction, switching | Counterevidence: a mature alternative already solves spatial capture well | Low-moderate: vendor-selected |
| [Houzz 2026 homeowner study](https://www.houzz.com/magazine/2026-u-s-houzz-and-home-study-renovation-trends-stsetivw-vs~185090855) | 10,176 renovating U.S. homeowners surveyed about 2025 activity | 75% set a budget and 37% exceeded it; upgraded materials and mid-renovation scope expansion were common contributors. | Quantitative pain | Supports budget/change visibility | High for surveyed Houzz population |

The table contains more than six distinct customer conversations or cohorts across a personal
blog, public forums, app-store reviews, and a homeowner survey. Only the first-person blog,
official product pages, and survey were directly readable in this pass.

### Existing alternatives

| Alternative | How customers use it | Strengths | Gaps relative to the chosen opportunity | Price or switching cost | Evidence |
| --- | --- | --- | --- | --- | --- |
| Spreadsheet + folders + messages + camera roll | Budget, lists, quotes, communication, and photos in separate familiar tools | Flexible, familiar, cheap, incremental | Manual linking and reconciliation; weak on-site upkeep; context decays | Often no new cash cost; high migration and habit cost | [First-person account](https://www.create-enjoy.com/2018/03/3-ways-we-budget-for-reno-projects.html), [RenoHub comparison](https://app-renohub.com/blog/best-apps-for-managing-a-home-renovation/) |
| Generic Obsidian vault/plugins | Notes, links, tasks, tables, and files in a user-owned local workspace | Local, extensible, Markdown-native, no proprietary project database | User must invent and maintain renovation semantics, calculations, and guidance | Obsidian is free; setup and ongoing system-building are the main costs | [Obsidian pricing and storage](https://www.obsidian.md/pricing) |
| magicplan | Mobile property capture, floor plans, measurements, documentation, quantities, estimates, and scopes | Mature field workflow; LiDAR; offline mobile use; room-linked quantities | Professional/restoration orientation; cloud project model; less emphasis on homeowner decision history | Two free projects; paid plans start at 10 new projects/month and $40 per overage project on the fetched page | [Pricing/capabilities](https://magicplan.app/pricing), [import workflow](https://help.magicplan.app/import-and-digitalize-an-existing-floor-plan) |
| Planner 5D | Consumer 2D/3D design, furnishing, visualization, and budget exploration | Strong visual design, large catalogue, AI plan conversion, broad reach | Design/visualization remains the centre; execution and property record are secondary | Free; Premium $19.99 monthly or $59.99 annually on 2026-09-09 | [Pricing](https://planner5d.com/pricing) |
| RoomSketcher / Floorplanner | Create, convert, furnish, export, and present floor plans | Mature 2D/3D creation and polished outputs | Models the space more than the renovation lifecycle | Free entry; RoomSketcher Pro $24 monthly or $144 annually; Floorplanner uses credits | [RoomSketcher](https://www.roomsketcher.com/pricing/), [Floorplanner](https://floorplanner.com/pricing) |
| Home Stories / RenoHub / Renosaur / Budget My Reno | Homeowner-oriented budgets, tasks, receipts, photos, rooms, reports, and contractor records | Focused, low-cost, mobile-friendly; some are local/offline | Limited spatial calculation and/or no Obsidian-native knowledge model; several already tell the same "replace spreadsheet chaos" story | Free tiers or low one-time prices; switching is therefore easy | [Home Stories](https://home-stories.12f.dk/), [RenoHub](https://app-renohub.com/blog/best-apps-for-managing-a-home-renovation/), [Renosaur](https://renosaur.app/), [Budget My Reno](https://budgetmyreno.com/) |
| BuildBook / JobTread / Houzz Pro | Builders manage estimates, schedules, changes, clients, documents, and financials | Deep connected workflow and mature change control | Business-first complexity, CRM/accounting concerns, and pricing mismatch for a homeowner | BuildBook Solo $79/month annually; JobTread $199/month plus internal users | [BuildBook](https://www.buildbook.co/pricing), [JobTread](https://www.jobtread.com/pricing), [Houzz Pro](https://pro.houzz.com/for-pros/houzz-pro-features) |
| Doing nothing / memory | Act as issues arise and retain only scattered artifacts | Zero setup | Highest risk of lost decisions, duplicate purchases, inaccessible evidence, and budget surprise | No software cost; potentially high error and reconstruction cost | [[Problem Definition]] |

Prices are point-in-time observations from 2026-09-09 and may change.

### Market context

- Harvard JCHS projects U.S. owner-occupied improvement and maintenance spending to reach
  **$518 billion by the end of 2026**, while growth slows to 1.6% year over year
  ([source](https://www.jchs.harvard.edu/press-releases/remodeling-growth-set-downshift-late-2026)).
- Houzz reports that 54% of its surveyed homeowners renovated in 2025, with median spend of
  $20,000 and 90th-percentile spend of $150,000
  ([source](https://www.houzz.com/magazine/2026-u-s-houzz-and-home-study-renovation-trends-stsetivw-vs~185090855)).

These figures establish a large, active category, not an addressable market for an Obsidian
plugin. The overlap between renovators and Obsidian users is unknown.

### Evidence assessment

- **Strongest supporting evidence:** The same continuity failure appears in firsthand behavior,
  forum accounts, substitute-tool comparisons, and the feature sets of new homeowner renovation
  products. The problem is not lack of isolated tools; it is keeping the relationships current.
- **Strongest counterevidence:** Low-cost homeowner apps now combine budgets, receipts, tasks,
  rooms, photos, and sharing, while magicplan already connects spatial capture to quantities and
  estimates. Continuity is becoming a category expectation, not a unique claim.
- **Important evidence gaps:** No primary interviews; no observed Obsidian renovation workflow;
  no retention, installation, usage, or payment data; no evidence that recommendations improve
  decisions; no validated customer acquisition channel.
- **Access limitations:** Reddit blocked direct retrieval; vendor pages select their own
  testimonials; private communities, app analytics, and paywalled review detail were unavailable.
- **What would change the decision:** If target users show that a spreadsheet plus one mobile
  tracker remains sufficient for six-month, multi-trade projects, or if they reject maintaining
  spatial/context links, continuity should not remain the lead opportunity. If they value
  budgeting but not guidance, the North-Star interpretation layer should be narrowed.

## 3. The business

### Business hypothesis

- **Value proposition:** Give an Obsidian-using homeowner one durable, renovation-aware model
  connecting where work happens to what is required, what it costs, what changed, and what to do
  next—without moving their documents into a proprietary SaaS.
- **Likely buyer and payer:** The homeowner who already uses Obsidian and personally coordinates
  a multi-room, multi-trade, or long-running renovation. This is a hypothesis; no payer research
  exists.
- **Reason to pay:** Reduce repeated reconciliation, missed purchases, budget surprises, and the
  time required to reconstruct context; preserve a useful property record after completion.
- **Copyable in a weekend:** Markdown templates, basic CRUD, a project dashboard, room lists,
  task boards, budget tables, and a simple plan overlay.
- **Harder-to-copy advantage:** A trusted, user-owned renovation knowledge model plus a growing
  body of homeowner-tested decomposition, sequencing, readiness, and next-action rules. The data
  model alone is copyable; the advantage would come from accumulated property history, workflow
  fit, and evidence-backed guidance.
- **Value before the advantage compounds:** Local project structure, spatially derived
  quantities/costs, and linked source documents are useful to the first user with no network or
  proprietary dataset.
- **Path to earning the advantage:** Begin with deterministic and explainable rules, validate
  them against real homeowner artifacts, record where recommendations help or fail, and improve
  the rule/template library without taking ownership of user data.
- **First-customer strategy:** Recruit a small design-partner cohort from Obsidian users already
  undertaking a renovation, starting with the author's real project and the Obsidian community.
  Ask participants to bring their current spreadsheet, photos, quotes, and notes; do not recruit
  only productivity-tool enthusiasts.
- **Disproof experiment:** In four weeks, onboard eight target renovators into the existing
  product or a concierge-assisted vault setup—no new prototype. Success requires at least six to
  represent one live project, four to maintain it for two weeks, four to correctly explain the
  next recommended action and its evidence, and three to commit to a stated one-time price before
  seeing a discount. Failure on maintenance or comprehension disproves the workflow; failure on
  payment weakens the business model even if usability succeeds.

### Why payment remains uncertain

The substitutes set a demanding reference point: spreadsheets and Obsidian are free, several
homeowner trackers offer free tiers, and some charge only a small one-time fee. Local-first
storage may create trust, but trust is not proof of willingness to pay. Pricing should follow the
disproof experiment rather than be inferred from renovation spend.

## 4. The connected plan

The editable plan is [[Renovation Planner Product Discovery.canvas]]. It links evidence,
counterevidence, alternatives, the chosen opportunity, the first-value journey, architecture,
scope, and experiments. External-source cards are links; repository authorities are file cards;
assumption cards are labelled as hypotheses.

### Main user journey

```text
Capture a property area or renovation intention
→ create a valid incomplete project
→ optionally add or import a reference plan
→ identify a Room or Area
→ connect work/material requirements
→ derive quantity and cost with visible provenance
→ expose the most important unresolved decision
→ take or record the next action
→ update the plan while preserving what changed
```

The plan remains optional because the evidence does not justify making spatial modelling a gate
to value.

### Architecture and data flow

The existing SDD already supports the chosen opportunity:

```text
Obsidian workspace views
→ presentation (isolated Vue applications and read models)
→ application commands and queries
→ renovation domain and calculation engines
→ repository ports
→ Obsidian infrastructure
→ Markdown notes + .rpgeo geometry sidecars + plugin settings
```

The vault is the persistent source of truth. Markdown preserves human-readable entities;
geometry sidecars preserve plan-owned spatial data; the project index maps stable IDs to files.
Quantities and costs are derived through explicit pipelines instead of being duplicated. This
supports trustworthy provenance and local ownership, but architecture alone does not produce
useful guidance: work, scheduling, decisions, and next-action rules still require product
validation and later domain support.

### Evidence-led validation sequence

This sequence is a discovery recommendation, not a replacement for the release staging in
`PRODUCT.md`.

1. **Orientation:** Create/open a project, preserve incomplete information, and show what is
   currently known.
2. **Place:** Add a Room or Area directly, or optionally trace a calibrated image/PDF reference.
3. **Consequence:** Attach one material requirement and derive quantity and estimated cost with
   visible source and override status.
4. **Guidance:** Explain one unresolved input and recommend one next action with a reason.
5. **Continuity:** Change one assumption and preserve the relationship between prior plan,
   updated cost, evidence, and decision.

Steps 1–3 substantially overlap the current technical MVP. Steps 4–5 are the critical discovery
gap: without them, the product can validate geometry-driven planning but not the complete North
Star.

### Scope for the next validation

**Included**

- One primary role: an Obsidian-using private homeowner.
- One active renovation project.
- Incomplete project creation.
- Optional image/PDF reference plan.
- One or more Rooms/Areas.
- A material requirement derived from geometry or entered manually.
- Estimated quantity and cost with provenance.
- One explainable next action.
- Preservation of the source artifacts in the user's vault.

**Excluded**

- 3D visualization or photorealistic rendering.
- Contractor CRM, accounting, payments, or marketplace functions.
- Real-time multi-user collaboration.
- Advanced scheduling, procurement automation, AI-generated construction advice, and broad
  property-lifecycle features.
- A new prototype.

### Plan checks

- [x] The chosen customer and core problem are unambiguous.
- [x] Evidence and counterevidence are visible.
- [x] The journey shows a complete outcome rather than isolated features.
- [x] Product surfaces map to steps in that journey through the current product authorities.
- [x] Architecture supports only the scoped workflow.
- [x] The sequence delivers value before advanced capabilities.
- [x] Sources and assumptions are distinguishable.
- [x] The Obsidian Canvas remains editable.

## 5. Prototype

Omitted by instruction. No prototype, prototype scope, simulated behavior, or prototype
verification is claimed.

## 6. Delivery and honest handoff

### Deliverables

- [x] Research paper with original source links and explicit limitations.
- [x] Editable Obsidian Canvas.
- [x] Opportunity and business hypotheses.
- [x] Main workflow and evidence-led validation scope.
- [x] Verification notes.
- [ ] Working prototype — deliberately excluded.
- [ ] Primary research log — not available because no interviews or observations were conducted.

### Verification

| Check | Expected result | Actual result | Status | Evidence |
| --- | --- | --- | --- | --- |
| Source traceability | Every external claim has a source or is labelled an assumption | Direct links are present; inaccessible Reddit evidence is marked | Pass | References and evidence table |
| Minimum conversation coverage | At least six relevant conversations across more than one source | Nine conversation/cohort rows across four source types | Pass with limitation | Customer evidence table |
| Alternative coverage | At least three alternatives including workarounds and doing nothing | Eight alternative categories covered | Pass | Alternatives table |
| Product authority alignment | Vision, problem, scope, and architecture claims match repository authorities | Compared against Product Vision, Problem Definition, PRODUCT.md, capability map, and SDD | Pass | Internal references |
| Prototype | No prototype is created or implied | Section explicitly omitted | Pass | Section 5 |
| Canvas editability | Canvas parses as Obsidian Canvas JSON and uses supported node/edge types | Verified locally after creation | Pass | [[Renovation Planner Product Discovery.canvas]] |
| Primary validation | Findings tested with target homeowners | No interviews, observation, or field trial performed | Not run | Evidence gap |
| Willingness to pay | Target payer commits at a stated price | No pricing experiment performed | Not run | Business hypothesis |

### What the evidence supports

- Renovation planning is a long-lived coordination problem with meaningful financial stakes.
- Fragmentation across familiar tools is recurrent and produces maintenance and retrieval costs.
- Budget, scope, documents, and physical location need to remain connected.
- Homeowners value simple entry, progressive detail, and accessible 2D more consistently than
  advanced visualization.
- A local, connected renovation workspace is plausible for the existing Obsidian audience.

### What remains an assumption

- The reachable Obsidian-renovator segment is large enough to sustain the product.
- The current domain backbone matches homeowners' natural organization.
- Users will maintain the structure during active construction.
- Explainable next actions create more value than a well-organized record alone.
- Local-first and open files are purchase drivers rather than appreciated attributes.
- The proposed advantage can compound faster than competitors copy visible workflows.

### What was not verified

- No target user was interviewed or observed.
- No participant supplied a real vault, quote, plan, budget, or renovation timeline.
- No recommendation was tested for correctness, comprehension, trust, or action.
- No acquisition, retention, conversion, or price experiment ran.
- No live Obsidian walkthrough was performed as part of this paper.

### Recommended next experiment

Run eight artifact-led interviews before adding breadth. Ask each participant to show the actual
tools and files used for one renovation and reconstruct one decision from room to quote to cost
to evidence. Then ask them to organize the same live case in the existing plugin and interpret
one deterministic next-action recommendation. The experiment should measure setup time,
information omitted, maintenance willingness, recommendation comprehension, and a real price
commitment. This tests the opportunity without creating a prototype.

## References

### Internal authorities and syntheses

- [[Product Vision]]
- [[Problem Definition]]
- [[Product Capability Map]]
- [[Product Discovery Blueprint]]
- [[renovation-planner-user-research-synthesis]]
- [[renovation-planner-competitive-market-landscape]]
- `PRODUCT.md`
- `docs/development/sdds/obsidian-renovation-planner-SDD.md`

### External sources

- Harvard Joint Center for Housing Studies,
  [Remodeling Growth Set to Downshift in Late 2026](https://www.jchs.harvard.edu/press-releases/remodeling-growth-set-downshift-late-2026),
  revised 2026-04-15.
- Houzz Research,
  [2026 U.S. Houzz & Home Study: Renovation Trends](https://www.houzz.com/magazine/2026-u-s-houzz-and-home-study-renovation-trends-stsetivw-vs~185090855),
  2026-04-22.
- Create / Enjoy,
  [3 ways we budget for reno projects](https://www.create-enjoy.com/2018/03/3-ways-we-budget-for-reno-projects.html).
- [magicplan pricing and capabilities](https://magicplan.app/pricing) and
  [existing-plan import workflow](https://help.magicplan.app/import-and-digitalize-an-existing-floor-plan).
- [Planner 5D pricing](https://planner5d.com/pricing).
- [RoomSketcher pricing](https://www.roomsketcher.com/pricing/).
- [Floorplanner pricing](https://floorplanner.com/pricing).
- [Home Stories](https://home-stories.12f.dk/).
- [RenoHub comparison](https://app-renohub.com/blog/best-apps-for-managing-a-home-renovation/).
- [Renosaur](https://renosaur.app/).
- [Budget My Reno](https://budgetmyreno.com/).
- [BuildBook pricing and capabilities](https://www.buildbook.co/pricing).
- [JobTread pricing](https://www.jobtread.com/pricing).
- [Houzz Pro features](https://pro.houzz.com/for-pros/houzz-pro-features).
- [Obsidian pricing and local-storage statement](https://www.obsidian.md/pricing).

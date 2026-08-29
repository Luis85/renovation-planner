# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — the private renovator.** Someone renovating their own house, apartment, garden
or property, planning it themselves rather than handing it to a general contractor. They
are already an Obsidian user: the vault is where their notes, photos and documents live,
and the plugin has to belong there rather than open a second world beside it. Their job,
in their words: *when I renovate my property, I want to see all planned measures spatially
and connected to costs and tasks, so that I always know what must be done where, what it
costs, and how far along it is.*

**Secondary — the advanced DIY planner.** The same person further in, needing material
requirements, measurements, quantities, shopping lists, suppliers, price comparisons and
dependencies rather than only a map of intentions.

**Confirmed: two audiences, weighted equally.** The author's own renovation and public
release on the Obsidian community marketplace are both binding from the start. Every
surface must work for a stranger in an unfamiliar vault — a different theme, a different
language, no knowledge of the domain model — not only for the person who wrote the spec.
That is what makes onboarding, empty states and terminology load-bearing rather than
polish.

**Not users yet.** Small contractors, interior designers, landscape planners, owner-side
consultants and facility managers are named in the PRD as a *future* persona and are
explicitly outside current scope. Designing for them now is scope the user has not asked
for.

## Product Purpose

The plan of a house or property becomes the spatial index of the entire renovation
project.

Renovation information is normally scattered across drawings, spreadsheets, task apps,
quotes, invoices, photos, notes, calendars and project plans, and the spatial relationship
between all of it is lost. The plugin imports a floor plan, site plan or sketch,
calibrates it to real-world scale, and lets the user mark rooms, areas, construction
sections and assets on it — spatial objects connected to structured Obsidian data rather
than isolated drawings.

Success is that a user can answer, from one surface: what should change, where, what work
and which trades that implies, what quantities and costs follow from the geometry, what
has already been executed, and what the final as-built state is.

## Positioning

**Geometry drives planning.** A marked terrace of 42.7 m², times a waste factor of 1.08,
times €34.95/m², produces a material quantity and a cost. The spatial object is not a
picture of the plan; it is an input to it. A neighbouring product could copy the drawing
surface or the cost table, but not the claim that the two are one model.

**The visualization is not the database.** Markdown files and their properties remain the
persistent source of truth; the visual editor is a projection and interaction surface over
them. Everything stays human-readable, versionable, portable, searchable and editable
outside the plugin, with no proprietary database and no cloud dependency for core
functionality.

**Progressive complexity.** A user never has to produce a full digital floor plan. The
smallest useful path is: import an image → calibrate → mark areas → connect project
information.

## Operating Context

The user works inside Obsidian, in their own vault, on a project that runs for months.
Planning happens at a desk; execution happens on site, where the same vault is consulted
rather than edited spatially.

The work itself is national: local trades, local price references, local paperwork.
Obsidian is already localized and the reader has already chosen their language, so a
German vault showing an English plugin reads as broken rather than foreign. English and
German are the current locales.

The domain vocabulary the product commits to — the nouns users and future surfaces share:
project, plan, zone, construction section, asset, trade, work package, task, cost item,
quantity, supplier, quote, procurement, document, decision, risk, milestone, revision,
as-built.

Native Obsidian concepts are used where useful rather than reinvented: Markdown,
properties, links, embeds, Bases, commands, workspace views, search and tags. Spatial
objects must stay reachable *without* the canvas — from notes, Bases rows, lists and
dashboards — and navigable from there back into the plan.

## Capabilities and Constraints

**Confirmed device scope: desktop-first, mobile read-only.** The plan editor, canvas,
drawing and calibration tools are desktop surfaces. On Obsidian mobile the project data
stays readable — notes, lists, budgets, task views — but no surface requires touch
drawing. `manifest.json` keeps `isDesktopOnly: false`, and that promise is now bounded
rather than open: this resolves the PRD's §105 open question, and mobile *parity* is
explicitly not the target.

**Confirmed accessibility standard: WCAG 2.2 AA** — see `## Accessibility & Inclusion`.

Scope is staged, and the stage matters because a surface designed for a later stage is
scope the product has not reached:

- **MVP** — project, plan, image/PDF background, calibration, pan/zoom, polygon zones,
  construction sections, basic assets, measurements, geometry calculations, basic
  requirement calculation, €/piece · €/m · €/m², basic budget aggregation, Markdown
  persistence, Obsidian links, undo/redo.
- **V1** — trades, work packages, tasks, schedule, suppliers, quotes, procurement,
  planned vs actual costs, documents, photos, progress, project dashboard.
- **V2** — scenarios, alternatives, change management, risks and issues, plan revisions,
  existing vs target state, as-built state, advanced geometry, spatial queries, forecast,
  reporting, extended import/export.

**Explicit non-goals.** The product does not replace CAD, BIM, structural engineering
software, architectural design, permitting software, professional estimating suites,
accounting, construction ERP, professional site management, or multi-user cloud
collaboration. 3D and automated architectural design are out.

**Technical constraints future work must respect.** TypeScript, Vue 3, Pinia and Konva on
Vite, tested with Vitest; Obsidian 1.13.0 is the floor. The layered architecture in
`docs/development/sdds/obsidian-renovation-planner-SDD.md` §8 is enforced by lint, not convention, and
the SDD is the authority over any guide that disagrees with it. Nothing writes to the
vault outside `infrastructure/`. Settings are declarative. Marketplace rules apply:
sentence-case UI text, no inline styles, no global `app`, `normalizePath` on user paths.

**Units and currency are the project's, not the reader's.** Internal precision and display
precision are separate — lengths normalize to mm, areas to mm², volumes to mm³, and a
value is formatted for display rather than stored rounded. A project defines its own
currency; a translated plugin still shows that currency, not the reader's.

**Localization.** Every user-visible string resolves through the pure `t(language, key)`
lookup in `src/presentation/i18n/`. English is the complete table and derives the key
type; German is partial and falls back per string. The language comes from Obsidian's own
`getLanguage()` — the plugin deliberately offers no language setting of its own.
`manifest.json` name and description stay in English as published.

**Open, and not to be invented:** which locales beyond English and German; regional
fallback (`de-AT` → `de`), which arrives with the first regional locale; whether a demo
project ships (PRD §95 leaves it optional).

## Brand Commitments

Published identity, fixed by the marketplace listing: the name **Renovation Planner**, the
plugin id `renovation-planner`, the description "Plan a renovation as a work breakdown of
rooms, trades and tasks, with budgets and a schedule.", and author Luis85.

**Voice: sentence case, plain, no exclamation.** This is a marketplace rule before it is a
preference, and it is linted in `src/presentation/i18n/locales/en.ts`. German noun
capitalization sits deliberately outside that rule.

**The host's appearance wins.** The plugin lives inside someone else's themed vault, so it
adopts Obsidian's own variables rather than asserting a palette over them.

No logo, wordmark, colour system or typographic identity exists or has been committed.

## Evidence on Hand

**Confirmed: nothing real yet.** There is no real renovation project, no floor plan or site
plan image, no photographs, no quotes or invoices, and no cost data. Every screen, every
screenshot and every example must use clearly invented sample content, and must be labelled
as such. Future work must not present invented rooms, prices, suppliers, quantities or
timelines as though they came from a real project, and must not fabricate testimonials,
users, benchmarks or adoption numbers — there are none.

The PRD's §95 example project does not exist; it would have to be authored, and that is an
undecided product fact rather than an available asset.

What *does* exist to design against: the PRD (`docs/product/prds/`), the SDD (`docs/development/sdds/`), 109
requirement notes in `docs/requirements/`, and a working scaffold whose one view renders an
empty mount point. `npm run harness` draws the real view against Obsidian's default
app.css in a browser — faithful about markup, spacing, hierarchy and Obsidian's default
colours, not about a themed vault's colours or accent.

## Product Principles

1. **Markdown is the source of truth; the visuals are a projection.** Any surface that
   would only make sense with a hidden database behind it is the wrong surface.
2. **Geometry produces project information.** Where a number can be derived from a shape,
   deriving it beats asking for it — and where it is derived, the surface must say so.
3. **Progressive complexity.** The first useful result must be reachable in four steps.
   Depth is available, never required, and never a precondition for value.
4. **Obsidian native, host-deferential.** Reuse the app's concepts, commands, theming and
   language choice instead of building a parallel world inside a tab.
5. **Nothing is canvas-only.** Every spatial object stays reachable, understandable and
   actionable from a list, a note or a Bases row — this is an accessibility requirement
   and a mobile-scope requirement at the same time.

## Accessibility & Inclusion

**Binding target: WCAG 2.2 AA.** Every surface is designed and audited against it rather
than against the qualities alone.

Product-specific requirements that outrank convenience, because the canvas is where they
are easiest to lose:

- full keyboard support, including the plan editor's own operations, with a visible focus
  indicator at every stop;
- no status, state or category encoded by colour alone — a zone's state, a task's status
  and a budget's health each need a second channel;
- an alternative list or table route to everything the canvas offers, per principle 5;
- sufficient contrast against *both* Obsidian's light and dark defaults, and degrading
  legibly under a user's custom theme rather than assuming ours.

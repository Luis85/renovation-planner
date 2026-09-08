---
type: Task
parent: "[[The project surface]]"
order: 11
dependsOn:
  - "[[21-the-project-detail-state]]"
status: Active
started: "2026-09-08"
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# 22 — Project entry guidance and the three open Resume/mobile contracts

The design package `docs/user-experience/renovation-planner-project-specs/` was implemented by
pull request #73 (WP-00 to WP-05). Measured against the package on 2026-09-08, one visible gap and
three recorded-open contracts remain. This task closes those four and nothing else. The package's
own documents are the authority: `interaction-concept.md` §6–§8, `states-and-navigation.md`,
`ui-copy.md`, and the four requirement notes each task names.

## Global constraints

- `npm run check:fast -- <touched test files>` between edits; the controller runs the full
  `npm run check` once before the branch is finished. Never two gates at once.
- Every user-visible string goes through `tr()` with an English key in
  `src/presentation/i18n/locales/en/*.ts` and a German twin in `de/*.ts`. The parity test
  (`tests/presentation/i18n/strings.test.ts`) fails on a missing twin. English strings are sentence
  case (ESLint `obsidianmd/ui/sentence-case-locale-module`). A `{placeholder}` is interpolated by
  `tr`'s second argument, never by string concatenation.
- No `obsidian` import outside `infrastructure/` and `plugin/`; `Platform` is reached in views
  only where `RenovationProjectView.ts:348` already reaches it, or through a `readOnly` prop.
- No hard-coded colour in `styles/`; partials stay under 400 lines; every `<button>` class gets a
  `:focus-visible` rule (`tests/build/buttonFocusRing.test.ts`).
- Test files stay under 450 lines. Split beside an existing top-level `describe` when one would
  cross it.
- Every `docs/requirements/*.md` note a task touches gets its "Project-surface implementation"
  section extended with a dated paragraph saying what closed and what is still open. Never
  declare a guarantee wider than the test that holds it.
- Commit per task with a message in the repository's imperative style, ending with
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

### Task 1: Three entry-path cards on the project detail state

**Spec:** P01 and P02 in `docs/user-experience/renovation-planner-project-specs/screens/`,
`interaction-concept.md` §6–§7, `ui-copy.md`. Requirement note:
`docs/requirements/Choose the next step from a project's details.md`.

**Current state:** `src/presentation/views/ProjectDetail.vue` draws `.rp-project-guidance` as a
toggle, an `<h3>` title, one `<p>`, and three bare buttons (prices, schedule, quotes).
`ProjectDetailState.vue` seeds `guidanceHidden` from `context.session` and mirrors it back on
toggle. `ProjectDetailState` never reads `context.continueContext()`; only `ViewRoot.vue:138`
does. `PlanList.vue` exposes no focus API.

**Behaviour to build**

1. Two variants, decided by ONE fact: `isNew = plans.length === 0 && unreadablePlans === 0 &&
   plansFailure === null`. A failed or partly unreadable plan read is never "new".
2. Heading: `isNew` → `view.project.guidance-start-title`; otherwise the existing
   `view.project.guidance-title`. Under the heading, on `isNew` only, one `<p>` with
   `view.project.guidance-optional-plan`.
3. Three entries, each an element carrying an `<h4>` title, a `<p>` benefit line, and exactly one
   `<button>` action. No nested interactive elements, no decorative chevron with a focus stop.
   Order and primary action differ by variant, and are otherwise stable:
   - `isNew`: note (primary, class `mod-cta`), plan, prices.
   - active: plan (primary), note, prices.
4. Entry contents:
   - Note: `entry-note-title`, `entry-note-body`, action `entry-note-action` → emit `openNote`.
   - Plan, `isNew`: `entry-plan-start-title`, `entry-plan-start-body`, action `entry-plan-create`
     → emit `createPlan`.
   - Plan, active with a valid last plan: `entry-plan-continue-title`, `entry-plan-continue-body`,
     action `entry-plan-open` with `{ planName }` → emit `openPlan(lastPlan.id)`.
   - Plan, active without one: same title and body, action `entry-plan-choose` → focus the first
     enabled plan row through `PlanList`'s new `focusFirst()`.
   - Prices: `entry-prices-title`, `entry-prices-body`, action `view.project.prices-open` (whose
     value changes to "View prices") → emit `prices`.
5. The plan entry's action button is `:disabled="readOnly"` (mobile). The note and prices actions
   stay enabled on mobile.
6. Hide guidance: the toggle keeps its position and labels become
   `view.project.guidance-hide` = "Hide getting-started guidance" /
   `view.project.guidance-show` = "Show getting-started guidance". When hidden, the heading,
   optional-plan line, entry titles and benefit lines are not rendered; the three action buttons
   remain, drawn in one compact row, in the same order and with the same labels and emits. The
   existing Schedule and Quotes buttons stay as a second compact row in both states. Nothing about
   the plan list, notices or empty state changes with the toggle.
7. Last plan: `ProjectDetailState.vue` reads `context.continueContext()` in the same hydrate that
   lists plans; `lastPlan` is the `PlanSummaryDto` whose id equals the stored `planId` when the
   stored `projectId` equals `props.projectId` and that plan is in the readable list, else `null`.
   Passed to `ProjectDetail` as a prop. A stale hydrate (ticket mismatch) never writes it.
8. `PlanList.vue`: `defineExpose({ focusFirst })` where `focusFirst()` focuses the first
   `.rp-plan-list__row:not([disabled])` and returns whether it found one. Give the `<ul>` a
   template ref for the lookup.
9. Remove the `view.project.guidance-body` key from both locales; nothing else uses it.

**Locale keys** (en / de), all in `locales/en/projectNavigation.ts` and
`locales/de/projectNavigation.ts`:

| key | en | de |
| --- | --- | --- |
| `view.project.guidance-title` (existing) | What would you like to do next? | Was möchtest du als Nächstes tun? |
| `view.project.guidance-start-title` | What would you like to start with? | Womit möchtest du beginnen? |
| `view.project.guidance-optional-plan` | You can start with a note. A floor plan is optional. | Du kannst mit einer Notiz beginnen. Ein Grundriss ist keine Voraussetzung. |
| `view.project.guidance-hide` | Hide getting-started guidance | Einstiegshilfe ausblenden |
| `view.project.guidance-show` | Show getting-started guidance | Einstiegshilfe anzeigen |
| `view.project.entry-note-title` | Describe your renovation | Renovierung beschreiben |
| `view.project.entry-note-body` | Record what should change and which questions remain. | Halte fest, was sich verändern soll und welche Fragen offen sind. |
| `view.project.entry-note-action` | Open project note | Projektnotiz öffnen |
| `view.project.entry-plan-start-title` | Start with a plan | Mit einem Plan beginnen |
| `view.project.entry-plan-start-body` | Draw a floor plan or use an available reference. | Zeichne einen Grundriss oder nutze eine vorhandene Referenz. |
| `view.project.entry-plan-create` | Create first plan | Ersten Plan anlegen |
| `view.project.entry-plan-continue-title` | Continue with a plan | Am Plan weiterarbeiten |
| `view.project.entry-plan-continue-body` | Pick up where you left off, or open any plan below. | Mach dort weiter, wo du aufgehört hast, oder öffne einen Plan aus der Liste. |
| `view.project.entry-plan-open` | Open {planName} | {planName} öffnen |
| `view.project.entry-plan-choose` | Choose a plan | Plan auswählen |
| `view.project.entry-prices-title` | Set project prices | Projektpreise festlegen |
| `view.project.entry-prices-body` | Add your own prices when you know them. | Hinterlege eigene Preise, sobald du sie kennst. |
| `view.project.prices-open` (existing, new value) | View prices | Preise ansehen |

**Styles:** new classes use the `rp-project-detail__entry` prefix (`__entries`, `__entry`,
`__entry--primary`, `__entry-title`, `__entry-body`, `__entry-action`, `__entry-row` for the
compact hidden state) so `tests/presentation/views/projectDetail.test.ts`'s "declares a rule for
every class it actually emits" covers them. Entries stack vertically at every width (spec §11:
"entry paths are vertical"). Rules live in `styles/project-detail.css` (255 lines today, cap 400),
using Obsidian variables only.

**Harness:** add a `?plans=<n>` knob (`tests/harness/page.ts` → `HarnessMountOptions.plans` in
`tests/harness/mount.ts`) that seeds the detail fixture with that many plans instead of the
default 26, and one capture `project-detail-new` (`?project=project-1&plans=0`) in
`scripts/harness-shot.mjs`, keeping `tests/build/harness-shot.test.ts` and
`tests/harness/harnessSurfaces.test.ts` green.

**Tests** (jsdom, mounting `ProjectDetailState` through the existing helpers in
`tests/presentation/views/projectExperience.test.ts` and `projectEntryBoundaries.test.ts`; add a
new file `tests/presentation/views/projectEntryGuidance.test.ts` rather than growing either past
450 lines):
- new project draws the start heading, the optional-plan line, note first and primary, "Create
  first plan" emitting create; active project draws the next heading, plan first and primary.
- a partially unreadable or failed plan read never draws the start variant.
- stored context for THIS project with a readable plan draws "Open {name}" and opening it calls
  `context.openPlan` with that id; stored context for another project, or a plan not in the list,
  draws "Choose a plan".
- "Choose a plan" moves `document.activeElement` to the first plan row.
- hiding guidance removes titles and bodies, keeps all three action buttons and the schedule and
  quotes buttons, flips `session.guidanceHidden`; showing restores them.
- on `readOnly`, the plan action is disabled and note and prices actions are not.
- update the two existing cases that match literal guidance text or `.rp-project-guidance`.

**Docs:** in `docs/requirements/Choose the next step from a project's details.md`, add a dated
paragraph under "Project-surface implementation" naming the three entries and the variant rule.

#### Amendments (2026-09-08, as built)

1. **`rp-project-detail__entry--primary` was NOT emitted.** Priority is carried by `mod-cta` on the
   first entry's action, which is what `ProjectEntryAction`'s own `priority` prop means in the
   component library — and a wrapper class with no rule fails
   `projectDetail.test.ts`'s "declares a rule for every class it actually emits", while a rule
   invented to satisfy it would be visual design this task was not asked to make. The four other
   `__entry*` classes are emitted and styled.
2. **`view.project.prices-open`'s button keeps `.rp-project-prices-open` beside
   `.rp-project-detail__entry-action`.** That selector is older than the entry it now sits in and
   two checks key on it, so the entries carry an optional extra class rather than a rename
   rippling through tests this task is not about. Neither of the two existing cases the brief
   expected to update actually needed changing: the active variant still draws
   `view.project.guidance-title`, and the schedule/quotes pair is still inside
   `.rp-project-guidance`. Watched green rather than assumed.

### Task 2: Clear the stored Resume target on a reliably missing project

**Spec:** `states-and-navigation.md` "Resume resolution" step 5; requirement note
`docs/requirements/Continue when the last plan is unavailable.md` extension 2d, whose
"Project-surface implementation" section records this as open.

**Current state:** `ContinueContextStore` (`src/infrastructure/obsidian/plugin-data/continueContextStore.ts`)
has `read` and `write` only. `RenovationProjectContext` has `continueContext` and
`rememberContinue`, no forget. `ViewRoot.vue` `resolveStored()` sets `'missing-project'` at the
branch where `indexScanCompleted()` is true and `getProject` answered `ok(null)`, and leaves the
store untouched. `tests/presentation/views/projectExperience.test.ts` has an `it.each` over
`['project-error', 'project-missing', 'plan-error', 'plan-unreadable']` asserting
`rememberContinue` is not called.

**Behaviour to build**

1. `ContinueContextStore.clear(): Promise<void>` writes `null` through the same adapter `write`
   uses, with the same swallow-and-warn shape (`continue-context.clear-failed`). `read` already
   answers absent for a non-object.
2. `forgetContinue: () => void` on `RenovationProjectContext` beside `rememberContinue`, with a
   docblock saying it fires only on a reliably missing project: index scan complete AND
   `getProject` answered `ok(null)`. Threaded through `src/plugin/composition-root.ts`'s options
   and `renovationProjectDeps`, bound in `src/plugin/RenovationPlannerPlugin.ts` beside
   `rememberContinue`, and defaulted to `vi.fn()` in `tests/helpers/makeRenovationProjectView.ts`.
3. `ViewRoot.vue` `resolveStored()`: on the missing-project branch call `context.forgetContinue()`
   before setting `resumeState.value = 'missing-project'`. The explanation still draws for this
   mount. Indexing, unreadable and missing-plan branches do not call it.
4. Nothing else clears: `onResume`'s `'failed'` opening and `resolvePlan`'s outcomes are untouched.

**Tests**
- store: `clear` writes null and a following `read` answers `null`; a throwing adapter is logged
  under `continue-context.clear-failed` and does not reject.
- `projectExperience.test.ts`: move `project-missing` out of the keep-recoverable table; add one
  case asserting `forgetContinue` is called exactly once on a reliably missing project and never
  on indexing, read failure, missing plan, or a `'failed'` opening.
- `tests/plugin/renovationProjectWiring.test.ts` (or the file that binds `rememberContinue`):
  `forgetContinue` reaches the store's `clear`.

**Docs:** extend the requirement note's "Project-surface implementation" with a dated paragraph:
extension 2d now closed on the project surface; real-vault acceptance still open.

### Task 3: The palette's plan open records the Resume target

**Spec:** requirement note `docs/requirements/Resume the last plan on a confirmed opening.md`,
main flow step 1 ("from the palette") and its "Project-surface implementation" paragraph naming
palette-originated opens as open.

**Current state:** `src/plugin/planEditorCommands.ts` `openPlanPicker` calls
`void revealPlanEditor(...)`, discarding its `'opened' | 'failed'` result, and never records the
continue context. `ProjectIndexEntry` carries `projectId?` (`src/application/ports/ProjectIndex.ts`).
The store binding is `RenovationPlannerPlugin.ts:737`. `src/plugin/renovationProjectOpenSeams.ts`'s
`renovationProjectOpenPlan` already wraps `revealPlanEditor` with the same fault reporting.

**Behaviour to build**

1. `openPlanPicker` routes through `renovationProjectOpenPlan(host.app.workspace, host.root.logger)`
   instead of its own inline `revealPlanEditor` call, so the palette and the project surface share
   one door.
2. On `'opened'`, and only when the picked entry has a `projectId`, call a
   `rememberContinue(context: ContinueContext)` the plugin hands to `registerPlanEditorCommands`
   — the same closure bound at `RenovationPlannerPlugin.ts:737`. Extend the registration's
   parameters or `PluginCommandHost` (`src/plugin/commandHost.ts`), whichever is smaller; a
   `'failed'` result records nothing. The detached activation still goes through the existing
   fault path; do not add a second `.catch`.
3. Editor hydration confirmation stays out of scope; the adopted contract is "leaf opened"
   (execution record decision 3).

**Tests** in `tests/plugin/planEditorCommands.test.ts`: picking a plan whose reveal answers
`'opened'` remembers `{ projectId, planId }`; `'failed'` remembers nothing; an entry with no
`projectId` remembers nothing. Keep the registration-locality test green.

**Docs:** extend the requirement note's "Project-surface implementation": palette opens now
recorded on a confirmed leaf open; asynchronous hydration confirmation still open.

### Task 4: Mobile — disabled with reason on supported surfaces, refused with reason on desktop-only ones

**Spec:** requirement note `docs/requirements/Bound the mobile surface to what it can actually do.md`
extensions 2a and 4a, and its acceptance criteria. `PRODUCT.md` device scope. `ui-copy.md` row
"Read-only explanation where needed".

**Current state:** `Platform.isMobile` is read at `RenovationPlannerPlugin.ts:353` (`new-project`
checkCallback) and `RenovationProjectView.ts:348` (`readOnly`). On the project surface the
`readOnly` flag HIDES the create-asset, New project, create-named, New asset, New plan and price
edit controls (`v-if="!readOnly"`), DISABLES plan rows and the Resume button, and silently returns
from the handlers. No reason text exists in any locale. `PlanEditorView.ts` and
`src/presentation/designer/AssetDesignerView.ts` never consult the platform. The palette commands
`open-plan-editor`, `set-plan-background` (`planEditorCommands.ts`), `open-asset-designer`
(`assetDesignerCommands.ts`) and `create-sample-project` (`sampleProject.ts`) have no mobile guard.

**Behaviour to build**

1. Locale keys in a NEW pair `locales/en/mobile.ts` / `locales/de/mobile.ts`, merged where the
   other pairs are:
   - `view.mobile.read-only`: "Available for viewing on mobile. Changes need a desktop." /
     "Auf Mobilgeräten zum Ansehen verfügbar. Änderungen brauchen einen Desktop."
   - `view.mobile.desktop-only`: "This surface is not available on mobile. Open it on a desktop." /
     "Diese Ansicht ist auf Mobilgeräten nicht verfügbar. Öffne sie auf einem Desktop."
2. Desktop-only surfaces: `PlanEditorView.ts` and `AssetDesignerView.ts`, when `Platform.isMobile`,
   draw one `<p class="rp-view-message">` with `view.mobile.desktop-only` inside their content
   element and mount no Vue app; `onClose` stays safe with nothing mounted. The check is read
   through the same import the project view already uses.
3. Supported surface (the project pane): one notice `<p class="rp-view-notice rp-mobile-notice">`
   with `view.mobile.read-only`, drawn once at the top of `ViewRoot.vue` when `readOnly`, carrying
   an id built with `app-id-prefix.ts`. Every control that today disappears under
   `v-if="!readOnly"` is instead rendered `:disabled="readOnly"` with
   `:aria-describedby` pointing at that id; the id travels as a prop or through the existing
   context. Controls already disabled (plan rows, Resume) gain the same `aria-describedby`. Empty
   states keep their action label but the button is disabled the same way. Handlers keep their
   early returns.
4. Palette: the four commands above get `checkCallback` guards returning `false` on
   `Platform.isMobile`, in the shape `new-project` already has, without changing any command id.
5. Manual case `docs/tests/cases/Read projects on mobile.md` in the shape of the sibling cases:
   steps for overview, detail, prices, a plan row, the palette, and a restored editor leaf; an
   expected result per step; an empty Runs table. It is the real-device measurement the note
   demands and no gate here performs.
6. Left out deliberately, and written into the note as still open: the asset library's write
   controls, which have their own design package and hook.

**Tests**
- `tests/presentation/views/*`: with `readOnly`, every formerly hidden control is present,
  disabled, and `aria-describedby` resolves to the notice; with `readOnly` false, no notice and
  nothing disabled. Update the existing cases that assert absence.
- Plan editor and designer view tests: with `Platform.isMobile = true` (the mock's mutable
  member; reset it in `afterEach`), `onOpen` draws the refusal and mounts nothing; with `false`,
  unchanged.
- `tests/plugin/*`: the four commands' `checkCallback` answers `false` on mobile and their
  existing behaviour on desktop.
- Harness accessibility: the notice and the disabled controls pass axe in the existing
  `tests/harness/accessibility.test.ts` scan if the harness can set `readOnly`; if it cannot,
  say so in the report rather than adding a knob.

**Docs:** extend the requirement note's "Project-surface implementation" with a dated paragraph:
disabled-with-reason on the project surface, refusal on editor and designer, palette guards,
manual case written and unrun; asset library and real-device measurement still open.

## Acceptance criteria

- [x] Task 1: entry cards, variants, last-plan naming, choose-a-plan focus, hide/show, `?plans=`
      knob and `project-detail-new` capture.
- [x] Task 2: `forgetContinue` fires exactly on a reliably missing project.
- [x] Task 3: palette open records the target on `'opened'` only.
- [x] Task 4: mobile notice and disabled controls, editor and designer refusal, palette guards,
      manual case written.
- [ ] Four requirement notes extended; `npm run check` green once before the branch is finished.

## Outcome

Filled in when the branch is finished.

---
type: Feature
parent: "[[Cross-cutting concerns]]"
order: 10
status: Active
started: 2026-08-23
finished: ""
horizon: Now
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
release: "[[MVP]]"
---

# User Interface

Two documents draw this product's screen. PRD §39 draws a toolbar, three columns and a
status bar; SDD §60 draws the same box again. **They are not the same drawing**, and the
three places they differ are the whole argument for this Feature: the left column's third
row is `Library` in one and `Assets` in the other, the centre is `Plan` in one and
`Plan Canvas` in the other, and the status bar reads `Status / Selection / Measurements`
in one and `Status / Measurements / Save State` in the other. Neither document is wrong —
both are received, both stay verbatim — so a screen author reading either one has to pick
a name, and the two authors who read different ones have named the same panel twice.

That is one surface. The two documents together name **thirteen**: SDD §11 lists six
workspace views (Renovation Project and Plan Editor now, Budget, Schedule, Procurement and
Dashboard later), SDD §13 lists six Bases views, and PRD §41 lists seven — the same six
plus Work Packages, with Risk and Risks disagreeing on number. Six plus seven is thirteen
surfaces named, the two documents disagree about which Bases views exist, and exactly one
of the thirteen has a layout. In `src/` today exactly one is registered, and it draws an
empty div.

Then the requirement that multiplies the rest. PRD §40 asks that spatial objects stay
accessible without the canvas, and PRD §44 and SDD §85 both ask for "alternative data
access via lists" — so every surface holding something spatial owes a second route to the
same facts. Nothing in either document says whether that route is a Bases view, a
workspace view of its own, or a pane inside the editor, so each screen would have answered
it locally and differently.

**Three of those questions are now decided, and the evidence above is deliberately left as
it was.** The counts are statements about the received documents, which have not changed and
never will — they are kept verbatim. What changed is that the register now answers them:
[[The alternative list route is a Bases view]] settles the route for every spatial surface at
once and makes it the mobile surface too;
[[Budget, Schedule and Procurement are Bases views first]] collapses three of the thirteen
from duplicates into single rows with a named trigger for promotion; and
[[The plan editor is a mode, not a second view]] makes SDD §11's two primaries one view type.
Each is an `Issue` recording what it rejected, which is what keeps the decision arguable
rather than merely historical.

## Why this is cross-cutting rather than one epic's work

The epic's admission test is whether a concern appears in all twenty product epics or is
the thing they are all measured by. This one is the first kind, and plainly: the plan
editor, the cost engine, procurement and the schedule each draw screens, and none of them
owns what a screen is made of. Written into whichever epic reaches it first, the
answer arrives as a precedent to imitate rather than a rule to argue against — the epic's
own sentence about being decided twenty times and differently, applied to the one concern
where the imitation is visible to the user.

The other three costs are worth naming because the note should claim these and not others.
The nineteenth screen copies the eighteenth, because there is nothing else to copy. The
alternative-list routes have no home, so they get bolted onto finished screens. And public
release is binding (`PRODUCT.md`), which means a stranger meets these surfaces in an
unfamiliar theme with unfamiliar vocabulary, where incoherence reads as a broken plugin
rather than an unfinished one.

## Two actors, and which deliverable serves which

**The renovator** gets a plugin they can find their way around: a surface they have not
opened before is recognisable, and getting from a note to the plan and back is one known
move rather than a search. The Sitemap is theirs, and the Information Architecture is
theirs in the half that decides what things are called.

**The maintainer** — whoever builds screen nineteen — gets a vocabulary to build against
instead of a precedent to copy. The Design System is theirs, and the Information
Architecture is theirs in the half that decides where a fact lives.

Both are written down here because the sibling at order 0 had to admit its outcome was the
maintainer's alone, and this one would be dishonest either way round: a Feature claiming
only the renovator's benefit hides why a design system is in it, and one claiming only the
maintainer's hides why a sitemap is.

## What it does not own

- **[[User Experience]]** owns behaviour over time — progressive disclosure, and which of the
  fifteen steps a renovator four months in is shown. A screenshot can settle a question in
  this Feature; only a sequence can settle one in that Feature. **Two things an earlier
  version of this line got wrong**, both corrected at the source rather than softened here:
  first run is **not** UX's — PRD §93, §94 and §95 are
  [[Onboarding and example project]]'s, claimed by name — and PRD §5 is not a loop, it is
  fifteen steps in a straight line with no return arrow. PRD §53 is the loop, and it has
  nine. [[Disclosure ladder]] reconciles all five drawings.
- **[[Accessibility]]** owns §44's list itself: keyboard support, visible focus, contrast,
  colour-independence, and the requirement that the alternative route exist. This Feature
  owns where that route lives, not whether it is owed.
- **[[Multilanguage]]** owns every string. A component defined here names its copy through
  `t`; the words are not this Feature's.
- **[[Architecture and Software Design]]** owns the layers underneath. `presentation/` is
  its structure (SDD §7.5), and a component here is a Vue component because ADR-004 said
  so, not because this Feature chose.
- **[[Shared UI vocabulary]]**, the PBI beneath this Feature, owns which surface a given
  failure *gets* — the routing rules connecting error categories to toasts, inline errors,
  modals and status badges, and the five slices that build them. The Design System owns
  what those surfaces *are*. Each cites the other rather than restating it.

## The reference is Obsidian's own app

Where the host already answers a question, the answer is the host's: panes, tabs, the
ribbon, the settings pane, Bases, the command palette, and the CSS variables of §84. This
is not modesty, it is the same argument as `t` reading `getLanguage()` — the reader has
already chosen, and a plugin that re-decides inside its own tab is the only foreign thing
in their vault. The deliverables record how to defer at least as often as they invent.

## The three deliverables, and the question each answers

| Deliverable | Answers |
| --- | --- |
| [[Information Architecture]] | Where does a given fact belong, and what is it called? |
| [[Sitemap]] | Which surfaces exist, and how does someone get between them? |
| [[Design System]] | What is a control made of, and what are its states? |

Each holds the artifact itself rather than a promise of one — derived, citing the PRD and
SDD sections it was read from, and expected to change as the design is refined. A
refinement that contradicts its source names the section it refines and lands in the
deliverable or an ADR, never in `docs/product/prds/` or `docs/development/sdds/`. That is the contract the
seventeen slices already carry, and `docs/README.md` now records it for this type too.

## What holds this, and what does not

Written to the check rather than ahead of it, because a claim lint cannot reach is the same
defect as a comment nothing tests.

**Checked today, and more of it than a first reading suggests.**
`eslint-plugin-obsidianmd` refuses inline styles and validates the manifest;
`--max-warnings 0` makes the mobile-safety rule a gate; the stylesheet assembler fails the
build on a partial no entry file imports and on a partial over 400 lines.
`tests/harness/cssVars.test.ts` sweeps every `var(--x)` the partials read against what the
three harness sheets declare — Obsidian's vendored `app.css` among them — so "every colour
comes from an Obsidian variable" is a checked sentence rather than a comment.
`tests/harness/accessibility.test.ts` runs axe against the real mounted view.

**And the ceilings, because each of those is narrower than its name.** The variable sweep
catches a name nothing declares; it does **not** catch a hardcoded hex, which declares
nothing and reads nothing. It reads declarations rather than the cascade, and ignores the
scheme. The axe run reaches semantics only: contrast throws under jsdom, `target-size`
reports a false pass because jsdom answers zero for every box, and axe has no
focus-indicator rule at all. [[Design System]] states both ceilings in full and this note
does not widen them.

**Writable, and named as the next check rather than as a fact.** A `no-restricted-syntax`
rule refusing a hardcoded colour or spacing literal in `styles/**` where an Obsidian
variable exists — the shape `WRITE_BOUNDARY` and `SVG_CLASS_TOKENS` already use, naming
the spellings the selector sees. It is the second half of the pair above, and it is the
half that does not exist.

**Not checked, and this is the honest sentence rather than a missing one.** Nothing can
verify that the Sitemap lists every registered view, or that a fact lives where the
Information Architecture says. The instrument that would is the fifth gate `CLAUDE.md`
lists as deliberately absent — `npm run docs`, whose "every module in `src/` specified by
at least one note" is exactly this check — and section 5 of
[`setup/quality-harness.md`](../setup/quality-harness.md) describes what building it costs.
Until it exists, these two deliverables are held by review.

**Not checkable here at all.** Appearance under a community theme, a hotkey firing, hit
targets under a real pointer. Those become `Test case` notes carrying a cadence, because
the browser harness is faithful about markup, spacing and hierarchy and about Obsidian's
*default* colours only.

## Outcome

Every surface the plugin adds has a name, a place and a vocabulary decided before it is
drawn, so a renovator recognises a screen they have not opened before and the author of the
nineteenth one has something to build against rather than a precedent to copy.

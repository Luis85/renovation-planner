---
type: Feature
parent: "[[Cross-cutting concerns]]"
order: 80
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Architecture and Software Design

The SDD runs to ninety-three sections and most of them are about no product epic at all.
§2 states the architectural goal — the vault is the persistent source of truth, and Vue,
Pinia and Konva are replaceable presentation technologies. §7 names the five layers and §8
gives the dependency rule, with three invalid arrows spelled out beside the valid ones:
domain → obsidian, geometry engine → konva, cost engine → pinia. §76 asks for automated
architecture tests. §§77–81 fix the repository structure, the internal module pattern, the
public boundaries, the naming conventions and the TypeScript rules. §89 records ten
architecture decisions and §92 lists fifteen criteria by which the whole foundation is
judged. None of that is the plan editor's work, and none of it is the cost engine's, and
all twenty product epics are built on it.

That is the second of this epic's two admission clauses rather than the first. Structure
does not appear *inside* every product epic the way text does or the way a typed error
does; it is the thing they are all measured by, which is the other half of the sentence and
the half this Feature is here on.

**Its outcome is the maintainer's, not the renovator's, and that is written down rather
than dressed up.** Somebody planning their own bathroom never observes the dependency rule
holding. What they eventually observe is a consequence they cannot attribute — that the
nineteenth screen behaves like the first, that a cost is the same number wherever it is
asked, that a broken file cost them one project and not the plugin. Every other Feature
under this epic promises something the reader can see; this one cannot, and phrasing it in
a user's terms would make it the one note in the folder whose Outcome is a fiction.

The record it owns has a direction, and the direction is the rule. The SDD is **received**
and stays verbatim, so a note citing §8 cites something that has not been edited to agree
with it. `docs/tasks/` holds seventeen **derived** slices, expected to change as the
design is refined, each naming the SDD sections it derives from. `docs/adrs/` holds what
was actually **decided**, and where a decision and the SDD disagree the ADR is what holds.
That is not hypothetical: ADR-0011 makes the geometry sidecar's folder and extension
configurable, which is nowhere among §89's ten. A refinement that contradicts its source
lands in a slice or an ADR and never in `docs/sdds/` — `docs/tasks/README.md` states that
rule and is where to read it in full.

What separates this Feature from a paragraph about good structure is how little of the SDD
argues for itself. §8's dependency rule is `no-restricted-imports`, per directory, in
`eslint.config.mjs`; §76 asks that `domain/**` refuse `vue`, `pinia`, `konva` and
`obsidian`, and the config refuses all four in `core/`, `domain/` and `application/` —
wider than the SDD asked. §76 offered two tools and the first was taken, which is a choice
with no ADR behind it. `WRITE_BOUNDARY` in the same file catches the case the layer bans
cannot see, a vault write from a view or the composition root, and the config names the
spellings its selectors do see and the ones they cannot. Then there is the part no linter
reaches: of §92's fifteen criteria, "Konva stores no canonical business data", "vault files
remain understandable without the plugin" and "new views can reuse the same
application/domain layers" are judgements about a design, checked by reading it against a
slice. Naming which criteria are lint's and which are review's is the work here, because a
criterion nobody has assigned is a criterion everybody assumes somebody else holds.

Beneath this Feature is where the slices become work, and they now do. Each of the seventeen
is scoped to be implemented, tested and reviewed on its own, which is a `Task` in this
register's own vocabulary — engineering work with evidence, an approach and acceptance
criteria — so each carries `type: Task` and this note as its `parent`, lives in `docs/tasks/`
(the folder the view files a `Task` into) and appears under this Feature in the tree.

The ladder skips a rung, deliberately: `Feature` → `Task`, with no `PBI` between them. The
backlog's type rules are advisory — a declared type is the type a note keeps, however oddly
it sits — so nothing is refused, and inventing seventeen PBIs to hold one slice each would be
a rung carrying no information. No `order` is set either, so the seventeen tie and the view
settles a tie by its configured sort, which is filename: `01-` through `17-`, the reading
order. That is a property of the view's setting rather than of these notes, so they need
explicit `order` values before that sort is changed.

Two boundaries. **The quality harness is not this Feature.** `npm run check`, the coverage
ratchet, the browser harness, the live-vault checks and the release pipeline are tooling
that holds the design; they are documented in `CLAUDE.md` and `docs/setup/`, and the epic
that once ranked them against the product is deleted rather than re-parented here. And the
ADRs are not backlog items either — an ADR is a decision with consequences and a
revisit-when, not a rank among siblings. A change under this Feature answers the SDD, a
slice or an ADR. Nothing here is a licence to restructure code that already satisfies all
three.

## Outcome

A structural question — which layer owns this, what may import what, what was decided
instead and what it cost — has one answer, in one place, and a violation of the layer rule
is refused by lint rather than noticed in review.

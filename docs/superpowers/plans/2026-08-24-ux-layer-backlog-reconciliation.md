# UX-layer / backlog reconciliation ledger — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one findings ledger at `docs/reviews/2026-08-24-ux-layer-backlog-reconciliation.md` reconciling the UX layer on `main` against the 227-note derived backlog, without editing a single derived note.

**Architecture:** An enumerable inventory of two row kinds in two directions, resolved through a five-state ladder into four finding kinds. The mechanical halves (named-thing lookup, behavioural candidate sets, every count) are produced by scripts whose output is checked against stated numbers; the judged halves (does this note address this claim, do these two disagree) are read by a human-or-agent inside bounded candidate sets and recorded per row. Working rows live in the scratchpad as TSV; the ledger prints counts and findings, not the matrix.

**Tech Stack:** bash, `grep`/`awk`/`diff`, `python3` for TSV aggregation. No new dependency — `npm run analyze` fails on an unimported package, and nothing here needs one.

**Spec:** [`docs/superpowers/specs/2026-08-24-ux-layer-backlog-reconciliation-design.md`](../specs/2026-08-24-ux-layer-backlog-reconciliation-design.md) — frozen 2026-08-24. Read it before Task 1; every task argues from it and quotes it where a number is claimed.

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include this section.

- **No derived note is edited.** The ledger is the whole deliverable. `git status` must show no change under `docs/requirements/`, `docs/entities/`, `docs/business-rules/`, `docs/components/`, `docs/actors/`, `docs/deliverables/`, `docs/adrs/`, `docs/issues/` at every commit.
- **Eight evidence bodies, not eight files** — the workspace PRD; the prototype's own §§1–16; the UXD §§1–34; the wireframe appendix; the JTBD backlog; the canvas concept's own §§1–783; the user research synthesis; `component-gallery.html`. Each read **once**, at one location, whichever files repeat it.
- **Derived scope: 227 notes, 11,342 lines** across the eight note types.
- **Evidence: 5,719 distinct lines** = 1451 + 285 + 682 + 459 + 424 + 783 + 1635.
- **Out of scope:** the competitive market landscape (873 lines); the 17 design slices in `tasks/` (14,763 lines); the HTML concept pages beyond the gallery; the seventeen screenshots.
- **Five states**, resolved by a fixed 4-rung ladder: `superseded` → `contradictory` → `present` → (forward) `absent` / (reverse) `retained`.
- **Four finding kinds**: `Contradiction`, `Gap`, `Orphan`, `Convention`. `Retained` is a **state, not a finding**.
- **Behavioural matching is two stages** and only the candidate set is mechanical. Never write "absence is mechanical" unqualified.
- **Rows and findings are counted separately.** A mirrored disagreement is two rows and one finding.
- **Direction/standing** per finding is `received`, `derived`, or `undetermined`. Seven of the eight evidence bodies are `undetermined` until the owner classifies `docs/user-experience/` **and** `docs/product/`; a finding carrying `undetermined` proposes no edit.
- **The original PRD and the SDD are a reference corpus**, never evidence bodies: read where a finding cites them, never swept for rows, contributing to no count.
- **`npm run check` must show no failure this pass introduced.** `main` is red in all four steps. Baseline by stashing and re-running; compare `lint` **sorted** (oxlint's order is nondeterministic) and compare `analyze` like-for-like (it reads `coverage/coverage-final.json`, so it is downstream of `test:coverage`).

## Working files

Scratchpad (`$SP` = `/tmp/claude-0/-home-user-renovation-planner/eb9111e3-de19-484d-bb01-ce9975d6628a/scratchpad/ledger`), **not committed** — these are the ledger's working material, and the spec authorises one output file only. If the counts should be publishable, that is a one-file addition to ask the user about, not a decision to take mid-pass.

| File | Responsibility |
| --- | --- |
| `corpus.sh` | Emits the eight body ranges; verifies both nestings by diff; prints the scope counts |
| `candidates.sh` | Given a direction and subject terms, prints the candidate-set paths and its size |
| `bodies/` | The eight evidence bodies materialised once over their ranges — what makes "read once, at one location" mechanical, and the corpus a reverse row is matched against |
| `rows.tsv` | Every row, both directions, both kinds — the matrix |
| `aliases.tsv` | The alias table, output of Task 2, input to Task 4 |
| `findings.tsv` | Coalesced findings with pair identity |
| `verify-dod.sh` | Every Definition-of-Done count, printed as `claimed vs measured` pairs |

Committed: `docs/reviews/2026-08-24-ux-layer-backlog-reconciliation.md` — and nothing else.

### `rows.tsv` schema — fixed in Task 1, relied on by Tasks 2–7

Tab-separated, one header line:

```
id	direction	kind	subject	source	terms	cand_n	matched	state	pair	target
```

- `id` — `f<N>` forward, `r<N>` reverse
- `target` — named rows only: which derived note type would hold this thing —
  exactly ONE of `entities|requirements|components|actors|deliverables`. Reverse rows take the
  type of the note they came from. `-` on behavioural rows.

  **A thing the extraction rule maps to two consumers becomes two rows, one per consumer**,
  ids suffixed `f376a`, `f376b`. A screen goes to `requirements` **and** `deliverables`, and
  those are not alternatives: searching their union settles the row `present` on a hit in
  either, so a screen with a deliverable mention and no Feature or PBI behind it can never
  become a `Gap`.

  That is not hypothetical — it silently defeated the spec's own worked example. `Project
  Home` appears in **0** notes under `requirements/` and **1** under `deliverables/`
  (`MVP Prototype.md`). The union lookup scored it `present`; the spec built the
  `requirements/` × named-thing cell precisely so that "a screen the new evidence names with no
  Feature or PBI behind it" would surface, and named `Project Home` as the example. Split by
  consumer it reads `absent` against `requirements` and `present` against `deliverables`, which
  is the finding. Three rows in this corpus were affected, all of them `Project Home`.
- `direction` — `forward` | `reverse`
- `kind` — `named` | `behavioural`
- `subject` — the item or claim, one line, no tabs
- `source` — `body§section` (forward) or `path::locator` (reverse)
- `terms` — normalised subject terms, comma-separated
- `cand_n` — candidate-set size; `-` for named rows
- `matched` — **the addressing claim's full citation**, not merely its file: `<path>::<locator>`
  on a forward row, `<body>§<section>` on a reverse one. Or `-`.

  The path alone cannot build a pair key. Pair identity is the ordered pair of *citations*, and
  Task 5 needs a forward row and its mirrored reverse row to produce byte-identical
  `EVIDENCE>>DERIVED` strings. A forward row holding only `docs/entities/Space.md` and a reverse
  row holding `docs/entities/Space.md::Rules[1]` never collide, so the two halves of one
  disagreement are counted as two findings and the coalesced-pair count — which the ledger
  prints as a directly-counted number — is wrong by however many mirrors failed to meet.
- `state` — `present|absent|contradictory|superseded|retained`
- `pair` — pair-identity key `evidence_source>>derived_path::locator`, or `-`

---

### Task 1: Corpus harness and the numbers everything else is checked against

**Files:**
- Create: `$SP/corpus.sh`
- Create: `$SP/rows.tsv` (header only)

**Interfaces:**
- Consumes: nothing.
- Produces: `corpus.sh body <name>` printing `path:start:end` for each of the eight bodies; `corpus.sh counts` printing the six scope numbers; the `rows.tsv` header above.

- [ ] **Step 1: Write the check that must fail first**

```bash
mkdir -p "$SP" && cat > "$SP/check-corpus.sh" <<'EOF'
#!/usr/bin/env bash
# Every number here is quoted from the frozen spec. Measured must equal claimed.
cd "$(git rev-parse --show-toplevel)"
fail=0; chk(){ [ "$2" = "$3" ] && echo "  ok   $1: $3" || { echo "  FAIL $1: claimed $2, measured $3"; fail=1; }; }
chk "derived notes"  227   "$(find docs/requirements docs/entities docs/business-rules docs/components docs/actors docs/deliverables docs/adrs docs/issues -type f | wc -l | tr -d ' ')"
chk "derived lines"  11342 "$(find docs/requirements docs/entities docs/business-rules docs/components docs/actors docs/deliverables docs/adrs docs/issues -type f -exec cat {} + | wc -l | tr -d ' ')"
# Measured from the tree, never from a sum of the same constants it is checked against.
# Each sub-range is anchored to the structural heading that ends it, so a body that grows
# moves the measurement instead of agreeing with it.
ln(){ grep -n "$2" "$1" | head -1 | cut -d: -f1; }
UX=docs/user-experience; PR=docs/prds; PD=docs/product
proto="$UX/renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md"
wf="$UX/renovation-project-workspace-wireframes.md"
cv="$UX/renovation-canvas-concept-interaction-design.md"
chk "evidence lines" 5719 "$((
    $(wc -l < "$PR/renovation-project-workspace.md")
  + $(( $(ln "$proto" '^# Appendix A') - 1 ))
  + $(wc -l < "$UX/renovation-project-workspace-UXD.md")
  + $(( $(wc -l < "$wf") - $(ln "$wf" '^# Appendix A') + 1 ))
  + $(wc -l < "$UX/renovation-planner-JTBD-research-backlog.md")
  + $(( $(ln "$cv" '^# Comprehensive User Research Synthesis') - 1 ))
  + $(wc -l < "$PD/renovation-planner-user-research-synthesis.md") ))"
chk "gallery lines"  842  "$(wc -l < "$UX/concepts/component-gallery.html" | tr -d ' ')"
exit $fail
EOF
chmod +x "$SP/check-corpus.sh"
```

- [ ] **Step 2: Run it to see it fail**

Run: `bash "$SP/check-corpus.sh"`
Expected: FAIL on nothing yet — this one should already pass, and that is the point: it pins the spec's numbers to the tree *before* any inventory work, so a later drift in `main` is caught as a corpus change rather than mistaken for an extraction bug. If it fails now, `main` has moved: re-measure, update the spec's Scope, and say so before continuing.

- [ ] **Step 3: Write `corpus.sh` with the body ranges and both nesting proofs**

```bash
cat > "$SP/corpus.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
R="$(git rev-parse --show-toplevel)"
UX="$R/docs/user-experience"; PR="$R/docs/prds"; PD="$R/docs/product"
body() { case "$1" in
  prd)        echo "$PR/renovation-project-workspace.md:1:1451" ;;
  prototype)  echo "$UX/renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md:1:285" ;;
  uxd)        echo "$UX/renovation-project-workspace-UXD.md:1:682" ;;
  wireframes) echo "$UX/renovation-project-workspace-wireframes.md:685:1143" ;;
  jtbd)       echo "$UX/renovation-planner-JTBD-research-backlog.md:1:424" ;;
  canvas)     echo "$UX/renovation-canvas-concept-interaction-design.md:1:783" ;;
  research)   echo "$PD/renovation-planner-user-research-synthesis.md:1:1635" ;;
  gallery)    echo "$UX/concepts/component-gallery.html:1:$(wc -l < "$UX/concepts/component-gallery.html" | tr -d ' ')" ;;
  *) echo "unknown body: $1" >&2; exit 2 ;; esac }
nesting() {
  # The prototype nests TWO bodies, not one: the UXD at 290-971, and the WHOLE wireframes file
  # at 290-1432 (of which the UXD is itself the first part). Verifying only the inner one left
  # the outer claim unchecked — and it is the outer one deduplication depends on, because
  # materialisation takes the wireframe appendix from the standalone file. If the two copies
  # ever diverged, `nesting` would still pass while the pass silently read one version and
  # claimed to have deduplicated the other. Measured today: identical, and 285 + 4 + 1143 =
  # 1432 accounts for every line of the prototype file.
  diff <(sed -n '290,1432p' "$UX/renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md") \
       "$UX/renovation-project-workspace-wireframes.md" >/dev/null \
    && echo "  ok   prototype contains the WHOLE wireframes file verbatim" \
    || { echo "  FAIL prototype/wireframes nesting"; return 1; }
  diff <(sed -n '290,971p' "$UX/renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md") \
       "$UX/renovation-project-workspace-UXD.md" >/dev/null \
    && echo "  ok   prototype contains UXD verbatim" || { echo "  FAIL prototype/UXD nesting"; return 1; }
  diff <(sed -n '784,2418p' "$UX/renovation-canvas-concept-interaction-design.md") \
       "$PD/renovation-planner-user-research-synthesis.md" >/dev/null \
    && echo "  ok   canvas contains research synthesis verbatim" || { echo "  FAIL canvas/research nesting"; return 1; }
}
# Write each body ONCE to $SP/bodies/<name>.txt over its own range. This is what makes
# "each body read once, at one location" mechanical rather than a promise, and it is the
# corpus a reverse row is matched against — see candidates.sh.
materialise() {
  local d; d="$(dirname "$0")/bodies"; mkdir -p "$d"
  for n in prd prototype uxd wireframes jtbd canvas research gallery; do
    IFS=: read -r f a b <<< "$(body "$n")"
    sed -n "${a},${b}p" "$f" > "$d/$n.txt"
    printf '  %-11s %6s lines\n' "$n" "$(wc -l < "$d/$n.txt" | tr -d ' ')"
  done
}
case "${1:-}" in
  body) body "$2" ;;
  nesting) nesting ;;
  counts) bash "$(dirname "$0")/check-corpus.sh" ;;
  materialise) materialise ;;
  *) echo "usage: corpus.sh {body <name>|nesting|counts|materialise}" >&2; exit 2 ;;
esac
EOF
chmod +x "$SP/corpus.sh"
printf 'id\tdirection\tkind\tsubject\tsource\tterms\tcand_n\tmatched\tstate\tpair\ttarget\n' > "$SP/rows.tsv"
```

- [ ] **Step 4: Run all four subcommands**

Run: `bash "$SP/corpus.sh" nesting && bash "$SP/corpus.sh" counts && bash "$SP/corpus.sh" body canvas && bash "$SP/corpus.sh" materialise`
Expected: two `ok` nesting lines; **four** `ok` count lines (the fourth is the gallery at 842); `…/renovation-canvas-concept-interaction-design.md:1:783`; and eight body files whose lengths are `1451 285 682 459 424 783 1635 842` — the seven Markdown bodies summing to the 5,719 the counts check measured, plus the gallery, which is HTML and is deliberately outside that Markdown total.

**The gallery's range is measured, not written down.** An earlier version of this harness returned `1:0` for it — an empty range, from which Task 3 would sweep nothing while the plan went on claiming all eight bodies covered. That is this project's recurring defect in its purest form: a claim wider than the mechanism under it. The range is now `wc -l` of the file, so a gallery that grows is swept whole.

**Why the nesting check is a gate and not a note:** the corpus has produced this defect twice. If a third nested file arrives, this check fails loudly instead of the pass reading the same claims twice and reporting the repetition as coverage.

- [ ] **Step 5: Commit** — nothing to commit; the harness is scratchpad-only. Record in the task log that `corpus.sh nesting` and `counts` both pass, with their output pasted.

---

### Task 2: Named-thing rows, presence by lookup, and the alias table

Implements spec order steps 1–2. One task because the alias table is both an **output** of the
lookup and an **input** to it, and that circularity is the point: you learn `DIY Renovator` has
no note while `Private renovator` does *by doing the lookup*, and you cannot settle either row
until you know they are the same actor. So the lookup runs **twice** — provisional, then
re-resolved through the aliases. Settling presence in one pass would file `DIY Renovator` as a
**Gap** and `Private renovator` as `retained`: two fabricated findings that are really one
rename.

**Files:**
- Modify: `$SP/rows.tsv` (append **both** `f<N>` and `r<N>` rows with `kind=named`)
- Create: `$SP/aliases.tsv`

**Named rows are created in both directions in this task, not just forward.** Step 6 below
re-resolves a *reverse* named row sitting at `retained?` when an alias says the evidence used
a different word — `Private renovator` is the worked example. If reverse named rows are not
built until Task 3, that branch has nothing to act on and no later step re-runs it, so
`Private renovator` stays `retained` while `DIY Renovator` is already `present` against it:
half of the rename resolved, the other half fabricating a state. The alias pass has to see
both sides of a rename at once, which is the same circularity the two-pass lookup exists to
break — one direction lower down.

**Interfaces:**
- Consumes: `corpus.sh body <name>` from Task 1.
- Produces: `aliases.tsv` with columns `evidence_term	derived_term	note_path	relation` where `relation` ∈ `same|renamed|split|collapsed`. **There is deliberately no `absent`
  relation.** An alias row exists to say two names denote one thing; a row saying they do not
  is not an alias, and the presence index is built from every row it is given — so an `absent`
  row would add its evidence term to the index and flip the very forward row from `absent?` to
  `present`, suppressing exactly the Gap it was recording. A thing with no counterpart gets no
  alias row at all, and its `absent` state stands; named rows in `rows.tsv` with `state` set.

- [ ] **Step 1: Write the presence lookup and its expected output for the known cases**

```bash
cat > "$SP/lookup.sh" <<'EOF'
#!/usr/bin/env bash
# Presence of a named thing in the note type that WOULD hold it.
#
#   lookup.sh "<name>" "<target[,target...]>"
#
# Searching all five types for every category is what makes a gap invisible. The extraction
# rule maps concepts to entities/, components to components/, actors to actors/, screens to
# requirements/ and deliverables/, artifacts to deliverables/ — so a component the new
# evidence names, with no note in components/, is a GAP even though a requirement mentions it
# in passing. Measured, not hypothetical: `Toolbar` and `Inspector` each appear in
# requirements/ as well as components/, so an all-five search would settle such a row
# `present` on the strength of a note that is not the one the thing is missing from.
cd "$(git rev-parse --show-toplevel)"
n="$1"; IFS=',' read -ra tg <<< "${2:-entities,requirements,deliverables,components,actors}"
dirs=(); for t in "${tg[@]}"; do dirs+=("docs/$t"); done
printf '%s\t%s\t' "$n" "$2"
grep -rliF -- "$n" "${dirs[@]}" 2>/dev/null | tr '\n' ',' | sed 's/,$//'
echo
EOF
chmod +x "$SP/lookup.sh"
```

- [ ] **Step 2: Run it against the four cases the spec already measured**

Run:
```bash
for n in "Planner Home" "Spaces View" "Space Detail" "Project Home"; do
  bash "$SP/lookup.sh" "$n" requirements,deliverables; done
```
Expected: the first three print the term and an empty last field; `Project Home` prints `docs/deliverables/MVP Prototype.md`. This reproduces the spec's `0, 0, 0, 1` and proves the lookup before it is trusted on unknown terms. All four are screens, so `requirements,deliverables` is their mapped target — and the check must also be run once with no target argument, against all five, to confirm the two agree for these four. Where they ever DISAGREE, the type-aware answer is the right one and the difference is a gap the all-five search would have hidden.

- [ ] **Step 2a: Strip repository back-links, BEFORE any presence is looked up**

The materialised gallery is HTML and links back to the very notes it is being compared against:

```html
<a href="../deliverables/Design%20System.md">Design System</a>
```

A literal `grep` counts that as the evidence naming `Design System`. It is not — it is the
evidence pointing AT the derived note, which is the one thing that cannot be evidence the note
has a counterpart in the new layer. Scored naively, a deliverable with no standing in the new
evidence comes back `present` on the strength of its own hyperlink.

```bash
mkdir -p "$SP/bodies-search"
for f in "$SP"/bodies/*.txt; do
  sed -E 's#<a href="\.\./(deliverables|components|entities|requirements|actors|business-rules|adrs|issues)/[^"]*">[^<]*</a>##g' \
    "$f" > "$SP/bodies-search/$(basename "$f")"
done
```

Reverse named presence is looked up in `bodies-search/`, never in `bodies/`. Behavioural
candidate sets keep using `bodies/` — a back-link is not a behavioural claim either way, and
narrowing the guard to the lookup it was measured against is the point.

**Narrow by measurement, not by taste.** Exactly three lines in the whole corpus match, all in
`gallery.txt`, and exactly one row changes: `Design System`, whose only hit was its own link.
`Disclosure ladder` KEEPS its hit — it appears in the gallery's own navigation as a link to a
sibling concept page, which is the evidence genuinely using the term. A guard that had removed
both would have manufactured a `retained` as surely as the missing guard manufactured a
`present`.

**Order is the whole point of this step, and it was wrong once.** This used to sit at Step 4a,
after Step 3 had already looked up every reverse name and Step 4 had verified their provisional
states — and nothing re-ran them. `Design System` would have stayed `present?` on the strength
of its own hyperlink, and Step 6 would merely have removed the question mark, laundering a
false positive into a settled state. A sanitising step placed after the thing it sanitises is
not a guard; it is a comment. It runs before Step 3 now.

- [ ] **Step 3: Extract named things in both directions and append rows**

**Forward** — read each body over its range from `corpus.sh body` (use the materialised
`$SP/bodies/<name>.txt`, which is that range and nothing else). Extract, per the spec's
producing rule: **concepts** (→ `entities/`), **screens and views** (→ `requirements/`,
`deliverables/`), **components** (→ `components/`), **actors and personas** (→ `actors/`),
**named artifacts** (→ `deliverables/`). Provisional state is `present?` on a hit,
`absent?` on none.

**Reverse** — every named thing the 227 derived notes hold gets an `r<N>` row of
`kind=named`, checked against the evidence bodies. Provisional state is `present?` where the
evidence uses the word, `retained?` where it does not. These are the rows Step 6's mirror
branch resolves, and they must exist before it runs.

**Where a note's identity lives differs by type**, measured across the corpus rather than
assumed:

| note type | declares `name:` | identity comes from |
| --- | --- | --- |
| `entities/` (34), `actors/` (8), `components/` (17) | all of them | the `name:` frontmatter |
| `requirements/` (121), `deliverables/` (5) | **none of them** | the H1 title, or the filename where a note has no H1 |

Taking `name:` universally would produce reverse named rows for 59 notes and none for the 126
that need them most — every screen and every artifact. The failure would be silent: the
behavioural pass still reaches all 227 notes, so the coverage gate passes, while every reverse
screen and artifact row, and any orphan among them, simply never exists.

`deliverables/MVP Prototype.md` is the worked case for the fallback — it has neither `name:`
frontmatter nor an H1, jumping straight from frontmatter to `## 1. Prototype Mission`, so its
identity is its filename.

Append one row per item:

```
f1	forward	named	Planner Home	uxd§28	planner home	-	-	absent?	-	requirements
r1	reverse	named	Private renovator	docs/actors/Private renovator.md::name	private renovator	-	-	retained?	-	actors
```

Eleven fields, including `target`. **Write `-` for an empty field, never leave it blank**: a
downstream shell pass read these rows with `IFS=$'\t' read`, and because tab is an IFS
*whitespace* character bash collapses a run of tabs into one delimiter — so a blank field
disappears and every field after it shifts left. It happened here: `pair` and `target` were
silently emptied on all 2,364 behavioural rows, and one named row's target ended up in its pair.
Subject, source and terms sit before any blank field, which is why nothing looked wrong.

Write a **provisional** state only: a hit → `present?`, no hit → `absent?`, both with the
question mark. Nothing is settled until Step 6 re-resolves through the aliases. Leave
`contradictory`/`superseded` for Task 5 — a named row can still turn out to disagree once its
behaviour is read.

Do **not** stop at the terms the spec already names. `Screen Component & Interaction State Specification` (wireframes §A.23) is a named artifact with no deliverable note, and it is in the plan because the spec found it, not because it is the only one.

- [ ] **Step 3a: Give every named row its target type**

A named row cannot be looked up until it is known which note type would hold it, and **each row carries exactly one target**. Forward rows take theirs from the extraction rule that produced them:

| The extraction rule maps… | to target(s) |
| --- | --- |
| concepts | `entities` |
| components | `components` |
| actors and personas | `actors` |
| named artifacts | `deliverables` |
| **screens and views** | **`requirements` AND `deliverables` — emit TWO rows**, ids suffixed `a` and `b` |

Reverse rows take the directory of the note they came from, which is always one type.

**A screen becomes two rows here, not one row with two targets.** The two consumers are not alternatives, and writing them into one field re-creates the union lookup by the back door: a screen present in `deliverables/` and absent from `requirements/` scores `present` and its missing Feature never becomes a `Gap`. That is the spec's own worked example — `Project Home`, 0 notes in `requirements/`, 1 in `deliverables/`. Verify no row carries a union, and none is missing a target:

```bash
awk -F'\t' 'NR>1 && $3=="named" && $11 ~ /,/ {n++} END{print "named rows carrying a union target (must be 0):", n+0}' "$SP/rows.tsv"
```


```bash
awk -F'\t' 'NR>1 && $3=="named" && ($11=="" || $11=="-") {n++} END{print "named rows with no target (must be 0):", n+0}' "$SP/rows.tsv"
```

- [ ] **Step 4: Verify every named row has a state and the known cases match**

Run:
```bash
awk -F'\t' 'NR>1 && $3=="named" && $9=="" {bad++} END{print "named rows missing a provisional state:", bad+0}' "$SP/rows.tsv"
awk -F'\t' 'NR>1 && $3=="named" {n[$9]++} END{for (s in n) print s, n[s]}' "$SP/rows.tsv"
```
Expected: `0` missing, and every state still carrying its `?`. A named row without a question
mark at this point is one that skipped the alias pass.

- [ ] **Step 5: Write the alias table from what the lookup exposed**

```bash
printf 'evidence_term\tderived_term\tnote_path\trelation\n' > "$SP/aliases.tsv"
printf 'DIY Renovator\tPrivate renovator\tdocs/actors/Private renovator.md\trenamed\n' >> "$SP/aliases.tsv"
printf 'Advanced Renovator\tAdvanced DIY planner\tdocs/actors/Advanced DIY planner.md\trenamed\n' >> "$SP/aliases.tsv"
printf 'Professional Planner\tProfessional planner\tdocs/actors/Professional planner.md\tsame\n' >> "$SP/aliases.tsv"
printf 'space\tSpace|Outdoor area|Zone\tdocs/entities/Space.md\tcollapsed\n' >> "$SP/aliases.tsv"
```

Those four are established by the spec. Add every further alias the Step 3 lookup exposed. `collapsed` is the important relation: it is what makes the behavioural matcher in Task 4 able to find a derived note that uses the backlog's word for the evidence's umbrella term.

- [ ] **Step 6: Re-resolve named presence through the alias table**

For every row still marked `absent?`, check its term against `aliases.tsv`. A `renamed`, `same`
or `collapsed` relation means the thing **is** present under another name: set `present`, and
record the alias in `matched`. Only a term with no alias and no hit becomes `absent`.

Then do the mirror, which is the half that is easy to forget: a **reverse** named row sitting at
`retained?` because the evidence never used its word is `present` if an alias says the evidence
used a different one. `Private renovator` is exactly that row.

```bash
awk -F'\t' -v OFS='\t' 'NR==FNR{if(FNR>1){a[tolower($1)]=$3; nb=split($2,B,"|"); for(j=1;j<=nb;j++) b[tolower(B[j])]=$3} next}
  FNR==1{print;next}
  $3=="named" && $9=="absent?"  && (tolower($4) in a){$9="present"; $8=a[tolower($4)]; print; next}
  $3=="named" && $9=="retained?" && (tolower($4) in b){$9="present"; $8=b[tolower($4)]; print; next}
  {sub(/\?$/,"",$9); print}' "$SP/aliases.tsv" "$SP/rows.tsv" > "$SP/rows.next" && mv "$SP/rows.next" "$SP/rows.tsv"
awk -F'\t' 'NR>1 && $9 ~ /\?$/ {n++} END{print "rows still provisional (must be 0):", n+0}' "$SP/rows.tsv"
```

Expected: `0` provisional rows; `DIY Renovator` now `present` against
`docs/actors/Private renovator.md` rather than standing as a fabricated `Gap`; and the mirror
of it, the reverse row for `Private renovator`, `present` rather than a fabricated `retained`.

The reverse index is built by **splitting `derived_term` on `|`**, not by using the field
whole. The `collapsed` row's derived side is `Space|Outdoor area|Zone` — three terms in one
field — and keying on the unsplit string produces a key no row's subject can ever equal, so
every collapsed alias would resolve forward and silently fail to resolve in reverse.

- [ ] **Step 7: Commit** — scratchpad only, nothing to commit. Record the named-row count, the alias count, and how many rows the alias pass moved off `absent?`/`retained?` — that number is the count of findings a single-pass lookup would have invented.

---

### Task 3: Behavioural rows, forward from the evidence and reverse per claim

Implements spec order step 3.

**Files:**
- Modify: `$SP/rows.tsv` (append `f<N>` with `kind=behavioural`, and all `r<N>` rows)

**Interfaces:**
- Consumes: `corpus.sh body`, `rows.tsv` schema.
- Produces: every behavioural row in both directions, `state` still empty — Tasks 4–6 fill it.

- [ ] **Step 1: Write the corpus-coverage check that must fail now**

```bash
cat > "$SP/check-coverage.sh" <<'EOF'
#!/usr/bin/env bash
cd "$(git rev-parse --show-toplevel)"
SP="$(dirname "$0")"
# TWO numbers, because one cannot carry both jobs and the first is already satisfied
# before this task runs. Task 2 now writes a reverse NAMED row per note, so counting every
# reverse row reports 227/227 before a single behavioural claim has been extracted — the
# check would pass at the moment it is written to fail, and would go on certifying coverage
# with the whole behavioural inventory missing.
any=$(awk -F'\t' 'NR>1 && $2=="reverse" {split($5,a,"::"); print a[1]}' "$SP/rows.tsv" | sort -u | wc -l | tr -d ' ')
beh=$(awk -F'\t' 'NR>1 && $2=="reverse" && $3=="behavioural" {split($5,a,"::"); print a[1]}' "$SP/rows.tsv" | sort -u | wc -l | tr -d ' ')
echo "notes reached by ANY reverse row:         $any  /  227   <- DoD 1b"
echo "notes reached by a reverse BEHAVIOURAL row: $beh  /  227   <- what THIS task builds"
[ "$any" = "227" ] && [ "$beh" = "227" ]
EOF
chmod +x "$SP/check-coverage.sh"
```

- [ ] **Step 2: Run it to see it fail**

Run: `bash "$SP/check-coverage.sh"`
Expected: the ANY line reads **`185 / 227`** and the BEHAVIOURAL line `0 / 227`, so the check **fails**. Both numbers are meant to be short here, and the first one's value is exact rather than approximate: Task 2 emits reverse named rows for the **five** note types that hold named things — entities 34 + requirements 121 + components 17 + actors 8 + deliverables 5 = **185** — and deliberately none for `business-rules/` (27), `adrs/` (12) or `issues/` (3), which consume behavioural rows only. Those 42 notes are reached for the first time by this task.

Do not write `227` here. An earlier version did, and it was wrong in the direction that causes damage: a worker who sees `185 / 227` where the plan promised 227 concludes the named pass under-produced, and the obvious repair is to fabricate named rows for the three note types the instrument specifically excludes — inventing a consumer no producer feeds, which is the exact hole the closure check exists to catch.

That split is the point of having two numbers at all. DoD 1b asks whether every note was read; this task asks whether every note's *claims* were extracted, and a single number that answers the first cannot be trusted to answer the second.

- [ ] **Step 3: Extract forward behavioural claims from all eight bodies**

Every behavioural claim in every body, **wherever in that body it sits** — the spec's table says where they *concentrate* and bounds nothing. Sweep each body over its full `corpus.sh` range. For the wireframe appendix that is all **23** A-numbered sections, not §§A.17–A.21; for the prototype all **16**, not two.

One row per claim:

```
f92	forward	behavioural	a user can start a project without a plan	prd§11.2.3	project,plan	-	-		-
```

Leave `cand_n`, `matched` and `state` empty.

- [ ] **Step 4: Build the reverse behavioural inventory, per claim rather than per note**

Every behavioural claim in all 227 notes gets a row. A note is a container: a Feature with four acceptance criteria yields four rows, not one. The reverse **named** rows already exist — Task 2 built them, because the alias pass needs both sides of a rename at once — so this step adds the behavioural half and the two together are the reverse inventory the spec asks for.

```
r418	reverse	behavioural	carries no geometry	docs/entities/Space.md::Rules[1]	space,zone,geometry	-	-		-
```

The `locator` after `::` must be stable and re-findable — a heading plus an index, never a line number.

- [ ] **Step 5: Run the coverage check again**

Run: `bash "$SP/check-coverage.sh"`
Expected: both lines read `227 / 227`, exit 0.

If it prints fewer, the missing notes are listed by:
```bash
comm -13 <(awk -F'\t' 'NR>1 && $2=="reverse"{split($5,a,"::"); print a[1]}' "$SP/rows.tsv" | sort -u) \
         <(find docs/requirements docs/entities docs/business-rules docs/components docs/actors docs/deliverables docs/adrs docs/issues -type f | sort)
```
Every one of them is a note nobody read. Read it.

- [ ] **Step 6: Commit** — scratchpad only. Record forward-behavioural and reverse row counts.

---

### Task 4: Two-stage matching

Implements spec order step 4. **Only stage one is mechanical, and the ledger will say so.**

**Files:**
- Create: `$SP/candidates.sh`
- Modify: `$SP/rows.tsv` (fill `cand_n` and `matched` on behavioural rows)

**Interfaces:**
- Consumes: `aliases.tsv` from Task 2; behavioural rows from Task 3.
- Produces: `candidates.sh "<terms>"` printing candidate note paths and a count; `cand_n` and `matched` populated on every behavioural row.

- [ ] **Step 1: Write the candidate-set script**

```bash
cat > "$SP/candidates.sh" <<'EOF'
# Stage one of the two-stage match: mechanical, reproducible by command.
#   candidates.sh forward "<terms>"   -> searches the 227 derived notes
#   candidates.sh reverse "<terms>"   -> searches the eight materialised evidence bodies
#
# The direction is not cosmetic. A forward row asks "does any derived note address this
# evidence claim"; a reverse row asks "does the new evidence speak to this derived claim".
# Searching the derived corpus for a reverse row returns the very note the claim was
# extracted from, so the row matches itself, rung 4 never fires, and `retained` and
# `superseded` are unreachable for every one of the 227 notes' reverse rows.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
SP="$(dirname "$0")"
case "${1:-}" in
  forward) corpus=(docs/requirements docs/entities docs/business-rules docs/components
                   docs/actors docs/deliverables docs/adrs docs/issues) ;;
  reverse) corpus=("$SP/bodies") ;;   # written by `corpus.sh materialise`, one file per body
  *) echo 'usage: candidates.sh {forward|reverse} "<terms>"' >&2; exit 2 ;;
esac

# A term expands to itself plus every alias counterpart, matched on EITHER side of the
# alias table so the expansion works whichever way the row runs. `derived_term` is split
# on `|`: the `collapsed` row holds three terms in one field.
expand() {
  printf '%s\n' "$1"
  awk -F'\t' -v t="$(printf '%s' "$1" | tr 'A-Z' 'a-z')" 'NR>1{
    if (tolower($1)==t) { n=split($2,B,"|"); for(i=1;i<=n;i++) print B[i] }
    n=split($2,B,"|"); for(i=1;i<=n;i++) if (tolower(B[i])==t) print $1
  }' "$SP/aliases.tsv"
}

# A term is matched as a PHRASE first; if the phrase appears nowhere, fall back to requiring
# every significant word of it to appear in the same file.
#
# The fallback is not a nicety. Extractors produce terms like `cost impact` and `scope change`
# — noun phrases rather than the entity/screen/component/actor names the method asks for — and
# a phrase-only match returns nothing for them. That is not an absent claim, it is an absent
# PHRASE, and the difference matters because an empty candidate set is resolved with NO
# judgement, straight to `absent`, and reported as a Gap. Measured on this corpus: JTBD-030
# ("see cost and schedule consequences of a considered change") had an empty candidate set
# while `docs/requirements/Impact analysis.md` says "showing that a change costs three weeks"
# in as many words. Phrase-only matching left 172 rows with empty candidate sets; with the
# fallback, 37. The 135 difference is the number of findings a phrase-only match would have
# invented.
#
# Widening is MONOTONE — it can only add candidates, never remove one — so it cannot hide a
# disagreement the narrow match would have found. It costs a larger set to read, not accuracy.
STOP=" the and for with from that this when what which into over must should shall have has are its their been than then them not but all any one two per via use used using "
words_of() {
  # `printf '%s\n'`, not `printf '%s'`. Without the trailing newline `tr` emits a last word
  # with no terminator, `read` returns non-zero on it, and the while loop exits BEFORE the
  # body runs — silently dropping the final word of every term. Measured: `scope change`
  # yielded only `scope`, so the intersection degenerated to the first word's hits and this
  # command returned 22 candidates where the true intersection is 8. Caught only because the
  # cached implementation and this one are checked against each other.
  printf '%s\n' "$1" | tr -cs 'A-Za-z' '\n' | while read -r w; do
    [ ${#w} -gt 3 ] || continue
    case "$STOP" in *" $(printf '%s' "$w" | tr 'A-Z' 'a-z') "*) continue ;; esac
    printf '%s\n' "$w"
  done
}
one_term() {
  # PHRASE hits UNION word-intersection hits — always both, never one instead of the other.
  #
  # An earlier version returned early when the phrase matched anywhere, and claimed three
  # lines above that widening "can only add candidates, never remove one". That claim was
  # wider than the mechanism under it: a phrase occurring incidentally in one file suppressed
  # the fallback entirely, so a note addressing the same behaviour in different words was
  # excluded from the candidate set and the row could still become a false Gap. Selecting one
  # strategy is not widening; unioning them is.
  local t="$1" out
  out="$(grep -rliE "\b${t}s?\b" "${corpus[@]}" 2>/dev/null || true)"
  [ -n "$out" ] && printf '%s\n' "$out"
  local first=1 acc="" cur
  while IFS= read -r w; do
    cur="$(grep -rliE "\b${w}s?\b" "${corpus[@]}" 2>/dev/null || true)"
    if [ $first = 1 ]; then acc="$cur"; first=0
    else acc="$(comm -12 <(printf '%s\n' "$acc" | sort -u) <(printf '%s\n' "$cur" | sort -u))"; fi
  done < <(words_of "$t")
  [ $first = 0 ] && printf '%s\n' "$acc" || true
}

IFS=',' read -ra terms <<< "${2:-}"
{ for t in "${terms[@]}"; do
    t="$(printf '%s' "$t" | sed 's/^ *//; s/ *$//')"
    [ -n "$t" ] || continue
    while IFS= read -r x; do
      [ -n "$x" ] || continue
      one_term "$x"
    done < <(expand "$t" | sort -u)
  done; } | awk 'NF' | sort -u
# `awk 'NF'` rather than `grep -v '^$'`. grep exits 1 when it selects no lines, and with
# `set -euo pipefail` that turns a legitimately EMPTY candidate set into a script failure —
# for exactly the rows where the empty set IS the answer, the ones that resolve straight to
# `absent`/`retained` with no judgement. Measured before the fix: this command exited 1 on a
# term matching nothing and 0 on a term matching something, so the one case a caller most
# needs to distinguish was reported as an error. awk exits 0 either way.
EOF
chmod +x "$SP/candidates.sh"
```

- [ ] **Step 2: Verify it on a claim whose answer is known, in both directions**

Run:
```bash
bash "$SP/candidates.sh" forward "space,zone" | wc -l
bash "$SP/candidates.sh" forward "space,zone" | grep -c 'Outdoor area'
bash "$SP/candidates.sh" reverse "space,zone"
```
Expected: forward, a non-zero count including `docs/entities/Space.md` and `docs/entities/Zone.md`, and `docs/entities/Outdoor area.md` present — it is reached only through the `collapsed` alias row, not through the literal term, so a `1` there is the alias expansion proving itself. Reverse, a list of `$SP/bodies/*.txt` files and **no** path under `docs/` — a reverse row that returns a derived note is the direction bug, and this is the check that catches it.

- [ ] **Step 3: Fill `cand_n` for every behavioural row**

For each behavioural row, run `candidates.sh` **with that row's own direction** on its `terms`, and write the count into `cand_n`. Record the command in the ledger later; it is stage one and must be re-runnable verbatim.

A forward row's candidate set is a set of derived notes; a reverse row's is a set of evidence bodies. Feeding every row the same corpus is what made `retained` unreachable, and the row's `direction` field is the only thing that decides it.

- [ ] **Step 4: Judge the match within each candidate set — one row per ADDRESSING member**

Read only the members of the candidate set — derived notes for a forward row, evidence bodies for a reverse one. Decide which of them **address** the claim. **Silence is not a match**: a candidate that mentions the term but says nothing about the claim does not count.

- none addresses it → leave the row as it is, `matched` = `-`.
- exactly one addresses it → write its path into `matched`.
- **more than one addresses it → split the row**, one copy per addressing member, each carrying that member in `matched` and keeping the original `subject`, `source` and `terms`. Suffix the ids `f92a`, `f92b`, …

The split is not bookkeeping. Two notes can address the same claim and *disagree with each other about it* — one restating it, one contradicting it. A single `matched` field records whichever the reader looked at first; if that is the agreeing note the row lands `present`, the contradicting pair never gets a `pair` key, and it cannot be coalesced into a finding because it was never a row. Splitting is also what keeps DoD 1 true: a row holds **exactly one** of five states, and a row matching two notes with opposite verdicts cannot.

The reverse pass gives that contradiction a second route — the contradicting note's own claim has a reverse row, checked against the evidence — so this is not the only thing standing between the corpus and a lost finding. It is the thing that stops the forward matrix from *asserting agreement that was never checked*, and one route is not a reason to leave the other broken.

A reverse row must never match the note it was extracted from. That is not a judgement call the reader has to make: the reverse corpus contains no derived notes at all, so the case cannot arise.

A row with `cand_n=0` is the one case needing no judgement: nothing to read, `matched=-`.

- [ ] **Step 5: Verify every behavioural row is matched or explicitly unmatched**

Run:
```bash
awk -F'\t' 'NR>1 && $3=="behavioural" && ($7=="" || $8=="") {bad++} END{print "behavioural rows not yet matched:", bad+0}' "$SP/rows.tsv"
awk -F'\t' 'NR>1 && $3=="behavioural" && $7=="0" {z++} END{print "rows with an empty candidate set:", z+0}' "$SP/rows.tsv"
```
Expected: `0` unmatched; the empty-candidate-set count is information for the ledger — those are the rows where the mechanical half carried the whole answer.

- [ ] **Step 6: Commit** — scratchpad only.

---

### Task 5: Resolve the ladder, derive findings, coalesce mirrored rows

Implements spec order steps 5–7 — **read, then ladder, then findings, in that order.** One
task: coalescing needs the states, and a reviewer rejecting the ladder would reject the findings
derived from it.

The order matters and was wrong in the spec until review found it. The ladder's first three
rungs *are* the reading: nothing is `superseded`, `contradictory` or `present` until the two
sides have been compared. Only rung 4 — one side silent — is decidable without reading, which is
why Step 1 below fills exactly that and stops.

**Files:**
- Modify: `$SP/rows.tsv` (fill `state` and `pair`)
- Create: `$SP/findings.tsv`

**Interfaces:**
- Consumes: matched rows from Task 4.
- Produces: `findings.tsv` with `finding_id	kind	standing_evidence	standing_derived	evidence_cite	derived_cite	rows	remedy`.

`standing_derived` and `remedy` answer different questions and an earlier version made one
field do both. **Standing** is what `docs/README.md` says a document is — and the register
DOES classify every one of the eight derived note types as derived, whatever it fails to say
about the evidence side. **Remedy** is whether this finding may propose an edit, which is the
thing an unclassified evidence body blocks. Blanking `standing_derived` to signal "no edit"
threw away a fact the register states plainly, and left most findings unable to satisfy the
ledger's own requirement that each side carry `received`, `derived` or `undetermined`.
`remedy` is `none` wherever `standing_evidence` is `undetermined`, and **it is written at the
moment the standing is assigned, not left for a later step to fill.** The provenance trace two
steps below only visits findings whose evidence side is `received` — the workspace PRD — so a
finding from any of the seven unclassified bodies is never revisited. Leaving its `remedy`
blank would make the verifier's `$3=="undetermined" && $8!="none"` fire on every one of them,
reporting the whole majority of the finding set as proposing edits it explicitly does not
propose. The same pass sets `standing_derived=derived`, because the register classifies all
eight derived note types whatever it fails to say about the evidence side.

- [ ] **Step 1: Write the ladder as a script over the rows you can decide mechanically**

```bash
cat > "$SP/ladder.sh" <<'EOF'
#!/usr/bin/env bash
# Rungs 3 and 4 are decidable from matched/cand_n. Rungs 1 and 2 need the reading in Task 6;
# this fills what it can and leaves the rest empty ON PURPOSE, rather than guessing.
awk -F'\t' -v OFS='\t' 'NR==1{print;next}
  $9!="" {print;next}
  $8=="-" && $2=="forward" {$9="absent"; print; next}
  $8=="-" && $2=="reverse" {$9="retained"; print; next}
  {print}' "$1"
EOF
chmod +x "$SP/ladder.sh"
```

- [ ] **Step 2: Run it and confirm only both-sides-speak rows remain unstated**

Run:
```bash
bash "$SP/ladder.sh" "$SP/rows.tsv" > "$SP/rows.next" && mv "$SP/rows.next" "$SP/rows.tsv"
awk -F'\t' 'NR>1 && $9=="" {n++} END{print "rows still needing a read:", n+0}' "$SP/rows.tsv"
awk -F'\t' 'NR>1 && $9=="" && $8=="-" {n++} END{print "unread rows with no match (should be 0):", n+0}' "$SP/rows.tsv"
```
Expected: the second number is `0` — every unstated row has a matched note, which is exactly the "both sides speak" set Task 6 reads.

- [ ] **Step 3: Read the both-sides-speak rows and set `superseded` / `contradictory` / `present`**

Rung 1 first: does the evidence explicitly supersede, in a citable passage? → `superseded`. Then rung 2: do they disagree? → `contradictory`. Otherwise → `present`. Order matters; a supersession also satisfies rung 2, which is why it is checked first.

- [ ] **Step 4: Fill `pair` on every `contradictory` and `superseded` row**

`pair` = `EVIDENCE>>DERIVED`, and **which field supplies which half depends on the row's
direction** — that is the whole point of a pair key, and getting it backwards defeats it:

| direction | `EVIDENCE` half | `DERIVED` half |
| --- | --- | --- |
| `forward` | the row's `source` (`body§section`) | the row's `matched` (`path::locator`) |
| `reverse` | the row's `matched` (`body§section`) | the row's `source` (`path::locator`) |

A forward row holds the evidence citation in `source`; a reverse row holds the DERIVED citation
there and the evidence citation in `matched`. Building `source>>matched` for both produces
`EVIDENCE>>DERIVED` on one and `DERIVED>>EVIDENCE` on the other, so the two halves of a single
disagreement carry different keys, never coalesce, and are counted as two findings — inflating
both the finding total and the directly-counted coalesced-pair number that is supposed to
prove the coalescing happened.

The delimiter is **exactly two** `>` characters. A forward row and its
mirrored reverse row produce the **same** key — that is what makes them one finding.

Written without placeholder brackets on purpose. An earlier version read
`<evidence_source>>><derived_path>::<locator>`, which is the two-character delimiter wearing
angle brackets — but it reads as three, and a reader who copies it leaves a stray `>` at the
head of every `derived_cite`, so the ledger cites `>docs/entities/Space.md::…` and no consumer
expecting a repository path can resolve it. The formatter below advances exactly two
characters past `index(p,">>")`; the definition and the parser now say the same thing.

- [ ] **Step 5: Coalesce and verify rows ≠ findings by exactly the mirror count**

```bash
printf 'finding_id\tkind\tstanding_evidence\tstanding_derived\tevidence_cite\tderived_cite\trows\tremedy\n' > "$SP/findings.tsv"
awk -F'\t' 'NR>1 && ($9=="contradictory" || $9=="superseded") {c[$10]=c[$10]" "$1; k[$10]=$9}
  END{i=0; for (p in c){i++; n=index(p,">>");
       printf "c%d\t%s\t\t\t%s\t%s\t%s\t\n", i, (k[p]=="superseded"?"Orphan":"Contradiction"),
              substr(p,1,n-1), substr(p,n+2), c[p]}}' \
  "$SP/rows.tsv" >> "$SP/findings.tsv"
rows=$(awk -F'\t' 'NR>1 && ($9=="contradictory"||$9=="superseded")' "$SP/rows.tsv" | wc -l | tr -d ' ')
finds=$(( $(wc -l < "$SP/findings.tsv") - 1 ))
echo "disagreement rows: $rows   findings: $finds   coalesced pairs: $(( rows - finds ))"
```
Expected: `coalesced pairs` equals the number of disagreements both directions found.

**The pair key is split back into its two citations here, not carried whole.** `pair` is
`EVIDENCE>>DERIVED`, two `>` characters; `findings.tsv` declares field 5 as
`evidence_cite` and field 6 as `derived_cite`. Writing the undivided key into field 6 leaves
field 5 empty, and Task 6 sets the evidence standing by testing `$5 ~ /^prd/` — so every
finding, the PRD-backed ones included, would come back `undetermined`, and the provenance
trace the received-evidence findings exist to get would be skipped entirely. Verify with:

```bash
awk -F'\t' 'NR>1 && $5=="" {n++} END{print "findings with no evidence citation (must be 0):", n+0}' "$SP/findings.tsv"
```

Note what this computes and what it must not: the count is `disagreement rows − distinct pairs`,
over `contradictory` and `superseded` rows **only**. It is *not* total rows minus total findings
— `present` and `retained` rows raise the row total while producing no finding, so that delta
would overstate coalescing by the size of the agreeing set. The spec said otherwise until round
nine; this script was already right, which is why the check is written as a script and not as a
sentence.

- [ ] **Step 6: Add `Gap` findings from forward `absent` rows**

Every forward row at `absent` is a `Gap`. It cannot mirror — there is no derived claim to pair with, which is what makes it a gap. Reverse `retained` rows produce nothing.

- [ ] **Step 7: Commit** — scratchpad only. Record the state breakdown and both totals.

---

### Task 6: Standing, provenance tracing, and decision-needing findings

**Files:**
- Modify: `$SP/findings.tsv` (fill `standing_evidence`, `standing_derived`)

**Interfaces:**
- Consumes: `findings.tsv` from Task 5.
- Produces: every finding carrying a standing on both sides, and a marked subset for the decisions section.

- [ ] **Step 1: Set the evidence standing mechanically from the register**

Only the workspace PRD is `received`. The other seven bodies are `undetermined`:

```bash
awk -F'\t' -v OFS='\t' 'NR==1{print;next}
  { if ($5 ~ /^prd/) { $3="received" }
    else            { $3="undetermined"; $8="none" }   # <- remedy, set HERE and not left blank
    $4="derived"                                        # every derived note type IS classified
    print }' \
  "$SP/findings.tsv" > "$SP/f.next" && mv "$SP/f.next" "$SP/findings.tsv"
```

- [ ] **Step 1a: Special-case the Gaps — they have no derived side to trace**

A `Gap` is a finding whose whole content is that **no derived note exists**. It therefore has
no `derived_cite`, no `sources:` frontmatter to read, and nothing to trace. Treating it as a
two-sided finding breaks the next step: the provenance trace visits every `received` finding
and tries to read a derived note that by definition is not there, so a PRD-backed Gap can never
complete tracing and keeps a blank `remedy` — which the verifier does not reject, because its
check only fires on `undetermined`.

```bash
awk -F'\t' -v OFS='\t' 'NR==1{print;next}
  $2=="Gap" { $4="n/a"                                    # there is no derived side
              $8=($3=="received" ? "backlog gains a note" : "none") }
  {print}' "$SP/findings.tsv" > "$SP/f.next" && mv "$SP/f.next" "$SP/findings.tsv"
```

`n/a` rather than `derived`, because claiming a standing for a document that does not exist is
the same error one layer down. And a received-evidence Gap needs no trace to know its remedy:
there is no derived claim that could have drifted, so the backlog simply gains a note.

- [ ] **Step 2: Trace provenance before setting the derived standing**

For each finding whose evidence side is `received` (the PRD) **and which has a derived side at all** — that is, every `Contradiction` and `Orphan`, and no `Gap` — read the derived note's `sources:` frontmatter and check the cited section in the **original** PRD or SDD:

```bash
sed -n '/^sources:/,/^[a-z]/p' "docs/entities/Space.md"
```

`standing_derived` is `derived` for every one of these — the register classifies all eight note
types. What the trace decides is the **remedy**, not the standing:

- The note has **drifted** from what it cites → `remedy=backlog moves`.
- The note **faithfully reflects** its source → this is received-vs-received. Moving the backlog
  would silently pick one received document over another. `remedy=none`; mark the finding for
  the decisions section.

The original PRD and SDD are read **here only**, per finding, and contribute no rows and no counts.

- [ ] **Step 3: Verify no finding proposes an edit it is not entitled to**

Run:
```bash
awk -F'\t' 'NR>1 && $3=="undetermined" && $8!="none" {n++} END{print "undetermined findings proposing an edit (must be 0):", n+0}' "$SP/findings.tsv"
awk -F'\t' 'NR>1 && ($3=="" || $4=="") {n++} END{print "findings missing a standing on either side (must be 0):", n+0}' "$SP/findings.tsv"
```
Expected: `0`.

- [ ] **Step 4: Commit** — scratchpad only.

---

### Task 7: The convention audit, run apart from the matrix

Implements spec order step 8. Separate task because it is derived from a different corpus and must not borrow the matrix's completeness.

**Files:**
- Create: `$SP/convention.tsv`

**Interfaces:**
- Consumes: `docs/README.md` and `docs/templates/`.
- Produces: `convention.tsv` with `id	claim	evidence	proposed`.

- [ ] **Step 1: Check every folder that exists against the register's folder table**

```bash
cd "$(git rev-parse --show-toplevel)"
comm -13 <(sed -n '/^| Folder/,/^$/p' docs/README.md | grep -oE '`[a-z-]+/`' | tr -d '`/' | sort -u) \
         <(find docs -maxdepth 1 -mindepth 1 -type d -printf '%f\n' | sort -u)
```
Expected: at minimum `product` and `user-experience` — the two the spec names. Anything else it prints is a finding nobody had noticed.

- [ ] **Step 2: Record each as a `Convention` finding**

One row per unregistered folder, citing `docs/README.md`'s own claim to name every folder so the first note of a kind "has somewhere obvious to go".

- [ ] **Step 3: Verify the audit is excluded from the matrix counts**

Run: `grep -c Convention "$SP/findings.tsv"`
Expected: `0`. Convention findings live in `convention.tsv` and are reported in their own ledger section. If any leaked into `findings.tsv`, the matrix counts would be overstated.

- [ ] **Step 4: Commit** — scratchpad only.

---

### Task 8: Write the ledger

**Files:**
- Create: `docs/reviews/2026-08-24-ux-layer-backlog-reconciliation.md`

**Interfaces:**
- Consumes: `rows.tsv`, `findings.tsv`, `convention.tsv`, and every count from the checks above.
- Produces: the one committed deliverable.

- [ ] **Step 1: Read both existing ledgers for shape**

Run: `head -60 docs/reviews/2026-08-23-backlog-register-review.md docs/reviews/2026-08-23-design-docs-review.md`

Match their shape: narrative, instrument named, counts stated, findings grouped by cluster rather than listed flat.

- [ ] **Step 2: Write the opening, with both deviations stated there**

The two existing ledgers open "All findings below are fixed." This one must say, in its own opening, that it is written **before any fix**, and must state its coverage limits where a reader meets them — the market landscape, the 17 slices, the HTML pages, the seventeen screenshots.

- [ ] **Step 3: State the instrument and print every count**

Rows and findings **separately**, with the coalesced-pair count between them. Notes reached beside 227. Per-body sections swept beside sections contained. The closure numbers: 5 named-thing consumers against 5 producer targets, 8 behavioural consumers against 8 bodies, 4 finding kinds each naming its corpus.

- [ ] **Step 4: Write the findings, grouped by cluster**

Each carries the standing of both sides and its citations: a `Contradiction` cites both sides by file and section; an `Orphan` cites both, including the superseding passage; a `Gap` cites the extant side plus the corpus searched **and the command that reproduces the absence**.

- [ ] **Step 5: Write the decisions section and the convention section**

Decisions carry options and a recommendation and are not resolved. The classification of `docs/user-experience/` and `docs/product/` is a member, established rather than predicted. Convention findings sit in their own section, excluded from the matrix counts.

- [ ] **Step 6: State the two-stage matching honestly**

The ledger says which half was mechanical and which was judged, gives the candidate-set command, and says plainly that two careful readers may differ inside a candidate set. Do **not** write "absence is mechanical" unqualified — that sentence has already been a finding once.

- [ ] **Step 7: Commit**

```bash
git add docs/reviews/2026-08-24-ux-layer-backlog-reconciliation.md
git commit -m "Reconcile the UX layer with the backlog: findings ledger"
```

---

### Task 9: Verify the Definition of Done and push

**Files:**
- Create: `$SP/verify-dod.sh`

- [ ] **Step 1: Write the DoD verifier**

```bash
cat > "$SP/verify-dod.sh" <<'EOF'
#!/usr/bin/env bash
cd "$(git rev-parse --show-toplevel)"
SP="$(dirname "$0")"; L=docs/reviews/2026-08-24-ux-layer-backlog-reconciliation.md
echo "1  rows with no state:      $(awk -F'\t' 'NR>1 && $9==""' "$SP/rows.tsv" | wc -l | tr -d ' ')  (must be 0)"
echo "1  rows and findings both printed: $(grep -cE 'rows|findings' "$L")  (must be >0)"
echo "1b notes reached:           $(awk -F'\t' 'NR>1 && $2=="reverse"{split($5,a,"::");print a[1]}' "$SP/rows.tsv" | sort -u | wc -l | tr -d ' ')  / 227"
echo "1a note types covered:      $(grep -cE 'requirements/|entities/|business-rules/|components/|actors/|deliverables/|adrs/|issues/' "$L")  (all 8 must appear)"
echo "6  derived notes edited:    $(git status --porcelain docs/requirements docs/entities docs/business-rules docs/components docs/actors docs/deliverables docs/adrs docs/issues | wc -l | tr -d ' ')  (must be 0)"

# ASSERT, do not merely print. A verifier that reports its own violations and still exits 0
# is the same defect as a check whose mechanism cannot fail: a worker runs the advertised
# gate, sees the bad numbers scroll past, and proceeds. Every measurement above is restated
# here as a condition, and the script exits non-zero if any of them is wrong.
fail=0
chk(){ [ "$2" = "$3" ] || { echo "  FAIL $1: expected $2, measured $3"; fail=1; }; }
chk "rows with no state" 0 "$(awk -F'\t' 'NR>1 && $9==""' "$SP/rows.tsv" | wc -l | tr -d ' ')"
# Definition-of-Done item 1 says every row holds exactly ONE OF FIVE states. Checking only for
# emptiness accepts `contradiction`, `Present`, `present?` — a typo or a leftover provisional
# marker — and the finding derivation then silently ignores the row, so an unrecognised
# disagreement disappears without any check failing. Validate against the vocabulary.
chk "rows whose state is outside the five" 0 "$(awk -F'\t' 'NR>1 && $9!="" && $9!="present" && $9!="absent" && $9!="contradictory" && $9!="superseded" && $9!="retained"' "$SP/rows.tsv" | wc -l | tr -d ' ')"
chk "notes reached by a reverse row" 227 "$(awk -F'\t' 'NR>1 && $2=="reverse"{split($5,a,"::");print a[1]}' "$SP/rows.tsv" | sort -u | wc -l | tr -d ' ')"
chk "notes reached by a reverse BEHAVIOURAL row" 227 "$(awk -F'\t' 'NR>1 && $2=="reverse" && $3=="behavioural"{split($5,a,"::");print a[1]}' "$SP/rows.tsv" | sort -u | wc -l | tr -d ' ')"
# Compare against the MERGE BASE, not the working tree. Task 8 commits the ledger before this
# verifier runs, so a derived-note edit committed alongside it leaves `git status` clean and
# the gate passes while the pass's single most important constraint is violated. The working
# tree cannot answer "did this branch change a derived note"; only the diff against the base
# can. Both are checked — an uncommitted edit is caught too — but the second is the one that
# can actually fail.
MB="$(git merge-base origin/main HEAD)"
DERIVED="docs/requirements docs/entities docs/business-rules docs/components docs/actors docs/deliverables docs/adrs docs/issues"
chk "derived notes edited (uncommitted)" 0 "$(git status --porcelain $DERIVED | wc -l | tr -d ' ')"
chk "derived notes edited (vs merge base $MB)" 0 "$(git diff --name-only "$MB"...HEAD -- $DERIVED | wc -l | tr -d ' ')"
chk "findings with no evidence citation" 0 "$(awk -F'\t' 'NR>1 && $5==""' "$SP/findings.tsv" 2>/dev/null | wc -l | tr -d ' ')"
chk "undetermined findings proposing an edit" 0 "$(awk -F'\t' 'NR>1 && $3=="undetermined" && $8!="none"' "$SP/findings.tsv" 2>/dev/null | wc -l | tr -d ' ')"
chk "named rows carrying a union target" 0 "$(awk -F'\t' 'NR>1 && $3=="named" && $11 ~ /,/' "$SP/rows.tsv" | wc -l | tr -d ' ')"

# The two LEDGER conditions, asserted rather than printed. Item 1a is a claim about the
# ledger's text, so it is checked against the ledger's text: all eight note types named, and
# both counts present. Counted as DISTINCT types, never as a raw matching-line total — a
# single line mentioning `requirements/` eight times would satisfy a line count and prove
# nothing about the other seven.
[ -f "$L" ] || { echo "  FAIL ledger missing: $L"; fail=1; }
if [ -f "$L" ]; then
  # Definition-of-Done item 1a: "the ledger says how many notes of each type were covered".
  # Grepping for the directory NAME is satisfied by scope prose and coverage-limit prose that
  # mention every folder while counting none, so the check passed on a ledger that reported no
  # coverage at all. Parse the number the ledger prints beside each type and compare it with
  # the corpus.
  for pair in requirements:121 entities:34 business-rules:27 components:17 actors:8 \
              deliverables:5 adrs:12 issues:3; do
    t="${pair%%:*}"; want="${pair##*:}"
    got="$(grep -oE "\`?$t/\`?[^0-9]{0,40}[0-9]+" "$L" | grep -oE '[0-9]+$' | head -1)"
    [ -n "$got" ] || { echo "  FAIL ledger prints no covered count for $t/"; fail=1; continue; }
    chk "notes covered, $t/" "$want" "$got"
  done
  # Parse the THREE numeric totals item 1 demands, and check them against the matrix.
  # Grepping for the bare words `rows` and `findings` is satisfied by the sentence "rows and
  # findings are counted separately" — prose about counting, with nothing counted. A check
  # that passes on a description of itself is not a check.
  want_rows=$(awk -F'\t' 'NR>1' "$SP/rows.tsv" | wc -l | tr -d ' ')
  want_find=$(awk -F'\t' 'NR>1' "$SP/findings.tsv" | wc -l | tr -d ' ')
  dis=$(awk -F'\t' 'NR>1 && ($9=="contradictory"||$9=="superseded")' "$SP/rows.tsv" | wc -l | tr -d ' ')
  distinct=$(awk -F'\t' 'NR>1 && ($9=="contradictory"||$9=="superseded"){print $10}' "$SP/rows.tsv" | sort -u | wc -l | tr -d ' ')
  want_coal=$(( dis - distinct ))
  # Look for each number NEXT TO ITS LABEL, not loose in the prose. A bare numeric grep is
  # satisfied by any incidental digit — `4` matches "§34", "4 convention findings", a date —
  # so the check passed on a ledger that never printed the coalesced-pair total at all.
  lbl(){ grep -qiE "$2[^0-9]{0,60}$1|$1[^0-9]{0,60}$2" "$L" \
           || { echo "  FAIL ledger does not print $2 = $1"; fail=1; }; }
  lbl "$want_rows"  "rows"
  lbl "$want_find"  "findings"
  lbl "$want_coal"  "coalesced"
  echo "  (ledger must print: rows=$want_rows findings=$want_find coalesced-pairs=$want_coal)"
fi
exit $fail
EOF
chmod +x "$SP/verify-dod.sh"
```

- [ ] **Step 2: Run it**

Run: `bash "$SP/verify-dod.sh"`
Expected: rows with no state `0`; notes reached `227 / 227`; derived notes edited `0`.

- [ ] **Step 3: Require the gate to pass**

```bash
npm run check
```
Expected: **exit 0**, all four steps.

**This step used to be a stash-and-compare baseline, and it no longer is.** The spec's
Definition of Done item 5 was written when `main` was red in all four gate steps, every failing
file tracing to `5c85a26`; it could only ask for "no failure this pass introduced", and it
spelled out how to prove that by stashing this branch's document and diffing.

`f15909c` fixed both defects — `ObsidianPlanRepository.ts:113` returns `Promise.resolve(err(conflict))`
and `digest.test.ts:23` reads `Object.entries(base).toReversed()` — and the merged tree measures
green: `npm run check` exits 0, `0 above threshold · 388 analyzed · maintainability 91.7`. The
repository owner chose to hold this work to that higher bar.

So item 5 is **retired, not reinterpreted**. Its paragraph describes a tree that no longer
exists, and the ledger says so where a reader meets it rather than quoting four red steps at
them. A findings ledger is a Markdown file that no gate step reads, so it cannot plausibly turn
the tree red — which is exactly why "it passes" is a cheap guarantee to give and a dishonest one
to withhold once it is true.

The baseline procedure is kept below for one case only: if the gate is red at this point,
`main` has regressed again, and stash-and-compare is how to show the red is not this pass's.

```bash
npm run lint > "$SP/lint-after.log" 2>&1
git stash list > "$SP/stash-before.txt"
git worktree add -q "$SP/base-tree" "$(git rev-parse HEAD~1)"
( cd "$SP/base-tree" && npm ci --silent && npm run lint ) > "$SP/lint-base.log" 2>&1
git worktree remove --force "$SP/base-tree"
diff <(sort "$SP/lint-after.log") <(sort "$SP/lint-base.log") && echo "lint: same errors ✓"
```

**Baseline from a REVISION, not from a stash.** Task 8 commits the ledger before this step, so
`git stash push -- <the ledger>` has no local modification to save: git prints "No local changes
to save", both runs then lint the identical committed tree, and the comparison shows they match
for a reason that has nothing to do with the ledger. A check that passes because it compared
something with itself is worse than no check. `HEAD~1` is the commit before the ledger landed,
so the two trees genuinely differ by exactly the ledger.
Compare `lint` **sorted** — oxlint's output order is nondeterministic, so a plain diff of two identical results can show a moved line. `analyze` reads `coverage/coverage-final.json` and is downstream of `test:coverage`, so compare it like-for-like or not at all.

- [ ] **Step 4: Push and update the PR**

```bash
git push -u origin claude/obsidian-renovation-planner-prd-r41jx7
```

Then update PR #8's body: the ledger now exists, and the PR is no longer "one document: the design spec".

---

## Self-review

**Round ten, and what it changed.** Four P1 findings arrived against this plan after the spec was frozen, and all four were verified against the tree before being accepted. None of them is a finding against the spec — each is a place where this plan's *implementation* of a frozen method contradicted the method: the gallery given an empty `1:0` range while the spec admits it as one of eight bodies; named rows built forward-only while the spec's reverse rule covers "every named thing **and** every behavioural claim"; a candidate corpus that searched the derived notes in both directions while the spec defines the reverse direction as "checked against the new evidence"; and a shell formatter that left `evidence_cite` blank. Two more came from the pre-flight scan: an evidence-line check that compared a constant against a sum of the same constants, and an alias index keyed on an unsplit `derived_term`. The spec was not reopened for any of them.

**Spec coverage.** Order steps 1–8 → Tasks 2, 2, 3, 4, 5, 5, 5, 7 (the order was renumbered in round nine: reading is now step 5, the ladder 6, findings 7). DoD 1 → Task 5 + Task 9; 1a → Task 8 step 3; 1b → Task 3 step 5 and Task 9; 1c → Task 8 step 3; 1d → Task 8 step 3; 2 → Task 8 step 4; 3 → Task 8 step 5; 4 → Task 8 step 2; 5 → Task 9 step 3; 6 → Global Constraints and Task 9 step 1. The two-stage matcher → Task 4. Pair identity → Task 5 steps 4–5. Provenance tracing → Task 6 step 2. Reference corpus limit → Task 6 step 2.

**Known gaps, stated rather than hidden.** Task 3's extraction is reading, not scripting — its volume (5,719 evidence lines, 11,342 derived lines) is the real cost of this plan and no step makes it cheaper. Tasks 4 step 4 and 5 step 3 are judgement bounded by mechanically-produced sets, exactly as the spec requires, and neither is reproducible in the strong sense.

**One thing this plan decides that the spec did not:** the matrix stays in the scratchpad and is not committed, because the spec authorises one output file. If the counts should be independently checkable from the repository, that is a second committed file and a question for the repository owner — raised here rather than taken silently.

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
id	direction	kind	subject	source	terms	cand_n	matched	state	pair
```

- `id` — `f<N>` forward, `r<N>` reverse
- `direction` — `forward` | `reverse`
- `kind` — `named` | `behavioural`
- `subject` — the item or claim, one line, no tabs
- `source` — `body§section` (forward) or `path::locator` (reverse)
- `terms` — normalised subject terms, comma-separated
- `cand_n` — candidate-set size; `-` for named rows
- `matched` — note path that addresses it, or `-`
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
cd /home/user/renovation-planner
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
R=/home/user/renovation-planner
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
printf 'id\tdirection\tkind\tsubject\tsource\tterms\tcand_n\tmatched\tstate\tpair\n' > "$SP/rows.tsv"
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
- Produces: `aliases.tsv` with columns `evidence_term	derived_term	note_path	relation` where `relation` ∈ `same|renamed|split|collapsed|absent`; named rows in `rows.tsv` with `state` set.

- [ ] **Step 1: Write the presence lookup and its expected output for the known cases**

```bash
cat > "$SP/lookup.sh" <<'EOF'
#!/usr/bin/env bash
# presence of a named thing across the five named-thing target types
cd /home/user/renovation-planner
n="$1"
printf '%s\t' "$n"
grep -rliF "$n" docs/entities docs/requirements docs/deliverables docs/components docs/actors 2>/dev/null | tr '\n' ',' | sed 's/,$//'
echo
EOF
chmod +x "$SP/lookup.sh"
```

- [ ] **Step 2: Run it against the four cases the spec already measured**

Run:
```bash
for n in "Planner Home" "Spaces View" "Space Detail" "Project Home"; do bash "$SP/lookup.sh" "$n"; done
```
Expected: the first three print the term and an empty second field; `Project Home` prints `docs/deliverables/MVP Prototype.md`. This reproduces the spec's `0, 0, 0, 1` and proves the lookup before it is trusted on unknown terms.

- [ ] **Step 3: Extract named things in both directions and append rows**

**Forward** — read each body over its range from `corpus.sh body` (use the materialised
`$SP/bodies/<name>.txt`, which is that range and nothing else). Extract, per the spec's
producing rule: **concepts** (→ `entities/`), **screens and views** (→ `requirements/`,
`deliverables/`), **components** (→ `components/`), **actors and personas** (→ `actors/`),
**named artifacts** (→ `deliverables/`). Provisional state is `present?` on a hit,
`absent?` on none.

**Reverse** — every named thing the 227 derived notes hold gets an `r<N>` row of
`kind=named`: the `name` each note declares, checked against the evidence bodies. Provisional
state is `present?` where the evidence uses the word, `retained?` where it does not. These are
the rows Step 6's mirror branch resolves, and they must exist before it runs.

Append one row per item:

```
f1	forward	named	Planner Home	uxd§28	planner home	-	-	absent?	-
r1	reverse	named	Private renovator	docs/actors/Private renovator.md::name	private renovator	-	-	retained?	-
```

Write a **provisional** state only: a hit → `present?`, no hit → `absent?`, both with the
question mark. Nothing is settled until Step 6 re-resolves through the aliases. Leave
`contradictory`/`superseded` for Task 5 — a named row can still turn out to disagree once its
behaviour is read.

Do **not** stop at the terms the spec already names. `Screen Component & Interaction State Specification` (wireframes §A.23) is a named artifact with no deliverable note, and it is in the plan because the spec found it, not because it is the only one.

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
cd /home/user/renovation-planner
SP="$(dirname "$0")"
reached=$(awk -F'\t' 'NR>1 && $2=="reverse" {split($5,a,"::"); print a[1]}' "$SP/rows.tsv" | sort -u | wc -l | tr -d ' ')
echo "notes reached by a reverse row: $reached  /  227"
[ "$reached" = "227" ]
EOF
chmod +x "$SP/check-coverage.sh"
```

- [ ] **Step 2: Run it to see it fail**

Run: `bash "$SP/check-coverage.sh"`
Expected: `notes reached by a reverse row: 0 / 227`, exit 1. This is DoD 1b, and it is written before the inventory exists so it cannot be retrofitted to whatever the inventory happened to produce.

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
Expected: `notes reached by a reverse row: 227 / 227`, exit 0.

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
cd /home/user/renovation-planner
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

IFS=',' read -ra terms <<< "${2:-}"
{ for t in "${terms[@]}"; do
    t="$(printf '%s' "$t" | sed 's/^ *//; s/ *$//')"
    [ -n "$t" ] || continue
    while IFS= read -r x; do
      [ -n "$x" ] || continue
      grep -rliE "\b${x}s?\b" "${corpus[@]}" 2>/dev/null || true
    done < <(expand "$t" | sort -u)
  done; } | sort -u
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

- [ ] **Step 4: Judge the match within each candidate set**

Read only the members of the candidate set — derived notes for a forward row, evidence bodies for a reverse one. Decide whether any addresses the claim; write its path into `matched`, or `-`. **Silence is not a match** — a candidate that mentions the term but says nothing about the claim leaves `matched` as `-`.

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
- Produces: `findings.tsv` with `finding_id	kind	standing_evidence	standing_derived	evidence_cite	derived_cite	rows`.

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

`pair` = `<evidence_source>>><derived_path>::<locator>`. A forward row and its mirrored reverse row produce the **same** key — that is what makes them one finding.

- [ ] **Step 5: Coalesce and verify rows ≠ findings by exactly the mirror count**

```bash
printf 'finding_id\tkind\tstanding_evidence\tstanding_derived\tevidence_cite\tderived_cite\trows\n' > "$SP/findings.tsv"
awk -F'\t' 'NR>1 && ($9=="contradictory" || $9=="superseded") {c[$10]=c[$10]" "$1; k[$10]=$9}
  END{i=0; for (p in c){i++; n=index(p,">>");
       printf "c%d\t%s\t\t\t%s\t%s\t%s\n", i, (k[p]=="superseded"?"Orphan":"Contradiction"),
              substr(p,1,n-1), substr(p,n+2), c[p]}}' \
  "$SP/rows.tsv" >> "$SP/findings.tsv"
rows=$(awk -F'\t' 'NR>1 && ($9=="contradictory"||$9=="superseded")' "$SP/rows.tsv" | wc -l | tr -d ' ')
finds=$(( $(wc -l < "$SP/findings.tsv") - 1 ))
echo "disagreement rows: $rows   findings: $finds   coalesced pairs: $(( rows - finds ))"
```
Expected: `coalesced pairs` equals the number of disagreements both directions found.

**The pair key is split back into its two citations here, not carried whole.** `pair` is
`<evidence_source>>><derived_path>::<locator>`; `findings.tsv` declares field 5 as
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
awk -F'\t' -v OFS='\t' 'NR==1{print;next} {$3 = ($5 ~ /^prd/) ? "received" : "undetermined"; print}' \
  "$SP/findings.tsv" > "$SP/f.next" && mv "$SP/f.next" "$SP/findings.tsv"
```

- [ ] **Step 2: Trace provenance before setting the derived standing**

For each finding whose evidence side is `received` (the PRD), read the derived note's `sources:` frontmatter and check the cited section in the **original** PRD or SDD:

```bash
sed -n '/^sources:/,/^[a-z]/p' "docs/entities/Space.md"
```

- The note has **drifted** from what it cites → `standing_derived=derived`, the backlog moves.
- The note **faithfully reflects** its source → this is received-vs-received. Mark the finding for the decisions section; it proposes no edit.

The original PRD and SDD are read **here only**, per finding, and contribute no rows and no counts.

- [ ] **Step 3: Verify no finding proposes an edit it is not entitled to**

Run:
```bash
awk -F'\t' 'NR>1 && $3=="undetermined" && $4!="" {n++} END{print "undetermined findings carrying an edit direction (must be 0):", n+0}' "$SP/findings.tsv"
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
cd /home/user/renovation-planner
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
cd /home/user/renovation-planner
SP="$(dirname "$0")"; L=docs/reviews/2026-08-24-ux-layer-backlog-reconciliation.md
echo "1  rows with no state:      $(awk -F'\t' 'NR>1 && $9==""' "$SP/rows.tsv" | wc -l | tr -d ' ')  (must be 0)"
echo "1  rows and findings both printed: $(grep -cE 'rows|findings' "$L")  (must be >0)"
echo "1b notes reached:           $(awk -F'\t' 'NR>1 && $2=="reverse"{split($5,a,"::");print a[1]}' "$SP/rows.tsv" | sort -u | wc -l | tr -d ' ')  / 227"
echo "1a note types covered:      $(grep -cE 'requirements/|entities/|business-rules/|components/|actors/|deliverables/|adrs/|issues/' "$L")  (all 8 must appear)"
echo "6  derived notes edited:    $(git status --porcelain docs/requirements docs/entities docs/business-rules docs/components docs/actors docs/deliverables docs/adrs docs/issues | wc -l | tr -d ' ')  (must be 0)"
EOF
chmod +x "$SP/verify-dod.sh"
```

- [ ] **Step 2: Run it**

Run: `bash "$SP/verify-dod.sh"`
Expected: rows with no state `0`; notes reached `227 / 227`; derived notes edited `0`.

- [ ] **Step 3: Establish the gate baseline and compare**

```bash
npm run lint > "$SP/lint-after.log" 2>&1; npm run analyze > "$SP/analyze-after.log" 2>&1
git stash push -q -- docs/reviews/2026-08-24-ux-layer-backlog-reconciliation.md
npm run lint > "$SP/lint-base.log" 2>&1; npm run analyze > "$SP/analyze-base.log" 2>&1
git stash pop -q
diff <(sort "$SP/lint-after.log") <(sort "$SP/lint-base.log") && echo "lint: same errors ✓"
diff "$SP/analyze-after.log" "$SP/analyze-base.log" && echo "analyze: identical ✓"
```
Expected: both identical. `lint` is compared **sorted** — oxlint's output order is nondeterministic and a plain diff of two identical results can show a moved line.

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

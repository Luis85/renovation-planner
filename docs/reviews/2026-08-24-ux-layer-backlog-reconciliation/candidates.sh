#!/usr/bin/env bash
#
# Stage one of the two-stage match: the MECHANICAL half, reproducible by command.
#
#   candidates.sh forward "<terms>"   -> searches the 227 derived notes
#   candidates.sh reverse "<terms>"   -> searches the eight evidence bodies
#
# Run it from anywhere in the repository. Take any row from `rows.tsv`, pass its `direction`
# and its `terms`, and this prints the candidate set that row was judged inside; `wc -l` on
# the output is that row's `cand_n`. That is what makes a `Gap` checkable: an `absent` verdict
# says no note in this set addresses the claim, and this command is how a reader gets the set.
#
# It carries the ledger's own alias table (`aliases.tsv`, beside this file) and materialises
# the evidence bodies from the repository itself, so a fresh checkout needs nothing else.
#
# The DIRECTION is not cosmetic. A forward row asks "does any derived note address this
# evidence claim"; a reverse row asks "does the new evidence speak to this derived claim".
# Searching the derived corpus for a reverse row returns the very note the claim came from,
# so the row matches itself and `retained` becomes unreachable for all 227 notes.
set -euo pipefail
R="$(git rev-parse --show-toplevel)"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$R"

# WHERE THE CORPUS IS gets ASKED, never spelled here.
#
# The 2026-08-28 reorganisation moved `prds` under `docs/product/` and the research
# synthesis under `docs/product/research/`, while `MATRIX_BASE` pins a tree that still
# holds both at their old paths — so the answer depends on the tree being read, and a
# third hand-written copy of the list is a third thing to forget. `lookup.py` owns it and
# both doors below read the same answer.
#
# The RANGES stay here deliberately. They are what lets this run from a clean checkout
# with no scratchpad, which is the property the header promises.

# The bodies NEST — the prototype spec contains the whole wireframes file, the canvas concept
# and the mobile PRD each contain the research synthesis verbatim — so each is read ONCE over
# its own range and never through its container. Same ranges as the plan's `corpus.sh`.
body() {  # $1 = body name, $2 = the "name<TAB>path" table -> that body's absolute path
  printf '%s\n' "$2" | awk -F'\t' -v n="$1" '$1==n{print $2}'
}

materialise() {
  local d="$1"; mkdir -p "$d"
  local B; B="$(python3 "$HERE/lookup.py" --body-paths)"
  sed -n '1,1451p'   "$(body prd        "$B")" > "$d/prd.txt"
  sed -n '1,285p'    "$(body prototype  "$B")" > "$d/prototype.txt"
  sed -n '1,682p'    "$(body uxd        "$B")" > "$d/uxd.txt"
  sed -n '685,1143p' "$(body wireframes "$B")" > "$d/wireframes.txt"
  sed -n '1,783p'    "$(body canvas     "$B")" > "$d/canvas.txt"
  sed -n '1,1635p'   "$(body research   "$B")" > "$d/research.txt"
  sed -n '1,424p'    "$(body jtbd       "$B")" > "$d/jtbd.txt"
  cat                "$(body gallery    "$B")" > "$d/gallery.txt"
}

case "${1:-}" in
  # The forward corpus is the DERIVED BACKLOG, and this matrix is a comparison against it as it
  # stood when the reconciliation ran. That state is pinned by `MATRIX_BASE` below, because the
  # multi-project decision has since edited four notes — and four edits moved the candidate set of
  # 1,205 behavioural rows, a fifth of the matrix. Replaying against the working tree would measure
  # a different corpus and quietly report the committed `cand_n` as wrong.
  #
  # `RP_CORPUS_ROOT` lets the verifier point this at a materialised copy of the pinned state. Unset,
  # it reads the working tree, which is what a reader wants when the backlog has not moved.
  forward) R="${RP_CORPUS_ROOT:-.}"
           corpus=()
           # A heredoc rather than a pipe, so the loop runs in THIS shell and the array it
           # builds survives it. The empty-path guard is not defensive noise: the first
           # version of this loop split on a literal backslash-t rather than a tab, every
           # path came back empty, and appending "$R/" turned the search into a walk of the
           # whole repository — which presents as a hang, not as an error.
           while IFS=$'\t' read -r _kind _path; do
             if [ -z "${_kind:-}" ] || [ "$_kind" = prds ]; then continue; fi
             if [ -z "${_path:-}" ]; then
               echo "candidates.sh: lookup.py --corpus-dirs named no path for '$_kind'" >&2
               exit 3
             fi
             corpus+=("$R/$_path")
           done <<EOF
$(RP_CORPUS_ROOT="$R" python3 "$HERE/lookup.py" --corpus-dirs)
EOF
           ;;
  reverse) BODIES="$(mktemp -d)"; trap 'rm -rf "$BODIES"' EXIT
           materialise "$BODIES"; corpus=("$BODIES") ;;
  *) echo 'usage: candidates.sh {forward|reverse} "<terms>"' >&2; exit 2 ;;
esac

# A term expands to itself plus every alias counterpart, matched on EITHER side of the alias
# table so the expansion works whichever way the row runs. `derived_term` is split on `|`:
# the `collapsed` row holds three terms in one field.
expand() {
  printf '%s\n' "$1"
  awk -F'\t' -v t="$(printf '%s' "$1" | tr 'A-Z' 'a-z')" 'NR>1{
    if (tolower($1)==t) { n=split($2,B,"|"); for(i=1;i<=n;i++) print B[i] }
    n=split($2,B,"|"); for(i=1;i<=n;i++) if (tolower(B[i])==t) print $1
  }' "$HERE/aliases.tsv"
}

# A term is matched as a PHRASE, and UNIONED with the set of files containing every
# significant word of it. Always both — selecting one strategy is not widening.
#
# The fallback is not a nicety. Extractors produce terms like `cost impact` and `scope change`
# — noun phrases rather than entity or screen names — and a phrase-only match returns nothing
# for them. That is an absent PHRASE, not an absent claim, and an empty candidate set resolves
# with NO judgement straight to `absent` and is reported as a Gap. Measured on this corpus:
# phrase-only matching left 172 rows with empty candidate sets; with the fallback, 37. The 135
# difference is the number of findings a phrase-only match would have invented.
STOP=" the and for with from that this when what which into over must should shall have has are its their been than then them not but all any one two per via use used using "
words_of() {
  # `printf '%s\n'`, not `printf '%s'`. Without the trailing newline `tr` emits a last word
  # with no terminator, `read` returns non-zero on it, and the loop exits BEFORE the body runs
  # — silently dropping the final word of every term. Measured: `scope change` yielded only
  # `scope`, so the intersection degenerated to the first word's hits.
  printf '%s\n' "$1" | tr -cs 'A-Za-z' '\n' | while read -r w; do
    [ ${#w} -gt 3 ] || continue
    case "$STOP" in *" $(printf '%s' "$w" | tr 'A-Z' 'a-z') "*) continue ;; esac
    printf '%s\n' "$w"
  done
}
# Strip a trailing plural BEFORE the optional `s?` is appended. Without this the tolerance runs
# one way only: a term arriving already plural gets `\bexampless?\b`, which matches `examples`
# and `exampless` and NOT `example` — so the candidate set silently narrows and the reading that
# set bounds is done against fewer notes than the rule promises. `lookup.py` had the identical
# defect in its own matcher; this is the same repair in the other instrument.
sing() { printf '%s' "$1" | sed -E 's/([^s])s$/\1/'; }
one_term() {
  local t="$1" out
  out="$(grep -rliE "\b$(sing "$t")s?\b" "${corpus[@]}" 2>/dev/null || true)"
  [ -n "$out" ] && printf '%s\n' "$out"
  local first=1 acc="" cur
  while IFS= read -r w; do
    cur="$(grep -rliE "\b$(sing "$w")s?\b" "${corpus[@]}" 2>/dev/null || true)"
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
  done; } | awk 'NF' | sort -u | sed "s|^${BODIES:-@@none@@}/||"
# `awk 'NF'` rather than `grep -v '^$'`. grep exits 1 when it selects no lines, and under
# `set -euo pipefail` that turns a legitimately EMPTY candidate set into a script failure —
# for exactly the rows where the empty set IS the answer, the ones resolving straight to
# `absent`/`retained` with no judgement. awk exits 0 either way.

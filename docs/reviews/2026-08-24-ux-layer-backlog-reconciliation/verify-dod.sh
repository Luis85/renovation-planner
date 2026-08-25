#!/usr/bin/env bash
cd "$(git rev-parse --show-toplevel)"
# Read the COMMITTED data, not the scratchpad copies. Once the matrix and the finding set
# are committed beside the ledger, the scratchpad is a working copy that can drift from what
# a reader will actually check; a verifier reading the copy nobody ships proves nothing about
# the artifact that shipped.
D=docs/reviews/2026-08-24-ux-layer-backlog-reconciliation
SP="$D"; L="$D.md"
# The freeze had ONE exception, taken by the repository owner and recorded in
# `docs/issues/The vault holds many projects, and selecting one is not a portfolio.md`. The gate
# is therefore an ALLOWLIST, not a removal: these four notes may change, the other 223 may not.
# Deleting the gate instead would have retired the pass's central guarantee to permit four edits,
# and there would then be nothing to notice the fifth.
ALLOWED_DERIVED="docs/issues/The vault holds many projects, and selecting one is not a portfolio.md
docs/entities/Project.md
docs/actors/Professional planner.md
docs/requirements/Start a renovation project.md"
not_allowed() {  # reads NUL-safe paths on stdin, prints the ones outside the allowlist
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    printf '%s\n' "$ALLOWED_DERIVED" | grep -qxF "$f" || printf '%s\n' "$f"
  done
}
echo "1  rows with no state:      $(awk -F'\t' 'NR>1 && $9==""' "$SP/rows.tsv" | wc -l | tr -d ' ')  (must be 0)"
echo "1  rows and findings both printed: $(grep -cE 'rows|findings' "$L")  (must be >0)"
echo "1b notes reached:           $(awk -F'\t' 'NR>1 && $2=="reverse"{split($5,a,"::");print a[1]}' "$SP/rows.tsv" | sort -u | wc -l | tr -d ' ')  / 227"
echo "1a note types covered:      $(grep -cE 'requirements/|entities/|business-rules/|components/|actors/|deliverables/|adrs/|issues/' "$L")  (all 8 must appear)"
echo "6  derived notes edited outside the allowlist: $(git status --porcelain -z docs/requirements docs/entities docs/business-rules docs/components docs/actors docs/deliverables docs/adrs docs/issues | tr '\0' '\n' | sed 's/^...//' | not_allowed | wc -l | tr -d ' ')  (must be 0)"

# ASSERT, do not merely print. A verifier that reports its own violations and still exits 0
# is the same defect as a check whose mechanism cannot fail: a worker runs the advertised
# gate, sees the bad numbers scroll past, and proceeds. Every measurement above is restated
# here as a condition, and the script exits non-zero if any of them is wrong.
fail=0

# ---------------------------------------------------------------------------------------------
# THE PINNED CORPUS, MATERIALISED ABOVE ITS FIRST USE.
#
# This matrix compares against the derived backlog AS IT STOOD, and `MATRIX_BASE` pins that state.
# The multi-project decision has since edited four notes, and those four edits moved the candidate
# set of 1,205 behavioural rows — a fifth of the matrix — so replaying against the working tree
# measures a different corpus and reports the committed `cand_n` as wrong. The findings are not
# invalidated by that: a gap says the backlog had no note for something WHEN THE COMPARISON RAN,
# and the backlog gaining one afterwards is the finding being RESOLVED, recorded in `remedy`
# rather than by moving the row.
#
# It lives HERE, at the top, because it did not: the `sections.py` selftest sat above the archive
# and expanded `${PINNED:-.}` to the working tree on every run, so a check this file described as
# pinned was not. That is the third ordering defect in this harness — after an allowlist helper
# defined below its own first use — and the instance fix (move the one call down) leaves the next
# `${PINNED}` added above this point silently unpinned. Defining above every use is what stops
# the class, and the check below is what proves it rather than trusting the layout.
MATRIX_BASE=2253cea3e2d2b4b5285f41b4066137f810ff3ad6
PINNED=""
if git cat-file -e "$MATRIX_BASE^{commit}" 2>/dev/null; then
  PINNED="$(mktemp -d)"; trap 'rm -rf "$PINNED"' EXIT
  git archive "$MATRIX_BASE" docs | tar -x -C "$PINNED" 2>/dev/null || PINNED=""
fi
[ -n "$PINNED" ] || echo "  NOTE matrix base $MATRIX_BASE unavailable; replaying against the working tree"

chk(){ [ "$2" = "$3" ] || { echo "  FAIL $1: expected $2, measured $3"; fail=1; }; }
chk "rows with no state" 0 "$(awk -F'\t' 'NR>1 && $9==""' "$SP/rows.tsv" | wc -l | tr -d ' ')"
# Definition-of-Done item 1 says every row holds exactly ONE OF FIVE states. Checking only for
# emptiness accepts `contradiction`, `Present`, `present?` — a typo or a leftover provisional
# marker — and the finding derivation then silently ignores the row, so an unrecognised
# disagreement disappears without any check failing. Validate against the vocabulary.
chk "rows whose state is outside the five" 0 "$(awk -F'\t' 'NR>1 && $9!="" && $9!="present" && $9!="absent" && $9!="contradictory" && $9!="superseded" && $9!="retained"' "$SP/rows.tsv" | wc -l | tr -d ' ')"
chk "notes reached by a reverse row" 227 "$(awk -F'\t' 'NR>1 && $2=="reverse"{split($5,a,"::");print a[1]}' "$SP/rows.tsv" | sort -u | wc -l | tr -d ' ')"
chk "notes reached by a reverse BEHAVIOURAL row" 227 "$(awk -F'\t' 'NR>1 && $2=="reverse" && $3=="behavioural"{split($5,a,"::");print a[1]}' "$SP/rows.tsv" | sort -u | wc -l | tr -d ' ')"
# The FORWARD side had no coverage gate at all, and every check above would survive losing a
# whole evidence body. The two reverse checks measure the derived side — they ask whether all
# 227 notes were read — and the per-type ledger check measures the same side again. Drop the
# gallery extraction, or the research one, and 227/227 still passes, every per-type covered
# count still matches, the totals still reconcile against a matrix that simply has fewer rows,
# and every Gap and Contradiction originating in that body is silently gone. Nothing named a
# body anywhere in this verifier before this line.
#
# Asserted as CLOSURE in both directions rather than as eight counts: every body contributes at
# least one forward row, and no forward row cites a body outside the eight. Pinning the counts
# themselves would fail on any legitimate row a later pass adds, which is how a gate gets
# relaxed instead of fixed. Watched failing by deleting one body's rows from a copy.
FWD_BODIES="canvas gallery jtbd prd prototype research uxd wireframes"
seen="$(awk -F'\t' 'NR>1 && $2=="forward"{split($5,a,"§"); print a[1]}' "$SP/rows.tsv" | sort -u)"
for b in $FWD_BODIES; do
  echo "$seen" | grep -qx "$b" || { echo "  FAIL no forward row cites evidence body '$b'"; fail=1; }
done
chk "forward rows citing a body outside the eight" "" "$(echo "$seen" | grep -vxE "$(echo $FWD_BODIES | tr ' ' '|')" | tr -d ' \n')"
chk "forward rows whose source carries no section locator" 0 "$(awk -F'\t' 'NR>1 && $2=="forward" && $5 !~ /§/' "$SP/rows.tsv" | wc -l | tr -d ' ')"
# Compare against the MERGE BASE, not the working tree. Task 8 commits the ledger before this
# verifier runs, so a derived-note edit committed alongside it leaves `git status` clean and
# the gate passes while the pass's single most important constraint is violated. The working
# tree cannot answer "did this branch change a derived note"; only the diff against the base
# can. Both are checked — an uncommitted edit is caught too — but the second is the one that
# can actually fail.
#
# And it must FAIL CLOSED when it cannot resolve that base. `git merge-base origin/main HEAD`
# leaves `MB` empty in any checkout without that ref — a clone with no configured remote, a
# fetch of this branch alone, the reviewer's own supplied tree. `git diff ""...HEAD` then fails,
# its error is swallowed by the `wc` pipeline, the count reads 0, and `chk` reports the pass's
# single most important constraint as SATISFIED because it could not be tested. A gate that
# answers "no derived note was edited" when what happened is "no comparison ran" is worse than
# no gate, for the same reason `--selftest` comparing only the state was: it gets quoted.
# Watched failing by pointing it at a ref that does not exist.
# The base must be the BRANCH's base, and `HEAD~1` is not it. That was the previous fallback,
# added to stop this gate passing when it could resolve nothing — and it replaced a gate that did
# not run with one that ran against the wrong thing, which is worse, because it reports a number.
# In a workspace with neither `origin/main` nor `main` the diff would then examine only the tip
# commit and miss a derived-note edit made in any earlier commit of the pull request, while still
# printing "0 outside the allowlist". This branch has a merge commit in it, so `HEAD~1` is
# demonstrably not its base here.
#
# So: a real base, or fail closed. `REVIEW_BASE` lets a reviewer supply one when the workspace has
# no main — an explicit answer rather than a guess that looks like one.
MB=""
for base in origin/main main ${REVIEW_BASE:-}; do
  MB="$(git merge-base "$base" HEAD 2>/dev/null)" && [ -n "$MB" ] && break
  MB=""
done
[ -n "$MB" ] || { echo "  FAIL cannot resolve the branch base (tried origin/main, main, \$REVIEW_BASE); the derived-note gate did not run"; fail=1; }
DERIVED="docs/requirements docs/entities docs/business-rules docs/components docs/actors docs/deliverables docs/adrs docs/issues"
chk "derived notes edited outside the allowlist (uncommitted)" 0 "$(git status --porcelain -z $DERIVED | tr '\0' '\n' | sed 's/^...//' | not_allowed | wc -l | tr -d ' ')"
if [ -n "$MB" ]; then
  chk "derived notes edited outside the allowlist (vs merge base $MB)" 0 "$(git diff --name-only -z "$MB"...HEAD -- $DERIVED | tr '\0' '\n' | not_allowed | wc -l | tr -d ' ')"
fi
chk "findings with no evidence citation" 0 "$(awk -F'\t' 'NR>1 && $5==""' "$SP/findings.tsv" 2>/dev/null | wc -l | tr -d ' ')"
chk "undetermined findings proposing an edit" 0 "$(awk -F'\t' 'NR>1 && $3=="undetermined" && $8!="none"' "$SP/findings.tsv" 2>/dev/null | wc -l | tr -d ' ')"
chk "named rows carrying a union target" 0 "$(awk -F'\t' 'NR>1 && $3=="named" && $11 ~ /,/' "$SP/rows.tsv" | wc -l | tr -d ' ')"

# The finding set must be RECOMPUTABLE from the committed matrix, and identical as a SET —
# not merely equal in total. Totals agreed while every one of the 48 contradiction citations
# differed between the two files, because `rows.tsv`'s pair column was never updated when the
# citations were corrected. A count check cannot see that; a set check is the only thing that
# can, and it is what makes the committed matrix worth committing.
python3 - "$SP" <<'PYCHK' || fail=1
import csv, collections, io, sys
d = sys.argv[1]
rows = [l.rstrip("\n").split("\t") for l in io.open(d + "/rows.tsv", encoding="utf-8")][1:]
dis = [r for r in rows if r[8] in ("contradictory", "superseded")]
pairs = collections.defaultdict(list)
for r in dis: pairs[r[9]].append(r)
rec = {(("Orphan" if any(x[8] == "superseded" for x in rs) else "Contradiction"),)
       + tuple(k.split(">>", 1)) for k, rs in pairs.items()}
gr = collections.Counter(("Gap", r[4], r[0]) for r in rows if r[1] == "forward" and r[8] == "absent")
f = list(csv.DictReader(open(d + "/findings.tsv"), delimiter="\t"))
have = {(r["kind"], r["evidence_cite"], r["derived_cite"]) for r in f if r["kind"] != "Gap"}
hg = collections.Counter((r["kind"], r["evidence_cite"], r["rows"]) for r in f if r["kind"] == "Gap")
bad = 0
for label, a, b in (("contradictions", rec, have), ("gaps", set(gr), set(hg))):
    if a != b:
        print("  FAIL finding set recomputed from rows.tsv differs from findings.tsv (%s): %d only in rows, %d only in findings"
              % (label, len(a - b), len(b - a)))
        bad = 1
print("  finding set recomputed from rows.tsv: %d contradictions + %d gaps%s"
      % (len(rec), sum(gr.values()), ", identical as a set" if not bad else " — SET MISMATCH above"))
sys.exit(bad)
PYCHK

# Every RECEIVED contradiction must carry a provenance verdict, and the join is checked in
# both directions: a trace row naming a finding that is not a received contradiction is as
# wrong as a received contradiction with no trace row.
if [ -f "$SP/provenance.tsv" ]; then
  recv="$(awk -F'\t' 'NR>1 && $2=="Contradiction" && $3=="received"{print $1}' "$SP/findings.tsv" | sort)"
  trac="$(awk -F'\t' 'NR>1{print $1}' "$SP/provenance.tsv" | sort)"
  chk "received contradictions with no provenance row" "" "$(comm -23 <(echo "$recv") <(echo "$trac") | tr -d ' \n')"
  chk "provenance rows naming a non-received contradiction" "" "$(comm -13 <(echo "$recv") <(echo "$trac") | tr -d ' \n')"
  chk "provenance verdicts outside the vocabulary" 0 "$(awk -F'\t' 'NR>1 && $2!="none" && $2!="backlog moves"' "$SP/provenance.tsv" | wc -l | tr -d ' ')"
fi

# The coverage table's instrument, checked against a second implementation and pinned counts
# before any number it produces is believed.
RP_CORPUS_ROOT="${PINNED:-.}" python3 "$SP/sections.py" --selftest >/dev/null \
  || { echo "  FAIL sections.py --selftest"; fail=1; }

# The MECHANICAL half of the match must be reproducible from the committed tree — that is what
# makes an `absent` verdict, and so every one of the 772 Gap findings, checkable rather than
# asserted. A published command that no longer reproduces the committed `cand_n` is a citation
# to something that no longer exists. Sampled with a fixed seed so the check is deterministic,
# and deliberately including rows whose candidate set is EMPTY: those resolve straight to
# `absent` with no judgement, so they are the ones a reader most needs to be able to re-run.
# The forward corpus is the derived backlog, and this matrix compares against it AS IT STOOD.
# `MATRIX_BASE` pins that state. The multi-project decision has since edited four notes, and four
# edits moved the candidate set of 1,205 behavioural rows — a fifth of the matrix — so replaying
# against the working tree measures a different corpus and reports the committed `cand_n` as wrong.
# The findings are not invalidated by that: a gap says the backlog had no note for something when
# the comparison ran, and the backlog gaining one afterwards is the finding being RESOLVED, which
# is recorded in `remedy` rather than by moving the row.
if [ -x "$SP/candidates.sh" ]; then
  python3 - "$SP" > "$SP/.sample.tsv" <<'PYS'
import io, random, sys
d = sys.argv[1]
rows = [l.rstrip("\n").split("\t") for l in io.open(d + "/rows.tsv", encoding="utf-8")][1:]
beh = [r for r in rows if r[2] == "behavioural" and r[6] not in ("", "-")]
random.seed(7)
pick = random.sample([r for r in beh if r[6] != "0"], 12) + [r for r in beh if r[6] == "0"][:3]
for r in pick:
    print("\t".join([r[0], r[1], r[6], r[5]]))
PYS
  miss=0
  while IFS="$(printf '\t')" read -r id dir want terms; do
    got="$(RP_CORPUS_ROOT="${PINNED:-.}" bash "$SP/candidates.sh" "$dir" "$terms" | awk 'NF' | wc -l | tr -d ' ')"
    [ "$got" = "$want" ] || { echo "  FAIL candidates.sh $dir: row $id committed cand_n=$want, reproduced $got"; miss=$((miss+1)); }
  done < "$SP/.sample.tsv"
  echo "  candidates.sh reproduced the committed cand_n on $(( $(wc -l < "$SP/.sample.tsv" | tr -d ' ') - miss ))/$(wc -l < "$SP/.sample.tsv" | tr -d ' ') sampled rows"
  rm -f "$SP/.sample.tsv"
  chk "sampled rows whose cand_n candidates.sh fails to reproduce" 0 "$miss"
else
  echo "  FAIL candidates.sh missing or not executable"; fail=1
fi

# `candidates.sh` answers a BEHAVIOURAL row only. A named row is a different mechanism —
# type-aware, alias-resolved, back-link-guarded — so it needs its own published command and its
# own check, and a gate that covered one while the ledger claimed both would be the exact
# defect this harness exists to catch. `--selftest` replays every named row against `rows.tsv`.
# ---------------------------------------------------------------------------------------------
# THE CORPUS OVERRIDE MUST NOT REACH THE MATRIX.
#
# `RP_CORPUS_ROOT` pins the EVIDENCE, so a replay can read the bodies as they stood. It must not
# also redirect `rows.tsv`: that is the artifact under test, and it is always the committed one.
# `sections.py` resolved both through the same root, so the pinned replay measured pinned evidence
# against the ARCHIVE'S matrix — four rows out of date, still holding the empty-state rows
# withdrawn since. It happened not to change the answer, because those four removed no section's
# last row, and the first correction that did would have made the published pinned command report
# the old matrix silently. `lookup.py` never had it: its artifacts hang off the script's directory.
#
# Checked behaviourally, not by reading the source: run the instrument against two roots that
# differ ONLY in `rows.tsv` — one the pinned tree, one the same tree with `rows.tsv` emptied — and
# require identical output. Pre-fix the swept column collapses to 0 for every body; post-fix the
# two runs are byte-identical.
#
# It exercises the DEFAULT invocation, and that bound was found the hard way: the first probe used
# `--selftest`, which exits before `swept()` is ever called, so it passed against both the fixed
# and the broken instrument and proved nothing. A probe that cannot tell the two apart is not
# evidence, and this one was watched telling them apart before it was believed.
if [ -n "$PINNED" ]; then
  _probe_root="$(mktemp -d)"
  mkdir -p "$_probe_root/docs/reviews/2026-08-24-ux-layer-backlog-reconciliation"
  for _d in user-experience prds product; do
    cp -r "$PINNED/docs/$_d" "$_probe_root/docs/$_d" 2>/dev/null
  done
  : > "$_probe_root/docs/reviews/2026-08-24-ux-layer-backlog-reconciliation/rows.tsv"
  if ! diff -q <(RP_CORPUS_ROOT="$PINNED" python3 "$SP/sections.py" 2>&1) \
                <(RP_CORPUS_ROOT="$_probe_root" python3 "$SP/sections.py" 2>&1) >/dev/null; then
    echo "  FAIL RP_CORPUS_ROOT reaches rows.tsv — sections.py measured the override's matrix, not the committed one"
    fail=1
  else
    echo "  corpus override does not reach the matrix: ok"
  fi
  rm -rf "$_probe_root"
else
  echo "  NOTE matrix base unavailable; skipped the corpus-override/matrix separation check"
fi

# ---------------------------------------------------------------------------------------------
# THE INSTRUMENTS RUN FROM ANYWHERE, INCLUDING WITH A RELATIVE CORPUS ROOT.
#
# `lookup.py`'s docstring promises "Run from anywhere in the repository", and it stopped being
# true the moment `RP_CORPUS_ROOT` arrived: a RELATIVE override was resolved against the caller's
# directory, so `RP_CORPUS_ROOT=. lookup.py` from `docs/` looked for `docs/docs/prds/...` and
# traced back. `candidates.sh` never had the bug because it `cd`s to the top level before reading
# the variable — the three instruments have to agree, and two of them silently did not.
#
# Checked by running them the way the claim says they can be run, from a subdirectory that is not
# the repository root, in both the unset and relative-override forms. A claim in a docstring is
# worth exactly what exercises it.
# The first version of this check was itself wrong, which is the reason it is written out rather
# than compressed: it passed the tool's arguments through an unquoted variable, so "Design System"
# split into two words, the CLI printed its usage, and the check reported the TOOL as broken while
# the tool was fine. Test the instrument before believing what it says about the subject.
_probe=0
_run_from_docs() {  # $1 = RP_CORPUS_ROOT value ("" means unset), rest = command
  local root="$1"; shift
  if [ -n "$root" ]; then
    ( cd docs && RP_CORPUS_ROOT="$root" "$@" ) >/dev/null 2>&1
  else
    ( cd docs && "$@" ) >/dev/null 2>&1
  fi
}
for _mode in "" "."; do
  _label="${_mode:+relative}"; _label="${_label:-unset}"
  _run_from_docs "$_mode" python3 "../$SP/lookup.py" reverse "Design System" \
    || { echo "  FAIL lookup.py fails from docs/ with RP_CORPUS_ROOT $_label — 'run from anywhere' is false"; _probe=1; }
  _run_from_docs "$_mode" python3 "../$SP/sections.py" --selftest \
    || { echo "  FAIL sections.py fails from docs/ with RP_CORPUS_ROOT $_label — 'run from anywhere' is false"; _probe=1; }
done
[ "$_probe" = 0 ] && echo "  instruments run from a subdirectory, unset and relative corpus root: ok"
fail=$(( fail || _probe ))

# ---------------------------------------------------------------------------------------------
# NOTHING EXPANDS $PINNED BEFORE THE ARCHIVE EXISTS.
#
# The invariant this file's own prose asserts: a replay described as pinned reads the pinned tree.
# It was false — `sections.py --selftest` sat above the `git archive` and expanded `${PINNED:-.}`
# to the working tree on every run, so the check ran against a corpus the matrix never compared,
# while the ledger and this script both called it pinned. Review found it; nothing here could.
#
# Scoped to $PINNED deliberately, and the wider version was measured rather than dismissed: a
# general "no variable used before it is assigned" scan reports SEVEN hits on this script and all
# seven are false — a function's own loop variable, an assignment following a `;`, and a mention
# inside a comment. Getting those right needs a bash parser, and a gate that needs a parser it
# does not have is the defect this harness keeps catching in itself. So this checks the one
# variable whose ordering is load-bearing, and says so instead of claiming the class.
python3 - <<'PYP' || fail=1
import io,re,sys
P="docs/reviews/2026-08-24-ux-layer-backlog-reconciliation/verify-dod.sh"
lines=io.open(P,encoding="utf-8").read().split("\n")
# Anchored on where the archive is COMPLETE, not on the first assignment. `PINNED=""` is an
# initialiser three lines above `git archive`, so anchoring there declared the variable ready
# while it still held the empty string — and an expansion inserted in the gap, the exact
# regression this gate exists to prevent, would have passed. Review caught that.
_start = next((i for i,l in enumerate(lines,1) if re.match(r'^\s*MATRIX_BASE=', l)), None)
_ready = next((i for i,l in enumerate(lines,1)
               if _start and i > _start and l.rstrip() == "fi"), None)
if _start is None or _ready is None:
    print("  FAIL verify-dod.sh no longer materialises PINNED in a recognisable block"); sys.exit(1)
define = _ready
# The block's OWN construction lines are the only legitimate expansions before completion.
_BUILD = re.compile(r'mktemp -d|trap |git archive ')
early=[(i,l.strip()[:78]) for i,l in enumerate(lines,1)
       if i < define and not l.lstrip().startswith("#")
       and re.search(r'\$\{?PINNED\b', l) and not _BUILD.search(l)]
print("  $PINNED expanded before the pinned archive is built: %d" % len(early))
for i,l in early:
    print("  FAIL line %d expands $PINNED, but the archive is not complete until line %d — %s"
          % (i,define,l))
sys.exit(1 if early else 0)
PYP

# ---------------------------------------------------------------------------------------------
# NO BACKLINK SURVIVES THE STRIP.
#
# This exists because pinning the selftest HID a defect instead of fixing one: the back-link
# guard assumed a fixed depth, the gallery moved a directory deeper, the anchor TEXT survived
# into the searched body, and `reverse "Design System"` answered `present gallery` from a link
# that means the opposite. Pinning made the verifier green while the published lookup stayed
# wrong on the corpus a reader actually has.
#
# The two checks are split by what each can guarantee, and neither covers the other. The PINNED
# selftest guarantees the published matrix reproduces against the corpus it compared. THIS check
# guarantees the stripper is correct on the corpus that exists NOW.
# Checked on the RESULT, not on the mechanism, which is what finally makes it independent.
# Two rounds were spent broadening a detector to match whatever the stripper's pattern matched —
# attributes, quote styles, nested labels — and review named another valid form each time: an
# UNQUOTED href, a label spanning lines. A detector that has to enumerate the same forms as the
# thing it checks will always trail it by one round.
#
# So this asks the invariant directly of the OUTPUT: after the real strip runs, no anchor pointing
# into a derived folder may remain in the text that gets searched. If the stripper misses a form,
# the anchor is still there and this fails — whatever form it was. It shares the SCOPE rule with
# the tool (`is_backlink`, so both agree what a backlink is) and shares nothing about structure.
#
# It counts what went IN as well as what is left: "0 remaining" and "there were none" print the
# same line otherwise, which is how a check goes silently blind — twice already here.
python3 - <<'PYB' || fail=1
import io,os,re,sys
import importlib.util
spec=importlib.util.spec_from_file_location(
    "lk","docs/reviews/2026-08-24-ux-layer-backlog-reconciliation/lookup.py")
lk=importlib.util.module_from_spec(spec); spec.loader.exec_module(lk)
ATAG=re.compile(r'<a\b[^>]*>', re.S)
HREF=re.compile(r"""\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""", re.S)
def backlinks_in(text):
    out=[]
    for m in ATAG.finditer(text):
        h=HREF.search(m.group(0))
        if not h: continue
        href=next((g for g in h.groups() if g is not None), "")
        if lk.is_backlink(href): out.append(href)
    return out
# The SCOPE rule is the one thing this gate shares with the tool by design, so a defect in it is
# invisible here — `/docs/components/Toast.md` read as external, and the anchor survived while
# this check reported a clean strip. A shared premise cannot be checked by the thing that shares
# it, so the rule is exercised directly against forms written out from its definition.
if not lk.scope_selftest():
    sys.exit(1)
went_in=0; left=[]
for name,path,a,b in lk.BODIES:
    if not os.path.exists(path): continue
    src=io.open(path,encoding="utf-8",errors="replace").read().split("\n")
    text="\n".join(src[a-1:] if b is None else src[a-1:b])
    went_in += len(backlinks_in(text))
    left += [(name,h) for h in backlinks_in(lk.strip_backlinks(text))]
if went_in == 0:
    print("  FAIL the back-link check found no backlinks at all; it has stopped seeing the corpus")
    sys.exit(1)
print("  backlinks into a derived folder: %d in the bodies, %d surviving the strip" % (went_in,len(left)))
for name,href in left:
    print("  FAIL %s still carries %r after stripping — its anchor text is searched as evidence"
          % (name,href))
sys.exit(1 if left else 0)
PYB

# Replayed against the PINNED corpus, exactly as candidates.sh is. Against the working tree it
# measures whatever the backlog and the evidence hold TODAY, which stopped being the corpus the
# matrix compared the moment main gained the plan-editor work.
RP_CORPUS_ROOT="${PINNED:-.}" python3 "$SP/lookup.py" --selftest >/dev/null 2>&1 \
  || { echo "  FAIL lookup.py --selftest"; fail=1; }

# Every id the CLUSTER BULLETS cite must exist and still be a disagreement. Two clusters were
# found narrating rows the matrix does not contain — `f258` and `f967` reclassified to `present`,
# and a split `f632a`/`f632b` that exists in no commit — while every count in the ledger was
# correct, because the counts come from `findings.tsv` and the prose does not. Nothing connected
# the two until this check.
#
# Scoped to BULLETED lines and their continuations: a bullet narrates a live finding, while the
# prose paragraphs around it discuss withdrawn ones BY NAME and must stay able to. That is why
# this reads structure rather than stripping known paragraphs — an exclusion list would need
# editing every time a correction is written, which is the moment it would silently stop working.
# EVERY headline figure in the ledger, swept against the committed artifacts. Six separate
# review rounds have now found a number in the prose disagreeing with `rows.tsv` or
# `findings.tsv` — 546/548, 416/412, 46/47, 31/32, 17/15, 2,247/2,249 — each fixed one at a
# time, each found by a reader rather than a check. The counts were never wrong; they are
# computed. The PROSE quoting them drifted, and nothing compared the two.
#
# Keyed off the DATA, not pinned values: each pattern is built from what the artifacts measure,
# so a legitimate change updates what is checked instead of failing. A pinned table would need
# editing on every real change, which is the moment it would be edited to whatever makes it pass.
# EVERY labelled total in the live half, not the ones this file remembered to list. The sweep
# below was built by enumerating known places and missed nine figures across five sections —
# which is the defect the ledger names as the one it is most prone to, committed inside the gate
# written to stop it. This one FINDS the numbers instead: any integer adjacent to a metric word,
# above a floor that separates a total from a cluster size. It caught three more the review had
# not named. Its own limit, stated because it cannot reach it: a BARE number under a heading has
# no metric word beside it and is invisible here — those stay in the targeted sweep below.
# ---------------------------------------------------------------------------------------------
# A NAMED IDENTITY ROW MUST NOT BE A QUALIFIED FORM OF A NOTE THE BACKLOG ALREADY HAS.
#
# `components/`, `entities/` and `actors/` are IDENTITY targets: a thing is present iff a note IS
# it, so an `absent` named row into one of them asserts the backlog is MISSING A THING. Review
# found four rows where that was a category error — PRD §24 heads four worked EXAMPLES of one
# empty state ("No Projects", "No Spaces", "No Work", "No Costs"), and the extractor read each
# heading as the name of a separate component. `components/Empty state.md` already models exactly
# one component whose cause and message vary, so those four rows demanded four notes for four
# configurations of a note that exists, and produced four false gaps.
#
# Checked at the forbidden SHAPE rather than by listing the four: a named identity row whose
# subject ends in the full title of a note in its own target directory is a qualified form of
# that note, not a new thing. Run over all 48 absent named component rows it returned exactly the
# four review named and nothing else, which is what made it safe to adopt as a gate rather than
# a cleanup. It reads the PINNED tree, because it is a claim about the corpus the matrix measured.
#
# SCOPED BY MEASUREMENT, not by taste. `components/` and `actors/` report zero. `entities/` was
# tried and reports ELEVEN, and reading them is what settled it: the shape does not transfer,
# because an entity subject is frequently a VERB PHRASE that merely ends in an entity name —
# "Start with a Blank Plan (starting method)", "Import Plan (project entry mode)", "Starting
# Method options: Import a Floor Plan, Draw a Plan, Start Without a Plan". None is `Plan`
# configured; each is a choice a wizard offers. The tail test cannot tell an adjectival qualifier
# ("No Projects" + "empty state") from a verb phrase's object, so `entities/` stays out rather
# than the gate being loosened until it passes. Excluding a directory to make a gate quiet is the
# move this ledger warns about, so the reason is the reading, not the count.
#
# ONE of those eleven may be the real thing and is deliberately NOT actioned here: `f389`, which
# asks `entities/` for a "Last Project" note when `Project.md` exists. It is an adjectival
# qualifier and fits the shape. Re-judging a row the review did not raise, on a pinned matrix,
# belongs to its own pass with its own reading — not to the commit that repairs a different row.
#
# What it cannot see, stated because the shape is narrower than the defect: a qualified form
# whose subject does not END in the note's title ("empty state for No Projects"), and a category
# error against a note the backlog does NOT have, which no lookup can distinguish from a real gap.
python3 - "${PINNED:-.}" <<'PYQ' || fail=1
import io,os,re,sys,csv
D='docs/reviews/2026-08-24-ux-layer-backlog-reconciliation'
root=sys.argv[1]
rows=list(csv.DictReader(io.open(D+'/rows.tsv',encoding='utf-8'),delimiter='\t'))
bad=[]
for tgt in ('components','actors'):
    d=os.path.join(root,'docs',tgt)
    if not os.path.isdir(d): continue
    titles={p[:-3].lower() for p in os.listdir(d) if p.endswith('.md')}
    for r in rows:
        if not(r['kind']=='named' and r['target']==tgt and r['state']=='absent'): continue
        subj=re.sub(r'\s*\([^)]*\)\s*$','',r['subject']).strip()
        w=subj.split()
        for n in (3,2,1):
            if len(w)<=n: continue
            if ' '.join(w[-n:]).lower() in titles:
                bad.append((r['id'],tgt,r['subject'],' '.join(w[-n:]))); break
print("  absent named identity rows that are a qualified form of an existing note: %d" % len(bad))
for rid,tgt,subj,tail in bad:
    print("  FAIL %s asks %s/ for %r, which is %r configured — not a missing thing" % (rid,tgt,subj,tail))
sys.exit(1 if bad else 0)
PYQ

# The ledger's ONE executable worked example must actually be true. It printed a finding id
# (`g92`) that belongs to a different row than the one its own commands select — a reader running
# the block would have seen `g96` come back and the label contradict it. Nothing checked it: the
# sampled candidates.sh gate replays 15 rows chosen by seed, and the figure sweeps look at totals.
# A provenance verdict that says the two passages DO NOT CONFLICT, on a finding still filed as a
# Contradiction. This has happened three times — `c47`/`r1640`, `c49`/`r519`, and `c6` — and each
# time the refutation was already written down in this ledger's own materials and nobody read it
# back. The trace was run to answer a different question (did the derived note drift from its
# sources?) and its prose kept answering a second one nothing consumed.
#
# Its limit, stated because the check cannot reach past it: this matches a PHRASING, not a meaning.
# It is deliberately narrow — "new evidence, not a drift" is the NORMAL case and must not trip it,
# because that says the note is faithful while the disagreement stands between two received
# documents, which is what most of these findings are. `c2` and `c7` say exactly that and stay.
python3 - <<'PYP' || fail=1
import io, re, sys
D = "docs/reviews/2026-08-24-ux-layer-backlog-reconciliation"
prov = [l.rstrip("\n").split("\t") for l in io.open(D + "/provenance.tsv", encoding="utf-8")][1:]
finds = {f.split("\t")[0]: f.rstrip("\n").split("\t")
         for f in io.open(D + "/findings.tsv", encoding="utf-8")}
NO_CONFLICT = re.compile(r"rather than contradicting a claim|settles a question the note already"
                         r"|is not a contradiction|do(es)? not contradict", re.I)
bad = []
for r in prov:
    if len(r) < 4:
        continue
    f = finds.get(r[0])
    if f and len(f) > 1 and f[1] == "Contradiction" and NO_CONFLICT.search(r[3]):
        bad.append(r[0])
print("  provenance verdicts saying the passages do not conflict, still filed as Contradiction: %d"
      % len(bad))
for b in bad:
    print("  FAIL %s: its own trace says the evidence does not contradict a claim" % b)
sys.exit(1 if bad else 0)
PYP

python3 - <<'PYW' || fail=1
import io, re, sys
D = "docs/reviews/2026-08-24-ux-layer-backlog-reconciliation"
L = io.open(D + ".md", encoding="utf-8").read()
finds = [f.rstrip("\n").split("\t") for f in io.open(D + "/findings.tsv", encoding="utf-8")][1:]
rows = {r.split("\t")[0]: r.rstrip("\n").split("\t")
        for r in io.open(D + "/rows.tsv", encoding="utf-8")}
m = re.search(r'\$7=="(f\d+[a-z]?)".*?#\s*(g\d+), a Gap, from row (f\d+[a-z]?)', L)
bad = []
if not m:
    bad.append("the worked-example block is gone or reworded")
else:
    sel, label, stated = m.group(1), m.group(2), m.group(3)
    if sel != stated:
        bad.append("block selects %s but says 'from row %s'" % (sel, stated))
    owner = [f[0] for f in finds if len(f) > 6 and sel in f[6].split()]
    if owner != [label]:
        bad.append("row %s belongs to %s, not %s" % (sel, owner or "no finding", label))
    cn = rows.get(sel, [""] * 7)[6]
    if not re.search(r"cand_n = %s\b" % re.escape(cn), L):
        bad.append("block does not state cand_n = %s for %s" % (cn, sel))
print("  worked example checked against the artifacts: %s" % ("ok" if not bad else "WRONG"))
for b in bad:
    print("  FAIL worked example: %s" % b)
sys.exit(1 if bad else 0)
PYW

python3 - <<'PYL' || fail=1
import io,re,sys,collections
D='docs/reviews/2026-08-24-ux-layer-backlog-reconciliation'
L=io.open(D+'.md',encoding='utf-8').read()
# Find the history boundary by PATTERN, not by its current wording — the heading counts the
# corrections, so it is renamed by every round, and hard-coding it made this gate crash the
# first time the count moved.
# Anchored on the SECTION HEADING, not on the counting sentence below it. Three gates depend on
# this boundary, and it was keyed to "N corrections, all from review of the committed matrix" — a
# sentence rewritten on every round. Changing "all" to "all but one", a true and necessary edit,
# made the boundary unresolvable and turned the live half into the whole document; the corrections
# section's own quoted figures then failed three checks at once. A load-bearing anchor may not sit
# on a sentence that every round rewrites.
_b=re.search(r"^## Findings withdrawn after review$", L, re.M)
if not _b:
    print("  FAIL cannot locate the corrections heading that bounds the live half"); sys.exit(1)
live=L[:_b.start()]
rows=[l.rstrip('\n').split('\t') for l in io.open(D+'/rows.tsv',encoding='utf-8')][1:]
rows=[r for r in rows if len(r)==11]
f=[x.rstrip('\n').split('\t') for x in io.open(D+'/findings.tsv',encoding='utf-8')][1:]
f=[x for x in f if len(x)==8]
byid={r[0]:r for r in rows}
st=collections.Counter(r[8] for r in rows); dk=collections.Counter((r[1],r[2]) for r in rows)
kd=collections.Counter(x[1] for x in f); gk=collections.Counter(byid[x[6]][2] for x in f if x[1]=='Gap')
cs=collections.Counter(x[2] for x in f if x[1]=='Contradiction')
# A number next to a metric word is a TOTAL when it is large enough to be one; below the floor
# it is a cluster size or a subset ("7 rows", "4 rows, 4 findings") and is not this check's business.
METRICS = {
 "rows":           (1000, {len(rows), st['present'], st['retained'], st['absent'],
                           dk[('forward','behavioural')], dk[('reverse','behavioural')]}),
 "gaps?":          (300,  {kd['Gap'], gk['named'], gk['behavioural']}),
 "findings":       (300,  {len(f), kd['Gap'], sum(1 for x in f if x[2]=="undetermined")}),
 "contradictions": (10,   {kd['Contradiction'], cs['received'], cs['undetermined']}),
}
bad=[]
for word,(floor,ok) in METRICS.items():
    for m in re.finditer(r"([\d][\d,]*)\s*(?:\*\*)?\s*" + word + r"\b", live):
        n=int(m.group(1).replace(",",""))
        if n>=floor and n not in ok:
            line=live[:m.start()].count("\n")+1
            bad.append((line,m.group(0).strip(),word,sorted(ok)))
print("  labelled totals in the live half checked against the artifacts; wrong: %d" % len(bad))
for line,txt,word,ok in bad:
    print("  FAIL line %d: %r — %s must be one of %s" % (line,txt,word,ok))
sys.exit(1 if bad else 0)
PYL

# ---------------------------------------------------------------------------------------------
# NO SUPERSEDED TOTAL SURVIVES IN THE LIVE HALF.
#
# The labelled net finds a number by the word beside it, so a total restated with a word that is
# not a metric word is invisible to it — "in 47 places", "the 15 verdicts", "8 of the 47". Round
# eleven found six such restatements and named four; the other two were found by looking for the
# CLASS rather than for the instances, which is what this check is.
#
# It runs the other way round: instead of asking whether a number is right, it asks whether a
# number is one this ledger has ALREADY MOVED PAST. The set is harvested from the corrections
# section by the same METRICS above — every value some metric once held and no longer holds —
# so it is keyed off this document's own history and needs no maintenance when a total changes.
# It therefore holds for figures not yet written, which a list of places never does.
#
# Three exclusions, each measured rather than assumed (they cost 4 false positives and no true
# ones): a table CELL counts something else (`| uxd | 31 | 34 |`), a locator is not a total
# (`docs/README.md:31-32`), and one live sentence deliberately quotes stale figures to explain
# why it no longer prints them. Watched failing by restoring the line-41 and line-75 figures.
#
# What it cannot do, stated because the measurement showed it: the small superseded values
# (14–17) collide with legitimate counts of other things — 17 component notes, 16 prototype
# sections — so the harvest keeps the METRICS floors and this check sees TOTALS only. The
# received-contradiction restatements this round are below that scale and stay in the targeted
# sweep, which is why both mechanisms are needed and neither is described as covering the other.
python3 - <<'PYX' || fail=1
import io,re,collections,sys
D='docs/reviews/2026-08-24-ux-layer-backlog-reconciliation'
L=io.open(D+'.md',encoding='utf-8').read()
_b=re.search(r"^## Findings withdrawn after review$", L, re.M)
if not _b:
    print("  FAIL cannot locate the corrections heading that bounds the live half"); sys.exit(1)
live, hist = L[:_b.start()], L[_b.start():]
rows=[r.rstrip('\n').split('\t') for r in io.open(D+'/rows.tsv',encoding='utf-8')][1:]
rows=[r for r in rows if len(r)==11]
f=[x.rstrip('\n').split('\t') for x in io.open(D+'/findings.tsv',encoding='utf-8')][1:]
f=[x for x in f if len(x)==8]
byid={r[0]:r for r in rows}
st=collections.Counter(r[8] for r in rows); dk=collections.Counter((r[1],r[2]) for r in rows)
kd=collections.Counter(x[1] for x in f); gk=collections.Counter(byid[x[6]][2] for x in f if x[1]=='Gap')
cs=collections.Counter(x[2] for x in f if x[1]=='Contradiction')
METRICS = {
 "rows":           (1000, {len(rows), st['present'], st['retained'], st['absent'],
                           dk[('forward','behavioural')], dk[('reverse','behavioural')]}),
 "gaps?":          (300,  {kd['Gap'], gk['named'], gk['behavioural']}),
 "findings":       (300,  {len(f), kd['Gap'], sum(1 for x in f if x[2]=='undetermined')}),
 "contradictions": (10,   {kd['Contradiction'], cs['received'], cs['undetermined']}),
}
sup=set()
for word,(floor,ok) in METRICS.items():
    for m in re.finditer(r"([\d][\d,]*)\s*(?:\*\*)?\s*"+word+r"\b", hist):
        n=int(m.group(1).replace(",",""))
        if n>=floor and n not in ok: sup.add(n)
QUOTING=re.compile(r'came to print|used to (?:read|say)|(?:read|said|reading) "')
bad=[]
for i,src in enumerate(live.split("\n")):
    if src.lstrip().startswith("|") or QUOTING.search(src): continue
    for m in re.finditer(r"(?<![\d,.:\u00a7#/`c-])([\d][\d,]*)(?![\d,.]*[\d%/])(?!-\d)", src):
        n=int(m.group(1).replace(",",""))
        if n in sup: bad.append((i+1,n,src.strip()))
print("  superseded totals surviving in the live half: %d  (harvested set: %s)"
      % (len(bad), ",".join(str(x) for x in sorted(sup))))
for line,n,src in bad:
    print("  FAIL line %d: %d is a total this ledger has already moved past — %s" % (line,n,src[:90]))
sys.exit(1 if bad else 0)
PYX

python3 - <<'PYS' || fail=1
import io,re,collections,sys
D='docs/reviews/2026-08-24-ux-layer-backlog-reconciliation'
L=io.open(D+'.md',encoding='utf-8').read()
rows=[r.rstrip('\n').split('\t') for r in io.open(D+'/rows.tsv',encoding='utf-8')][1:]
rows=[r for r in rows if len(r)==11]
f=[x.rstrip('\n').split('\t') for x in io.open(D+'/findings.tsv',encoding='utf-8')][1:]
f=[x for x in f if len(x)==8]
byid={r[0]:r for r in rows}
st=collections.Counter(r[8] for r in rows)
dk=collections.Counter((r[1],r[2]) for r in rows)
kd=collections.Counter(x[1] for x in f)
cs=collections.Counter(x[2] for x in f if x[1]=='Contradiction')
gk=collections.Counter(byid[x[6]][2] for x in f if x[1]=='Gap')
und=sum(1 for x in f if x[2]=='undetermined')
nprov=len([l for l in io.open(D+'/provenance.tsv',encoding='utf-8').read().rstrip('\n').split('\n')[1:] if l.strip()])
nsite=len([x for x in f if x[1]=='Contradiction' and ('Site.md' in x[5] or 'Outdoor area.md::Relationships' in x[5] or 'Project.md::Relationships' in x[5])])
fwdbody=collections.Counter(r[4].split('\u00a7')[0].strip('"').strip() for r in rows if r[1]=='forward')
ndl=len([x for x in f if x[1]=='Contradiction' and 'Disclosure ladder' in x[5]])
# Every finding maps to exactly one row (measured: no finding's `rows` field carries a separator),
# so the direction partition is a count of those rows, not a set union over several.
_dirof={r[0]:r[1] for r in rows}
crev=len([x for x in f if x[1]=='Contradiction' and _dirof[x[6]]=='reverse'])
cfwd=len([x for x in f if x[1]=='Contradiction' and _dirof[x[6]]=='forward'])
_rowof={}
for _x in f:
    for _r in _x[6].split(): _rowof[_r]=_x[0]
    _rowof[_x[0]]=_x[0]
_cs=L.index("## Contradictions, by cluster"); _ce=L.index("\n## Gaps")
_parts=re.split(r"\n### ([A-I])\. ", L[_cs:_ce])
nag=sum(len({_rowof[y] for y in re.findall(r"`([fr]\d+[a-z]?|c\d+)`", _parts[i+1]) if y in _rowof})
        for i in range(1,len(_parts),2) if _parts[i] not in ("H","I"))
def c(n): return "{:,}".format(n)
# Each entry: label, and a template whose {} is filled FROM THE DATA. The gate therefore
# tracks the artifacts rather than a pinned number, so a legitimate change updates what is
# checked instead of failing.
checks=[
 ("matrix rows",             r"\| matrix rows \| \*\*%s\*\* \|" % c(len(rows))),
 ("forward, named",          r"\| ├ forward, named \| %s \|" % c(dk[('forward','named')])),
 ("forward, behavioural",    r"\| ├ forward, behavioural \| %s \|" % c(dk[('forward','behavioural')])),
 ("reverse, named",          r"\| ├ reverse, named \| %s \|" % c(dk[('reverse','named')])),
 ("reverse, behavioural",    r"\| └ reverse, behavioural \| %s \|" % c(dk[('reverse','behavioural')])),
 ("retained",                r"\| `retained` \| %s \|" % c(st['retained'])),
 ("present",                 r"\| `present` \| %s \|" % c(st['present'])),
 ("absent",                  r"\| `absent` \| %s \|" % c(st['absent'])),
 ("contradictory",           r"\| `contradictory` \| %s \|" % c(st['contradictory'])),
 ("Contradiction findings",  r"\| Contradiction \| \*\*%s\*\* \|" % c(kd['Contradiction'])),
 ("Gap findings",            r"\| Gap \| \*\*%s\*\* \|" % c(kd['Gap'])),
 ("findings.tsv size",       r"\| `findings\.tsv` \| %s \|" % c(len(f))),
 ("received contradictions", r"received contradictions\s+%d" % cs['received']),
 ("traced n of n",           r"traced to the sections their note cites\s+%d / %d" % (cs['received'],cs['received'])),
 ("undetermined contras",    r"The other %d come from the two folders" % cs['undetermined']),
 ("named gaps heading",      r"\*\*%d named gaps\*\*" % gk['named']),
 ("gap split in Checks",     r"%d named \+ %d behavioural" % (gk['named'],gk['behavioural'])),
 ("disagreement rows",       r"disagreement rows\s+%d" % st['contradictory']),
 ("disagreement findings",   r"disagreement findings\s+%d" % kd['Contradiction']),
 ("undetermined findings",   r"%d of the %d matrix findings" % (und,len(f))),
 # The decision-1 summary restates BOTH halves of the partition in prose. Review found all
 # three of its numbers stale in one sentence while the table above it was correct.
 ("decision-1 undetermined",  r"the %d contradictions now carrying `undetermined`" % cs['undetermined']),
 ("decision-1 received",      r"standing the other %d already have" % cs['received']),
 ("decision-1 traced",        r"All %d already-received contradictions were traced" % cs['received']),
 ("decision-1 faithful",      r"and all %d came back faithful" % cs['received']),
 # Round seven of the same defect found four MORE prose counts the first sweep did not reach:
 # the narration promise, a cluster's own row count, the gap-citation figure in the honesty
 # paragraph, and the provenance row count in the artifact table. Each lives in a different
 # section, which is the point — the sweep has to follow the numbers, not the headings.
 ("narration promise",        r"\*\*All %d appear below\*\*" % kd['Contradiction']),
 ("provenance.tsv size",      r"\| `provenance\.tsv` \| %d \|" % nprov),
 ("gap citations in prose",   r"does not print %d gap citations" % kd['Gap']),
 ("cluster B size",           r"\*\*%d rows, %d findings\.\*\* The entity notes model" % (nsite,nsite)),
 # The cluster tallies and the most-contradicted-note figure are derived, and were stale twice.
 ("Disclosure ladder count",  r"`deliverables/Disclosure ladder\.md` alone accounts for %d\." % ndl),
 ("cluster E size",           r"\*\*%d rows, %d findings — the most contradicted note" % (ndl,ndl)),
 ("clusters A-G total",       r"[Ss]even themed clusters carry %d" % nag),
 # A PER-BODY row count restated outside the summary table. The labelled net cannot see it: at 95
 # it sits below the `rows` floor that exists to skip cluster sizes, so the floor that keeps the
 # net quiet is exactly what hides this one. That is what the targeted sweep is for.
 ("jtbd forward rows in prose", r"producing %d forward rows" % fwdbody["jtbd"]),
 # A BARE number under a heading has no metric word beside it, so the labelled-total net below
 # cannot see it. The gap section opens with one, and it was stale for three rounds.
 ("gap section headline",     r"## Gaps\n\n\*\*%d\*\*, of which %d are named" % (kd['Gap'], gk['named'])),
 ("behavioural gaps heading", r"\*\*%d behavioural gaps\*\*" % gk['behavioural']),
 ("rows.tsv size",            r"\| `rows\.tsv` \| %s \|" % c(len(rows))),
 # Round eleven. Six more restatements, in FIVE sections, none of them reachable by the labelled
 # net: three name the total with a word that is not a metric word ("places", "verdicts", a bare
 # "of the N"), two sit below the `findings` floor, and one lives beneath the corrections heading
 # that bounds the live half. Every one was a SECOND COPY of a figure stated correctly elsewhere.
 ("most-contradicted restated", r"with %d of the %d\. Beside those" % (ndl,kd['Contradiction'])),
 ("orphans sentence",         r"contradicts the backlog in %d places" % kd['Contradiction']),
 ("received restated",        r"each of those %d was traced back" % cs['received']),
 ("faithful restated",        r"and all %d read faithfully" % cs['received']),
 ("provenance restated",      r"the %d verdicts with the sections" % nprov),
 ("coalesced-pair paragraph", r"%d disagreement rows resolve to %d\nfindings" % (st['contradictory'],kd['Contradiction'])),
 # This one is BELOW the corrections heading, inside correction 19, yet states a present-tense fact
 # re-derivable from the artifacts. The live/historical split is positional, and position turned
 # out to be a proxy for liveness that fails on a correction which explains a figure by restating it.
 ("direction partition",      r"\*\*%d of the %d contradictions rest on reverse rows alone\*\*, against %d on forward rows" % (crev,kd['Contradiction'],cfwd)),
 # The Checks block's selftest ratio is the NAMED ROW COUNT, and at 678 it sits below the `rows`
 # floor exactly as the jtbd per-body count did — the same blind spot, found the same way, one
 # round later. Computed from the matrix rather than pinned.
 ("lookup selftest ratio",   r"lookup\.py reproduces the committed named state\s+%d / %d named rows"
                             % ((dk[('forward','named')]+dk[('reverse','named')],)*2)),
 ("per-body forward rows",    r"prd %d, canvas %d, prototype %d, uxd %d,\nwireframes %d, jtbd %d, research %d, gallery %d\." % tuple(fwdbody[k] for k in ("prd","canvas","prototype","uxd","wireframes","jtbd","research","gallery"))),
]
# EVERY COPY, not one of them. The sweep above uses re.search, so an entry is satisfied by a
# single correct occurrence — which makes it structurally blind to the defect it exists to catch,
# because every stale figure in this ledger has been a SECOND COPY of one that was right. Review
# found the named-row count corrected in the Checks block while three other copies still read 682,
# and the sweep passed clean on all three.
#
# These entries invert it: a SHAPE with a numeric group, where every match must equal the measured
# value. One shape covers all copies of a figure, the ones written and the ones not yet written.
#
# The general version was measured and refused: scanning the live half for any "<number> <unit>"
# and flagging a unit stated with two different values reports NINE units, essentially all
# legitimate — "rows" alone correctly carries 2, 4, 6, 7, 37 and 66 across cluster sizes and
# totals. Internal disagreement is not by itself a defect in a document that counts many things,
# so this stays per-figure and says so.
NAMED = dk[('forward','named')] + dk[('reverse','named')]
everywhere = [
 ("named-row count",       r"(\d+) named rows",                          NAMED),
 ("named-row ratio",       r"(\d+) / (\d+) named rows",                  NAMED),
 ("selftest N of N",       r"committed state: \*\*(\d+) of (\d+)\*\*",   NAMED),
]
# Scanned over the LIVE half only, and that bound was found by the check reporting a true hit it
# should not have: correction 7 records that "18 named rows" were rescored, which is a count of
# rows that correction moved, not the total. The historical half quotes superseded figures ON
# PURPOSE, so a shape general enough to be useful there would fail on every correction record.
_lb=re.search(r"^## Findings withdrawn after review$", L, re.M)
_live = L[:_lb.start()] if _lb else L
wrong=[]
for label,shape,want in everywhere:
    for m in re.finditer(shape,_live):
        for g in m.groups():
            if int(g)!=want:
                wrong.append((label,_live[:m.start()].count("\n")+1,m.group(0).strip(),want))
print("  restatements checked at every copy: %d shapes, disagreeing: %d" % (len(everywhere),len(wrong)))
for label,line,txt,want in wrong:
    print("  FAIL line %d: %r — every %s must read %d" % (line,txt,label,want))

bad=[n for n,p in checks if not re.search(p,L)]
print("  ledger figures swept against the committed data: %d, disagreeing: %d" % (len(checks),len(bad)))
for n in bad: print("  FAIL ledger does not print the measured value for: %s" % n)
sys.exit(1 if (bad or wrong) else 0)
PYS

python3 - <<'PYC' || fail=1
import io, re, sys
D = "docs/reviews/2026-08-24-ux-layer-backlog-reconciliation"
L = io.open(D + ".md", encoding="utf-8").read()
rows = {r.split("\t")[0]: r.rstrip("\n").split("\t") for r in io.open(D + "/rows.tsv", encoding="utf-8")}
finds = {f.split("\t")[0]: f.rstrip("\n").split("\t") for f in io.open(D + "/findings.tsv", encoding="utf-8")}
body = L[L.index("## Contradictions, by cluster"):L.index("\n## Gaps")]
bullets, cur = [], None
for line in body.split("\n"):
    if line.startswith("- "):
        cur = line; bullets.append(cur)
    elif cur is not None and line.startswith("  "):
        bullets[-1] += " " + line.strip()
    else:
        cur = None
ids = set()
for b in bullets:
    ids |= set(re.findall(r"`([fr]\d+[a-z]?|c\d+)`", b))
bad = []
for i in sorted(ids):
    if i not in rows and i not in finds:
        bad.append((i, "does not exist"))
    elif i in rows and rows[i][8] not in ("contradictory", "superseded"):
        bad.append((i, "state is " + rows[i][8]))
print("  cluster bullets cite %d ids; not narratable as contradictions: %d" % (len(ids), len(bad)))
for i, why in bad:
    print("  FAIL cluster cites %s but %s" % (i, why))
sys.exit(1 if bad else 0)
PYC
RP_CORPUS_ROOT="${PINNED:-.}" python3 "$SP/lookup.py" --selftest 2>/dev/null | tail -1

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
    # Parse the table COLUMNS. Taking the first number after the directory name reads the
    # `notes` column, not `covered` — so `| requirements/ | 121 | 0 |` passed a check whose
    # whole purpose is to catch exactly that. Match the row and take the third cell.
    got="$(grep -E "^\|[^|]*\`?$t/\`?[^|]*\|" "$L" | head -1 | awk -F'|' '{gsub(/[^0-9]/,"",$4); print $4}')"
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
  # The BREAKDOWN tables, not just the totals. `lbl` asks whether each headline number appears
  # somewhere; it says nothing about the rows that are supposed to add up to it. The ledger prints
  # matrix rows split two ways — by direction/kind and by state — and a pass that adds rows to one
  # kind updates the total and the state it lands in while the direction/kind sub-row keeps its old
  # value. That happened: seven forward behavioural rows were added and `forward, behavioural`
  # stayed at 897 against a total of 3,073, so the four sub-rows summed to 3,066 and every existing
  # check still passed. Parse both breakdowns out of the ledger and require each to sum to the
  # total it sits under. Watched failing by reverting that one cell.
  # Matched WITHOUT the leading box-drawing character: `[\u251c\u2514]` is a bracket expression over
  # multi-byte UTF-8 and matches nothing under this locale, so a pattern anchored on it measures 0
  # and the check fails for a reason that has nothing to do with the ledger. Found by watching it
  # fail wrongly, which is why the drill is run before the check is believed.
  chk "ledger's direction/kind rows sum to the row total" "$want_rows" \
      "$(grep -E '(forward|reverse), (named|behavioural) \|' "$L" | awk -F'|' '{gsub(/[^0-9]/,"",$3); s+=$3} END{print s+0}')"
  chk "ledger's state rows sum to the row total" "$want_rows" \
      "$(grep -E '^\| .?(retained|present|absent|contradictory|superseded).? \|' "$L" | awk -F'|' '{gsub(/[^0-9]/,"",$3); s+=$3} END{print s+0}')"
  lbl "$want_rows"  "rows"
  lbl "$want_find"  "findings"
  lbl "$want_coal"  "coalesced"
  echo "  (ledger must print: rows=$want_rows findings=$want_find coalesced-pairs=$want_coal)"
fi
exit $fail

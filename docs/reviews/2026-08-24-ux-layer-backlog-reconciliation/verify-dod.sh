#!/usr/bin/env bash
cd "$(git rev-parse --show-toplevel)"
# Read the COMMITTED data, not the scratchpad copies. Once the matrix and the finding set
# are committed beside the ledger, the scratchpad is a working copy that can drift from what
# a reader will actually check; a verifier reading the copy nobody ships proves nothing about
# the artifact that shipped.
D=docs/reviews/2026-08-24-ux-layer-backlog-reconciliation
SP="$D"; L="$D.md"
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
MB=""
for base in origin/main main "$(git rev-parse HEAD~1 2>/dev/null)"; do
  [ -n "$base" ] || continue
  MB="$(git merge-base "$base" HEAD 2>/dev/null)" && [ -n "$MB" ] && break
  MB=""
done
[ -n "$MB" ] || { echo "  FAIL cannot resolve a review base; the derived-note gate did not run"; fail=1; }
DERIVED="docs/requirements docs/entities docs/business-rules docs/components docs/actors docs/deliverables docs/adrs docs/issues"
chk "derived notes edited (uncommitted)" 0 "$(git status --porcelain $DERIVED | wc -l | tr -d ' ')"
if [ -n "$MB" ]; then
  chk "derived notes edited (vs merge base $MB)" 0 "$(git diff --name-only "$MB"...HEAD -- $DERIVED | wc -l | tr -d ' ')"
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
python3 "$SP/sections.py" --selftest >/dev/null || { echo "  FAIL sections.py --selftest"; fail=1; }

# The MECHANICAL half of the match must be reproducible from the committed tree — that is what
# makes an `absent` verdict, and so every one of the 772 Gap findings, checkable rather than
# asserted. A published command that no longer reproduces the committed `cand_n` is a citation
# to something that no longer exists. Sampled with a fixed seed so the check is deterministic,
# and deliberately including rows whose candidate set is EMPTY: those resolve straight to
# `absent` with no judgement, so they are the ones a reader most needs to be able to re-run.
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
    got="$(bash "$SP/candidates.sh" "$dir" "$terms" | awk 'NF' | wc -l | tr -d ' ')"
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
python3 "$SP/lookup.py" --selftest >/dev/null 2>&1 || { echo "  FAIL lookup.py --selftest"; fail=1; }

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
# The ledger's ONE executable worked example must actually be true. It printed a finding id
# (`g92`) that belongs to a different row than the one its own commands select — a reader running
# the block would have seen `g96` come back and the label contradict it. Nothing checked it: the
# sampled candidates.sh gate replays 15 rows chosen by seed, and the figure sweeps look at totals.
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
_b=re.search(r"^[A-Za-z-]+ corrections, all from review of the committed matrix", L, re.M)
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
 # A BARE number under a heading has no metric word beside it, so the labelled-total net below
 # cannot see it. The gap section opens with one, and it was stale for three rounds.
 ("gap section headline",     r"## Gaps\n\n\*\*%d\*\*, of which %d are named" % (kd['Gap'], gk['named'])),
 ("behavioural gaps heading", r"\*\*%d behavioural gaps\*\*" % gk['behavioural']),
 ("rows.tsv size",            r"\| `rows\.tsv` \| %s \|" % c(len(rows))),
 ("per-body forward rows",    r"prd %d, canvas %d, prototype %d, uxd %d,\nwireframes %d, jtbd %d, research %d, gallery %d\." % tuple(fwdbody[k] for k in ("prd","canvas","prototype","uxd","wireframes","jtbd","research","gallery"))),
]
bad=[n for n,p in checks if not re.search(p,L)]
print("  ledger figures swept against the committed data: %d, disagreeing: %d" % (len(checks),len(bad)))
for n in bad: print("  FAIL ledger does not print the measured value for: %s" % n)
sys.exit(1 if bad else 0)
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
python3 "$SP/lookup.py" --selftest 2>/dev/null | tail -1

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

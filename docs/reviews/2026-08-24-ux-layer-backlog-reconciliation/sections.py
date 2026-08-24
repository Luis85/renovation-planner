#!/usr/bin/env python3
"""Measure, per evidence body, which numbered sections it CONTAINS and which produced rows.

Run from the repository root:

    python3 docs/reviews/2026-08-24-ux-layer-backlog-reconciliation/sections.py
    python3 docs/reviews/2026-08-24-ux-layer-backlog-reconciliation/sections.py --selftest

This is the instrument behind the ledger's "Sections swept, beside sections contained" table.
It reads the eight evidence bodies at the line ranges the plan's `corpus.sh` materialises them
over — the ranges are repeated here so the script runs from a clean checkout with no scratchpad,
and `--selftest` checks them against the files.

Both columns count TOP-LEVEL numbered sections: what the body's headings declare, against what
appears in a forward row's `source` field in `rows.tsv`. One unit, named. An earlier version of
the ledger's table mixed two units inside a single row — `contains` counted subsection headings
while `swept` counted distinct source strings — and overstated two bodies as a result.

What this cannot see, stated because the table would otherwise read wider than it is: a section
counted swept may have produced one row out of twenty available claims. This measures REACH, not
depth. `research§21` is the worked example.
"""
import io, os, re, sys, collections, subprocess

# `RP_CORPUS_ROOT` pins the corpus, as in candidates.sh and lookup.py. It agrees with the working
# tree today, and that is a measurement rather than a guarantee: the section counts here are of
# bodies the plan-editor merge also touched, so the agreement is the current state of the corpus
# and not a property of this instrument. It had no such variable until the check for it was run
# with the variable ignored — which is why "identical both ways" proved nothing the first time.
# A RELATIVE override is resolved against the repository root, not the caller's directory, which
# is what `candidates.sh` already does by `cd`-ing to the top level before it reads the variable.
# Without that, `RP_CORPUS_ROOT=.` from `docs/` looked for `docs/docs/prds/...` and traced back —
# against a docstring three lines up that promises this runs from anywhere in the repository.
_TOP = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                      capture_output=True, text=True).stdout.strip() or "."
_CORPUS = os.environ.get("RP_CORPUS_ROOT")
ROOT = (_CORPUS if _CORPUS and os.path.isabs(_CORPUS)
        else os.path.normpath(os.path.join(_TOP, _CORPUS)) if _CORPUS
        else _TOP)
UX = os.path.join(ROOT, "docs/user-experience")
PR = os.path.join(ROOT, "docs/prds")
PD = os.path.join(ROOT, "docs/product")

# name -> (path, first line, last line or None for "to the end"). Same ranges as corpus.sh:
# the bodies NEST, so each is read once over its own range and never through its container.
BODIES = [
    ("prd",        os.path.join(PR, "renovation-project-workspace.md"), 1, 1451),
    ("prototype",  os.path.join(UX, "renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md"), 1, 285),
    ("uxd",        os.path.join(UX, "renovation-project-workspace-UXD.md"), 1, 682),
    ("wireframes", os.path.join(UX, "renovation-project-workspace-wireframes.md"), 685, 1143),
    ("canvas",     os.path.join(UX, "renovation-canvas-concept-interaction-design.md"), 1, 783),
    ("research",   os.path.join(PD, "renovation-planner-user-research-synthesis.md"), 1, 1635),
    ("jtbd",       os.path.join(UX, "renovation-planner-JTBD-research-backlog.md"), 1, 424),
    ("gallery",    os.path.join(UX, "concepts/component-gallery.html"), 1, None),
]

# The CORPUS is pinnable; the MATRIX is not. `ROOT` moves with `RP_CORPUS_ROOT` so the evidence
# bodies can be read as they stood, but `rows.tsv` is the artifact under test and must always be
# the committed one — read from beside this script, exactly as `lookup.py` reads its own.
#
# It resolved through `ROOT` until review caught it, which meant the pinned replay measured the
# pinned evidence against the ARCHIVE'S rows.tsv — a matrix four rows out of date, still holding
# the empty-state rows withdrawn since. It happened not to change the answer, because those four
# removed no section's last row; the first correction that did would have made the published
# pinned command report the old matrix and say nothing.
HERE = os.path.dirname(os.path.abspath(__file__))
ROWS = os.path.join(HERE, "rows.tsv")

# A heading at ANY level, because the bodies do not share one: prd, uxd and research number at
# `#`, canvas, prototype and wireframes at `##`. Any route that fixes a level measures a subset
# and reports it as the whole — which is the defect --selftest exists to catch.
HEAD = re.compile(r"^#+\s+(A\.\d+|\d+)(?:\.\d+)*[.\s]")


def lines(name):
    for path, a, b in [(p, a, b) for n, p, a, b in BODIES if n == name]:
        src = io.open(path, encoding="utf-8", errors="replace").read().split("\n")
        return src[a - 1:] if b is None else src[a - 1:b]
    raise KeyError(name)


def contained(name):
    """Top-level section ids the body's headings declare, in document order."""
    seen, order = set(), []
    for line in lines(name):
        m = HEAD.match(line)
        if m and m.group(1) not in seen:
            seen.add(m.group(1))
            order.append(m.group(1))
    return order


def swept():
    """Top-level section ids that produced at least one forward row, per body."""
    out = collections.defaultdict(set)
    for i, line in enumerate(io.open(ROWS, encoding="utf-8")):
        if i == 0:
            continue
        f = line.rstrip("\n").split("\t")
        if f[1] != "forward" or "§" not in f[4]:
            continue
        body, sec = f[4].split("§", 1)
        m = re.match(r"(A\.\d+|\d+)", sec)
        if m:
            out[body].add(m.group(1))
    return out


def order(s):
    return (0, int(s)) if s.isdigit() else (1, int(s.split(".")[1]))


if "--selftest" in sys.argv:
    # Two independent checks, because either alone tests nothing.
    #
    # (a) PINNED counts, verified by hand against the files. If the heading reader and the
    #     shell route below both drifted the same way, only a literal catches it.
    # (b) A SECOND IMPLEMENTATION, in shell with its own regex, over the same range.
    PINNED = {"research": 33, "prd": 39, "uxd": 34}
    ok = True
    for name, path, a, b in BODIES:
        if name == "gallery":
            continue                      # HTML: no numbered sections to count
        mine = len(contained(name))
        rng = "%d,%dp" % (a, b) if b else "%d,$p" % a
        shell = subprocess.run(["sh", "-c",
            "sed -n '%s' %s | grep -ohE '^#+ +(A\\.[0-9]+|[0-9]+)([.][0-9]+)*[. ]' "
            "| sed -E 's/^#+ +//; s/^(A\\.[0-9]+|[0-9]+).*/\\1/' | sort -u | wc -l"
            % (rng, path)], capture_output=True, text=True).stdout.strip()
        pin = PINNED.get(name)
        good = (str(mine) == shell) and (pin is None or pin == mine)
        print("  selftest %-11s instrument=%-4d shell=%-4s%s  %s" % (
            name, mine, shell, "" if pin is None else ("  pinned=%d" % pin),
            "ok" if good else "FAIL"))
        ok &= good
    print("  selftest:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)

sw = swept()
print("%-11s %7s %9s  %s" % ("body", "swept", "contains", "not swept"))
for name, path, a, b in BODIES:
    if name in ("gallery", "jtbd"):
        print("%-11s %7s %9s  %s" % (name, "—", "—",
              "not numbered by section; see the ledger's limit note"))
        continue
    c, s = contained(name), sw.get(name, set())
    miss = [x for x in c if x not in s]
    extra = [x for x in sorted(s, key=order) if x not in c]
    print("%-11s %7d %9d  %s%s" % (
        name, len([x for x in c if x in s]), len(c),
        ", ".join("§" + x for x in miss) or "—",
        ("   [row sources naming no heading: " + ", ".join("§" + x for x in extra) + "]")
        if extra else ""))

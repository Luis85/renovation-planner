#!/usr/bin/env python3
"""The named-thing lookup: the mechanical half of the match for a NAMED row.

Run from anywhere in the repository.

    lookup.py forward requirements "Cost View"
    lookup.py forward requirements,deliverables "Project Home"
    lookup.py reverse "Design System"
    lookup.py --selftest

`candidates.sh` is the companion for BEHAVIOURAL rows and does not answer this question. A
named row is not a candidate set narrowed by judgement — it is a lookup that settles the row
on its own, so it is a different mechanism and needs its own command. Three things make it
different, and each was a defect before it was a rule:

* **TYPE-AWARE.** A forward named row carries a `target` — the note type that would hold the
  thing — and is searched only there. Searching all five hides a gap: a component named
  incidentally in a requirement, with no component note, comes back `present`. `Project Home`
  is the worked example: `absent` against `requirements/`, `present` against `deliverables/`,
  and a union of the two scores it present and the missing Feature never becomes a Gap.
* **ALIAS-RESOLVED, IN TWO PASSES.** The alias table is an output of this lookup and an input
  to it. `DIY Renovator` files as `absent` on the first pass and `Private renovator` as
  `retained`; they are one rename seen from two ends. The second pass re-resolves through
  `aliases.tsv` — and only inside the row's own target, because resolving through the table's
  note path without re-checking the target reintroduces the first defect after the fact.
* **WORD-BOUNDED, IN BOTH DIRECTIONS.** A literal search reads a name inside a longer word as
  a mention: `Order` on `borders`, `Layer` on `layered`. Forward, that let incidental prose
  stand in for a note; reverse, it let a body it does not appear in stand in for evidence.
  Three reverse rows rested on one such hit and none of the three moves state — each is named
  properly by another body — so this refuses a class rather than repairing a count. What it
  does NOT do is judge sense, which is why `matched` names every body rather than one.
* **PLURAL-TOLERANT IN BOTH DIRECTIONS TOO, which `s?` alone is not.** Appending it to a name
  that already ends in `s` asks for `\bIssuess?\b`, which matches neither `Issue` nor
  anything else the row means; `Issues` and `Scenarios` read `retained` against bodies that
  name both. The name is reduced to its singular BEFORE the optional `s` is added, so the
  tolerance runs both ways instead of only from singular to plural.
* **ANNOTATION-STRIPPED, within bounds.** The extractor wrote `Project Home (screen)`, and
  searching that literally is what made the header's own worked example come back with the
  wrong answer. `annotation_stripped` says when the parenthetical may be dropped and why the
  bound is not optional.
* **BACK-LINK-GUARDED, in reverse.** The gallery is HTML and links back into the corpus it is
  compared against: `<a href="../deliverables/Design%20System.md">Design System</a>`. A literal
  grep reads that as the evidence naming the thing. It is the evidence pointing AT the derived
  note, which is the one thing that cannot show the note has a counterpart. Exactly three lines
  in the corpus match; only `Design System` loses its sole hit.

`--selftest` replays every one of the 686 named rows against the states committed in
`rows.tsv`. That is the whole point of publishing it: a command that no longer reproduces the
matrix is a citation to something that no longer exists.
"""
import io, os, re, subprocess, sys, tempfile, shutil

ROOT = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                      capture_output=True, text=True).stdout.strip() or "."
HERE = os.path.dirname(os.path.abspath(__file__))
UX = os.path.join(ROOT, "docs/user-experience")
PR = os.path.join(ROOT, "docs/prds")
PD = os.path.join(ROOT, "docs/product")

# Same ranges as candidates.sh and the plan's corpus.sh: the bodies NEST, so each is read once
# over its own range and never through its container.
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
BACKLINK = re.compile(
    r'<a href="\.\./(deliverables|components|entities|requirements|actors|business-rules|adrs|issues)/[^"]*">[^<]*</a>')

ROLE = (r"(persona|command|screen|view|pane|tab|section|component|actor|entity|concept"
        r"|feature|artifact|deliverable|layer|tool|mode|state)")


def norm(s):
    """Extractors wrote `DIY Renovator persona`, `Property (pane)`. The alias table holds bare
    names, so exact matching on the raw subject missed the rename this lookup exists to catch."""
    s = s.strip().lower()
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"[:—–-]+\s*$", " ", s)
    s = re.sub(r"\s+%s\s*$" % ROLE, " ", s)
    return re.sub(r"\s+", " ", s).strip()


def search_view(dst):
    """The eight bodies with back-links into the derived corpus stripped."""
    os.makedirs(dst, exist_ok=True)
    for name, path, a, b in BODIES:
        src = io.open(path, encoding="utf-8", errors="replace").read().split("\n")
        text = "\n".join(src[a - 1:] if b is None else src[a - 1:b])
        io.open(os.path.join(dst, name + ".txt"), "w", encoding="utf-8").write(
            BACKLINK.sub("", text))


def aliases():
    fwd, rev = {}, {}
    for i, line in enumerate(io.open(os.path.join(HERE, "aliases.tsv"), encoding="utf-8")):
        if i == 0:
            continue
        p = line.rstrip("\n").split("\t")
        if len(p) < 4:
            continue
        ev, der, note, _ = p
        fwd[norm(ev)] = note
        for d in der.split("|"):
            if d.strip():
                rev[norm(d)] = ev
    return fwd, rev


# Presence means two different things in the two kinds of target directory, and the corpus
# itself says which — measured, not assumed. `entities/`, `components/` and `actors/` are
# ONE NOTE PER THING: all 59 of them have an H1 identical to their filename, so a thing is
# present there iff a note IS it. `requirements/` (121 Features and PBIs) and `deliverables/`
# (5 inventories — Sitemap, Information Architecture, MVP Prototype …) are the opposite: no
# screen in this corpus is the identity of a note in either, so a screen is present there iff
# a note NAMES it.
#
# Testing both with one substring grep is what let incidental prose stand in for a note. `Wall`
# scored present on `entities/Photo.md`'s "the wall went up"; `Work` on `Constraint.md`'s
# "worked on" and "[[Work package]]". Seven forward rows were present on text like that, and
# each is a real gap: the canvas names Work, Measurement, Note, Wall, Door and Window as
# entities the backlog has no note for, and the UXD names Procurement against a backlog that
# has `Procurement item`.
#
# Applying identity everywhere would have been the mirror defect, fabricating gaps instead of
# hiding them: `Work Packages` and `Trades` are `Work package.md` and `Trade.md` under a
# plural, and all three `Project Home` rows are named inside deliverables that are inventories
# by construction. Hence plural tolerance, and hence the split.
IDENTITY_TYPES = {"entities", "components", "actors"}


def singular(s):
    return s[:-1] if s.endswith("s") and not s.endswith("ss") else s


def identity_index(kind):
    """{normalised name: path} over one directory's note identities — filename stem and H1."""
    out, d = {}, os.path.join(ROOT, "docs", kind)
    if not os.path.isdir(d):
        return out
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".md"):
            continue
        names = {norm(fn[:-3])}
        for line in io.open(os.path.join(d, fn), encoding="utf-8", errors="replace"):
            m = re.match(r"^#\s+(.+?)\s*$", line)
            if m:
                names.add(norm(m.group(1)))
                break
        for n in names:
            if n:
                out.setdefault(singular(n), "docs/%s/%s" % (kind, fn))
    return out


def annotation_stripped(subject):
    """`Project Home (screen)` -> `Project Home`, when what is left is still a NAME.

    The parenthetical is the extractor's note about the ROLE, not part of what the thing is
    called, so searching for it literally makes an annotated row `absent` unless the alias
    table happens to rescue it. `Project Home` against `deliverables/` was exactly that:
    `absent`, while `MVP Prototype.md` names it — the row this module's own header uses as the
    worked example of the opposite answer.

    Stripping is bounded, because unbounded it is the mirror defect. 33 annotated rows have an
    unannotated twin naming the same thing at the same target; 31 already agree, and the two
    that disagree are the two this repairs. Dropping the annotation unconditionally moves 57
    rows instead, nearly all onto a common word — `Open` on the verb, `Tasks` on a `../tasks/`
    link path — hiding 55 gaps to fix 2. Two bounds keep it to the repair:

    * **TWO WORDS OR MORE.** One word left over is not a name, it is a word.
    * **AS WRITTEN.** The annotation was the disambiguator; without it, require the proper
      noun. `MVP Prototype.md` names `Project Home`; `add renovation work` in that same
      sentence is prose about an action, and `[[Start a renovation project]]` is a link to a
      requirement rather than a deliverable naming a screen.

    Its limit, stated because the check cannot reach it: a genuinely one-word screen name, or
    one an inventory writes in lower case, still reads `absent`.
    """
    bare = re.sub(r"\s+", " ", re.sub(r"\([^)]*\)", " ", subject)).strip()
    return bare if bare != subject and len(bare.split()) >= 2 else ""


def names_it(subject, kind):
    """First note in `kind` that NAMES the subject, at word boundaries and plural-tolerant."""
    bare = annotation_stripped(subject)
    flag, name = ("-rlE", bare) if bare else ("-rliE", subject)
    r = subprocess.run(["grep", flag, "--", r"\b%ss?\b" % re.escape(singular(name)),
                        "docs/" + kind], cwd=ROOT, capture_output=True, text=True)
    out = [x for x in r.stdout.split("\n") if x]
    return out[0] if out else ""


def forward(target, subject):
    """(state, matched) for a forward named row with this target and subject."""
    kinds = [t for t in target.split(",") if t and t != "-"]
    for k in kinds:
        if k in IDENTITY_TYPES:
            hit = identity_index(k).get(singular(norm(subject)))
        else:
            hit = names_it(subject, k)
        if hit:
            return "present", hit
    fwd, _ = aliases()
    note = fwd.get(norm(subject))
    # Resolve through the alias table ONLY inside the row's own target. Taking the table's
    # note path unconditionally is how 18 rows came back `present` on a note outside the type
    # they were looking for, which is the defect the target exists to prevent.
    if note and any(note.startswith("docs/" + k + "/") for k in kinds):
        return "present", note
    return "absent", "-"


def bodies_naming(name, view):
    """Every body naming `name`, at word boundaries and plural-tolerant — sorted.

    The same test `names_it` applies forward, and for the same reason: a literal search reads
    a name inside a longer word as a mention. Three reverse rows rested on one — `Order` on
    the prototype's `borders`, `Site` on jtbd's `prerequisite`, `Layer` on research's `layered`.
    """
    pat = r"\b%ss?\b" % re.escape(singular(name))
    r = subprocess.run(["grep", "-rliE", "--", pat, view], capture_output=True, text=True)
    return sorted(os.path.basename(x)[:-4] for x in r.stdout.split("\n") if x)


def reverse(subject, view):
    """(state, every body naming it) for a reverse named row.

    EVERY body, not the first one grep happened to walk into. A single field records whichever
    file the reader opened first, and on a thing several bodies name that is an arbitrary
    answer presented as the answer — the report makes this argument for the forward direction
    and it holds here. It also bounds what word boundaries can do: they refuse a name inside a
    longer word, they cannot judge SENSE. The gallery says `<!-- Order is load-bearing -->`
    about stacking order, which is a boundary-clean hit on a thing that note does not mean;
    listing jtbd and research beside it is what shows the row does not rest on that comment.
    """
    hits = bodies_naming(subject, view)
    if hits:
        return "present", ",".join(hits)
    _, rev = aliases()
    ev = rev.get(norm(subject))
    if ev:
        hits = bodies_naming(ev, view)
        if hits:
            return "present", ",".join(hits)
    return "retained", "-"


def main():
    args = [a for a in sys.argv[1:] if a != "--selftest"]

    if "--selftest" in sys.argv:
        rows = [l.rstrip("\n").split("\t") for l in
                io.open(os.path.join(HERE, "rows.tsv"), encoding="utf-8")][1:]
        named = [r for r in rows if r[2] == "named"]
        fwd_named = [r for r in named if r[1] == "forward"]
        tmp = tempfile.mkdtemp()
        try:
            view = os.path.join(tmp, "bodies-search")
            search_view(view)
            bad = judged = stale = 0
            for r in named:
                if r[1] == "forward":
                    st, m = forward(r[10], r[3])
                else:
                    st, m = reverse(r[3], view)
                if st == r[8]:
                    # The STATE agreeing is not the row agreeing. `matched` is the citation a
                    # reader follows, and a row can keep its state across a repair while its
                    # citation goes stale — which is what happened when presence was split by
                    # target type: 36 rows stayed `present` and went on citing the
                    # incidental-prose note the old substring search had found, `Space` on
                    # `Constraint.md` and `Trade` on `Work package.md`. A selftest comparing
                    # only the state reports 686/686 over all of them, which is worse than no
                    # check — it certifies the half it can see and is silent about the half a
                    # reader actually follows.
                    if r[1] == "forward" and m != r[7]:
                        stale += 1
                        print("  STALE CITATION %-7s %-28s committed=%-38s lookup=%s"
                              % (r[0], r[3][:28], r[7][:38], m))
                    continue
                # A row this lookup settles `present` may afterwards have been READ and found
                # to disagree — both corpora name the thing and mean different things by it.
                # That is the one legitimate divergence: judgement moving a row the mechanical
                # stage placed, never the mechanical stage being irreproducible. Every other
                # difference is a failure, including the reverse of this one.
                if st == "present" and r[8] == "contradictory":
                    judged += 1
                    print("  judged onward %-7s %-9s %-30s present -> contradictory"
                          % (r[0], r[1], r[3][:30]))
                    continue
                bad += 1
                print("  MISMATCH %-7s %-9s %-34s committed=%-9s reproduced=%s"
                      % (r[0], r[1], r[3][:34], r[8], st))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        print("  lookup.py reproduced the mechanical state on %d/%d named rows "
              "(%d moved onward by a reading, %d wrong)"
              % (len(named) - bad, len(named), judged, bad))
        print("  forward named rows whose committed citation it also reproduces: %d/%d"
              % (len(fwd_named) - stale, len(fwd_named)))
        sys.exit(1 if (bad or stale) else 0)

    if len(args) == 3 and args[0] == "forward":
        print("\t".join(forward(args[1], args[2])))
    elif len(args) == 2 and args[0] == "reverse":
        tmp = tempfile.mkdtemp()
        try:
            view = os.path.join(tmp, "bodies-search")
            search_view(view)
            print("\t".join(reverse(args[1], view)))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    else:
        print('usage: lookup.py forward <target[,target]> "<subject>"\n'
              '       lookup.py reverse "<subject>"\n'
              '       lookup.py --selftest', file=sys.stderr)
        sys.exit(2)


main()

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
from html.parser import HTMLParser
import posixpath
from urllib.parse import unquote

# The matrix was computed against ONE state of the corpus, and `RP_CORPUS_ROOT` is how a replay
# names it — the same variable `candidates.sh` takes, for the same reason. Unset it and this reads
# the working tree, which is what a reader wants while the corpus has not moved.
#
# It had no such variable until `candidates.sh` had had one for a while — the sibling defect to the
# one review found there, in the other direction: one instrument was repaired and the other was not
# checked beside it. The rule it serves: a reverse row records what the evidence said WHEN THE
# COMPARISON RAN, so a replay is pinned rather than the matrix being restated.
#
# It arrived for the WRONG REASON, and the wrong reason is recorded here because it was written
# into this file as fact. `Design System` flipping `retained` -> `present` was blamed on the corpus
# moving — on two new evidence files naming it. Neither is in `BODIES`; this tool reads exactly one
# file from that folder. The cause was `BACKLINK` below failing on a deeper path, and pinning the
# replay made the gate green while leaving this tool wrong. **Pinning is not a fix for a parser.**
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
HERE = os.path.dirname(os.path.abspath(__file__))
# WHERE A CORPUS FOLDER LIVES IS RESOLVED AGAINST THE TREE BEING READ, NEVER SPELLED TWICE.
#
# On 2026-08-28 the vault was reorganised: `prds` and `business-rules` moved under
# `docs/product/`, `adrs` and `sdds` under `docs/development/`. `MATRIX_BASE` still pins a
# tree where all of them sit directly under `docs/`, so BOTH layouts are live at once — the
# pinned replay reads the old one, an unpinned run reads the new one, and a hard-coded path
# can only be right about one of them. That is exactly how this tool broke: `docs/prds` was
# correct for the pinned corpus and named nothing in the working tree, so every command
# raised `FileNotFoundError` before it read a single row.
#
# The KIND is the stable name — it is what `rows.tsv` cites, what `--selftest` compares on,
# and what a reader says out loud. Only its container moved, so only the container is probed.
CORPUS_CONTAINERS = ("docs/%s", "docs/product/%s", "docs/development/%s")

# The EVIDENCE bodies move independently of the derived folders and have moved twice: the
# research synthesis sat at `docs/product/` in the pinned tree and is at `docs/product/research/`
# now, and it moved there DURING the repair of the previous move. Bodies are individual files
# rather than folders, so they get their own candidate list; `%s` takes a name that may itself
# carry a directory, which is how the gallery resolves.
BODY_CONTAINERS = ("docs/user-experience/%s", "docs/product/research/%s", "docs/product/%s",
                   "docs/prds/%s", "docs/product/prds/%s")


def _first_existing(candidates, fallback):
    """The first candidate that is really there, or `fallback` so a miss still names something.

    Every caller already tolerates a path that is not there — `identity_index` returns {},
    `names_it` greps a folder that matches nothing — which is what the partial probe trees in
    `verify-dod.sh` need. Returning the canonical spelling rather than "" is what keeps a
    FileNotFoundError pointing at a path a reader recognises.
    """
    for c in candidates:
        if os.path.exists(os.path.join(ROOT, c)):
            return c
    return fallback


def corpus_path(kind):
    """Where one corpus FOLDER sits under ROOT, relative to it."""
    return _first_existing([c % kind for c in CORPUS_CONTAINERS], "docs/%s" % kind)


def body_path(name):
    """Where one evidence BODY sits under ROOT, absolute."""
    return os.path.join(ROOT, _first_existing([c % name for c in BODY_CONTAINERS],
                                              "docs/user-experience/%s" % name))


# Same ranges as candidates.sh and the plan's corpus.sh: the bodies NEST, so each is read once
# over its own range and never through its container.
BODIES = [
    ("prd",        body_path("renovation-project-workspace.md"), 1, 1451),
    ("prototype",  body_path("renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md"), 1, 285),
    ("uxd",        body_path("renovation-project-workspace-UXD.md"), 1, 682),
    ("wireframes", body_path("renovation-project-workspace-wireframes.md"), 685, 1143),
    ("canvas",     body_path("renovation-canvas-concept-interaction-design.md"), 1, 783),
    ("research",   body_path("renovation-planner-user-research-synthesis.md"), 1, 1635),
    ("jtbd",       body_path("renovation-planner-JTBD-research-backlog.md"), 1, 424),
    ("gallery",    body_path("concepts/component-gallery.html"), 1, None),
]
# A link from an evidence document BACK to a derived note is not the evidence naming the thing —
# it is the evidence pointing AT it — so the anchor is stripped before the body is searched.
#
# The depth is not fixed, and assuming it was is what broke: this matched exactly one `../`, and
# when the gallery moved a directory deeper its footer became `../../deliverables/Design%20System.md`.
# The guard stopped matching, the anchor TEXT survived into the body, and `reverse "Design System"`
# answered `present gallery` against a link that means the opposite. Any run of `./` or `../`, with
# or without a `docs/` prefix, now counts — the folder is what identifies a backlink, not the route.
# An evidence document linking BACK to a derived note is not the evidence naming the thing — it is
# the evidence pointing AT it — so the anchor is removed before the body is searched.
#
# PARSED, not pattern-matched, and that is the third attempt. A regex assumed one `../`; broadened,
# it still assumed a quoted href and a single-line label. Each round review named another valid
# form — `<a class=… href=…>`, `<span>`-wrapped labels, an UNQUOTED href, a label spanning lines —
# and each fix enumerated the forms someone had thought of, which is the defect this ledger names
# as the one it is most prone to. HTML has a parser in the standard library; the enumeration ends
# by using it. `convert_charrefs=False` and slicing the ORIGINAL text mean the parser's leniency
# on Markdown costs nothing: it supplies positions, never reconstructed content.
DERIVED_FOLDERS = ("deliverables", "components", "entities", "requirements",
                   "actors", "business-rules", "adrs", "issues")


def kind_of(path):
    """The corpus kind a note path names, or "" — the folder HOLDING the file, not the route.

    The kind is the segment immediately before the filename, and that is what makes this
    survive a container move: `docs/business-rules/X.md` and `docs/product/business-rules/X.md`
    are the same note under two layouts and both answer `business-rules`. Reading segment 0
    after stripping a `docs/` prefix — what `is_backlink` did before — answers `product` for
    the second and silently stops recognising it, which turns a back-link into surviving
    anchor text and a reverse row into a false `present`.

    It is deliberately route-insensitive, which is the property the old spelling had and this
    one keeps: `../components/Toast.md` from `docs/user-experience/concepts/` really resolves
    to a folder that does not exist, and is treated as a derived link anyway. Over-stripping a
    link that means nothing costs nothing; under-stripping a real one costs a row.

    One behaviour it does NOT keep, named because it is a change rather than an accident: a
    route THROUGH a derived folder (`deliverables/nested/x.md`) is no longer a derived link.
    The corpus is flat — 227 notes in eight folders, no subdirectories — so this names no
    real path, and the case is in `SCOPE_CASES` so a corpus that grows one has to decide.
    """
    parts = [p for p in path.split("/") if p not in ("", ".")]
    return parts[-2] if len(parts) >= 2 and parts[-2] in DERIVED_FOLDERS else ""


def is_backlink(href):
    """A link into the derived corpus.

    A SCHEME makes it external, and so does a protocol-relative `//host/...`. Everything else is
    normalised to a vault-relative path before the folder is read: surrounding whitespace, PERCENT
    ENCODING, a ROOT-RELATIVE leading slash, any run of `./` or `../`, and a `docs/` prefix.

    Decoding is not hypothetical: this corpus already writes `Design%20System.md`. It happened to
    encode a character in the FILENAME, where the folder comparison never looked — `%63omponents`
    would have read as a folder that does not exist and the anchor would have survived.

    The path is resolved by `posixpath.normpath` rather than by stripping prefixes one at a time.
    Four consecutive review rounds landed on this function — depth, then quoting, then unquoted and
    multi-line, then root-relative and whitespace, then encoding — and each was one more step
    between a URL and its path. `../tasks/../deliverables/x.md`, `a/../deliverables/x.md` and
    `./docs/./components/Toast.md` all resolve into the derived corpus and all read as external
    before this, which is three more instances of the same sequence waiting to be reported. Handing
    resolution to the standard library is the same move that replaced the anchor regex with a
    parser, one layer down: stop enumerating the steps.

    CASE is deliberately not normalised. `../DELIVERABLES/x.md` stays external because on a
    case-sensitive filesystem that folder does not exist — the rule follows the vault, not the URL.

    KNOWN LIMIT, stated because it was measured and then deliberately not fixed. The path is read
    on its own, NOT resolved from the body that carries it, so the number of `../` does not have to
    be right: `../components/Toast.md` from `docs/user-experience/concepts/` really resolves to
    `docs/user-experience/components/`, is not a derived note, and is stripped anyway — hiding a
    genuine mention. Resolving from the body was built and measured; it fixes that and BREAKS the
    pinned replay, because at `2253cea` the gallery footer read `../deliverables/…`, one level too
    few, until `19c9974` re-rooted the paths a folder move had left behind. Base-relative
    resolution calls that dangling link external, its label counts as evidence, and `r1366`
    reproduces `present` against a committed `retained` — 677/678.

    No rule separates the two: a broken backlink and a coincidental path are the same input, and an
    existence test cannot tell them apart either, since neither `docs/user-experience/components/`
    nor `docs/user-experience/deliverables/` exists. Only INTENT separates them, and intent is not
    available to a path function. The error that does not rewrite committed history is the one
    kept: flipping a row on the strength of a path typo fixed two commits later is what "a row
    records what the evidence said WHEN THE COMPARISON RAN" exists to prevent.

    The leading slash was missing, so `/docs/components/Toast.md` — a valid repository-root URL —
    read as external and its label survived into the searched body. This is the SCOPE rule, the
    one thing the output gate shares with this function by design, so a defect here is invisible
    to it. That is why the rule is exercised directly, form by form, in `scope_selftest`.
    """
    if not href:
        return False
    h = href.strip()
    p = unquote(h.split("#")[0].split("?")[0])
    # The scheme test runs AFTER decoding as well as before, because decoding can produce one.
    if re.match(r"\w+:", h) or re.match(r"\w+:", p) or h.startswith("//") or p.startswith("//"):
        return False
    # The leading `../` run and a `docs/` prefix used to be stripped here so that segment 0
    # could be read as the folder. `kind_of` reads the segment before the FILENAME instead,
    # which needs neither strip and is what survives the containers moving.
    p = posixpath.normpath(re.sub(r"^/", "", p))
    return bool(kind_of(p))


# The scope rule is a pure function, so it is checked against forms written out by hand from the
# rule's definition rather than by a second implementation that could share its assumptions. Each
# entry is a URL a real document could carry; three of them were false before review named the
# first. A table is the right instrument here precisely because enumeration is the WEAKNESS
# elsewhere in this file — for a pure predicate over a small, stable input space it is the
# strength, and the parser above is what stops the enumeration where it does not belong.
SCOPE_CASES = [
    ("../deliverables/Design System.md",       True,  "one level up"),
    ("../../deliverables/Design System.md",    True,  "two levels up"),
    ("./components/Toast.md",                  True,  "explicit same-directory"),
    ("components/Toast.md",                    True,  "bare relative"),
    ("docs/entities/Plan.md",                  True,  "docs-prefixed"),
    ("/docs/components/Toast.md",              True,  "repository-root URL"),
    ("/deliverables/x.md",                     True,  "root URL without docs/"),
    ("  ../deliverables/x.md  ",               True,  "surrounded by whitespace"),
    ("../../%63omponents/Toast.md",            True,  "percent-encoded directory character"),
    ("../deliverables/Design%20System.md",     True,  "percent-encoded filename, as the corpus writes it"),
    ("%2F%2Fhost/deliverables/x",              False, "protocol-relative only after decoding"),
    ("../tasks/../deliverables/x.md",          True,  "interior dot segment"),
    ("a/../deliverables/x.md",                 True,  "interior dot segment, no leading prefix"),
    ("./docs/./components/Toast.md",           True,  "redundant same-directory segments"),
    ("../deliverables//x.md",                  True,  "duplicate slash"),
    ("../DELIVERABLES/x.md",                   False, "case is not normalised: the vault decides"),
    ("../deliverables/x.md#anatomy",           True,  "with a fragment"),
    ("../deliverables/x.md?v=2",               True,  "with a query"),
    ("https://example.com/deliverables/x",     False, "external, http"),
    ("mailto:someone@example.com",             False, "external, mailto"),
    ("//host/deliverables/x",                  False, "protocol-relative"),
    ("../tasks/05-canvas.md",                  False, "a folder that is not derived"),
    ("../deliverablesX/x.md",                  False, "a folder that merely starts the same"),
    ("../../product/business-rules/A rule.md", True,  "a container the corpus gained on 2026-08-28"),
    ("docs/development/adrs/0001-x.md",        True,  "a nested container, docs-prefixed"),
    ("../deliverables/nested/x.md",            False, "a route THROUGH a derived folder is not a note in one"),
    ("",                                       False, "empty"),
    (None,                                     False, "absent"),
]


def scope_selftest():
    bad = [(h, want, why) for h, want, why in SCOPE_CASES if is_backlink(h) is not want]
    for h, want, why in bad:
        print("  FAIL is_backlink(%r) is %s, expected %s — %s" % (h, not want, want, why))
    print("  back-link scope rule: %d forms checked, %d wrong" % (len(SCOPE_CASES), len(bad)))
    return not bad


class _BacklinkStripper(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text, self._lines, self._cuts, self._open = text, text.split("\n"), [], None
        self.feed(text)
        self.close()

    def _offset(self, pos):
        line, col = pos
        return sum(len(l) + 1 for l in self._lines[:line - 1]) + col

    def handle_starttag(self, tag, attrs):
        if tag == "a" and is_backlink(dict(attrs).get("href")):
            self._open = self._offset(self.getpos())

    def handle_endtag(self, tag):
        if tag == "a" and self._open is not None:
            end = self.text.find(">", self._offset(self.getpos()))
            self._cuts.append((self._open, len(self.text) if end < 0 else end + 1))
            self._open = None

    def result(self):
        out, last = [], 0
        for a, b in self._cuts:
            out.append(self.text[last:a])
            last = b
        out.append(self.text[last:])
        return "".join(out)


def strip_backlinks(text):
    return _BacklinkStripper(text).result()


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
            strip_backlinks(text))


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
    out, rel = {}, corpus_path(kind)
    d = os.path.join(ROOT, rel)
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
                out.setdefault(singular(n), "%s/%s" % (rel, fn))
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
    return bare if bare != subject else ""


# WORD BOUNDARIES ARE `grep -w`, NOT `\b`, AND THAT IS A PORTABILITY FIX RATHER THAN A STYLE ONE.
#
# `\b` is undefined in POSIX ERE. GNU grep accepts it, and on the machine this matrix was
# computed on it meant what it reads as — but `grep -E '\bBases?\b'` matches NOTHING under GNU
# grep 3.0 in a locale that is neither unibyte nor UTF-8, which is the default on Windows. It does
# not warn and it does not fail: it reports no match, so every affected row files the negative
# state. That is 42 of the 678 named rows in `--selftest`, all of them `present` -> `retained`,
# reported as a matrix that no longer reproduces rather than as a broken instrument — and the 636
# that did reproduce are what made it look like drift instead of a dialect.
#
# `-w` is POSIX, is what these three patterns actually mean, and depends on neither the dialect
# nor the locale. It bounds the WHOLE match, which is exactly what wrapping a pattern in `\b`
# does. The table-cell pattern below keeps neither, because it anchors on `|` rather than on a
# word and `-w` would have nothing to say about it.


def names_it(subject, kind):
    """First note in `kind` that NAMES the subject, at word boundaries and plural-tolerant.

    Three cases, because what counts as *naming* depends on how much of a name survives the
    annotation. The two-word bound this used to carry was too strong in one direction: review
    found `Settings (IA top-level area)` reading `absent` against `deliverables/` while
    `Sitemap.md` inventories it as `| Settings | Settings tab | PRD §83 … | MVP |` — a false gap
    whose remedy said "backlog gains a note" about a note the backlog has.

    Dropping the bound outright is the mirror defect, and measured rather than argued: it moves
    41 rows, most onto a word used in prose — `Work` on the Disclosure ladder's rung group,
    `Costs` inside a Feature's body. What separates the two is the SHAPE of the hit, not the
    length of the name. An inventory lists a surface in its identity column; prose merely uses
    the word. So a one-word name must appear as the LEADING CELL of a table row. That moves 10
    rows, every one of them into `deliverables/`, every one matched by `Sitemap.md` or
    `Information Architecture.md` — the two notes that exist to inventory surfaces.
    """
    bare = annotation_stripped(subject)
    if not bare:
        flag, pat = "-rliEw", r"%ss?" % re.escape(singular(subject))
    elif len(bare.split()) >= 2:
        flag, pat = "-rlEw", r"%ss?" % re.escape(singular(bare))
    else:
        flag, pat = "-rlE", r"^\| *\*{0,2}%ss?\*{0,2} *\|" % re.escape(singular(bare))
    r = subprocess.run(["grep", flag, "--", pat, corpus_path(kind)],
                       cwd=ROOT, capture_output=True, text=True)
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
    # Compared by KIND, not by prefix: `aliases.tsv` is frozen in the pre-2026-08-28 spelling,
    # so `note.startswith("docs/" + k + "/")` stops matching the moment a kind gains a
    # container, and stops matching SILENTLY — the row just files `absent`.
    if note and kind_of(note) in kinds:
        return "present", note
    return "absent", "-"


def bodies_naming(name, view):
    """Every body naming `name`, at word boundaries and plural-tolerant — sorted.

    The same test `names_it` applies forward, and for the same reason: a literal search reads
    a name inside a longer word as a mention. Three reverse rows rested on one — `Order` on
    the prototype's `borders`, `Site` on jtbd's `prerequisite`, `Layer` on research's `layered`.
    """
    pat = r"%ss?" % re.escape(singular(name))
    r = subprocess.run(["grep", "-rliEw", "--", pat, view], capture_output=True, text=True)
    return sorted(os.path.basename(x)[:-4] for x in r.stdout.split("\n") if x)


def reverse(subject, view):
    """(state, every body naming it) for a reverse named row.

    EVERY body, not the first one grep happened to walk into. A single field records whichever
    file the reader opened first, and on a thing several bodies name that is an arbitrary
    answer presented as the answer.

    This docstring used to offer the forward direction as precedent for that, citing a sentence
    from the report. **The sentence was only ever here** — in the repair it was being offered as
    precedent for — and the report has never contained it. Measured instead of cited: of the 268
    forward named rows searching a names-it directory, 262 match no note and 6 match exactly one,
    so the forward side never had a second note to choose between. It is not precedent, and the
    instrument was checked against a probe that does find several (`Project` matches 29 notes in
    `requirements/`) before that zero was believed. The argument for listing every body stands on
    the reverse direction alone, where bodies routinely name the same thing. It also bounds what word boundaries can do: they refuse a name inside a
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


def same_note(a, b):
    """Two note paths naming the same note, across a container move.

    `--selftest` compares the citation it reproduces against the one `rows.tsv` committed, and
    the committed spelling predates the 2026-08-28 reorganisation: the matrix cites
    `docs/business-rules/X.md` for a note the working tree now holds at
    `docs/product/business-rules/X.md`. The KIND and the FILENAME are what identify a note —
    the container is not — so comparing raw strings would report 30 stale citations for a move
    that changed no answer, and a reader chasing them would find 30 identical notes.

    It does not weaken the check it replaces. A citation that names a DIFFERENT note still
    differs in the kind or in the filename, which is the whole of what the stale-citation
    check was built to catch: the 36 rows that kept `present` while citing the
    incidental-prose note the old substring search had found differ in both.
    """
    return (kind_of(a), posixpath.basename(a)) == (kind_of(b), posixpath.basename(b))


def main():
    args = [a for a in sys.argv[1:]
            if a not in ("--selftest", "--corpus-dirs", "--body-paths",
                            "--corpus-pathspecs")]

    # THE MACHINE-READABLE DOORS EMIT LF, NEVER CRLF.
    #
    # `print` on Windows writes `\r\n` whatever the stream is, so every line these three modes
    # hand a shell arrived with a trailing carriage return. It is invisible in every way that
    # matters: `echo` shows nothing, a diff shows nothing, and git ACCEPTS `docs/components\r`
    # as a pathspec and simply matches no file — so the freeze gate reported a clean corpus over
    # 21 edited notes, and `candidates.sh` searched eight directories that do not exist and
    # reported every candidate set as empty. Both failed by finding nothing, which is the failure
    # mode this whole harness is built to distrust.
    #
    # Fixed at the SOURCE rather than with a `tr -d` at each of the four call sites: a consumer
    # that forgets the strip is a consumer that silently measures nothing.
    if any(a in sys.argv for a in ("--corpus-dirs", "--body-paths", "--corpus-pathspecs")):
        sys.stdout.reconfigure(newline="\n")

    # `candidates.sh` and `verify-dod.sh` need the same answer and are shell. They ASK for it
    # rather than restating the container list, for the reason the back-link contract gate is
    # already imported from this module: a consumer holding its own copy of the thing it reads
    # is a copy that drifts, and a drifted corpus path fails by finding nothing rather than by
    # erroring. `prds` is included because it is a corpus folder that moved too, even though it
    # is evidence rather than a derived kind and so is not in `DERIVED_FOLDERS`.
    if "--corpus-dirs" in sys.argv:
        for kind in DERIVED_FOLDERS + ("prds",):
            print("%s\t%s" % (kind, corpus_path(kind)))
        sys.exit(0)

    # Every place a corpus folder could be, existing or not — for a git PATHSPEC rather than a
    # read. A freeze gate asking whether the derived corpus changed has to watch both ends of a
    # move: the resolved path alone sees the arriving files and is blind to the departing ones,
    # so it would report half of a reorganisation and call the corpus unchanged. git tolerates a
    # pathspec that matches nothing, which is what makes listing all of them the cheap answer.
    if "--corpus-pathspecs" in sys.argv:
        for kind in DERIVED_FOLDERS:
            for c in CORPUS_CONTAINERS:
                print(c % kind)
        sys.exit(0)

    if "--body-paths" in sys.argv:
        for name, path, _a, _b in BODIES:
            print("%s\t%s" % (name, path.replace(os.sep, "/")))
        sys.exit(0)

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
                    if r[1] == "forward" and not same_note(m, r[7]):
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


# Guarded so the module can be IMPORTED, which is what lets the back-link contract gate check
# `BODIES` and `BACKLINK` as this tool actually defines them rather than re-declaring them
# beside it. A gate holding its own copy of the thing it checks is a gate that drifts.
if __name__ == "__main__":
    main()

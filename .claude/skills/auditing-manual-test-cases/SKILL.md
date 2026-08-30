---
name: auditing-manual-test-cases
description: Use when checking a manual test case, walkthrough, smoke test or QA checklist against an automated suite, when deciding which manual steps an automated run could replace, when a step is assumed to be covered by an existing test, or when triaging which manual steps could be automated at all
---

# Auditing manual test cases

## Overview

A manual step is covered only when a named test asserts **every clause** of its pass
condition. The failure this exists for is quiet: an assertion covering PART of a step reads
exactly like one covering the whole of it, so the audit writes the step down as discharged
and the gap survives.

**The audit's output is a clause table. Its acceptance test is a mutation.**

## When to use

Comparing a walkthrough or checklist against a suite; deciding which steps to stop running by
hand; about to write down that a step "should already be covered"; triaging which steps are
automatable at all. Not for authoring a new case, and not for reviewing a diff.

## The recipe

1. **Read all three parts of the step** — what to DO, what PASSES, what it EXISTS TO CATCH.
   The last often names a failure the pass condition is too weak to express.
2. **Split the pass condition into clauses.** "An accent outline appears with one handle per
   vertex" is two. "Follows smoothly and stays where dropped; Undo enables" is three, one of
   them a feel judgement no instrument settles.
3. **Read candidate tests' BODIES.** A name is a claim about a test, not the test. Coverage
   often sits in a file this step's reader would never open.
4. **One row per clause**, including the clauses you are confident about — confident ones are
   where omissions happen.
5. **A row saying `none` is a gap.** Write the test.
6. **Close it through the mutation gate.**
7. **Update the row and everything that summarises it in one edit.**

## The clause table (required shape)

| Step | Clause | Discharged by |
| --- | --- | --- |
| 4 | one command per drag | `selectTool` *a body drag dispatches exactly ONE gesture…* |
| 4 | the ghost follows the pointer | `selectTool` *the body preview FOLLOWS the pointer mid-drag…* |
| 4 | "smoothly" | none — a feel judgement, no pass condition |

Cite by test NAME, never line number: an edit that moves a case leaves the citation standing,
one that renames it breaks the citation visibly.

A clause no instrument can settle gets a row saying so and stays a **residue**, not a gap — and
it does not reclassify the step. One adverb beside three assertable clauses is still an
assertable step; a pass condition with no assertable clause at all is the different thing.

## The mutation gate

A gap is closed when, and only when:

1. You break **exactly that clause** in the source — the narrowest change making the claim
   false while leaving the rest correct.
2. The new test goes **red**.
3. Its **neighbours stay green** — the half that proves the test adds coverage rather than
   duplicating one, and what makes the audit measurable instead of arguable.
4. You restore the source and record which mutation you ran.

If the mutation reddens a test you did not write, the clause was already covered: correct the
audit instead of keeping the new test's justification.

## Common mistakes

| Mistake | What the recipe does |
|---|---|
| A test's name read as its whole claim | Step 3 requires the body |
| One assertion taken as covering a multi-clause step | Step 4 forces a row per clause |
| A test asserting the thing exists, not that it works | Break the clause, not the object |
| A closing test duplicating an existing one | Gate condition 3 |
| Summary updated, canonical source left stale | Step 7 |
| Trusting a regex sweep's hits | Read every match — a word match is not a claim match |

## Real-world impact

One 24-step walkthrough against a 3400-test suite. First pass: "18 discharged, 2 gaps". True
figure after six review rounds: **17 discharged, 5 gaps** — wrong in *both* directions,
over-reporting coverage three times from partial assertions and under-reporting it once
from a test's name. A reviewer found four of the five corrections. Two gaps were invisible to
any state assertion: leaving a selection overlay drawn after a deselection kept 50 of 51
existing tests green.

**Replayed against the four failures it was written from**, which is the verification it has:

- Step 1 passed on "an accent outline appears with ONE handle circle per vertex". Two clauses;
  the cited test counts circles. Row one says `none`. **Gap caught** — the first pass collapsed
  the pair and wrote "discharged".
- Step 4 passed on "follows smoothly and stays where dropped; Undo enables". Four clauses, one
  of them a judgement. The `follows` row says `none`, because the cited test asserts only that
  a preview is non-null. **Gap caught.**
- Step 12 passed on "the zone note AND its sidecar entry disappear". Two clauses; the second
  was cited to a case proving a FAILED sidecar removal restores the note — the opposite half of
  the pair. **Gap caught**, and it was the sharpest: every other assertion about that delete is
  note-side, and a missing note already reads as absent.
- Step 7 passed on "the vertex snaps back; every other vertex is where it was". Reading the
  BODY finds a last line asserting the whole pre-drag list. **Correctly NOT a gap** — the first
  pass read the name and reported one.

**Not pressure-tested with subagents** (see superpowers:writing-skills). Its RED phase is that
recorded session rather than a synthetic baseline, and the replay above tests the recipe, not
the wording: an agent may still read it and do something else. Evidence-backed, unverified.

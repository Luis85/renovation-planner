---
type: Task
parent: "[[Produce auditable release evidence]]"
order: 70
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Confirm merged main carries the verified editor state]]"
---

# Manually accept the eighteen editor reference comparisons

## Evidence

`scripts/editor-visual-final-check.mjs` passed at `22772267`, and its closing line says what that
pass is not: "manual comparison acceptance remains a separate review".
`scripts/editor-visual-comparisons.mjs` pairs each screen from M00 to M17 with one or two captures
and writes a full and a detail comparison per screen. Nothing records a person judging the
eighteen comparisons that run produced.

*Claimed and verified.* In `docs/user-experience/renovation-planner-editor-specs/implementation/`,
`completion-matrix.md` and `implementation-status.md` both say a complete nine-journey,
four-scenario run on revision 430 produced all eighteen comparisons and that all eighteen were
inspected. `RESUME.md` names the browser that run used — Edge 152 through `RP_CHROMIUM_EXECUTABLE`,
with no pinned-Chromium pass claimed — and keeps its images as predecessor evidence.
`remaining-plan.md` says no complete current repetition had succeeded. The pass at `22772267` is
the only one on the current tree with the pinned Chromium, so no inspection on record applies to
its images.

`completion-matrix.md` lists residuals from the revision-430 run — M01 floor-summary and Room
cues, M04 closed-draft contrast, and correctly attributed M00/M07/M13/M16 supplemental views. They
can seed the review list; the plan's row *P1 – konkrete Bild-Fidelity* forbids deriving new
deferrals from old pending notes.

## Why it matters

The matrix proves that the journeys run and the states are captured. Whether a capture matches its
design is a judgement no exit code makes, and [[Trace release criteria to named evidence]] needs
that judgement screen by screen.

It is not [[Execute the manual release evidence matrix]], which covers host, assistive-technology
and comprehension checks. Nor is it [[Review the live theme and layout matrix]], whose 2026-09-08
amendment separates scripted browser evidence from its live-host matrix.
[[Complete the usable editor release with spatial rotation]] names the eighteen comparisons among
its own acceptance.

## Approach

For each screen, open the full and detail pair from the matrix run on `main` beside that screen's
note in `docs/user-experience/renovation-planner-editor-specs/screens/` and its reference image.
Record one verdict per screen and scenario, bound to the image's hash. Fix a defect on its own
branch and re-compare; never adjust a capture script to agree with a picture.

## Acceptance criteria

1. Each of the 18 screens has a recorded verdict — pass, defect, or accepted limitation — from a
   person who viewed its full and detail pair against its screen note and reference image, with the
   image's SHA-256.
2. Light, dark, custom accent at 1000 px and German constrained at 460 px are each judged wherever
   the matrix captured the screen in them. A screen with no capture in a scenario is recorded as
   *not captured*, never as passed.
3. The plan's priority checks are covered: M00/M01/M07 hierarchy and visible actions; M01
   architecture, openings and stairs; M08–M14 record and photo context; M15–M17 recovery,
   constrained layout and review.
4. Every defect is fixed and re-compared, or recorded as an accepted limitation with concrete
   evidence.
5. The residuals from the revision-430 run are each re-judged on the current images.
6. Reviewer, date and `main` SHA are recorded. No exit code is cited as a verdict.

## Risks

- A green matrix invites a skim. The judgement is per screen and per scenario, not per run.
- A later capture replaces the images a verdict was given on; the recorded hash is what exposes a
  verdict that no longer describes the image beside it.

## Outcome

Every M00–M17 comparison on the current tree carries a human verdict tied to its image and to the
build it shows.

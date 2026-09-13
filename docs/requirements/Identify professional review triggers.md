---
type: PBI
parent: "[[Handoff purpose and recipient requirements]]"
order: 30
status: New
horizon: "V1"
release: "[[Mighty Dragon]]"
---

# Identify professional review triggers

## Actor

[[Private renovator]] preparing work that may affect structure, safety, permissions or regulated
building systems.

## Main flow

1. The plugin evaluates explicit project facts against a reviewed set of advisory triggers.
2. It identifies topics that may need an architect, engineer, energy consultant, authority,
   qualified trade or hazardous-material investigation.
3. Each result states what project fact triggered it, its jurisdiction and content review date,
   and which professional question should be answered.
4. The finding becomes an open handoff question and can route to supporting evidence.
5. A professional answer or document may be linked, but only the professional source may be
   labelled professional-issued or verified.

## Extensions

- **1a** — The jurisdiction is unknown or unsupported. The plugin asks the renovator to check with
  the relevant professional or authority and makes no no-permit-required claim.
- **1b** — The building or work history is incomplete. The result remains unknown and requests
  investigation; absence of data is not treated as absence of risk.
- **2a** — Several triggers overlap. They are grouped by question and source rather than shown as
  duplicate approvals.
- **5a** — The homeowner records a verbal answer. It remains homeowner-recorded until linked to a
  professional-issued artifact.

## Guarantee

The product can draw attention to professional-review needs without representing advice,
permission, qualification or safety approval that it does not possess.

## Out of scope

- Legal, engineering, energy or hazardous-material assessment.
- Determining that work is permit-free or safe to execute.
- Maintaining an unreviewed global regulatory database.

## Acceptance criteria

1. Every trigger cites the project fact, jurisdiction, source and content review date behind it.
2. Unknown jurisdiction or missing history produces a check-required state, never approval.
3. The output is an open question until a professional-issued response is linked.
4. Homeowner-entered claims cannot be relabelled as professional-verified.
5. Trigger content can be updated independently from canonical renovation records.
6. Construction-year and known/suspected hazardous-material information can be included when
   building fabric may be disturbed.

## Sources

- PRODUCT.md operating-context and non-goal decisions.
- PRD §§44, 57, 90 and 103.
- [German GefStoffV §5a](https://www.gesetze-im-internet.de/gefstoffv_2010/__5a.html).
- [Bundesportal building-permit guidance](https://verwaltung.bund.de/leistungsverzeichnis/de/leistung/99012070006000/herausgeber/BY-1839/region/090000000000).

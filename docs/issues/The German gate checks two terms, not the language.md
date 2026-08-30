---
type: Issue
parent: "[[German]]"
order: 10
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# The German gate checks two terms, not the language

The residue of the slice 11/14 polishing pass, which gave `de.ts` its first automated reader
and stopped well short of reading the language.

## The question

Until that pass, **nothing rendered `de.ts` in any gate**. Its only reader was a human who
happened to look, and the first one who did found three defects at once: `Materialien` for an
Asset — a word slice 11 had already removed, reintroduced by slice 14 forty lines below the
German-language comment recording the correction — a garbled `Tresnornder` for `Tresorordner`,
and `Das Tresor` against `Der Tresor` at two keys naming the same noun.

`tests/presentation/i18n/strings.test.ts` now pins **two terms**: it refuses the value
`Material` (the German UI says `Objekt`), and it requires `Vault` wherever `en.ts` says
"vault", *Vault* being Obsidian's own name for the thing and therefore not translated at all.

Spelling, grammar, gender agreement, register, and every term other than those two remain
unread by any gate. That is the honest state and it is stated plainly in `CLAUDE.md` — this
note exists so it is also *scheduled* rather than merely admitted.

## What is true today

- The two rows are **different instruments**, and the difference was measured rather than
  assumed. A forbidden-synonym row can only refuse a wrong word somebody thought of:
  `'Tresnornder…'.includes('Tresor')` is `false`, so that row reports four of the five Vault
  sites and sails past the one that started the item. The English-side row — wherever `en.ts`
  says "vault", `de.ts` must say "Vault" — refuses any translation including a misspelled one,
  and reports all five.
- A missing German key fails the English-side row rather than passing it silently, because the
  `?? ''` fallback cannot contain "Vault".
- A sibling case already enforces that `de.ts` translates every key `en.ts` declares. That is
  completeness, a different mechanism from vocabulary, and neither implies the other.
- Both rows were watched failing before they were trusted.
- The design specified **five** pinned terms; two shipped. Zone, Grundriss and Anforderung
  were to be "pinned by presence", and are not.

## Alternatives weighed, and why they were not taken

- **Pin all five terms as the design said.** Not taken, and this is the one worth arguing
  about. Three of the five have no wrong word in circulation, so their rows would have been
  presence assertions with no refused synonym — a check written against nothing, which passes
  for the same reason an empty check passes. The design itself said as much ("inventing one to
  forbid would be a check written against nothing") and pinned them anyway; the implementation
  did not. Either the three rows are worth having as drift detectors or they are not, and that
  question is open rather than settled.
- **Render `de.ts` in a harness and read it.** Rejected on proportion: a rendering harness for
  copy is a large instrument, and the defects found were all visible in the source text.
- **A spell checker over the German values.** Not weighed seriously and probably should be —
  `Tresnornder` is exactly what a dictionary catches and no rule here can. The obstacles are a
  German dictionary as a dependency and the false-positive rate against domain nouns
  (`Grundriss-Zeichenfläche`, `Geometrie-Seitendatei`).
- **Ask a German speaker to review it once and call it done.** Rejected implicitly by the whole
  point of the item: that is exactly what had been happening, and it is why a word removed in
  one slice came back in the next.

## Why no gate saw it

`I18N_LITERAL_BAN` and `NOTICE_TEXT_BAN` sit at the call sites and say nothing about what the
strings contain. The locale-completeness case reads keys, not values. Nothing renders German
copy, and `getLanguage()` in the test mock always answers `'en'`, so no jsdom suite draws a
German surface either.

## Why it matters

- German is a shipped locale with a PBI of its own, and a user reading it gets the plugin's
  only impression of its quality from these strings.
- The failure mode is not "a typo" but **vocabulary drift**: the same concept given two names
  across slices written by different hands, which is what makes a refusal read as being about
  something other than the button the user just pressed. That is the defect the original
  glossary comment was written to prevent, and it recurred anyway.

## What closes it

Not designed here. The near-term decision is whether the three unpinned terms get presence
rows; the larger one is whether anything can read German *as prose* in a gate, or whether this
locale is permanently review-held and should say so in one place rather than being rediscovered.

## References

- `tests/presentation/i18n/strings.test.ts` — the two rows, and the docblock explaining why
  they are two instruments.
- `src/presentation/i18n/locales/de.ts` — the glossary comment, and its record of both breaches.
- `docs/requirements/Multilanguage.md` — the rule the lint bans enforce at the call sites.
- `docs/superpowers/specs/2026-08-27-slice-11-14-polish-design.md` — Item 6 and amendment 6,
  which records the five-to-two reduction.

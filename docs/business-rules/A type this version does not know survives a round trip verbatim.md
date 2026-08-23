---
rule: BR-DATA-006
kind: constraint
name: A type this version does not know survives a round trip verbatim
area: data
sources:
  - PRD §84
type: business-rule
---

# A type this version does not know survives a round trip verbatim

**The rule.** §84's vocabularies are configurable — zone types, asset categories, trades, cost
types, document types. Each shipped list ends in *Custom*, and a value this version of the plugin
does not recognise is read, held and written back **exactly as the user wrote it**. Not normalized,
not lowercased, not replaced by a fallback, not dropped.

**Why.** The vault is the user's, and a plugin that rewrites a value it did not understand is
destroying data to tidy its own model. It is also a forward-compatibility rule: a note written by a
later version, or by a user who typed their own zone type, has to survive being opened by this one.

**The one place it inverts.** `data.json` — the plugin's own settings — takes the opposite rule: a
value outside the vocabulary falls back to the default and an unknown key is dropped, on the way in
*and* on the way out (`settingsFrom`, see [`CLAUDE.md`](../../CLAUDE.md)). The difference is
whose data it is. Settings are the plugin's own state and a bad value there is a bug to contain;
a zone type is the user's content and an unknown value there is information to preserve.

**Where it holds.** Every frontmatter mapper in `infrastructure/`. [[Zone]] and [[Asset]] state it
for their own vocabularies.

**Checked by.** Not yet. A round-trip test is the natural instrument: read, write, compare bytes.

**Sources.** PRD §84.

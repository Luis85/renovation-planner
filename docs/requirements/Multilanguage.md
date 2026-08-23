---
type: Feature
parent: "[[Cross-cutting concerns]]"
order: 30
status: ""
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Multilanguage

The PRD never asks for this. Every occurrence of "translation" in it is a coordinate
transform (§81), and §57's list of what the product is not does not exclude localization
either — it is simply absent, so this Feature is something the backlog adds rather than
something derived from the document. Saying so is the point of writing it down: a reader
who goes looking for the requirement behind this note will not find one.

What makes it worth adding anyway is that Obsidian is already localized and the reader has
already chosen. A vault set to German shows German menus, German settings and German
dates, and a plugin whose ribbon tooltip, command entry, settings and errors are all
English does not read as an English plugin there — it reads as a broken one. The audience
is private renovators planning their own house, which is a national-market activity: the
trades, the price references and the paperwork are local, and the tool should not be the
only foreign thing in the project.

The mechanism is not the open question, because the scaffold already committed to one and
it is worth stating what it guarantees. `src/presentation/i18n/` holds a single pure
lookup, `t(language, key)`, whose language is an argument rather than an import, so the
tables stay host-free and a node test can ask for any locale without a mock. English is
the complete table and `StringKey` derives from it, so the compiler refuses a key English
does not answer. German is `Partial`, so a missing key falls back one string at a time
instead of failing the locale. The language is read once from Obsidian's own
`getLanguage()` and there is deliberately no language setting of the plugin's own — a
plugin-local language switch is a recurring review rejection, and the app language is
already the reader's choice.

So the work this Feature actually names is holding that as twenty product epics add
screens to it. Nothing refuses a hardcoded literal in a new view today: `npm run lint`
lints sentence case in `locales/en.ts` — that is what
`recommendedWithLocalesEn` adds, and why German's noun capitalization deliberately sits
outside it — but a string that never reaches `t` at all passes the build, the lint and the
suite. That is the gap, and it is a rule at the forbidden thing rather than a paragraph,
by the same argument that put `WRITE_BOUNDARY` in `eslint.config.mjs`.

What else is undecided: which languages beyond English and German, and regional fallback —
`de-AT` → `de` — which arrives with the first regional locale and not before.

Two boundaries, because both look like this Feature and are not. Units and currency are
already owned: §70 and §72 put them in the project and plugin settings, and a translated
plugin still shows a project's own currency rather than the reader's. And `manifest.json`
is out of scope — its name and description are what the marketplace lists, governed by the
naming rules in [`setup/publishing.md`](../setup/publishing.md), and they stay as
published.

## Outcome

Every string the plugin shows reads in the language the reader's Obsidian is set to, and a
new screen cannot ship an untranslatable string without something refusing it.

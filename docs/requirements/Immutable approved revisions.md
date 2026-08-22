---
type: Feature
parent: "[[Plan revisions]]"
order: 30
status: ""
started: ""
finished: ""
horizon: "V2"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Immutable approved revisions

§31's last and hardest feature. A trade priced a specific drawing; if that drawing can still move, the
price means nothing and neither does any later disagreement about it.

Its cost is that every write path has to know whether what it is about to change belongs to an approved
revision — which makes it a rule enforced at the write, in the way `WRITE_BOUNDARY` in
`eslint.config.mjs` is, rather than a convention held by whoever remembers it. A single unguarded write
path is the whole guarantee gone.

## Outcome

Once a plan version is approved, nothing can change it, and what somebody quoted against can always be
reproduced.

---
type: "renovation-plan"
schema-version: 1
id: "plan-ground"
revision: 1
project: "proj-unreadable"
name: "Ground"
background-path: ""
background-kind: "image"
background-page: null
layers: []
---

The one plan in this fixture. Both zones belong to it, and its geometry sidecar at
`Geometry/plan-ground.rpgeo` holds an entry for each — so a zone that refuses to load in a
test refuses because that test corrupted its NOTE, never because its geometry was missing.

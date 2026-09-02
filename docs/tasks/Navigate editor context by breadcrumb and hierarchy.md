---
type: Task
parent: "[[Navigate property, building and floor context in the editor]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Navigate editor context by breadcrumb and hierarchy

## Evidence

M00 locks a contextual breadcrumb and Property panel, and the component library requires
`PropertyTree` tree semantics, arrow-key navigation and a list-equivalent route.

## Why it matters

The canvas cannot be the only way to orient or change floors, and two navigation widgets must
not keep independent current-context state.

## Approach

Render the navigation read model in the context bar and Property tree/list, bind active state to
the floor identity held by the leaf, and route breadcrumb, pointer and keyboard activation to one
navigation intent.

## Acceptance criteria

- Breadcrumb and hierarchy mark the same current Property, Building presentation group and Plan.
- Tree semantics expose levels, expansion, arrow-key movement and activation.
- A keyboard-accessible list route reaches every floor exposed in the tree.
- Breadcrumb, tree and list activation emit the same stable Plan identity.
- Constrained presentation reuses the same model and active state.

## Risks

Roving focus, expansion and responsive presentation can accidentally become additional sources
of current-floor truth.

## Outcome

Users can understand and navigate editor context consistently with a pointer or keyboard.

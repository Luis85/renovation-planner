# WIP — wall-task Room-choice clearance

The available closed-loop capture shows the optional Room checkbox and label obscured beneath
the sticky Finish control. The accepted banner host remains appropriate; the defect is within
its scrolling content. [Before capture](evidence/editor-wall-task-clearance/before-dark.png).

This **untested source preparation** prevents the task's flex children shrinking, reserves scroll
clearance above Finish, keeps the checkbox and its label together, and excludes checkboxes from
the text inputs' 32px minimum height. It adds only a class to the existing checkbox label.
Handlers, form identity, selectors, geometry behavior and the sticky Finish control remain intact.

Changed files: `styles/editor-structure.css`, `styles/editor-visual-tasks.css` and
`src/presentation/editor/structure/StructureTaskForm.vue`. No test, browser, build, lint or formatter
run was performed for this draft. It is committed only to preserve the user-requested intermediate
and restart state, not as a verified fix. Verify the closed-loop checkbox, its keyboard focus and
sticky-footer clearance at desktop and German constrained widths before acceptance.

# Product Requirements Document
## Renovation Project Workspace

**Product:** Renovation Planner  
**Product Type:** Obsidian Community Plugin  
**Status:** Draft  
**Version:** 0.1  
**Primary Goal:** Make starting, continuing, and navigating a renovation project intuitive from a user perspective.

---

# 1. Purpose

The Renovation Planner already has a technically sound foundation for spatial planning, zones, assets, quantities, costs, work packages, scheduling, and project documentation.

The purpose of this PRD is to define the user-facing product layer that turns these capabilities into a coherent renovation-planning experience.

The Renovation Project Workspace shall become the central interaction model of the plugin.

Instead of exposing isolated technical capabilities, entities, or views, the plugin shall organize the user experience around a simple mental model:

> I am planning and managing a renovation project.

The workspace must help users:

- start a new renovation project,
- understand what to do next,
- structure their property,
- move naturally between areas of the renovation,
- continue where they previously stopped,
- track planning progress,
- manage renovation work in context,
- progressively adopt more advanced features,
- complete and archive a renovation project.

---

# 2. Product Problem

Renovation planning is inherently complex.

A single project may contain:

- buildings,
- floors,
- rooms,
- outdoor areas,
- plans,
- measurements,
- renovation zones,
- assets,
- materials,
- quantities,
- trades,
- work packages,
- tasks,
- costs,
- procurement,
- schedules,
- documentation,
- photos,
- decisions.

A technically driven product risks exposing this complexity too early.

Without a coherent project-level experience, users may face questions such as:

- Where do I start?
- Do I need a floor plan first?
- What should I configure before I can use the plugin?
- How do rooms relate to work packages?
- Where do I manage the kitchen renovation?
- Where do I see the overall project budget?
- How do I continue work from yesterday?
- Which planning steps are still missing?
- Do I need to understand the plugin's data model?

The product must hide unnecessary structural complexity and guide users through the renovation according to their current intent.

---

# 3. Product Vision

Renovation Planner should feel like a renovation workspace that happens to live inside Obsidian.

A user should be able to open the plugin and immediately understand:

1. which renovation projects exist,
2. which project they were recently working on,
3. what the current state of that project is,
4. what needs attention next,
5. how to enter the part of the project they want to work on.

The core product principle is:

> The renovation project is the primary UX object.

Underlying Markdown files, sidecars, properties, domain entities, and technical storage mechanisms remain implementation details unless the user explicitly chooses to interact with them.

---

# 4. Goals

The Renovation Project Workspace must:

- provide a clear entry point into Renovation Planner,
- support creation of new renovation projects,
- support continuation of existing renovation projects,
- guide users through initial project setup,
- establish a consistent project navigation structure,
- organize information around renovation areas and project concerns,
- provide a project-level overview,
- support contextual navigation into buildings, floors, rooms, zones, and outdoor areas,
- remember the user's previous working context,
- provide deterministic guidance about incomplete planning steps,
- allow users to start simple and adopt advanced capabilities gradually,
- integrate naturally with Obsidian rather than replacing its core strengths.

---

# 5. Non-Goals

This epic does not initially aim to:

- replace the existing Obsidian file explorer,
- introduce cloud synchronization,
- introduce collaboration or multi-user editing,
- introduce AI-based recommendations,
- provide contractor marketplaces,
- provide full accounting or bookkeeping,
- automate regulatory or legal compliance,
- provide architectural CAD functionality,
- replace professional construction management systems,
- require the spatial editor for basic project usage.

The workspace is an orchestration and interaction layer over the renovation-planning capabilities.

---

# 6. Target Users

## 6.1 Primary Persona — DIY Renovator

A private homeowner renovating a house, apartment, garden, garage, or similar property.

Typical characteristics:

- not a construction professional,
- wants structure without enterprise complexity,
- needs budgeting and work planning,
- may perform some work personally,
- may coordinate external trades,
- may have incomplete plans,
- may begin with rough estimates.

Primary need:

> Help me organize my renovation without forcing me to become a construction project manager.

## 6.2 Secondary Persona — Advanced Renovator

A user managing a larger or more structured renovation.

Typical characteristics:

- works with multiple trades,
- tracks quantities and costs,
- manages procurement,
- uses floor plans,
- cares about dependencies and schedule,
- wants detailed control.

Primary need:

> Give me deeper planning capabilities when I need them without making the basic workflow harder.

## 6.3 Secondary Persona — Professional Planner

A designer, architect, construction coordinator, consultant, landlord, or similar professional using Obsidian as part of their workflow.

Primary need:

> Let me maintain structured renovation information while preserving transparency and access to the underlying Vault data.

---

# 7. Jobs to Be Done

## JTBD-01 — Start a Renovation

When I begin planning a renovation, I want the software to guide me through the essential setup so that I can start organizing the project without knowing the application's data model.

## JTBD-02 — Continue Working

When I return to a renovation project, I want to immediately see where I left off and what needs my attention so that I can continue without reorienting myself.

## JTBD-03 — Understand the Project

When I look at my renovation, I want to see its major areas, progress, costs, and outstanding planning work so that I understand the current state of the project.

## JTBD-04 — Work in Spatial Context

When I work on a specific room or area, I want the related renovation work, costs, materials, plans, and documents to be visible together so that I do not have to manually reconstruct context.

## JTBD-05 — Grow in Complexity

When my planning becomes more detailed, I want additional capabilities to become available without having to redesign my project or migrate my data.

## JTBD-06 — Know What to Do Next

When parts of my project are incomplete, I want clear guidance about useful next actions so that I can progressively build a complete renovation plan.

---

# 8. Core Experience Model

The product shall distinguish between two top-level contexts:

```text
Renovation Planner
│
├── Project Selection
│
└── Renovation Project
```

Within a renovation project, the primary navigation shall represent user concerns rather than technical domain entities.

Recommended initial navigation:

```text
Project
│
├── Overview
├── Spaces
├── Design
├── Work
├── Budget
├── Schedule
└── Documentation
```

The exact naming may evolve through UX validation.

---

# 9. Project Lifecycle

A renovation project should support the following conceptual lifecycle:

```text
New
→ Planning
→ Ready
→ In Progress
→ Completing
→ Completed
→ Archived
```

The lifecycle must remain lightweight.

Users must not be forced to actively manage project status for basic functionality.

Project lifecycle state may be partly derived from available information and partly manually controlled.

---

# 10. Epic Breakdown

## Epic 1 — Renovation Planner Home

### Objective

Provide a central entry point for all renovation projects.

### User Stories

- As a user, I want to see all renovation projects so that I can choose what to work on.
- As a user, I want to see my recent projects so that I can quickly continue work.
- As a new user, I want an obvious starting point so that I know how to begin.
- As a user, I want to create a new renovation project from the home screen.

### Functional Requirements

The Home view shall support:

- project listing,
- project name,
- optional project image or icon,
- project status,
- recent activity,
- basic progress indication,
- current or planned budget summary when available,
- last opened timestamp,
- create-project action,
- open-project action,
- continue-project action,
- empty state when no projects exist.

### Empty State

The empty state should prominently offer:

```text
Start your first renovation project
```

Secondary explanatory text should briefly describe the workflow.

### Acceptance Criteria

- A user with no project can create one directly from the Home view.
- A user with multiple projects can distinguish between them.
- Recently used projects can be identified without opening each project.
- Project navigation requires no interaction with the Vault file tree.

---

# 11. Epic 2 — New Project Wizard

## Objective

Provide a guided but lightweight process for establishing a new renovation project.

The wizard must capture only information required to provide useful initial structure.

Everything must remain editable later.

## Feature 2.1 — Project Identity

Capture:

- project name,
- optional description,
- project type,
- optional project image,
- optional target dates.

Example project types:

- entire house,
- apartment,
- individual rooms,
- garden/outdoor renovation,
- garage/workshop,
- extension,
- new construction,
- custom.

## Feature 2.2 — Scope Definition

Allow users to describe the high-level property scope.

Possible structures include:

- building,
- apartment,
- floors,
- basement,
- attic,
- garage,
- garden,
- terrace,
- driveway,
- other outdoor areas.

The wizard should generate sensible default structures from the selected project type.

## Feature 2.3 — Starting Method

Users shall be able to choose how they want to begin.

Supported options should include:

### Import a Plan

Examples:

- PNG,
- JPG,
- PDF where technically feasible.

### Start with a Blank Plan

Creates an empty spatial planning surface.

### Start without a Plan

Creates a renovation project based on rooms and areas only.

This option is mandatory.

A spatial drawing must never be required to use the product.

## Feature 2.4 — Initial Areas

Users may optionally create initial spaces such as:

- kitchen,
- bathroom,
- living room,
- bedroom,
- hallway,
- garden,
- terrace.

Users must be able to skip this step.

## Feature 2.5 — Project Creation

Upon completion, the system shall:

- create the project structure,
- persist project metadata,
- initialize required project data,
- create selected initial spaces,
- establish project session state,
- open the Project Home.

---

# 12. Epic 3 — Project Home

## Objective

Provide a central dashboard for each renovation project.

The Project Home shall answer:

- What is this project?
- Where are we?
- What have I already planned?
- What needs attention?
- What should I work on next?

## Feature 3.1 — Project Summary

Display:

- project name,
- project status,
- planning progress,
- budget summary,
- schedule summary,
- number of spaces,
- number of work items,
- optional project image.

## Feature 3.2 — Planning Progress

The product should derive meaningful progress from the project's planning completeness.

Possible dimensions:

- property structure,
- spaces,
- plans,
- renovation scope,
- work definition,
- estimates,
- schedule,
- documentation.

Progress should not be represented as fake precision.

Prefer milestone-style completeness or meaningful percentages based on explicit criteria.

## Feature 3.3 — Next Actions

The Project Home shall surface context-sensitive next actions.

Examples:

- import or create a plan,
- calibrate a plan,
- create rooms,
- define renovation work,
- estimate an existing work package,
- add missing material costs,
- schedule unscheduled work,
- record actual costs.

Guidance shall initially be deterministic and rule-based.

## Feature 3.4 — Recent Activity

Display recent project changes such as:

- room created,
- work package created,
- estimate changed,
- material added,
- cost updated,
- task completed,
- document added.

## Feature 3.5 — Project Shortcuts

Users should be able to enter commonly used areas directly.

Examples:

- open plans,
- open rooms,
- open work,
- open budget,
- open schedule.

---

# 13. Epic 4 — Project Navigation

## Objective

Provide stable navigation within every project.

The user should always understand:

- which project is active,
- which part of the project they are viewing,
- how to return to the project overview.

## Feature 4.1 — Primary Navigation

Provide access to:

- Overview,
- Spaces,
- Design,
- Work,
- Budget,
- Schedule,
- Documentation.

## Feature 4.2 — Project Switcher

Allow users to switch between renovation projects without manually locating files.

## Feature 4.3 — Breadcrumbs

Context-sensitive breadcrumbs should represent spatial or functional scope.

Example:

```text
House Renovation
→ Ground Floor
→ Kitchen
→ Work
```

## Feature 4.4 — Context Preservation

Navigating between different functional areas should retain the selected project and, where reasonable, the selected spatial context.

Example:

```text
Kitchen → Work
Kitchen → Budget
Kitchen → Documentation
```

---

# 14. Epic 5 — Spatial Context Navigation

## Objective

Make the physical renovation structure one of the primary navigation mechanisms.

Recommended hierarchy:

```text
Project
→ Property / Building
→ Floor / Area
→ Room
→ Zone
```

The model must also support outdoor structures such as:

```text
Project
→ Garden
→ Terrace
→ Planting Area
```

## Feature 5.1 — Spaces View

Users should be able to browse and manage the spatial structure of the project.

Possible representations:

- tree,
- cards,
- list,
- visual floor-plan access.

## Feature 5.2 — Space Detail

Every relevant space should provide a contextual workspace.

Examples:

- kitchen,
- bathroom,
- garden,
- terrace,
- garage.

A Space Detail view should aggregate relevant information such as:

- plan,
- zones,
- work,
- materials,
- costs,
- tasks,
- documents,
- photos.

## Feature 5.3 — Contextual Actions

Actions initiated within a spatial context should automatically inherit that context.

Example:

Creating a work item while viewing the Kitchen should associate the work item with the Kitchen unless explicitly changed.

---

# 15. Epic 6 — Project Session and Continue Experience

## Objective

Reduce reorientation when users return to the plugin.

## Feature 6.1 — Last Project

The plugin should remember the most recently opened renovation project.

## Feature 6.2 — Last Context

Per project, persist appropriate context such as:

- last view,
- last selected space,
- last relevant entity,
- last opened timestamp.

## Feature 6.3 — Continue Project

The Home view should provide a Continue action.

Continue should restore the user's previous meaningful working context when feasible.

Example:

```text
Continue House Renovation

Kitchen
→ Work
→ Electrical
```

## Feature 6.4 — Safe Restoration

If the previously selected entity no longer exists, the application should gracefully fall back to the closest valid context.

Example hierarchy:

```text
entity
→ space
→ previous view
→ Project Home
```

---

# 16. Epic 7 — Deterministic Project Guidance

## Objective

Help users progressively complete renovation planning without requiring AI.

## Feature 7.1 — Guidance Rules

The product shall evaluate project state against deterministic rules.

Example rules:

```text
IF plan exists
AND plan is not calibrated
THEN suggest calibration
```

```text
IF room exists
AND room contains no renovation work
THEN suggest defining work
```

```text
IF work item exists
AND cost estimate is missing
THEN suggest estimation
```

## Feature 7.2 — Guidance Item

A guidance item should contain:

- title,
- explanation,
- severity or importance,
- project context,
- suggested action,
- target destination.

## Feature 7.3 — Guidance Categories

Possible categories:

- setup,
- missing information,
- planning completeness,
- cost completeness,
- schedule completeness,
- execution,
- documentation.

## Feature 7.4 — Non-Blocking Guidance

Guidance must not prevent users from navigating or working.

The product should advise rather than enforce unnecessary workflows.

---

# 17. Epic 8 — Progressive Disclosure

## Objective

Support both simple and advanced renovation projects without creating separate product modes.

## Feature 8.1 — Simple Project Experience

A basic user should be able to work primarily with:

- spaces,
- work,
- tasks,
- estimated costs,
- documentation.

## Feature 8.2 — Advanced Planning

More sophisticated capabilities may become available when relevant.

Examples:

- zones,
- quantity calculations,
- assemblies,
- detailed material planning,
- trades,
- work packages,
- dependencies,
- procurement,
- actual vs estimated costs.

## Feature 8.3 — Contextual Introduction

Advanced capabilities should be introduced when the user reaches a relevant planning problem.

Example:

Instead of showing a Quantity Calculation module immediately:

```text
Estimate floor replacement

Room area: 24.3 m²

[Use room area]
[Enter quantity manually]
```

Advanced quantity planning may then be offered as an option.

---

# 18. Epic 9 — Project Completion and Archive

## Objective

Allow users to bring a renovation project to a clear conclusion.

## Feature 9.1 — Completion Review

Provide a high-level summary containing:

- completed work,
- incomplete work,
- estimated total,
- actual total,
- final schedule,
- documentation completeness.

## Feature 9.2 — Mark Completed

A user may mark a renovation project as completed.

## Feature 9.3 — Archive

Completed projects may be archived while remaining accessible.

Archived projects should not clutter the default active-project view.

## Feature 9.4 — Preservation

Archiving must never destroy the underlying project data.

---

# 19. Information Architecture

Recommended user-facing hierarchy:

```text
Renovation Planner
│
├── Projects
│
│   ├── Project A
│   │   ├── Overview
│   │   ├── Spaces
│   │   ├── Design
│   │   ├── Work
│   │   ├── Budget
│   │   ├── Schedule
│   │   └── Documentation
│   │
│   └── Project B
│
└── Settings
```

Spatial hierarchy:

```text
Project
│
├── Building
│   ├── Ground Floor
│   │   ├── Kitchen
│   │   ├── Living Room
│   │   └── Hallway
│   │
│   └── Upper Floor
│
├── Garage
│
└── Garden
    ├── Terrace
    ├── Lawn
    └── Pond Area
```

---

# 20. UX Principles

## 20.1 Project First

Users interact with renovation projects, not storage structures.

## 20.2 Context Over Configuration

Whenever the system already knows relevant context, it should apply it automatically.

## 20.3 Start Simple

A user should be able to create a useful project with very little information.

## 20.4 Everything Editable Later

The setup wizard must not create irreversible decisions.

## 20.5 No Mandatory Floor Plan

Spatial visualization is a powerful capability, not an onboarding requirement.

## 20.6 Explain the Next Step

Empty and incomplete states should help the user proceed.

## 20.7 Preserve User Orientation

The user should always know:

- current project,
- current location,
- selected spatial context.

## 20.8 Progressive Complexity

Advanced construction-planning concepts should remain discoverable without overwhelming basic users.

## 20.9 Local-First Transparency

Project data remains stored in the Obsidian Vault and should remain inspectable where practical.

---

# 21. Key Domain Concepts Exposed to Users

The workspace may expose the following user concepts:

- Renovation Project,
- Property,
- Building,
- Floor,
- Space,
- Room,
- Outdoor Area,
- Zone,
- Plan,
- Renovation Work,
- Material,
- Cost,
- Trade,
- Work Package,
- Task,
- Schedule,
- Document.

Technical implementation concepts should not normally appear in the interface.

Examples of concepts that should remain hidden:

- sidecar file,
- persistence adapter,
- application command,
- Pinia state,
- Konva node,
- serialization schema.

---

# 22. State Model

A minimal project state may include:

```ts
interface RenovationProject {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  type?: ProjectType;

  createdAt: string;
  updatedAt: string;

  startDate?: string;
  targetEndDate?: string;
}
```

Session state may include:

```ts
interface ProjectSession {
  projectId: string;

  lastView?: string;
  lastSpaceId?: string;
  lastEntityId?: string;

  lastOpenedAt: string;
}
```

The PRD does not prescribe persistence technology.

---

# 23. Commands and Entry Points

The plugin should provide Obsidian commands such as:

```text
Renovation Planner: Open
Renovation Planner: New Project
Renovation Planner: Open Recent Project
Renovation Planner: Continue Project
```

An optional ribbon icon should open Renovation Planner Home.

---

# 24. Empty States

Every major view must define an actionable empty state.

## No Projects

```text
You haven't created a renovation project yet.

Start by creating your property and planning the first areas.

[Create Project]
```

## No Spaces

```text
Your project does not contain any rooms or areas yet.

[Add Space]
[Import Floor Plan]
```

## No Work

```text
No renovation work has been planned for this area.

[Add Renovation Work]
```

## No Costs

```text
You have planned work but haven't estimated its cost yet.

[Start Estimating]
```

Empty states must help users continue rather than merely report that no data exists.

---

# 25. Error Handling

User-facing errors must:

- explain what failed,
- preserve entered data where possible,
- suggest recovery,
- avoid exposing technical stack traces by default,
- never silently discard project changes.

Example:

```text
The floor plan could not be imported.

The original file has not been changed.

[Try Again]
[Choose Another File]
```

---

# 26. Accessibility Requirements

The workspace should support:

- keyboard navigation,
- visible focus indicators,
- readable contrast compatible with Obsidian themes,
- text labels for icon-only actions where necessary,
- screen-reader-compatible semantic structure where practical,
- no critical information communicated only through color.

---

# 27. Responsive Behaviour

The plugin should support:

- desktop Obsidian,
- constrained sidebar widths where appropriate,
- tablet-sized layouts where feasible.

The primary project workspace may require a full workspace pane.

Complex visual planning functionality may have reduced usability on mobile, but project overview and basic management should degrade gracefully where technically feasible.

---

# 28. Performance Requirements

Expected interaction targets:

- opening Renovation Planner Home should feel immediate,
- switching between already loaded project views should occur without visible blocking,
- project summaries should use derived/indexed information where necessary,
- navigation should not require reparsing the entire Vault where avoidable.

Large-project handling should be considered from the beginning.

---

# 29. Privacy Requirements

The workspace must conform to local-first principles.

Default operation shall require:

- no account,
- no external analytics,
- no cloud API,
- no remote project database.

No project information shall leave the device unless an explicitly introduced future feature requires it and the user knowingly enables it.

---

# 30. Data Integrity Requirements

Project creation and navigation must not compromise Vault data.

Requirements:

- project initialization must be transactional where practical,
- partial initialization should be detectable,
- invalid project structures should be recoverable,
- existing user files must never be overwritten without explicit intent,
- project identifiers must remain stable when files are renamed where technically feasible.

---

# 31. Analytics and Product Telemetry

No external telemetry is required.

Product quality should initially be evaluated through:

- manual UX testing,
- dogfooding,
- structured user interviews,
- task-completion testing,
- GitHub feedback,
- optional locally derived debugging diagnostics.

---

# 32. Success Metrics

Because the product is local-first, success metrics are primarily usability-oriented.

## Onboarding

A new user should be able to:

- create a project,
- create or identify at least one space,
- understand the next suggested action,

without consulting technical documentation.

## Orientation

After reopening Obsidian, a returning user should be able to resume meaningful work with minimal navigation.

## Navigation

Users should be able to answer:

```text
Where am I?
What project am I working on?
What part of the property am I working on?
How do I go back?
```

without relying on the file explorer.

## Complexity

A beginner must be able to use the product without understanding:

- zones,
- quantity engines,
- work-package hierarchies,
- implementation schemas.

An advanced user must still be able to access those capabilities.

---

# 33. MVP Scope

The initial Renovation Project Workspace MVP should include:

- Renovation Planner Home,
- project listing,
- new-project wizard,
- project creation,
- Project Home,
- basic project summary,
- spaces hierarchy,
- Room/Area Detail,
- primary project navigation,
- contextual breadcrumbs,
- project session state,
- Continue Project,
- basic deterministic guidance,
- actionable empty states.

---

# 34. Post-MVP Scope

Likely later increments include:

- richer project dashboards,
- project templates,
- renovation-type templates,
- progress visualization,
- configurable project navigation,
- phase management,
- project health indicators,
- configurable guidance rules,
- completion review,
- archived project browser,
- project duplication,
- import/export,
- linked Obsidian Bases views,
- cross-project dashboards.

---

# 35. Proposed Delivery Slices

## Slice 1 — Project Foundation

Deliver:

- project domain entity,
- project persistence,
- project discovery,
- Renovation Planner Home,
- New Project action.

Success criterion:

A user can create and reopen multiple renovation projects.

## Slice 2 — Guided Project Creation

Deliver:

- project wizard,
- property scope,
- initial space setup,
- plan/no-plan choice.

Success criterion:

A new user can bootstrap a useful project without documentation.

## Slice 3 — Project Home

Deliver:

- dashboard,
- summary,
- recent activity,
- basic completeness model.

Success criterion:

Opening a project provides immediate orientation.

## Slice 4 — Spatial Navigation

Deliver:

- building/floor/room hierarchy,
- breadcrumbs,
- space details,
- contextual actions.

Success criterion:

Users can work on renovation information from the perspective of a specific room or area.

## Slice 5 — Continue Experience

Deliver:

- session state,
- last view,
- last space,
- continue action.

Success criterion:

Returning users can resume previous work directly.

## Slice 6 — Guidance

Deliver:

- guidance-rule model,
- initial rule catalog,
- Project Home next actions,
- guidance navigation.

Success criterion:

The product can identify incomplete planning states and provide actionable next steps.

## Slice 7 — Progressive Disclosure

Deliver:

- simplified default interfaces,
- advanced actions only when contextually relevant,
- refined empty states.

Success criterion:

Basic users are not exposed to unnecessary advanced construction-planning concepts.

---

# 36. Risks

## Risk — Application Within an Application

A large project workspace may feel disconnected from Obsidian.

### Mitigation

Retain:

- Markdown-native project data,
- file links,
- native themes,
- Obsidian commands,
- backlinks where useful,
- standard workspace behavior.

## Risk — Wizard Complexity

Too much onboarding may discourage users.

### Mitigation

- keep required fields minimal,
- allow skipping optional steps,
- let users edit everything later,
- provide sensible defaults.

## Risk — Over-Abstraction

Hiding the Vault entirely could reduce one of Obsidian's key benefits.

### Mitigation

The workspace should be the default interaction model but never prevent users from accessing the underlying notes.

## Risk — Premature Advanced Features

Showing every domain concept early may overwhelm new users.

### Mitigation

Apply progressive disclosure systematically.

## Risk — Guidance Becomes Prescriptive

Different renovation projects follow different processes.

### Mitigation

Guidance remains advisory and dismissible.

---

# 37. Open Product Questions

The following questions should be resolved during the UX journey and interaction-design phase:

1. Should the Renovation Planner Home open automatically after plugin activation?
2. Should a project correspond to one root Markdown note, one folder, or an abstract project descriptor?
3. Should building and floor structures be mandatory or optional?
4. How prominently should underlying Markdown files be exposed?
5. Should the left-side navigation be permanent or contextual?
6. Should Space Detail use tabs, sub-navigation, or contextual cards?
7. What constitutes meaningful project progress?
8. How should planning guidance be prioritized?
9. Which advanced concepts should remain hidden in the default experience?
10. What should happen when users manually modify project files outside the plugin?

---

# 38. Definition of Done

The Renovation Project Workspace can be considered product-complete for its initial release when:

- a new user can start without documentation,
- multiple projects can be created and distinguished,
- users can continue existing work,
- each project has a coherent home and navigation model,
- physical areas can be browsed and selected,
- renovation work can be accessed in spatial context,
- incomplete planning states produce useful guidance,
- simple projects can remain simple,
- advanced functionality can be adopted incrementally,
- navigation remains compatible with Obsidian conventions,
- project information remains local-first and Vault-native,
- error states are recoverable,
- project data is not lost during navigation or setup failures.

---

# 39. Product Principle Summary

The Renovation Project Workspace should follow these principles:

> **Project before feature.**

> **User intent before domain structure.**

> **Context before configuration.**

> **Simple first, advanced later.**

> **Guide rather than enforce.**

> **Spatial context is a first-class navigation mechanism.**

> **The floor-plan editor is a tool inside the renovation workflow, not the renovation workflow itself.**

> **The user should always know where they are, what has already been done, and what they can do next.**

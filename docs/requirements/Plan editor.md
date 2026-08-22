---
type: Epic
order: 40
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

# Plan editor

The product's premise is §3.4: geometry drives planning, so quantities and costs are derived
from what is drawn instead of typed into a spreadsheet. That premise needs a surface to draw
on, and it has to accept what a private renovator actually owns — a floor plan from the estate
agent, a scan of a paper drawing, a PDF from the architect. §13 is that surface.

This epic deliberately knows nothing about what a shape *means*. A polygon here is a polygon;
that it is a bathroom belongs to [[Zones and spatial objects]], that it is a measure to be
awarded belongs to [[Construction sections]], and that it can be measured at all belongs to
[[Calibration and measurement]]. Keeping meaning out is what lets the editor be tested as
geometry and lets the domain be tested without a canvas.

The hardest requirement in it is not drawing. It is §44's accessibility list: keyboard support,
visible focus, no colour-only encoding, and an alternative list or table route to anything
spatial. A plan editor is the least convenient place to honour that and the place where a user
who cannot use a pointer is most completely locked out.

Derived from PRD §13 (Epic 2), with persistence from §37–§38, save behaviour from §66 and undo
from §68.

## Definition of done

An item beneath this epic is done when:

- Geometry is stored in world units and never in canvas pixels (§38): the sidecar's own `unit`
  plus an integer point list, so a zoom level, a window size or a replaced background cannot
  change a stored quantity.
- No vault write happens while a pointer is moving (§44, §66). What persists is a completed
  command or a debounced property change.
- Several hundred spatial objects on one plan still pan and zoom smoothly (§44).
- Undo and redo are one stack across the editor (§68), not one per tool. A tool with private
  history is a tool that loses somebody's work.
- Layer state and geometry are sidecar data rather than frontmatter (§37); frontmatter is for
  what a human would want to read.
- Anything the editor can do is reachable by keyboard with visible focus, and anything it shows
  spatially is also reachable as a list or table (§44).

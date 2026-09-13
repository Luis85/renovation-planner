---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 75
sources:
  - SDD §62
status: Approved
---
# Canvas performance

Preconditions: `npm run harness`, open `http://localhost:5173/?view=plan-editor&rooms=80` in a
pane at least 1200 px wide. Budget: SDD §62 — pan/zoom at 60 fps, 30 minimum.

`?rooms=N` (`tests/harness/roomsKnob.ts`) appends N synthetic 4000×3000 mm rooms on a grid after
the seeded zones, which is the only way the canvas can be looked at — or measured — at the plan
size the budget is about; the seeded fixture alone has two rooms.

1. Paste in the console, read `pan.vueMs`, `zoom.vueMs`, and the draw counts:

    ```js
    const K = window.Konva, stage = K.stages[0], el = document.querySelector('.rp-plan-canvas'), r = el.getBoundingClientRect();
    const counts = {}, proto = K.Layer.prototype, orig = proto.drawScene;
    proto.drawScene = function (...a) { counts[this.name()] = (counts[this.name()] ?? 0) + 1; return orig.apply(this, a); };
    const raf = () => new Promise(res => requestAnimationFrame(() => res()));
    const micro = async () => { for (let i = 0; i < 5; i++) await null; };
    async function run(make, n = 40) { const vue = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); el.dispatchEvent(make()); await micro(); vue.push(performance.now() - t0); await raf(); await raf(); } return { vueMs: vue.sort((a, b) => a - b)[n >> 1] }; }
    const at = { clientX: r.left + 400, clientY: r.top + 400, bubbles: true, cancelable: true, deltaMode: 0 };
    const pan = await run(() => new WheelEvent('wheel', { ...at, deltaX: 40, deltaY: 0 })), panDraws = { ...counts };
    for (const k in counts) delete counts[k];
    let z = 1; const zoom = await run(() => new WheelEvent('wheel', { ...at, deltaX: 0, deltaY: (z = -z) * 60 })), zoomDraws = { ...counts };
    proto.drawScene = orig;
    console.table({ pan, zoom }); console.table({ panDraws, zoomDraws });
    ```

2. Record `pan.vueMs` and `zoom.vueMs` at `rooms=0`, `rooms=40`, `rooms=80`. A reading over 8 ms
   leaves less than half a frame for Konva's own draw and is the trigger for §4's levers.
3. Middle-button drag for two seconds and watch the Performance panel's frame chart: no frame
   over 33 ms is the floor SDD §62 names.

## Runs

| Date | Build | rooms=0 | rooms=40 | rooms=80 | Result |
|---|---|---|---|---|---|
| 2026-09-13 | 31fb0c3f, harness, DPR 1 | pan 3.4 ms, zoom 6.9 ms | not run | not run | 2-room fixture only; the knob did not exist |

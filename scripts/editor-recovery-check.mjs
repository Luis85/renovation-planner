import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { journey as planningJourney } from './editor-planning-check.mjs';
import { runAreaBrowserMatrix, activate, tabTo } from './editor-area-browser.mjs';
import { panel } from './editor-structure-check.mjs';
import { recordText, recordApply, recordShot } from './editor-record-browser.mjs';
const form = '[data-rp-form="planning"]', retry = '[data-rp-warning="stale"] [data-rp-action="retry"]';
const snapshot = page => page.evaluate(() => window.planningRecovery.snapshot());
const idle = page => page.waitForFunction(() => !document.querySelector('[data-rp-new-material]')?.disabled);
async function recovery(page, scenario, out) {
 await activate(page, '.rp-renovation-inspector > button:first-of-type');
 await panel(page, 'details'); await activate(page, '[data-rp-mode="materials"]'); await idle(page);
 const before = await snapshot(page), previousRows = await page.locator('.rp-planning-group li').count();
 await activate(page, '[data-rp-new-material]'); await tabTo(page, `${form} select[name="asset"]`); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab');
 await recordText(page, form, 'lot', '100'); await page.evaluate(() => window.planningRecovery.armFailure());
 await recordApply(page, form, false); await page.locator(retry).waitFor();
 assert.equal(await page.locator('.rp-planning-group li').count(), previousRows, 'retained material projection');
 assert.equal(await page.locator('[data-rp-action="undo"]').isDisabled(), true);
 assert.match(await page.locator('.rp-save-state-label').innerText(), /refresh needed|Aktualisierung/);
 await recordShot(page, scenario, out, 'saved-refresh-needed');
 for (let index = 0; index < 2; index++) { await activate(page, retry); await page.waitForFunction(() => document.querySelector('[data-rp-warning="stale"] [data-rp-action="retry"]')?.getAttribute('aria-disabled') !== 'true'); }
 const failed = await snapshot(page); assert.equal(failed.materialWrites - before.materialWrites, 1);
 const warningAccessibility = await accessibility(page, scenario, out, '-warning');
 await page.evaluate(() => window.planningRecovery.setFailure(false)); await activate(page, retry); await idle(page);
 assert.equal(await page.locator('.rp-planning-group li').count(), previousRows + 1);
 assert.equal((await snapshot(page)).materialWrites, failed.materialWrites, 'retry never replays a write');
 await activate(page, '[data-rp-new-material]'); await recordText(page, form, 'waste', '17,5');
 await page.evaluate(async () => { window.planningRecovery.setFailure(true); await window.planningRecovery.events(1); });
 await page.locator('.rp-draft-recovery').waitFor();
 assert.equal(await page.locator(`${form} [name="waste"]`).inputValue(), '17,5');
 assert.equal(await page.locator(`${form} [name="waste"]`).evaluate(el => document.activeElement === el), true);
 await recordShot(page, scenario, out, 'retained-draft');
 const draftAccessibility = await accessibility(page, scenario, out, '-draft');
 await activate(page, '.rp-draft-recovery button:first-of-type');
 await page.evaluate(() => window.planningRecovery.setFailure(false)); await activate(page, '.rp-draft-recovery button:first-of-type');
 await page.locator('.rp-draft-recovery').waitFor({ state: 'hidden' });
 assert.equal(await page.locator(`${form} [name="waste"]`).inputValue(), '17,5');
 await page.keyboard.press('Escape'); await page.locator(form).waitFor({ state: 'hidden' });
 const eventsBefore = await snapshot(page);
 await page.evaluate(() => window.planningRecovery.files(Array.from({ length: 100 }, (_, index) => `Journal/${index}.md`)));
 await page.waitForTimeout(50); assert.equal((await snapshot(page)).reads, eventsBefore.reads);
 await page.evaluate(() => window.planningRecovery.files(['scan.png'])); await page.waitForTimeout(50);
 assert.equal((await snapshot(page)).reads, eventsBefore.reads, 'linked image invalidates evidence without a planning read');
 await page.evaluate(() => window.planningRecovery.events(100)); await idle(page);
 const burst = (await snapshot(page)).reads - eventsBefore.reads; assert.ok(burst >= 1 && burst <= 2, `100 events caused ${burst} reads`);
 const packaged = await page.locator('.rp-planning-group').last().locator('dl').innerText();
 await page.evaluate(() => window.planningRecovery.geometryChange()); await idle(page);
 assert.match((await page.locator('.rp-planning-group').allTextContents()).join(' '), /Stale|Veraltet/);
 assert.equal(await page.locator('.rp-planning-group').last().locator('dl').innerText(), packaged, 'source changes despite unchanged packaged quantity and cost');
 await recordShot(page, scenario, out, 'changed-source');
 return { successfulMaterialWrites: 1, failedRetries: 2, replayedWrites: 0, unrelatedEvents: 100, unrelatedReads: 0, linkedImageReads: 0, burstEvents: 100, burstReads: burst, warningAccessibility, draftAccessibility };
}
async function accessibility(page, scenario, out, suffix = '') {
 await page.addScriptTag({ path: createRequire(import.meta.url).resolve('axe-core/axe.min.js') });
 const result = await page.evaluate(() => window.axe.run(document.querySelector('.renovation-plan-editor'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }));
 const violations = result.violations.map(item => ({ id: item.id, impact: item.impact, help: item.help, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
 await writeFile(`${out}/${scenario.name}${suffix}-axe.json`, JSON.stringify({ violations, incomplete: result.incomplete.map(item => ({ id: item.id, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) }, null, 2));
 assert.deepEqual(violations, [], 'WCAG automated findings');
 return { violations: violations.length, incompleteChecks: result.incomplete.length, scope: 'real browser DOM, WCAG 2.2 AA tags; manual screen-reader acceptance separate' };
}
async function largeFloor(page, scenario, out) {
 await page.reload(); await page.locator('[data-rp-empty="floor-start"]').waitFor();
 const fixture = await page.evaluate(() => window.planningRecovery.seedLarge());
 await panel(page, 'layers');
 await page.waitForFunction(() => document.querySelectorAll('[data-rp-region="layers"] .rp-room-list__row').length === 80);
 const closed = await page.evaluate(() => window.planningRecovery.close()); assert.equal(closed.stages, 0); assert.equal(closed.listeners, 0);
 const started = await page.evaluate(async () => { const start = performance.now(); await window.planningRecovery.reopen(); return start; });
 await page.locator('.rp-plan-canvas').waitFor();
 const usableMs = await page.evaluate(start => performance.now() - start, started);
 await panel(page, 'layers'); const room = `[data-rp-region="layers"] .rp-room-list__row[data-rp-id="${fixture.firstRoom}"]`;
 await tabTo(page, room); const selectionStart = await page.evaluate(() => performance.now()); await page.keyboard.press('Enter');
 await page.waitForFunction(id => document.querySelector(`[data-rp-id="${id}"]`)?.getAttribute('aria-pressed') === 'true', fixture.firstRoom);
 const selectionMs = await page.evaluate(start => performance.now() - start, selectionStart);
 if (scenario.width === 460) await page.keyboard.press('Escape');
 const pan = await panFrames(page);
 await activate(page, '[data-rp-perspective="renovate"]'); await panel(page, 'details');
 await activate(page, '[data-rp-mode="materials"]'); await idle(page);
 await page.waitForFunction(() => window.planningRecovery.scene()[0]?.materialMarkers === 3);
 if (scenario.width === 460) await page.keyboard.press('Escape');
 const materialPan = await panFrames(page);
 assert.equal(materialPan.sceneAfter.materialMarkers, 3, 'first Room retains its three material markers through pan/zoom');
 await panel(page, 'details');
 await tabTo(page, '[data-rp-mode="photos"]');
 const inspectorStart = await page.evaluate(() => performance.now()); await page.keyboard.press('Enter');
 await page.waitForFunction(() => document.querySelectorAll('.rp-evidence-thumbnail').length === 40);
 const inspectorMs = await page.evaluate(start => performance.now() - start, inspectorStart);
 await page.locator('.rp-evidence-thumbnail').first().scrollIntoViewIfNeeded(); await page.waitForFunction(() => document.querySelector('.rp-evidence-thumbnail')?.naturalWidth === 1600);
 await recordShot(page, scenario, out, 'large-photos');
 const resources = []; for (let count = 0; count < 3; count++) { const result = await page.evaluate(() => window.planningRecovery.close()); resources.push(result); assert.equal(result.stages, 0); assert.equal(result.listeners, 0); assert.equal(result.images, 0); assert.equal(result.objectUrls, 0); await page.evaluate(() => window.planningRecovery.reopen()); await page.locator('.rp-plan-canvas').waitFor(); }
 return { fixture, usableMs, selectionMs, inspectorMs, pan, materialPan, resources, targets: { usableMs: 1500, selectionMs: 100, inspectorMs: 200, fps: 'target60/min30' }, limitation: 'warm harness mount; synthetic images; timings include browser-driver round trips and are not live Obsidian measurements' };
}
async function panFrames(page) {
 const canvas = await page.locator('.rp-plan-canvas').boundingBox(); assert.ok(canvas);
 const sceneBefore = await page.evaluate(() => window.planningRecovery.scene()[0]); assert.ok(sceneBefore.camera);
 const sampled = page.evaluate(() => new Promise(resolve => { const gaps = []; let previous = performance.now(); function frame(now) { gaps.push(now - previous); previous = now; if (gaps.length < 60) requestAnimationFrame(frame); else resolve(gaps.slice(1)); } requestAnimationFrame(frame); }));
 const x = canvas.x + canvas.width / 2, y = canvas.y + canvas.height / 2;
 await page.mouse.move(x, y); await page.mouse.down({ button: 'middle' });
 for (let index = 0; index < 30; index++) { await page.mouse.move(x + index * 2, y + index); await page.waitForTimeout(16); }
 await page.mouse.up({ button: 'middle' });
 await page.waitForFunction(before => { const after = window.planningRecovery.scene()[0]?.camera; return after && (after.x !== before.x || after.y !== before.y); }, sceneBefore.camera);
 const sceneAfterPan = await page.evaluate(() => window.planningRecovery.scene()[0]);
 await page.mouse.wheel(0, -80);
 await page.waitForFunction(zoom => { const camera = window.planningRecovery.scene()[0]?.camera; return camera && camera.zoom !== zoom; }, sceneAfterPan.camera.zoom);
 const sceneAfter = await page.evaluate(() => window.planningRecovery.scene()[0]);
 const frames = (await sampled).toSorted((a, b) => a - b);
 return { samples: frames.length, medianMs: frames[Math.floor(frames.length / 2)], p95Ms: frames[Math.floor(frames.length * .95)], sceneBefore, sceneAfterPan, sceneAfter, method: 'requestAnimationFrame cadence during verified middle-button pan and wheel zoom, headless browser' };
}
async function zoomReflow(page, scenario, out) {
 await page.setViewportSize({ width: Math.max(920, scenario.width), height: 900 }); await panel(page, 'details');
 await activate(page, '[data-rp-new-material]'); await recordText(page, form, 'waste', '13,5');
 const before = await snapshot(page);
 await page.evaluate(() => { document.body.style.zoom = '2'; });
 await page.waitForTimeout(50);
 assert.equal(await page.locator(`${form} [name="waste"]`).inputValue(), '13,5');
 assert.equal(await page.locator(`${form} [name="waste"]`).evaluate(el => document.activeElement === el), true);
 const layout = await page.locator('.rp-dialog').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }));
 assert.ok(layout.scroll <= layout.width + 1, '200% layout zoom has no horizontal dialog overflow');
 await activate(page, '.rp-dialog [data-rp-action="cancel"]'); await page.locator(form).waitFor({ state: 'hidden' });
 assert.equal((await snapshot(page)).materialWrites, before.materialWrites);
 await recordShot(page, scenario, out, 'zoom-reflow');
 await page.evaluate(() => { document.body.style.zoom = ''; }); await page.setViewportSize({ width: scenario.width, height: 900 });
 return { layout, method: '200% CSS layout zoom with retained draft/focus and keyboard Cancel; native Obsidian zoom acceptance remains separate' };
}
async function journey(page, scenario, out) {
 const normal = await planningJourney(page, scenario, out);
 const recovered = await recovery(page, scenario, out), axe = await accessibility(page, scenario, out);
 const reflow = await zoomReflow(page, scenario, out);
 const performance = await largeFloor(page, scenario, out);
 return { normal, recovery: recovered, accessibility: axe, reflow, performance };
}
await runAreaBrowserMatrix('planning-recovery', '&reference&planning&recovery', journey, '[data-rp-empty="floor-start"]');

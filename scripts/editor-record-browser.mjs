import assert from 'node:assert/strict';
import { activate, tabTo } from './editor-area-browser.mjs';
export async function recordText(page, scope, name, value) {
 await tabTo(page, `${scope} [name="${name}"]`); await page.keyboard.press('Control+A'); await page.keyboard.type(value);
}
export async function recordApply(page, scope, preview = false) {
 await activate(page, `${scope} button[type="submit"]`);
 if (preview) await activate(page, `${scope} button[type="submit"]`);
 await page.locator(scope).waitFor({ state: 'hidden' });
}
export async function recordShot(page, scenario, out, name) {
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
 await page.screenshot({ path: `${out}/${scenario.name}-${name}.png` });
}
async function roomDetails(page, scenario, panel) {
 await panel(page, 'layers'); await activate(page, '.rp-room-list__row');
 if (scenario.width === 460) await page.keyboard.press('Escape');
 await panel(page, 'details');
}

export async function recordRoom(page, scenario, out, helpers) {
 const tokens = await helpers.preserveTheme(page, scenario);
 await helpers.drawWalls(page, scenario, out); await roomDetails(page, scenario, helpers.panel); return tokens;
}

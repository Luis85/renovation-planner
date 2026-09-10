import assert from 'node:assert/strict';

/** Choose a visible Add entry with the menu's real keyboard navigation. */
export async function chooseAddEntry(page, entry) {
	const selector = `[data-rp-entry="${entry}"]`;
	for (let count = 0; count < 20; count++) {
		if (await page.locator(selector).evaluate(element => element === document.activeElement)) break;
		await page.keyboard.press('ArrowDown');
	}
	assert.equal(await page.locator(selector).evaluate(element => element === document.activeElement), true);
	await page.keyboard.press('Enter');
}

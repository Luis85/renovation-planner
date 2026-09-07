import assert from 'node:assert/strict';

/** Measure native content after interaction; do not reset scroll or focus for a screenshot. */
export async function inspectorVisibility(page, selectors, constrained) {
	const inspector = await page.locator('[data-rp-shell-region="inspector"]').boundingBox();
	assert.ok(inspector, 'Inspector is displayed');
	const boxes = {};
	for (const selector of selectors) {
		const box = await page.locator(selector).boundingBox(); assert.ok(box, `${selector} remains rendered`); boxes[selector] = box;
		if (!constrained) assert.ok(box.y >= inspector.y - 1 && box.y + box.height <= inspector.y + inspector.height + 1
			&& box.x >= inspector.x - 1 && box.x + box.width <= inspector.x + inspector.width + 1, `${selector} stays inside the visible Inspector`);
	}
	return boxes;
}

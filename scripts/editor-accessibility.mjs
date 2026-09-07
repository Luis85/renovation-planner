import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';

export async function editorAccessibility(page, scenario, out, state, surface = '.renovation-plan-editor') {
	await page.addScriptTag({ path: createRequire(import.meta.url).resolve('axe-core/axe.min.js') });
	assert.equal(await page.locator(surface).isVisible(), true, 'accessibility scans the visible native surface');
	const result = await page.evaluate(selector => window.axe.run(document.querySelector(selector), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }), surface);
	await writeFile(`${out}/${scenario.name}-${state}-axe.json`, JSON.stringify({ violations: result.violations, incomplete: result.incomplete }, null, 2));
	assert.deepEqual(result.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => node.target) })), [], `${state} has no automated WCAG violations`);
	return { state, violations: result.violations.length, incompleteChecks: result.incomplete.length };
}

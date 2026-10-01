import { expect } from 'vitest';
import { AxeBuilder } from '@axe-core/webdriverio';
import { writeEvidence } from './diagnostics';
import type { NativeBrowser } from './session';

/**
 * WCAG A/AA over one subtree of the real renderer. Electron lacks `window/new`, so axe's legacy
 * mode; there are no cross-origin frames here and no rule is disabled. Unlike jsdom's scans, a
 * real renderer lets axe grade colour contrast. `mustPass` names a rule the include must have
 * reached, because an include that matched nothing reports no violations too.
 */
export async function expectNoViolations(browser: NativeBrowser, directory: string, include: string, mustPass: string): Promise<void> {
	const result = await new AxeBuilder({ client: browser }).include(include).setLegacyMode().withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
	await writeEvidence(directory, 'accessibility', result);
	expect(result.passes.map((rule) => rule.id)).toContain(mustPass);
	expect(result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) }))).toEqual([]);
}

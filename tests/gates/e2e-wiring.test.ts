import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { REPO } from '../helpers/repo';
import { constantsOf, parseScript } from '../helpers/parsedSource';
import e2eConfig from '../e2e/vitest.config.mts';

/**
 * `npm run test:e2e` drives a real Obsidian and lives OUTSIDE `npm run check` — which is a
 * claim held together by four spellings in four files: the `.e2e.ts` suffix the e2e config
 * collects, the `.test.ts` suffix the root config collects, the npm script, and the workflow
 * that runs it. Each is read here from the file that owns it, because the failure modes are
 * silent in both directions: a case named `*.test.ts` under `tests/e2e/` is collected by the
 * ROOT config and launches Obsidian inside `npm run check`, and a case whose suffix the e2e
 * config no longer matches simply never runs.
 */
interface Workflow {
	readonly on: { readonly push?: { readonly branches?: readonly string[] }; readonly pull_request?: unknown };
	readonly jobs: Record<
		string,
		{
			readonly strategy?: { readonly matrix?: { readonly include?: readonly { version: string; ui: string }[] } };
			readonly steps?: readonly { run?: string; env?: Record<string, string> }[];
		}
	>;
}

const workflow = parse(readFileSync(join(REPO, '.github/workflows/e2e.yml'), 'utf8')) as Workflow;
const job = workflow.jobs.e2e;
const E2E_DIR = join(REPO, 'tests/e2e');

describe('the e2e suite is wired outside npm run check', () => {
	it('collects only *.e2e.ts, and no *.test.ts sits where the root config would collect it', () => {
		expect(e2eConfig.test?.include).toEqual(['tests/e2e/**/*.e2e.ts']);
		const files = readdirSync(E2E_DIR, { recursive: true, encoding: 'utf8' });
		expect(files.filter((file) => file.endsWith('.test.ts'))).toEqual([]);
		// The suite is not empty by accident of the suffix either.
		expect(files.filter((file) => file.endsWith('.e2e.ts')).length).toBeGreaterThan(0);
	});

	it('is reached by the npm script the workflow runs', () => {
		const { scripts } = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
		expect(scripts['test:e2e']).toBe('node scripts/e2e.mjs');
		expect(existsSync(join(REPO, 'scripts/e2e.mjs'))).toBe(true);
		expect(scripts.check).not.toContain('e2e');
	});

	it('runs on pull requests and pushes to main, and every leg runs the script', () => {
		expect(workflow.on.pull_request).toBeDefined();
		expect(workflow.on.push?.branches).toContain('main');
		const runs = (job?.steps ?? []).filter((step) => step.run?.includes('npm run test:e2e'));
		expect(runs).toHaveLength(1);
		expect(runs[0]?.env?.OBSIDIAN_VERSION).toBe(`\${{ matrix.version }}`);
		expect(runs[0]?.env?.OBSIDIAN_UI).toBe(`\${{ matrix.ui }}`);
	});

	/**
	 * The baseline is `session.ts`'s default, read from its constant rather than retyped: the two
	 * MUST agree, because a developer's `npm run test:e2e` and CI's floor leg are otherwise two
	 * different Obsidians with nothing to say so.
	 */
	it('covers the local baseline, latest, and mobile emulation', () => {
		const baseline = constantsOf(parseScript(join(E2E_DIR, 'session.ts'))).get('BASELINE_VERSION');
		expect(typeof baseline).toBe('string');
		const legs = (job?.strategy?.matrix?.include ?? []).map((leg) => `${leg.version}/${leg.ui}`);
		expect(legs).toEqual([`${String(baseline)}/desktop`, 'latest/desktop', `${String(baseline)}/mobile-emulation`]);
	});
});

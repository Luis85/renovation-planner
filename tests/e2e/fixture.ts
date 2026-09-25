import { test as base } from 'vitest';
import { createNativeSession, requestedVersion, mobileEmulation, type NativeBrowser } from './session';
import { captureBrowser, caseDirectory, writeEvidence } from './diagnostics';
import { createPlannerPage } from './helpers';
import { withSession } from './sessionLifecycle';

interface NativeContext {
	browser: NativeBrowser;
	page: ReturnType<NativeBrowser['getObsidianPage']>;
	ui: ReturnType<typeof createPlannerPage>;
	directory: string;
}

/** One fresh Obsidian, profile and copied vault per case, released however the case ends. */
export const test = base.extend<{ native: NativeContext }>({
	native: async ({ task, signal }, use) => {
		const directory = await caseDirectory(task.id, task.name);
		const session = createNativeSession();
		let abortCleanup: Promise<void> | undefined;
		const cancel = (): void => {
			abortCleanup = session.close();
			// Observed now; the teardown below still awaits it and propagates a failure.
			void abortCleanup.catch(() => undefined);
		};
		signal.addEventListener('abort', cancel, { once: true });
		if (signal.aborted) cancel();
		try {
			await withSession(session, async (browser) => {
				const page = browser.getObsidianPage();
				await writeEvidence(directory, 'environment', {
					requestedVersion,
					appVersion: browser.getObsidianVersion(),
					installerVersion: browser.getObsidianInstallerVersion(),
					platform: process.platform,
					ui: mobileEmulation ? 'desktop mobile emulation; NOT a device test' : 'desktop',
					commit: process.env.GITHUB_SHA ?? 'local',
					vault: page.getVaultPath(),
				});
				try {
					await use({ browser, page, ui: createPlannerPage(browser), directory });
				} finally {
					if (!signal.aborted) await captureBrowser(browser, directory);
				}
			});
			await abortCleanup;
			await writeEvidence(directory, 'teardown', { completed: true });
		} catch (error) {
			await writeEvidence(directory, 'failure', error);
			throw error;
		} finally {
			signal.removeEventListener('abort', cancel);
		}
	},
});

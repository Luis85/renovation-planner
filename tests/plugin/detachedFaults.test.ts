/**
 * @vitest-environment jsdom
 *
 * Every activation this plugin starts from a click is DETACHED — Obsidian's ribbon, command
 * and modal handlers all return nothing — so a fault in one has no awaiter and reaches nobody
 * unless something puts it in front of the user and in the log.
 *
 * Four doors spelled that as a bare `void`, two of them under a comment calling the missing
 * rejection handler deliberate. Measured against what the rest of the plugin does with the
 * same class of failure, it was not: the composition root wraps the sibling workspace
 * operation (`openProjectNote`) in exactly the treatment these lacked. A ribbon click that
 * faulted opened nothing, said nothing and recorded nothing.
 *
 * These cases drive a workspace whose activation REJECTS and require both halves back. Watched
 * failing against the `void` spelling: no notice and no log line, in every one of them.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { Notice } from '../helpers/obsidian-mock';
import { runDetached } from '../../src/plugin/runDetached';
import { lines, recorder, resetRecorder } from '../helpers/logger';
import { settle } from '../helpers/async';

installObsidianDom();

describe('a detached operation that faults', () => {
	beforeEach(() => {
		Notice.shown.length = 0;
		resetRecorder();
	});

	it('reaches the user AND the log, from one mapping', async () => {
		runDetached(Promise.reject(new Error('workspace is gone')), recorder, 'view.project.reveal-failed');
		await settle();

		expect(Notice.shown).toHaveLength(1);
		const logged = lines.filter((line) => line.event === 'view.project.reveal-failed');
		expect(logged).toHaveLength(1);
		// The CAUSE travels to the log and never to the notice — slice 11's rule, and the whole
		// reason the two representations are minted at one step.
		expect(logged[0]?.context?.['cause']).toBeInstanceOf(Error);
		expect(Notice.shown[0]).not.toContain('workspace is gone');
	});

	it('says nothing at all when the operation succeeds', async () => {
		runDetached(Promise.resolve(), recorder, 'view.project.reveal-failed');
		await settle();

		expect(Notice.shown).toHaveLength(0);
		expect(lines).toHaveLength(0);
	});

	it('does not re-throw, because there is no caller left to catch it', async () => {
		// The property that makes this safe at a detached door: `runDetached` returns `void` and
		// settles the rejection itself, so nothing downstream of it can become a second
		// unhandled rejection. An implementation that re-threw inside the `catch` would pass
		// both cases above and reintroduce exactly the defect.
		const unhandled: unknown[] = [];
		const onUnhandled = (reason: unknown): void => {
			unhandled.push(reason);
		};
		process.on('unhandledRejection', onUnhandled);
		try {
			runDetached(Promise.reject(new Error('boom')), recorder, 'view.project.reveal-failed');
			await settle();
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}

		expect(unhandled).toEqual([]);
	});
});

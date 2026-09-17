// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import DraftRecovery from '../../../../src/presentation/editor/forms/DraftRecovery.vue';
import PersistentWarningStrip from '../../../../src/presentation/editor/shell/PersistentWarningStrip.vue';
import { editorWarnings } from '../../../../src/presentation/editor/shell/warnings';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';
import { withSaveStateTracking } from '../../../../src/presentation/editor/save-state/with-save-state-tracking';
import { CommandHistory } from '../../../../src/presentation/editor/tools/command-history';
import { guardCommand } from '../../../../src/application/errors/guardAgainstThrowing';
import { persistenceError } from '../../../../src/application/errors';
import { installWriteIncidentRegistry } from '../../../../src/application/incidents/WriteIncidentRegistry';
import { ok } from '../../../../src/core/result/Result';
import type { DispatchOutcome } from '../../../../src/application/commands/DispatchOutcome';
import type { AppError } from '../../../../src/core/errors/AppError';
import type { VaultExceptionMapper } from '../../../../src/application/errors/exceptionMapper';
import { recorder } from '../../../helpers/logger';
import { installOpenWriteIncident } from '../../../helpers/writeIncidents';
import { t } from '../../../../src/presentation/i18n/strings';
import { FIXTURE_PLAN } from '../../../helpers/planFixtures';
import { mountPlanEditorCanvas, type CanvasHarness } from '../../../helpers/editor';

const canvases: CanvasHarness[] = [];
const wrappers: VueWrapper[] = [];

beforeEach(() => {
	setActivePinia(createPinia());
});

afterEach(() => {
	canvases.splice(0).forEach(canvas => canvas.wrapper.unmount());
	wrappers.splice(0).forEach(wrapper => wrapper.unmount());
	installWriteIncidentRegistry(null);
});

/** Required by `guardCommand`'s signature the way production's is; nothing here throws. */
const threw: VaultExceptionMapper = (cause) => ({ ...persistenceError('vault.threw', 'threw', cause), technicalFault: true });

function mountedRecovery(): { wrapper: VueWrapper; retry: ReturnType<typeof vi.fn> } {
	const retry = vi.fn<() => Promise<void>>().mockResolvedValue();
	const openSource = vi.fn<() => Promise<void>>().mockResolvedValue();
	const wrapper = mount(DraftRecovery, { props: { retry, openSource } });
	wrappers.push(wrapper);
	return { wrapper, retry };
}

it('I13 names reference scale only when this loaded plan has a reference background', async () => {
	const noReference = await mountPlanEditorCanvas();
	canvases.push(noReference);
	expect(noReference.wrapper.find('.rp-editor-scale').exists()).toBe(false);

	const reference = await mountPlanEditorCanvas({
		plan: { ...FIXTURE_PLAN, background: { path: 'Plans/ground.png', kind: 'image' } },
	});
	canvases.push(reference);
	expect(reference.wrapper.get('.rp-editor-scale').text()).toBe(t('en', 'editor.status.scale.uncalibrated'));
});

it('I13 keeps an unconfirmed write distinct from a read-failed draft and never restores its read retry', async () => {
	const retry = vi.fn<() => Promise<void>>().mockResolvedValue();
	const openSource = vi.fn<() => Promise<void>>().mockResolvedValue();
	const recovery = mount(DraftRecovery, { props: { retry, openSource } });
	wrappers.push(recovery);

	expect(recovery.attributes('data-rp-recovery-state')).toBe('read-failed');
	expect(recovery.attributes('aria-atomic')).toBe('false');
	expect(recovery.findAll('button')).toHaveLength(2);

	useSaveStateStore().markUnrecovered();
	await recovery.vm.$nextTick();
	expect(recovery.attributes('data-rp-recovery-state')).toBe('unconfirmed');
	expect(recovery.text()).toContain('Reading again cannot repair');
	expect(recovery.findAll('button')).toHaveLength(1);
	await recovery.get('button').trigger('click');
	expect(retry).not.toHaveBeenCalled();
	expect(openSource).toHaveBeenCalledOnce();
});

it('I13 announces only changed warning rows while retaining their safe read actions', () => {
	const warnings = editorWarnings({
		unrecoveredWrite: false,
		stale: true,
		refreshing: false,
		retriesFailed: 0,
		unreadableZones: 0,
		backgroundStatus: 'none',
		retry: () => undefined,
		openSourceNote: () => undefined,
	});
	const strip = mount(PersistentWarningStrip, { props: { warnings } });
	wrappers.push(strip);

	expect(strip.attributes('role')).toBe('status');
	expect(strip.attributes('aria-atomic')).toBe('false');
	expect(strip.attributes('aria-relevant')).toBe('additions text');
	expect(strip.get('[data-rp-warning="stale"]').findAll('[data-rp-action]').map(action => action.attributes('data-rp-action')))
		.toEqual(['retry', 'open-source-note']);
});

/**
 * **A vault-wide write pause must not take the READ retry away.** ADR-0034 gates COMMANDS and
 * says so in as many words — a gate that blocked reads "would make the vault uninspectable at
 * exactly the moment inspecting it is the only remedy on offer", and `docs/using-planning-
 * recovery.md` is what tells the user to inspect.
 *
 * `DraftRecovery` reads this leaf's OWN unrecovered write at all four of its sites (an early
 * return in `tryAgain`, the `data-rp-recovery-state` attribute, the message key and the retry
 * button's `v-if`). Every one of them is about a draft THIS leaf failed to confirm, so none of
 * them may answer to an incident raised on another plan, another project or in an earlier
 * session. The control is this file's `I13 keeps an unconfirmed write distinct from a read-failed
 * draft and never restores its read retry`, where this leaf's OWN `markUnrecovered()` does
 * suppress the retry and does swap the copy — without it, these two cases would pass on a build
 * where the panel had simply stopped reading the store at all.
 */
it('I13 keeps the read retry while the vault is paused by an incident this leaf did not raise', async () => {
	await installOpenWriteIncident();
	const { wrapper, retry } = mountedRecovery();

	expect(wrapper.attributes('data-rp-recovery-state')).toBe('read-failed');
	expect(wrapper.text()).toContain(t('en', 'planning.recovery.draft'));
	expect(wrapper.findAll('button')).toHaveLength(2);
	await wrapper.get('button').trigger('click');
	expect(retry).toHaveBeenCalledOnce();
});

/**
 * The same claim reached through the CATCH-UP door rather than through the seed: a leaf that was
 * already open when a peer raised the incident learns of it at its next refused write, through
 * `withSaveStateTracking` and the real `guardCommand`. That door records the VAULT's fact, so
 * this panel's copy and its retry are untouched by it.
 */
it('I13 keeps the read retry after the vault-wide gate refuses this leaf’s next write', async () => {
	const { wrapper, retry } = mountedRecovery();
	const history = withSaveStateTracking(new CommandHistory(), useSaveStateStore());

	await installOpenWriteIncident();
	const guarded = guardCommand<void, DispatchOutcome, AppError>(
		{ execute: () => Promise.resolve(ok<DispatchOutcome>('wrote')) },
		'command.test.failed',
		recorder,
		threw,
	);
	await history.run({ execute: () => guarded.execute(undefined), undo: () => guarded.execute(undefined) });
	await wrapper.vm.$nextTick();

	expect(wrapper.attributes('data-rp-recovery-state')).toBe('read-failed');
	expect(wrapper.text()).toContain(t('en', 'planning.recovery.draft'));
	expect(wrapper.findAll('button')).toHaveLength(2);
	await wrapper.get('button').trigger('click');
	expect(retry).toHaveBeenCalledOnce();
});

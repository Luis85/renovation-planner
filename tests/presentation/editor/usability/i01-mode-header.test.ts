// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle } from '../../../helpers/editor';
import { t } from '../../../../src/presentation/i18n/strings';

let rig: Awaited<ReturnType<typeof renovationEditor>> | undefined;
afterEach(() => { rig?.unmount(); rig = undefined; });

it('keeps the current mode label and caption synchronized with the existing perspective radios', async () => {
	rig = await renovationEditor();
	const context = rig.wrapper.get('[data-rp-perspective-context]');

	expect(context.attributes('data-rp-perspective-context')).toBe('plan');
	expect(context.get('.rp-perspective-context__mode').text()).toContain(t('en', 'renovation.plan'));
	expect(context.get('.rp-perspective-context__caption').text()).toBe(t('en', 'editor.perspective.plan.caption'));
	expect(rig.wrapper.get('[data-rp-perspective="plan"]').attributes('aria-label')).toBe('Plan: Draw and adjust');

	await rig.wrapper.get('[data-rp-perspective="renovate"]').trigger('click');
	await settle();
	expect(rig.session.perspective).toBe('renovate');
	expect(rig.wrapper.get('[data-rp-perspective-context]').attributes('data-rp-perspective-context')).toBe('renovate');
	expect(rig.wrapper.get('.rp-perspective-context__caption').text()).toBe(t('en', 'editor.perspective.renovate.caption'));
	expect(rig.wrapper.get('[data-rp-perspective="renovate"]').attributes('aria-checked')).toBe('true');

	await rig.wrapper.get('[data-rp-perspective="review"]').trigger('click');
	await settle();
	expect(rig.wrapper.get('[data-rp-perspective-context]').attributes('data-rp-perspective-context')).toBe('review');
	expect(rig.wrapper.get('.rp-perspective-context__caption').text()).toBe(t('en', 'editor.perspective.review.caption'));
});

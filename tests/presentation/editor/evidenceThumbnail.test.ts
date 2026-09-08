// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import EvidencePreview from '../../../src/presentation/editor/planning/EvidencePreview.vue';
import { evidenceThumbnailSource } from '../../../src/presentation/editor/planning/evidenceThumbnail';
import { planningStack } from '../../helpers/planning';
import { ok } from '../../../src/core/result/Result';
import type { EvidenceFiles } from '../../../src/application/ports/EvidenceFiles';

const mounted: VueWrapper[] = [];
afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount(); });

describe('evidence thumbnail byte revisions', () => {
	it.each([
		['app://resource/photo.png', 'app://resource/photo.png?rp-evidence-revision=3'],
		['/photo.png?size=large', '/photo.png?rp-evidence-revision=3&size=large'],
		['app://resource/photo.png#view', 'app://resource/photo.png?rp-evidence-revision=3#view'],
		['/photo.png?size=large#view', '/photo.png?rp-evidence-revision=3&size=large#view'],
		['data:image/png;base64,AA==', 'data:image/png;base64,AA=='],
		['blob:https://example.test/image', 'blob:https://example.test/image'],
	])('preserves resource semantics for %s', (source, expected) => {
		expect(evidenceThumbnailSource(source, 3)).toBe(expected);
		expect(evidenceThumbnailSource(source)).toBe(source);
	});
	it('reloads a previously successful resource at the same path and retains lazy decoding and its label', async () => {
		const rig = await planningStack(), image = 'app://resource/photo.png?size=large#view';
		const resolve = vi.fn<EvidenceFiles['resolve']>(() => ok({ path: rig.evidence.path, subpath: rig.evidence.subpath, image }));
		const wrapper = mount(EvidencePreview, { props: { item: rig.evidence, files: { list: () => [], resolve, open: () => Promise.resolve(ok(undefined)), createNote: () => Promise.resolve(ok('')), importFile: () => Promise.resolve(ok('')) }, planId: rig.plan.id, revision: 1 } });
		mounted.push(wrapper);
		const before = wrapper.get('img').attributes('src'); await wrapper.get('img').trigger('load');
		await wrapper.setProps({ revision: 2 });
		expect(wrapper.get('img').attributes('src')).not.toBe(before);
		expect(wrapper.get('img').attributes()).toMatchObject({ src: 'app://resource/photo.png?rp-evidence-revision=2&size=large#view', alt: rig.evidence.description, loading: 'lazy', decoding: 'async' });
		expect(resolve).toHaveBeenCalledTimes(2);
		await wrapper.get('img').trigger('error'); expect(wrapper.find('img').exists()).toBe(false);
		await wrapper.setProps({ revision: 3 }); expect(wrapper.get('img').attributes('src')).toContain('rp-evidence-revision=3');
	});
});

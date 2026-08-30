/**
 * @vitest-environment jsdom
 *
 * The accessibility wiring, asserted as DOM rather than as a class name.
 *
 * SDD §85 / PRD §44 require status that is not encoded only by colour, so the assertions
 * below read TEXT CONTENT and ARIA attributes. A test that asserted a class would pass on a
 * component that rendered a red border and no words.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import FieldError from '../../../src/presentation/components/FieldError.vue';
import FormBanner from '../../../src/presentation/components/FormBanner.vue';
import { nextAppIdPrefix } from '../../../src/presentation/views/app-id-prefix';

function mountField(message: string | null) {
	return mount(FieldError, {
		props: { message },
		// The caller binds what the slot hands down — which is the whole point: there is no
		// lookup to get wrong and no id for a second leaf to collide with.
		slots: { default: '<template #default="{ inputId, aria }"><input :id="inputId" v-bind="aria"></template>' },
	});
}

describe('FieldError', () => {
	it('renders nothing and marks nothing invalid when there is no message', () => {
		const wrapper = mountField(null);
		const input = wrapper.get('input');

		expect(wrapper.find('.rp-field-error__message').exists()).toBe(false);
		expect(input.attributes('aria-invalid')).toBeUndefined();
		expect(input.attributes('aria-describedby')).toBeUndefined();
	});

	it('renders the message as TEXT and wires aria-invalid and aria-describedby', () => {
		const wrapper = mountField('A project needs a name.');
		const input = wrapper.get('input');
		const message = wrapper.get('.rp-field-error__message');

		expect(message.text()).toContain('A project needs a name.');
		expect(input.attributes('aria-invalid')).toBe('true');
		expect(input.attributes('aria-describedby')).toBe(message.attributes('id'));
	});

	it('carries a non-colour glyph beside the text', () => {
		// "status not encoded only by colour": the glyph is aria-hidden because the message
		// itself already says what is wrong — announcing "warning" twice helps nobody.
		const wrapper = mountField('A project needs a name.');
		const glyph = wrapper.get('.rp-field-error__glyph');

		expect(glyph.attributes('aria-hidden')).toBe('true');
		expect(glyph.text()).not.toBe('');
	});
});

describe('nextAppIdPrefix', () => {
	it('gives two mounted apps distinct useId namespaces, so the ids they mint differ', () => {
		// `useId` restarts at `v-0` in every app; a case that mounts only one app cannot
		// distinguish "unique per app" from "unique because nothing else ran yet". The
		// defect this guards is two LEAVES colliding, so the test mints two apps, exactly
		// the way `PlanEditorView` and `RenovationProjectView` each call `createApp` once
		// per leaf and set `app.config.idPrefix` from this same counter.
		const slots = {
			default: '<template #default="{ inputId, aria }"><input :id="inputId" v-bind="aria"></template>',
		};
		const first = mount(FieldError, {
			props: { message: null },
			global: { config: { idPrefix: nextAppIdPrefix() } },
			slots,
		});
		const second = mount(FieldError, {
			props: { message: null },
			global: { config: { idPrefix: nextAppIdPrefix() } },
			slots,
		});

		expect(first.get('input').attributes('id')).not.toBe(second.get('input').attributes('id'));
	});
});

describe('FormBanner', () => {
	it('renders nothing when there is no message', () => {
		const wrapper = mount(FormBanner, { props: { message: null } });

		expect(wrapper.find('.rp-form-banner').exists()).toBe(false);
	});

	it('renders the message in an assertive live region', () => {
		// A banner appears in response to the user's own submit, and it is the only feedback
		// that press produced — so it is announced rather than merely present.
		const wrapper = mount(FormBanner, { props: { message: 'The vault could not be written.' } });
		const banner = wrapper.get('.rp-form-banner');

		expect(banner.text()).toContain('The vault could not be written.');
		expect(banner.attributes('role')).toBe('alert');
	});
});

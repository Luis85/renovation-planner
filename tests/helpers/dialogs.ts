import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import DialogHost from '../../src/presentation/dialogs/DialogHost.vue';
import { useDialogStore } from '../../src/presentation/dialogs/dialog-store';

export interface DialogHarness {
	readonly wrapper: VueWrapper;
	readonly store: ReturnType<typeof useDialogStore>;
	readonly pinia: Pinia;
	/** The button that stands in for "the view behind the dialog", for inert/focus checks. */
	readonly background: HTMLButtonElement;
	readonly unmount: () => void;
}

/**
 * A `DialogHost` with a SIBLING to be backgrounded, because that is the shape the host's
 * `inert` logic is written against: it marks its parent's other children, which is the one
 * DOM operation available to a component mounted inside the view it must black out.
 *
 * `attachTo` a real document element rather than the detached default: `document.
 * activeElement` only tracks elements that are in the document, so focus assertions
 * against a detached tree pass on `<body>` no matter what the host did.
 */
export function mountDialogHost(): DialogHarness {
	const pinia = createPinia();
	setActivePinia(pinia);

	const host = document.createElement('div');
	document.body.append(host);

	const Root = defineComponent({
		setup() {
			return () => [
				h('button', { class: 'rp-test-background', type: 'button' }, 'behind'),
				h(DialogHost),
			];
		},
	});

	const wrapper = mount(Root, { attachTo: host, global: { plugins: [pinia] } });
	const background = host.querySelector<HTMLButtonElement>('.rp-test-background');
	if (background === null) throw new Error('the background stand-in did not mount');

	return {
		wrapper,
		store: useDialogStore(pinia),
		pinia,
		background,
		unmount: () => {
			wrapper.unmount();
			host.remove();
		},
	};
}

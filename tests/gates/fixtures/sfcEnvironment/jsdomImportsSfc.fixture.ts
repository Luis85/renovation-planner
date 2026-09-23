// @vitest-environment jsdom
import { expect, it } from 'vitest';
import Probe from './Probe.vue';

it('imports an SFC from a jsdom-environment file', () => {
	expect(Probe).toBeDefined();
});

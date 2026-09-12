import { expect, it } from 'vitest';
import Probe from './Probe.vue';

it('imports an SFC from a node-environment file', () => {
	expect(Probe).toBeDefined();
});

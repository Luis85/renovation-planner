// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle, settleUntil } from '../../../helpers/editor';
import { expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';
import type { Renovation } from '../../../../src/domain/renovation/Renovation';
import { tr } from '../../../../src/presentation/i18n/strings';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
const terms = (rig: Awaited<ReturnType<typeof renovationEditor>>) => rig.wrapper.findAll('.rp-editor-inspector-fields dt').map(item => item.text());

it('names a wall\'s planned material beside its existing one when the plan changes it', async () => {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	const brick = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Clinker brick', unit: 'm2', category: 'material' }), 'absent')).entity;
	const render = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Lime render', unit: 'm2', category: 'material' }), 'absent')).entity;
	const renovation: Renovation = { work: [], decisions: [],
		subjects: [{ id: 'detail-wall', targetId: 'wall-a', kind: 'wall', existing: { description: 'Brick', condition: 'good', assetId: brick.id }, planned: { change: 'modify', description: 'Rendered', assetId: render.id } }] };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); await rig.runtime.refreshProjection();
	await settleUntil(() => rig.runtime.planning.baseline.value?.catalogue.some(item => item.asset.id === render.id) === true, 'catalogue read');
	rig.selection.select(['wall-a' as never]); await settle();
	expect(terms(rig)).toContain(tr('editor.structure.planned-material'));
	const facts = rig.wrapper.get('.rp-editor-inspector-fields').text();
	expect(facts).toContain('Clinker brick'); expect(facts).toContain('Lime render');
});

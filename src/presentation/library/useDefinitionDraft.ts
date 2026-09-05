import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import { sameVersion } from '../../application/ports/versioning';
import { isTechnicalFault } from '../../core/errors/technical-fault';
import { isErr } from '../../core/result/Result';
import { useAssetLibraryStore } from '../stores/AssetLibraryStore';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { useAssetLibraryContext } from './AssetLibraryContext';
import { useLibraryDraftGuard } from './libraryDraftGuard';
import { definitionDraft, definitionChanges, validateDefinition, DEFINITION_ERRORS, type DefinitionDraft } from './definitionDraft';

export function useDefinitionDraft(entry: () => CatalogueEntryDto) {
	const context = useAssetLibraryContext();
	const library = useAssetLibraryStore();
	const guard = useLibraryDraftGuard();
	const baseline = ref(entry());
	const values = ref(definitionDraft(entry()));
	const errors = ref<Partial<Record<keyof DefinitionDraft, string>>>({});
	const status = ref<'idle' | 'saving' | 'saved' | 'refresh' | 'unknown' | 'rejected'>('idle');
	const banner = ref<string | null>(null);
	const reading = ref(false);
	const writeConflict = ref(false);
	const dirty = computed(() => JSON.stringify(values.value) !== JSON.stringify(definitionDraft(baseline.value)));
	const conflict = computed(() => writeConflict.value || !sameVersion(entry().version, baseline.value.version));
	const busy = computed(() => status.value === 'saving' || reading.value);
	const locked = computed(() => busy.value || status.value === 'refresh' || status.value === 'unknown');
	const canSave = computed(() => dirty.value && !locked.value && !conflict.value);
	const needsRead = computed(() => status.value === 'refresh' || status.value === 'unknown' || conflict.value);
	const statusText = computed(() => {
		if (busy.value) return tr('view.asset-library.draft.saving');
		if (status.value === 'refresh') return tr('view.asset-library.draft.saved');
		if (dirty.value) return tr('view.asset-library.draft.title');
		return status.value === 'saved' ? tr('view.asset-library.draft.saved') : '';
	});
	const differences = computed(() => {
		if (!conflict.value) return [];
		const current = definitionDraft(entry());
		const previous = definitionDraft(baseline.value);
		return (Object.keys(current) as (keyof DefinitionDraft)[])
			.filter((key) => current[key] !== previous[key])
			.map((key) => ({ key, before: previous[key], current: current[key] }));
	});
	function discard(): void {
		baseline.value = entry();
		values.value = definitionDraft(entry());
		errors.value = {}; banner.value = null; status.value = 'idle';
	}
	guard.register(discard);
	watch([dirty, busy, status], () => {
		guard.dirty = (dirty.value && status.value !== 'refresh') || status.value === 'unknown';
		guard.busy = busy.value;
	}, { immediate: true, flush: 'sync' });
	onBeforeUnmount(() => guard.register(null));
	watch(entry, () => { if (!dirty.value && !busy.value && (status.value === 'idle' || status.value === 'saved')) discard(); });

	async function refresh(): Promise<void> {
		if (busy.value) return;
		reading.value = true;
		try {
			await library.hydrate(context.queries, context.indexScanCompleted);
			if (library.error === null) {
				writeConflict.value = false;
				if (status.value === 'refresh') discard();
			}
		} finally { reading.value = false; }
		// An unknown outcome still requires an explicit discard after inspecting the current note.
	}
	async function save(): Promise<void> {
		if (!canSave.value) return;
		errors.value = validateDefinition(values.value, baseline.value.currency);
		if (Object.keys(errors.value).length > 0) return;
		status.value = 'saving'; banner.value = null;
		try {
			const result = await context.commands.updateAsset.execute({
				assetId: baseline.value.assetId, expected: baseline.value.version,
				changes: definitionChanges(values.value, baseline.value),
			});
			if (isErr(result)) {
				writeConflict.value = ['asset.revision-conflict', 'asset.external-modification'].includes(result.error.code);
				status.value = isTechnicalFault(result.error) ? 'unknown' : 'rejected';
				if (status.value === 'unknown') { banner.value = tr('view.asset-library.draft.unknown'); return; }
				const field = DEFINITION_ERRORS[result.error.code];
				if (field !== undefined) errors.value[field] = trError(result.error);
				else banner.value = trError(result.error);
				return;
			}
			// The command has confirmed the note write. Read failure must never enable a repeat write.
			status.value = 'refresh';
			reading.value = true;
			await library.hydrate(context.queries, context.indexScanCompleted);
			if (library.error !== null) { banner.value = tr('view.asset-library.draft.refresh'); return; }
			discard(); status.value = 'saved';
		} catch {
			if (status.value === 'refresh') banner.value = tr('view.asset-library.draft.refresh');
			else { status.value = 'unknown'; banner.value = tr('view.asset-library.draft.unknown'); }
		} finally { reading.value = false; }
	}
	return { values, errors, status, banner, dirty, conflict, busy, locked, canSave, needsRead, statusText, differences, discard, refresh, save };
}

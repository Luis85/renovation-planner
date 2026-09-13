import type { AssetPreset, PresetGroup } from './presetGeometry';
import { PLANT_AND_BED_PRESETS } from './plantsBeds';
import { SANITARY_PRESETS } from './sanitary';
import { SEATING_PRESETS } from './seating';
import { TABLE_PRESETS } from './tables';

/** The order the preset picker offers groups in. */
export const PRESET_GROUPS: readonly PresetGroup[] = ['tables', 'seating', 'sanitary', 'plants-beds'];

/** Every preset, in picker order. The first one is the picker's default. */
export const ASSET_PRESETS: readonly AssetPreset[] = [...TABLE_PRESETS, ...SEATING_PRESETS, ...SANITARY_PRESETS, ...PLANT_AND_BED_PRESETS];

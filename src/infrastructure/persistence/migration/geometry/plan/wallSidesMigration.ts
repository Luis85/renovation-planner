/** Legacy versions owned only total thickness. Backfill both structures without changing their geometry. */
export function migrateWallSides(input: unknown): unknown {
	if (typeof input !== 'object' || input === null) return input;
	if ('schemaVersion' in input && typeof input.schemaVersion === 'number' && input.schemaVersion >= 13) return input;
	const result: Record<string, unknown> = { ...input, schemaVersion: 13 };
	for (const key of ['structure', 'intended']) {
		const structure = result[key];
		if (typeof structure !== 'object' || structure === null || !('walls' in structure) || !Array.isArray(structure.walls)) continue;
		result[key] = { ...structure, walls: structure.walls.map((wall: unknown) => {
			if (typeof wall !== 'object' || wall === null || !('thickness' in wall) || typeof wall.thickness !== 'number') return wall;
			return { ...wall, sideExtents: { a: wall.thickness / 2, b: wall.thickness / 2 } };
		}) };
	}
	return result;
}

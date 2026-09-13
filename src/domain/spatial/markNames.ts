/** Which drafting kinds are named by a sequence, and how (plan drafting tools design §5). */
const SEQUENCES = new Map<string, { readonly prefix: string; readonly digits: number }>([
	['section', { prefix: 'S-', digits: 2 }],
	['view', { prefix: 'A-', digits: 2 }],
	['grid', { prefix: '', digits: 1 }],
]);

/** The lowest free sequence name for `kind` among `taken`, or null for a kind named by its label. */
export function nextMarkName(kind: string, taken: readonly string[]): string | null {
	const sequence = SEQUENCES.get(kind);
	if (!sequence) return null;
	const used = new Set(taken.map(name => name.trim()));
	for (let n = 1; ; n += 1) {
		const name = sequence.prefix + String(n).padStart(sequence.digits, '0');
		if (!used.has(name)) return name;
	}
}

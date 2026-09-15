import { ref, watch, type Ref } from 'vue';

/** Keep both creation and Select/Add reachable when host fonts or leaf width change their height. */
export function useTaskbarClearance(root: Ref<HTMLElement | null>, options: { includeContent?: boolean } = {}) {
	const clearance = ref(88);
	watch(root, (element, _previous, cleanup) => {
		const canvas = element?.closest<HTMLElement>('.rp-plan-canvas');
		const primary = canvas?.querySelector<HTMLElement>('.rp-primary-actions');
		if (!element || !canvas || !primary) return;
		const measure = () => { clearance.value = Math.max(0, canvas.getBoundingClientRect().bottom - primary.getBoundingClientRect().top + 16 + (options.includeContent ? element.getBoundingClientRect().height : 0)); };
		const observer = new ResizeObserver(measure);
		if (options.includeContent) observer.observe(element);
		observer.observe(canvas); observer.observe(primary); measure();
		cleanup(() => observer.disconnect());
	}, { flush: 'post' });
	return clearance;
}

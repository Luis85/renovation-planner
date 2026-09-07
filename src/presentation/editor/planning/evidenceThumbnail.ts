/** Reload mutable host resources without changing immutable data/blob identities. */
export function evidenceThumbnailSource(image: string, revision?: number): string {
	if (revision === undefined || /^(data|blob):/.test(image)) return image;
	return image.replace(/([?#]|$)/, marker => `?rp-evidence-revision=${String(revision)}${marker === '?' ? '&' : marker}`);
}

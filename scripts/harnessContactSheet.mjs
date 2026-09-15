import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function writeContactSheet(directory, shots) {
	const entries = shots.filter(({ name }) => existsSync(path.join(directory, `${name}.png`))).map((shot) => {
		const group = shot.entry ?? shot.name.split('-').slice(0, 2).join(' / ');
		const file = `${shot.name}.png`;
		return `<article><h2>${esc(group)}</h2><p>${esc(shot.name)}</p><a href="${encodeURI(file)}"><img src="${encodeURI(file)}" alt="${esc(shot.name)}"></a></article>`;
	});
	writeFileSync(path.join(directory, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Harness shots</title><style>body{font:14px system-ui;margin:2rem}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem}article{border:1px solid #ccc;padding:.5rem}img{max-width:100%}</style><main>${entries.join('')}</main>`);
}

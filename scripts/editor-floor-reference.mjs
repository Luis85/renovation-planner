import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

/** A synthetic floor drawing at five world millimetres per pixel, with no project records. */
export function writeFloorReference() {
	const canvas = createCanvas(1640, 1240), ctx = canvas.getContext('2d');
	ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.translate(20, 20);
	function line(points, width = 2, color = '#b1b4b8') {
		ctx.beginPath(); ctx.moveTo(...points[0]); for (const point of points.slice(1)) ctx.lineTo(...point);
		ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
	}
	function rect(x, y, w, h) { ctx.strokeStyle = '#c2c4c7'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); }
	// Wall lines belong to the imported drawing; editable Rooms are created independently.
	line([[0, 0], [1600, 0], [1600, 1200], [0, 1200], [0, 0]], 18, '#42464b');
	line([[800, 0], [800, 600], [0, 600]], 12, '#64686d');
	line([[800, 600], [800, 1200]], 12, '#64686d');
	line([[800, 900], [1600, 900]], 12, '#64686d');
	// Window recesses and an internal doorway.
	ctx.fillStyle = '#ffffff';
	for (const [x, y, w, h] of [[200, -12, 220, 24], [1040, -12, 300, 24], [1588, 260, 24, 220], [550, 585, 190, 30], [788, 680, 24, 170]]) ctx.fillRect(x, y, w, h);
	line([[200, -3], [420, -3]]); line([[200, 3], [420, 3]]);
	line([[1040, -3], [1340, -3]]); line([[1040, 3], [1340, 3]]);
	line([[1597, 260], [1597, 480]]); line([[1603, 260], [1603, 480]]);
	line([[550, 600], [550, 790]], 2); ctx.beginPath(); ctx.arc(550, 600, 190, 0, Math.PI / 2); ctx.stroke();
	// Kitchen cabinets, sink, hob and island.
	rect(26, 24, 730, 105); rect(651, 129, 105, 300);
	for (const x of [140, 255, 370, 485, 600]) line([[x, 24], [x, 129]]);
	rect(310, 45, 120, 62); rect(321, 52, 98, 46);
	for (const [x, y] of [[678, 222], [727, 222], [678, 271], [727, 271]]) { ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.stroke(); }
	rect(210, 405, 295, 112);
	for (const x of [255, 355, 455]) { ctx.beginPath(); ctx.arc(x, 550, 25, 0, Math.PI * 2); ctx.stroke(); }
	// Living room furniture and hall stair treads.
	rect(1000, 110, 375, 145); rect(1018, 130, 165, 106); rect(1192, 130, 165, 106);
	rect(1090, 330, 190, 105); rect(1410, 160, 125, 370);
	rect(970, 610, 160, 160); rect(40, 760, 145, 395);
	for (let y = 795; y < 1155; y += 35) line([[40, y], [185, y]]);
	line([[112, 1120], [112, 820], [100, 840], [112, 820], [124, 840]]);
	// Bathroom fixtures.
	rect(1240, 945, 310, 180); rect(1254, 958, 282, 154); rect(840, 1050, 135, 110);
	ctx.beginPath(); ctx.ellipse(1080, 1115, 48, 62, 0, 0, Math.PI * 2); ctx.stroke();
	writeFileSync('tests/fixtures/editor-floor-reference.png', canvas.encodeSync('png'));
}

/**
 * `enHelp`'s German half, approved verbatim with ruling 49. The holes are the English ones, in
 * German quotation marks; `strings.test.ts` requires the same holes per key.
 */
export const deHelp = {
	'command.open-help': 'Einstiegshilfe öffnen',
	'help.guide.title': 'Einstiegshilfe',
	'help.guide.step-1': 'Führen Sie „{openProject}“ über die Befehlspalette oder das Symbol in der Werkzeugleiste aus. Wählen Sie „{createProject}“ – oder „{newProject}“, sobald es ein Projekt gibt – und geben Sie einen Namen ein.',
	'help.guide.step-2': 'Öffnen Sie das Projekt und wählen Sie „{createFirstPlan}“ oder unter der Planliste „{newPlan}“. Wählen Sie einen Plan in der Liste aus, um ihn im Grundriss-Editor zu öffnen.',
	'help.guide.step-3': 'Wählen Sie auf einem leeren Grundriss „{addRooms}“, später „{add}“ und dann „{room}“. Ziehen Sie auf dem Grundriss, um den Raum zu bemessen, oder geben Sie Breite und Tiefe ein, benennen Sie ihn und wählen Sie „{createRoom}“.',
	'help.guide.step-4': 'Um über einer vorhandenen Zeichnung zu arbeiten, legen Sie zuerst die PNG-, JPEG- oder PDF-Datei in Ihren Vault. Wählen Sie „{upload}“, geben Sie den Pfad der Datei im Vault ein und legen Sie dann den Maßstab fest, damit Flächen in echten Einheiten herauskommen.',
	'help.guide.step-5': 'Wählen Sie unter der Projektliste „{newAsset}“ oder „{library}“, um Ihren Katalog aufzubauen. Im Grundriss-Editor platzieren Sie ein Objekt mit „{add}“ und dann „{asset}“.',
	'help.guide.step-6': 'Um sich zuerst umzusehen, führen Sie „{sample}“ in der Befehlspalette aus. Damit entsteht ein fiktives Projekt mit einem Plan und fünf Räumen und Flächen, und der Plan wird geöffnet.',
	'help.guide.step-7': 'Wenn sich etwas nicht lesen lässt, führen Sie „{diagnostics}“ in der Befehlspalette aus oder öffnen Sie den Bericht in den Einstellungen dieses Plugins. Er zeigt, welche Notizen in dieser Sitzung das Laden verweigert haben.',
	'help.guide.reopen': 'Sie können diese Hilfe jederzeit wieder mit „{openHelp}“ in der Befehlspalette öffnen.',
} as const;

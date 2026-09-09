# Verbleibender Plan: Referenzskalierung auf #109

Stand: 2026-09-09. Dies ist ausschließlich die Concern-Fortschreibung zur Referenzskalierung. Der vollständige, weiterhin maßgebliche [Restplan aus #117](https://github.com/Luis85/renovation-planner/blob/5c15006c38d01b530641ac6da1ed154ab52227c6/docs/user-experience/renovation-planner-editor-specs/implementation/remaining-plan.md) bleibt für alle anderen Arbeitspakete unverändert. #109 baut auf #108 auf; #110 ist seine unmittelbare Folgeabhängigkeit.

## Abnahme dieses Punkts

- [x] Aktuelle Remote-Heads, CI und Review-Threads von Concern und Basis prüfen.
- [x] Eigenen Worktree vom aktuellen #109-Stand erstellen; Main und fremde Arbeiten unverändert lassen.
- [x] Referenzteil des Zusatztreibers übernehmen und fehlende Maßstabs-/Speicherprüfungen ergänzen.
- [x] Tatsächlich gerenderte Bildfläche gegen den unveränderten #108-Stand vergleichen.
- [x] Beschriftete Pan-/Zoom-/Fit-Aktionen, Maus und Tastatur sowie unveränderte A/B-Bildkoordinaten prüfen.
- [x] 700 px mit Eingabe `3,5` m ergeben 0,2 Pixel/mm; Wiederöffnen und bytegleicher Abbruch eines gespeicherten Plans prüfen.
- [x] Light, Dark, Akzent und Deutsch bei 460 px aufnehmen und tatsächlich betrachten.
- [x] Aktuellen vollständigen Qualitätscheck auswerten: Build/Lint und alle vier Referenz-Testdateien bestanden; 8 bekannte fremde Testfehler, 97,87 % Branch-Coverage und Fallow-Befunde bleiben offen. Nachweise siehe Concern-Bericht.
- [x] Bestätigten Testvault sichern, geprüften Build installieren und nativ neu laden.
- [x] Nativ PNG, Light/Dark, Pan/Zoom/Fit, stabile A/B-Koordinaten, unveränderten Escape-Abbruch sowie die Speicherung mit 0,2 Pixel/mm prüfen.
- [ ] **Manuell durch den Nutzer übernommen:** gespeicherte Referenz wieder öffnen und A/B/3,5 m prüfen; geänderten gespeicherten Referenzentwurf abbrechen und Dateien vergleichen; schmale deutsche Host-Ansicht prüfen.

**Die vollständige Abnahme bleibt offen; die restliche manuelle Prüfung übernimmt der Nutzer später selbst.** Der Pfad `C:\Users\lum\.codex\tmp\renovation-planner-finalization-vault` wurde bestätigt und ausschließlich dieser Vault verwendet. Computer Use wurde während der nativen Prüfung mit der physischen Escape-Taste beendet. Anschließend hat der Nutzer die Restprüfung ausdrücklich übernommen; der Agent führt keine weiteren nativen Aktionen aus.

Prüfplan: **Reference Scale Acceptance** im Projekt **Reference Scale Acceptance 2026-09-09**. Letzter beobachteter Hostzustand: Light; Deutsch ausgewählt, Sprachneustart ausstehend. Vorher: Englisch und „Adapt to system“. Der geprüfte Plugin-Build und der gespeicherte Prüfplan bleiben für die manuelle Fortsetzung verfügbar. [Native Teilabnahme und konkrete Restschritte](reference-scale-acceptance.md#native-teilabnahme-und-manuelle-fortsetzung).

[Abnahmekriterien, Befunde und Nachweise](reference-scale-acceptance.md). Bei der kontrollierten späteren Stackintegration ausschließlich diesen Referenzstatus und die erweiterten Referenzprüfungen in den vollständigen Plan/Treiber übernehmen. Foto-UX, andere Modals und alle weiteren Editor-Planpunkte bleiben offen beziehungsweise behalten ihre bisherige Klassifikation. Kein Merge oder Release.

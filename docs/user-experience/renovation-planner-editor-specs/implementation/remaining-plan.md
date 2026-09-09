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
- [ ] Ablauf nativ im eindeutig freigegebenen isolierten Obsidian-Testvault verifizieren.

**Der Punkt ist noch nicht abgeschlossen.** Der ausdrücklich genannte Pfad `C:\Users\lum.codex\tmp\renovation-planner-finalization-vault` existiert nicht; der frühere Plan nennt stattdessen den vorhandenen Pfad `C:\Users\lum\.codex\tmp\renovation-planner-finalization-vault`. Die Klärung ist angefragt. Bis zur Antwort erfolgt keine native Aktion in einem abweichenden Vault.

[Abnahmekriterien, Befunde und Nachweise](reference-scale-acceptance.md). Bei der kontrollierten späteren Stackintegration ausschließlich diesen Referenzstatus und die erweiterten Referenzprüfungen in den vollständigen Plan/Treiber übernehmen. Foto-UX, andere Modals und alle weiteren Editor-Planpunkte bleiben offen beziehungsweise behalten ihre bisherige Klassifikation. Kein Merge oder Release.

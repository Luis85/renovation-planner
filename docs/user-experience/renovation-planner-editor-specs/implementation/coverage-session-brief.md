# Dedicated coverage session — copyable assignment

Übernimm dediziert die verbleibende Testabdeckung für den Renovation-Planner-Editor.

## Auftrag und Basis

Repository: `D:/Projects/renovation-planner`.
Integration: `codex/editor-plan-finalization`, PR
https://github.com/Luis85/renovation-planner/pull/91.
Koordinierende Root-Task-ID: `01a0786f-b624-7303-987f-b18b94db48d9`.

Lies vorhandene AGENTS.md, CLAUDE.md und gegebenenfalls .codex/instructions.md samt
Workflow. Lies danach im Integrationsbranch
`docs/user-experience/renovation-planner-editor-specs/implementation/RESUME.md`,
`coverage-coordination.md`, `implementation-status.md` und die aktuellen
Coverage-/Evidence-Berichte.

Prüfe den tatsächlichen Git-/CI-Stand. Erstelle einen eigenen Worktree unter
`.worktrees/editor-coverage-finalization` mit Branch
`codex/editor-coverage-finalization`, aus dem **neuesten gepushten**
`origin/codex/editor-plan-finalization`. Behalte den main-Checkout sauber.
Bei bereits vorhandenem Branch/Worktree zuerst dessen Zustand prüfen.

## Ziel und Zuständigkeit

Erreiche die unveränderten Coverage-Vorgaben auf dem aktuellen, mit Root
abgestimmten gemeinsamen Quellstand: Statements 99%, Functions 99%, Lines 99%,
Branches 98%. Maßgeblich bleibt die tatsächliche Repository-Konfiguration.
Root behält Integration und Gesamtabschluss; UI behält Darstellung, Caption-/DOM-
Messung, Browser-Captures und deren Regressionen. E bleibt für konkrete
Recovery-/Hardening-Defekte zuständig. Du besitzt die globale Coverage-Auswertung
und die dafür vereinbarten zusätzlichen Testpakete.

Melde Root zuerst deine Task-ID, Branch, Basis-SHA und einen begrenzten ersten
Datei-/Testplan. Kündige Änderungen an bestehenden Testdateien an; nutze nach
Möglichkeit neue klar abgegrenzte Testdateien. Koordiniere notwendige
Produktionskorrekturen vor gemeinsamen Dateiänderungen. Andere Worktrees bleiben
unverändert. Erzeuge keine Ersatz-Tasks.

## Ausgangsevidence, neu zu prüfen

CI auf `45c58609`, Run `34140688682`: alle vier Linux-/Windows-Jobs bestehen
651 Dateien/8.079 Tests, 69 übersprungen. Statements 99,04%, Functions 99,26%,
Lines 99,51%; Branches 12.400/12.692 = 97,69%. Bei diesem Nenner fehlen 39 Arme.
Neuere Root-Tests und die noch laufende UI-Integration verändern diesen Stand.
Übernimm daher keine unverifizierte Restzahl als aktuelle Wahrheit.

Vollständige JSON-/LCOV-Artefakte werden von jeder CI-Matrixvariante hochgeladen.
Der Name enthält den getesteten PR-Merge-SHA. Vergleiche dessen Git-Baum/Source
mit deinem Prüfstand. Lokale Kopie der genannten Messung:
`C:/Users/lum/AppData/Local/Temp/rp-finalization-20260907-88b9ee3d/ci-45c58609-linux24/`.
Sie enthält `coverage-final.json`, `lcov.info` und `missing-counters.json`.
Fehlt sie oder ist sie veraltet, verwende den passenden aktuellen CI-Download.

Root hat vor Übergabe das bereits begonnene Paket
`planningFinancialBoundaries.test.ts` und `projectLibraryFlows.test.ts` abgeschlossen
(8/8 Tests, Types/Oxlint/scoped ESLint und statischer Fallow grün).
Diese Fälle und alle in RESUME/Evidence dokumentierten Pakete nicht duplizieren.
Die aktuelle UI-Produktion ist teilweise noch nicht im Root-Branch; hole für die
abschließende Messung den mit Root vereinbarten integrierten Stand nach.

## Arbeits- und Prüfregeln

- Ordne fehlende Counter echten erreichbaren Verhaltensgrenzen zu. Nutze gültige
  persistierte Daten, reale Commands/Repositories und native öffentliche Abläufe.
  Prüfe beobachtbare Ergebnisse, Fokus, Identitäten, Writes, Undo und Recovery.
- Behalte Schwellen, Assertions, Timeouts, Testentdeckung und Ausschlüsse bei.
  Keine Coverage-/Lint-Suppressions, verfälschten Counter, privaten Vue-Handler,
  unmöglichen Erfolgsdaten oder künstlichen Fehlerantworten, nur um Zahlen zu füllen.
- Öffentliche Service-Grenztests sind sinnvoll, wenn sie einen tatsächlichen
  Vertrag prüfen; kennzeichne sie als solche und nicht als Browser-/Host-Evidence.
  Dokumentiere nicht erreichbare defensive Arme und priorisiere echte Lücken.
- Sichere vollständige Coverage vor Scoped-Runs. Ein Scoped-Pass ersetzt keine
  vollständige Messung. Ermittle tatsächliche neue Hits anhand vergleichbarer
  Countermaps; schätze sie nicht nach der Anzahl hinzugefügter Tests.
- Fallow kann die ursprüngliche CI-Datei mit `--coverage` und
  `--coverage-root /home/runner/work/renovation-planner/renovation-planner` lesen.
  Prüfe Sourcegleichheit und Pfadzuordnung; geschätzte CRAP-Werte aus alten oder
  fremden Quellpositionen sind kein aktueller Health-Nachweis.
- Schwere lokale Installationen, Tests, Builds, Coverage, Analyser und Browserläufe
  brauchen einen ausdrücklich mit Root abgestimmten freien Prüfslot. Der Rechner
  hat etwa 8 GB RAM. Lesen, Testvorbereitung und Dokumentation können parallel
  laufen. Keine fremden Prozesse beenden; keine bereits laufende Prüfung duplizieren.

## Checkpoints und Abschluss

Committe und pushe regelmäßig kleine zusammenhängende Zwischenstände, besonders
vor langen Prüfungen oder Pausen. WIP darf gesichert werden, muss aber eindeutig
als ungeprüft dokumentiert sein. Halte einen eigenen Coverage-Fortsetzungsbericht
mit Basis, Änderungen, echten Ergebnissen, offenen Punkten und nächster Aktion
aktuell; Root pflegt die gemeinsamen Statusdateien.

Liefere Root jeweils Commit-SHA, betroffene Dateien, ausgeführte Prüfungen und
Integrationsempfehlung. Öffne bei GitHub-Zugang eine korrekt auf
`codex/editor-plan-finalization` basierte Draft-PR. Root übernimmt nur vereinbarte
committete Ergebnisse. Keine PR mergen, Releases veröffentlichen oder fremde
Tasks/Worktrees schließen.

Abschlussnachweis: unverändertes `npm run check` auf dem abgestimmten aktuellen
gemeinsamen Source, vollständige passende CI-/Coverage-Daten, exakte Counter und
alle Qualitätsvorgaben erfüllt. Melde verbleibende echte Blocker konkret.
Ein grüner Teiltest oder ein älterer Branch genügt nicht. Der Gesamtabschluss von
M00–M17 und die Live-Host-Abnahme bleiben bei Root.

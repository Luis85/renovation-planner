# Wiederaufnahme der Editor-Finalisierung

Stand: **2026-09-07T14:18:24.109Z (UTC)**.

Dieses Dokument ist der zentrale Wiedereinstieg, wenn der Chatkontext oder das Nutzungslimit endet. Es ersetzt keine Prüfung des aktuellen Git-, Prozess- und CI-Zustands. Neuere direkte Nutzeranweisungen haben Vorrang. Alte Pause-Dateien vom App-Neustart sind historisch: Der Nutzer hat die Arbeit ausdrücklich mit „fahre fort“/„weiter“ wieder aufgenommen.

## 1. Auftrag und Abschlussmaßstab

Das unveränderte Ziel lautet:

> Finalize the Renovation Planner editor implementation plan by coordinating the two existing implementation tasks, closing remaining in-scope M00–M17 requirements, integrating committed results, and delivering one verified, reviewable completion candidate. Do not mark complete while required implementation, verification, or live-host acceptance remains outstanding.

Der zusammenhängende Ablauf muss funktionieren: Project → Floor setup → Room/Area/Wall/Opening → Existing → Planned → Work → Materials → Costs → Evidence → Review → Safe recovery.

Erforderlich sind Produktion, angemessene Verifikation und eindeutiger Status der Host-Abnahme für alle anwendbaren akzeptierten Anforderungen. Eine grüne Teilprüfung, viele Tests, eine offene PR oder vorhandene Vergleichsbilder reichen nicht als Abschlussnachweis. Das Goal ist **aktiv und nicht abgeschlossen**, ohne Tokenbudget.

Der Nutzer hat zusätzlich verlangt:
- den aktuellen Zwischenstand zu pushen;
- sinnvolle zusätzliche Parallelisierung;
- dieses dauerhafte Wiederaufnahme-Dokument;
- **regelmäßige kleine Zwischenstands-Commits und Pushes auch durch die beiden anderen Aufgaben**. Ungeprüfte Arbeit darf als klar gekennzeichneter WIP gesichert werden; daraus folgt kein Prüf- oder Abnahmepass.

Keine GitHub-PR mergen, keinen Release veröffentlichen, keine Aufgabe schließen und keine fremden Worktrees löschen ohne entsprechende Nutzeranweisung. Gewöhnliche Nutzervaults sind keine Testdatenquelle. Keine Coveragegrenze, Assertion, Timeoutgrenze oder Ausschlussliste abschwächen, um einen Pass herzustellen.

## 2. Verbindliche Quellen zuerst lesen

- Vorhandene `AGENTS.md` als primäre Projektanweisung; bei `.codex/` auch `.codex/instructions.md` und passenden Workflow. Beim letzten Audit waren beide im Repo nicht vorhanden; erneut prüfen.
- [CLAUDE.md](../../../../CLAUDE.md) und [SDD](../../../development/sdds/obsidian-renovation-planner-SDD.md).
- [Spezifikationsübersicht](../README.md), alle M00–M17-Screens samt Bildern, [Komponenten](../components/component-library.md).
- [Implementierungsplan](implementation-plan.md), [Status](implementation-status.md), [Completion-Matrix](completion-matrix.md), [Integrationsplan](integration-map.md).
- [Aktuelle Metadatenkorrekturen](evidence-metadata-completion.md), [Downstream-Evidence](downstream-planning-evidence.md), [Review-Audit](review-audit.md).
- [E-Wiederaufnahme](e-hardening-resume.md), [ausführbarer Host-/CI-Audit](e-host-ci-audit.md).
- [Host-Vorbereitung](live-host-preparation.md), [Linked-Summary-Fokus](linked-summary-focus-evidence.md), [Pin-Symbole](editor-pin-symbols.md), [Caption-Clearance](editor-caption-placement.md).

Spätere akzeptierte ADR-/SDD-Amendments gehen älteren Liefer-Snapshots vor. Ein historischer Satz „not delivered“ ist keine akzeptierte Scope-Entfernung. Manche Tabellen enthalten historische oder generische Pending-Zeilen; daraus keine neue Implementierung ableiten, ohne den aktuellen Code zu prüfen.

## 3. Repository und Integrationsstand

Repository: `https://github.com/Luis85/renovation-planner`.

| Bestandteil | Gesicherter Stand |
|---|---|
| Hauptcheckout | `D:/Projects/renovation-planner`, sauber auf `main`, zuletzt `44234f77c229fa5b6122fc75d86e2f2d19a31dfa` |
| Integrationsworktree | `D:/Projects/renovation-planner/.worktrees/editor-plan-finalization` |
| Integrationsbranch | `codex/editor-plan-finalization` |
| Letzter gepushter Produkt-/Testcheckpoint | `73b0c205d8abaf1ab5869ee8cffead8654061f00` |
| PR | [#91](https://github.com/Luis85/renovation-planner/pull/91), **OPEN / DRAFT** |
| PR-Basis | `codex/materials-costs-evidence`, #88, `3c1c737a5bfaf0a9e4782f1cbfe2ec4e0aca7f6a` |

Der Commit, der dieses Dokument hinzufügt, ist ein Dokumentationsnachfolger. Die unten genannten Messungen beziehen sich auf den explizit genannten Produktstand, nicht automatisch auf jeden späteren HEAD.

Abhängigkeiten: **#74 → #75 → #76 → #82 → #83 → #85 → #86 → #87 → #88**, danach den gewählten #89/#90/#91-Integrationsweg genau einmal. Abhängige PRs nach dem Landen ihrer Basis retargeten. Der Mensch entscheidet die konkrete Merge-Strategie. Frühere gleichwertige Patches nicht doppelt übernehmen.

Alte Stashes wurden bereits angewandt und nur als historische Sicherungen behalten. **Nicht erneut poppen/anwenden.** Keine Reset-/Clean-/Worktree-Aufräumaktion aus diesem Dokument ableiten.

## 4. Aufgaben, Zuständigkeiten und gesicherte WIPs

Nur die zwei bestehenden benutzereigenen Implementierungsaufgaben koordinieren; keine Ersatzaufgaben erzeugen. Zusätzliche eng begrenzte Hilfsagenten für unabhängige Arbeit wurden durch die neuere Parallelisierungsanfrage erlaubt. Fremde Worktrees nicht selbst bearbeiten.

| Aufgabe | ID | Worktree / Branch | Stand |
|---|---|---|---|
| Integration, diese Aufgabe | `01a0786f-b624-7303-987f-b18b94db48d9` | `editor-plan-finalization` / `codex/editor-plan-finalization` | Produkt-/Teststand 73b0c205 gepusht |
| **Implement locked editor UI** | `01a0783d-199d-7772-920b-90493cf0d8b4` | `.worktrees/editor-object-ui` / `codex/editor-object-ui` | **laut Owner gepusht: cdbd30a3**, weiterhin ungeprüfter UI-WIP |
| **Improve M15 recovery workflow** | `01a07838-4e54-7ac3-bc24-a8eef9185d6e` | `.worktrees/native-recovery-boundaries` / `codex/native-recovery-boundaries` | sauber/gepusht: `1dd52cdad1e9b837fb24ee138cbe343a783e0c71`; Produktfix bleibt `300a0929`, Nachfolger sichert Audit-Dokumentation |

UI-WIP ist **gesichert, aber noch nicht geprüft/angenommen und nicht in Root integriert**:
- `b0c68a0390341b1eb8069133b1c80948f0067e78`: repräsentative Sechs-Foto-Galerie über synthetische Bildinputs und native Formularpfade.
- `9d7f7e8baa258761042e45b9ecaa69a736484d09`: lokaler Root-73b0-Merge, im gepushten Nachfolger enthalten. Produktionskonflikte der drei Pin-Dateien wurden mit dem Root-Stand aufgelöst; required Props, zurückbehaltener Snapshot und Datum bleiben erhalten.
- `023af9857227e95e928dfae9e4b916a5187c6ceb`: separater ungetesteter M04-WIP. Dateien: `StructureTaskForm.vue` (Labelklasse), `styles/editor-structure.css` (Flex/Scroll-Padding), `styles/editor-visual-tasks.css` (Checkbox aus allgemeinem Input-Minimum). Bericht `editor-wall-task-clearance.md` und Before-Bild liegen auf dem UI-Branch.

Weitere gepushte UI-WIPs: `5ca8cd65` Record-/Kosten-Dichte, `75a4c0ae` Overview-Abstände, `421c19b0` Add-Katalog/Host-Symbole, `226e0be9` M07/M11-Darstellung, `cdbd30a3` passende Capture-Kontexte. Letzterer bestand drei `node --check`; Browserprüfung und Integration stehen aus. UI besitzt zusätzlich die Präsentation von M05/M15/M17 aus vorhandenen Read-Modellen. Keine neuen Readiness-Regeln. Eigene Wiederaufnahme: `editor-ui-resume.md` auf UI-Branch.

E hat den separaten Checkpoint **`46dd866138d49d0283849b3b59a130cb9f3a9ed3`** auf **`codex/downstream-view-states`**, Worktree `.worktrees/downstream-view-states`, von Root `b6d8934e` gepusht. Nur `QuoteComparisonState.vue`, `work/ProjectWorkState.vue` und eigene Evidence-Doku: abgeleitete Viewzustände zum Beheben der gemessenen Template-Komplexität. Noch WIP; E erhält nach Root-Session 20330 den exklusiven schweren Prüfslot. Root besitzt `EvidenceInspector.vue` und Coverage-Auswertung.

Push-Regel ab jetzt: Nach zusammenhängenden Abschnitten und vor längeren Prüfungen kleine Checkpoints sichern; SHA, Branch, bestandene/offene Prüfungen, WIP-Status und nächste Aktion an die Integration melden. Keine regelmäßige Automation dafür anlegen. Gemeinsame Ledger aktualisiert primär Root; Eigentümer verwenden eigene Evidence-/Wiederaufnahmedateien.

E sichert seine Auditresultate zusätzlich in `e-hardening-resume.md` und `e-host-ci-audit.md` (Dokumentationscheckpoint `1dd52cda`, ebenfalls in Root übernommen). UI legt einen eigenen `editor-ui-resume.md`-Eintrag an; seine Existenz/letzten Stand vor Verwendung prüfen.

## 5. Zuletzt integrierte Checkpoints

| Ursprung | Root-Übernahme | Inhalt |
|---|---|---|
| E `7fd8980144e1bbce4aee9a7eafa85e9799a4cf8a` | `a7d61da1` | 8 native Arrival-/Deletion-Fälle |
| E `fe76028ec99d82a7e69fc6ee145835aa33036b58` | `eb08df28` | 4 native Recovery-Grenzen und Browser-Resize-Synchronisierung |
| UI `f8fcc32b1f47eb7ecedf9eb0830f6bfcd266290d` | `ae7685a0` | Room-Captions halten Abstand zu sichtbaren Pins |
| E `300a0929dec7965147ff83cf2e3732c706ad5e94` | `11e5aa26` | Fokusnachfolger nach verschwundenem Overview-Link |
| UI `454e7b6163f74dde5c9ad7d0d14122f66c6bb0d3` | `08797c24` | Host-Symbole + Nummern; Canvas-Adapter und Pixeltests |
| UI `905f3f3062fcc2a75a769a369d86a10e54f1ef8c` | `56d73f3e` | Decode-/Frame-Wait vor Foto-Capture |
| Root | `73b0c205` | Datum, Schema 8, gemeinsamer Pin-Snapshot, separater Work-Link, weitere native Grenztests und Dokumentation |

Der Promise-Executor im Capture-Wait ist in Root 73b0c205 mit einem Blockbody korrigiert. Die äquivalente Zeile im UI-Galerie-WIP nicht als zweiten unabhängigen Fix behandeln.

Ältere gesamte Vorgänger-/Owner-Lineage steht in [integration-map.md](integration-map.md). Insbesondere UI 51aaac72 sowie E 89f498f9/00852947 bleiben enthalten.

## 6. Aktueller Produktstand und wichtige Invarianten

Die grundlegenden verbundenen Funktionen sind integriert: alle elf Add-Routen, Room-/Area-/Elementpräzision, unabhängige Existing-/Planned-Fakten, Work/Decisions, Materialien/manuelle Overrides, Beschaffung und getrennte Kostenfakten, Evidenz und Review, Quellenavigation und sichere Wiederherstellung.

Neu in 73b0c205:
- `Evidence.date?: string` ist ein ausdrücklich eingegebenes ISO-Kalenderdatum. Unbekannt bleibt fehlend; niemals Datei-/Importzeit oder Heute einsetzen.
- Nur Plans mit vorhandenem Datum schreiben Schema 8. Reine 7→8-Lesemigration schreibt keine Datei und erfindet kein Datum. Ohne Datum bleibt das von anderen tatsächlichen Fähigkeiten benötigte Schreibschema erhalten.
- `sameRenovation` berücksichtigt das Datum. Reine Date-/Clear-/Undo-Vorgänge und Peer-CAS sind getestet.
- Galerie/Liste und Pins verwenden dieselbe Datumsreihenfolge: bekannte Daten aufsteigend, gleiche Daten stabil, undatierte Einträge danach.
- **Ein** `useEvidencePins(readEvidence)` in `PlanCanvas.vue` liest `runtime.planning.baseline`. Required Props führen dieselbe Liste an ZoneLayer und über RenovationLayer an EvidencePins. ProjectStore-Zonen liefern nur die aktuell gezeichneten Weltpositionen. Kein zweiter Metadaten-Fallback und keine optionale Runtime-Injection.
- `workId` wird als eigener Work-Link angezeigt, wenn es vom allgemeinen `recordId` abweicht. Gleiche Links nicht verdoppeln; verschiedene Beziehungen erhalten.
- Ein erfolgreicher Save mit gescheitertem Read-back bleibt erfolgreich. Retry/Quellöffnung dürfen den Write nicht wiederholen; spätere View-Callbacks dürfen nach Disposal nicht erneut wirken.

Die aktuelle Canvas-Testbrücke konvertiert nur das sechste `arc`-Argument zu Boolean. Konva übergibt bei SVG-Pfaden 0/1, der Browser akzeptiert dies, der native Rust-Rasterizer war strenger. Echter Rasterizer und Pixelvergleich bleiben aktiv; keine Fehlerunterdrückung.

## 7. Verifikation: belastbare Ergebnisse und aktuelle Fehler

### Gezielte Prüfungen

- Finaler Zwischenstands-Lauf: **478/478 Tests, 9 Dateien, 51,66 s** nach den letzten Default-/Mock-Korrekturen.
- Vorheriger kombinierter Metadaten/UI/Recovery/Digest-Lauf: **476/476, 9 Dateien, 45,06 s**. Die Mengen überlappen; Zahlen nicht addieren.
- Finale Typprüfung und **ganzes** Oxlint/ESLint: bestanden.
- Produktionsbuild: bestanden, 1047 Module. Diff-Checks bestanden.
- Datum-RED zeigte zunächst das fehlende Feld. Zwei weitere echte REDs belegten falsche Galerie-/Pinzuordnung bei zurückbehaltenem Planning und einen obsolete Cost-Draft bei erfolgreichen, nur im Datum unterschiedlichen Snapshots.
- Ein ursprünglicher Pin-Test nahm Konva-Einfügereihenfolge als Nummerierung an; korrigiert wurde der Test auf die tatsächlich sichtbare Nummer. Kein Datenverlust wird aus dieser Fixtureannahme behauptet.

### Vollständige CI auf 73b0c205

Run [34126554088](https://github.com/Luis85/renovation-planner/actions/runs/34126554088) ist abgeschlossen:
- Alle vier Verify-Jobs rot; Audit grün.
- Linux 22/24/26 und Windows 22 zeigen dieselben **647 Dateien: 645 bestanden, 2 fehlgeschlagen**; insgesamt **8053 bestanden, 3 fehlgeschlagen, 69 übersprungen**.
- Statements **17842/18028 = 98,96 %** (Vorgabe 99 %).
- Branches **12371/12686 = 97,51 %** (Vorgabe 98 %).
- Functions **5106/5153 = 99,08 %**, Lines **13964/14038 = 99,47 %**: Vorgaben erfüllt.
- Bei unverändertem Nenner fehlen noch **6 Statements und 62 Branch-Arme**. Nach Korrekturen neu messen; diese Zahl ist keine dauerhafte Restliste.

### Volltest abgeschlossen, Vertragskorrekturen gezielt grün

Der lokale vollständige Lauf auf Produktstand `73b0c205` ist **terminal, Exit 1**, Session 6991 beendet: 647 Dateien, 644 bestanden/3 fehlgeschlagen; 8051 Tests bestanden/4 fehlgeschlagen/70 übersprungen, 2156,81 Sekunden. Neben den drei identischen CI-Vertragsfehlern trat lokal ein unveränderter 5-s-Timeout in `temporaryToolBanner.test.ts` auf. Coverage entspricht exakt den oben angegebenen CI-Werten.

Anschließend wurden zwei Testdateien korrigiert:
1. `referencePlanMigration.test.ts`: latest/idempotente Migration Schema 8, letzter Schritt 7→8, Zukunftsversion 9. Unverändertheit der Originaldaten und alte Writer-Schutzprüfung bleiben erhalten.
2. `planningWorkflow.test.ts`: Related-record-Link anhand seiner übersetzten Beschriftung auswählen, da der separate Work-Link jetzt davor steht. Sämtliche Work-/Decision-/Cost-/Subject-Navigationen und Löschwarnungen bleiben geprüft.

Gezielter Nachlauf **Session 20330 terminal, Exit 0: 49/49 Tests in fünf Dateien, 86,04 s**. Aufruf: `npm test -- tests/infrastructure/persistence/referencePlanMigration.test.ts tests/presentation/editor/planningWorkflow.test.ts tests/presentation/editor/shell/temporaryToolBanner.test.ts tests/presentation/editor/evidenceDate.test.ts tests/presentation/editor/evidenceWorkLink.test.ts`, `VITEST_MAX_WORKERS=1`. Der lokale Timeout bestand beim unveränderten Wiederholungslauf; keine Grenze erhöht. Log `post-ci-contract-corrections.log` im unten genannten Scratch. Diese Korrekturen sind im selben Checkpoint wie diese Aktualisierung enthalten; ein vollständiger Folgepass wird daraus nicht behauptet.

Frisches vollständiges **Fallow ebenfalls Exit 1**: drei Template-Cognitive-Complexity-Befunde bei Grenzwert 15: `QuoteComparisonState.vue` 18, `work/ProjectWorkState.vue` 19, `planning/EvidenceInspector.vue` 16. **Null Dead-Code-Issues, null Clone-Gruppen.** E bearbeitet die ersten zwei, Root den Inspector. Die allgemeine Empfehlung zu `renovationSummary.ts` ist keiner dieser drei Fehler. Keine Suppression oder Grenzwertänderung.

Vollständiges JSON/lcov und Check-/Analyze-Logs samt Exitdateien sind vor scoped Coverage gesichert unter `C:/Users/lum/AppData/Local/Temp/rp-finalization-20260907-88b9ee3d/full-checkpoint-73b0c205/`. Für die nächste Coverage-Auswertung diese frische Messung verwenden. Root hat aktuell keinen schweren Prozess; E hat den Prüfslot, UI arbeitet source-only. Nach Neustart aktuelle Handles und Prozesse erneut prüfen, alte Sessionnummern nicht als lebend behandeln.

Ein früherer PowerShell-5-Wrapper brach fälschlich an informativem Vite-stderr ab. Korrigiert: direkt im vorhandenen PowerShell ausführen, `npm.cmd` auflösen und den echten Exitcode auswerten. Der spätere Gate-Lintfehler des RAF-Executors sowie zwei Komplexitätsgrenzen und ein Date-Placeholder-Lintfehler sind bereits korrigiert.

## 8. Bekannter visueller Restumfang

Die folgenden Befunde stammen teilweise aus älteren 555-Captures plus aktuellem Source-Review. Vor einer Änderung passenden Zustand und ca. 1000-px-Referenzhöhe vergleichen; Inhalts-/ADR-Unterschiede nicht als Fehler oder gefälschte Daten „reparieren“.

| Bereich | Nächste Arbeit |
|---|---|
| M00/M01 | CTA/Kosten unter Fold bzw. übergroße Abstände prüfen; enge CSS-Dichtekorrektur, vorhandene Funktionen erhalten |
| M02 | Add-Menü: sehr hohe Kartenzeilen, starke Scrollstrecke, fehlende Katalogsymbole/Suchhinweis |
| M03/M05 | Frische passende Bilder fehlen teilweise; M05-Startkarten brauchen die geforderten Beschreibungen |
| M04 | Checkbox durch allgemeine Input-Min-Höhe/Sticky-Footer beeinträchtigt; **WIP 023af985 prüfen**, nicht erneut implementieren |
| M06 | Modal-Host ist akzeptierte ADR-Abweichung; keine unnötige Reparenting-Neugestaltung |
| M07 | Großer Maß-/Kontextblock verdrängt Overview; echte Kameraposition/Fit-Floor und Dichte prüfen |
| M08–M10 | Überhohe Recordkarten/gleichgewichtige Aktionen; Fokus erhalten, Aktionen nicht nur verstecken |
| M11 | Gequetschte Batchaktionen und irrelevanter Area-Hinweis bei Wall-Auswahl |
| M12/M16 | Bisher kein neuer hoher Screenshotbefund; finale gemeinsame Prüfung bleibt nötig |
| M13 | Dichte/Anordnung der fünf Summen und Sichtbarkeit von Add Cost |
| M14 | **Galerie-WIP b0c68a03 prüfen**: sechs synthetische Bilder, native Links, During-Filter, explizite Daten/Work, bekannte Auswahl, vier tatsächliche Room-Fixtures und native Fit-Floor. Ein Foto belegt Pin-Korrektur, nicht vollständige Galerie-Fidelity |
| M15 | Warnsymbol und beschreibende Überschrift prüfen; vorhandene Recovery-/Live-Region-Semantik erhalten |
| M17 | Read-only Floor-/Room-Zusammenfassung/ausgewählte Transformation aus vorhandenen Projektionen; keine neuen Readiness-Regeln. Repräsentative Findings-Capture fehlt |

UI besitzt die Darstellung und eigene Driver/Fixtures. Root besitzt die integrierten Datum-/Snapshot-/Work-Funktionen. Gemeinsame Vue-Dateien vor parallelen Änderungen abstimmen.

Die originale finale Sequenz hat **neun**, nicht zehn Journeys:
1. materials-costs-evidence
2. renovation-workflow
3. reference-plan
4. editor-visual-resilience
5. editor-visual-overview
6. editor-object
7. planning-recovery
8. modal-busy-focus
9. editor-downstream

Danach: `editor-visual-fidelity-shots.mjs` und `editor-visual-comparisons.mjs`, 18 Referenzen, Bildhashes und `capture-provenance.json`. Der originale `scripts/editor-visual-final-check.mjs` verlangt committed Source/Harness und prüft den Source während des Laufs. Unterbrochene Teilläufe nicht zu einem behaupteten kompletten Pass zusammenfügen.

## 9. Performance- und Host-Abnahme

E 300a0929 bestand die deutsche Original-Recovery-Journey vor dem letzten Metadaten-Join:
- 80 Rooms / 240 Materialien / 24 Katalogobjekte / 40 Fotos mit 1600×1200.
- Nutzbar 506,9 ms; Auswahl 65,4 ms; Inspector 75,4 ms.
- Pan: 59 Samples, Median 16,6 ms / p95 17,1 ms.
- Material-Pan: Median 16,7 ms / p95 16,8 ms.
- Drei Close/Reopen-Zyklen: je null getrackte Stages, Listener, DOM-Bilder und Object URLs.
- 1 Write, zwei fehlgeschlagene Retries, kein Write-Replay; 100 unrelated Events = 0 Reads; 100 relevante Events = 1 Read.
- Axe: keine Violations, dokumentierte incomplete Checks.

Diese Werte liegen in diesem Headless-Edge-Lauf innerhalb der vorgeschlagenen Budgets. Der finale gemeinsame Lauf muss sie erneut liefern. Der Driver zeichnet Ziele auf, assertiert aber nicht alle Latenz-/FPS-Grenzen: Rohwerte prüfen, nicht allein Exit 0. Keine physische Geräte-/Screenreader-Abnahme daraus ableiten.

### Testvault ist jetzt zugänglich

Ausschließlich: `C:/Users/lum/.codex/tmp/renovation-planner-finalization-vault`.

- Obsidian **1.13.7**, testbezogenes Fenster zuletzt **7014760**.
- Gewöhnliches Nutzervault-Fenster **657340** wurde nicht benutzt.
- Der frühere Trust-Dialog ist weg. Keine Security-Einstellung wurde durch die Inspektion verändert.
- Installierter Build ist **noch preliminary**. `main.js` SHA-256:
  `8258d6b2482c85bc04b1596e9cf0993fd2df8f45571dc84c6235e77106c972d2`.
- Native Formulare erzeugten Project `Codex Finalization Synthetic 2026-09-07`:
  `project-01M1XSR8AEWA4T9KVEQDGYMED4`.
- Plan `Synthetic Ground Floor`:
  `plan-01M1XSVJ5CECKGQEVW6AFRZYXX`.
- Dateien: `Renovation/Codex Finalization Synthetic 2026-09-07/Codex Finalization Synthetic 2026-09-07.md` und `Plans/Synthetic Ground Floor.md` darunter. Beide bei Erstellung Schema 1/Revision 1.
- `References/editor-background-png-test.png` und `References/editor-background-pdf-test.pdf` sind unveränderte Repository-Fixtures. Nicht erneut anlegen oder gewöhnliche Nutzerdaten als Ersatz nehmen.

Vor Abnahme finalen gepushten Build sichern/kopieren/reloaden und Source-/Bundle-/Styles-/Manifest-Hashes protokollieren. Aktuellen Computer-Use-Skill lesen und nur unterstützte APIs nutzen; Security-/Privatsphäre-Abfragen nicht automatisch bestätigen oder per Dateien umgehen. UIA meldete teilweise den Dokumentroot, obwohl der Caret im Feld sichtbar war: Fokus zusätzlich visuell prüfen. Nach Aktionen konnten sofortige Snapshots dem asynchronen UI hinterherlaufen; Resultat nachlesen, Submit nicht blind wiederholen.

| ID | Konkreter Ablauf und verbleibender Anteil |
|---|---|
| H1 | Legacy-Noten zunächst bytegleich lesen; PNG/PDF-Referenz konfigurieren, Cancel/Save unterscheiden; Evidenz öffnen, im Testvault umbenennen/verschieben; stabile IDs/Links/Unterpfade/Thumbnail und tatsächlichen Cache-Update prüfen; Editor/Testvault wieder öffnen |
| H2 | Zusammenhängende native Tastaturreise, alle elf Add-Routen öffnen/abbrechen, mindestens Room/Object speichern/Undo; Draft im Split und bei Reflow behalten; besonders Overview→Materials→Escape sowie datierte Pins und Evidence→Work |
| H3 | Gefüllten Zustand in Light/Dark/vorhandenem Custom-Akzent sowie DE bei ca. 460 px/200 % prüfen; tatsächliche Editorgröße protokollieren; unter 400 px klare Ablehnung, keine neuen Themes installieren |
| H4 | Automatisch: finale Rohmessungen/Kameradelta/Marker/Cleanup. Physische Touch-/Stift-/Trackpad-Interaktion benötigt benanntes Gerät und Beobachter; SendInput ersetzt dies nicht |
| H5 | Benannter Screenreader: Name/Rolle/Zustand, Auswahl, Modal/Tab/ShiftTab/Escape, Validierung/M15/Retry tatsächlich beobachten/anhören. Axe/UIA sind nur Vorprüfung |
| H6 | Draft öffnen, synthetische Quelle in zweitem Leaf ändern, alten Apply-Konflikt und Peer-/Draft-Erhalt prüfen; Datei vorübergehend umbenennen und Missing/Retry/Wiederherstellung prüfen. Exakte Save→Read-back-Fault/Writecounts im Harness; vollständige entsprechende Live-Fault-Schnittstelle ist noch nicht nachgewiesen |

Pro beobachtetem Teil SHA/Umgebung/Aktion/Soll/Ist/Bild-/Dateibeleg festhalten. Kein pauschaler H-Pass und keine Crash-Atomicity-/Journalbehauptung.

## 10. Nächste Schritte in sinnvoller Reihenfolge

1. Diesen Snapshot gegen Git, Owner-Branches, Tasks und echte Prozesszustände abgleichen. Letzte Nutzeranweisung auf Pause/Weiter prüfen.
2. Gesichertes vollständiges 73b0-JSON/lcov auswerten; Volltest/Fallow und gezielter 49-Test-Nachlauf sind beendet.
3. E-Verifikation der Work-/Quote-Viewzustände abwarten und geprüften Commit integrieren; Root korrigiert EvidenceInspector-Komplexität.
4. Frische Countermaps nach echten erreichbaren Verhaltensgrenzen untersuchen. Root kann E einen begrenzten read-only Coverage-Audit geben. Keine privaten Handler, unmöglichen Serviceantworten oder Fake-Projektionen zum Füllen der Statistik.
5. Optionale sinnvolle Parallelisierung: Coverage-JSON/lcov aus bestehenden CI-Matrixjobs als diagnostische Artefakte sichern. E hat einen read-only Vorschlag: ein Upload-Step nach unverändertem `npm run check`, auch bei Fehlern aber nicht nach Cancel, eindeutiger OS/Node/SHA/Attempt-Name, nur die zwei Dateien. Noch **nicht implementiert**. Bestehende CI-/Manifest-Contracts prüfen; keine Gates ändern.
6. UI-WIPs auf dem gemeinsamen Datumsstand verifizieren, dann bestätigte visuelle Korrekturen gebündelt mit eindeutiger Dateizuständigkeit umsetzen/integrieren. Nur gepushte vereinbarte Checkpoints übernehmen.
7. Auf eingefrorenem gemeinsamen Source alle neun Journeys/18 Referenzen/Themes/DE/Reflow/Keyboard/Performance/Cleanup laufen lassen und wirklich visuell beurteilen.
8. Finale vollständige Gates/CI/Reviewthreads auf dem aktuellen Head abschließen; Host-H1–H6 wie oben durchführen. Menschlichen Anteil konkret vorbereiten.
9. Dokumentation/PR auf endgültigen Stand bringen. Erst bei vollständiger Beweislage Goal abschließen und um den konkreten Integration-/Merge-Schritt bitten.

## 11. Ressourcen, Befehle und Wiederherstellung ohne lokalen Chat

Lokaler Rechner: ca. **8 GB RAM**, Windows, Node **24.20.0**. Volle lokale Tests und Browser-/Performancecaptures serialisieren. Unabhängige read-only Reviews/Dokumentation können parallel laufen; GitHub testet vier Plattform-/Node-Kombinationen remote.

Nach Stop/Neustart zuerst lesend:

```powershell
git status --short --branch
git worktree list
git log -5 --oneline
git fetch origin --prune
gh pr view 91 --json state,isDraft,headRefOid,baseRefName,url
gh run list --branch codex/editor-plan-finalization --limit 5
```

Falls der Integrationsworktree auf einem neuen Rechner fehlt: vom **gepushten Integrationsbranch**, nicht blind von main neu anfangen. Vorhandenen lokalen Branch wiederverwenden; nur wenn er fehlt einen Tracking-Branch anlegen. Keine vorhandenen uncommittierten Dateien überschreiben.

```powershell
# Nur bei fehlendem Worktree und fehlendem lokalem Topic-Branch:
git worktree add --track -b codex/editor-plan-finalization .worktrees/editor-plan-finalization origin/codex/editor-plan-finalization
# Im so entstandenen Worktree, nur wenn Abhängigkeiten fehlen:
npm ci
# Erst wenn kein alter Volltest mehr lebt:
$env:VITEST_MAX_WORKERS='2'
npm.cmd run check
```

Browser verwendet mangels gepinntem Cache das tatsächlich installierte Edge:
`RP_CHROMIUM_EXECUTABLE=C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`,
`BROWSER=none`. Version zuletzt 152.0.4191.62. Dies ist dokumentierte Edge-Evidence, kein behaupteter gepinnter Chromium-/Obsidian-Lauf.

Temporärer Zusatzspeicher:
`C:/Users/lum/AppData/Local/Temp/rp-finalization-20260907-88b9ee3d`.

Wichtige Namen dort:
- `root-resumed-20260907.md` und historisches `PAUSED-FOR-RESTART.md`.
- `full-checkpoint-73b0c205/`: abgeschlossener vollständiger Check/Fallow und gesicherte JSON/lcov-Kopien.
- `coverage-c1091086-final.json` / `-lcov.info` / `-missing.json`: **ältere** vollständige Vergleichsmessung.
- `ci-73b0c205-linux22.log` / `linux24.log` / `linux26.log` / `windows22.log`.
- `checkpoint-native-final.log`, `metadata-final-types.log`, `metadata-final-lint.log`.
- `evidence-date-red.log`, `evidence-snapshot-red.log`, `evidence-metadata-joined-green.log`.
- `root-final-joined-check.ps1`, das native Exitcodes und frische Coverage getrennt behandelt.

Temporäre Dateien und alte Toolhandles sind **Hilfen, keine Voraussetzung** für die spätere Fortsetzung. Wenn sie fehlen: gepushte Branches und die im Repo enthaltenen Evidence-Dokumente verwenden; CI-Logs anhand Run/Job herunterladen oder die erforderliche Prüfung erneut auf dem exakten Source ausführen. Niemals fehlende Logs durch eine Pass-Behauptung ersetzen.

CI-Job-IDs von Run 34126554088: Linux22 `101756477712`, Linux26 `101756477788`, Linux24 `101756477838`, Windows22 `101756477981`, Audit `101756477531`. Neuere Runs haben andere IDs.

## 12. Dieses Dokument aktuell halten

Bei jedem wesentlichen gepushten Checkpoint aktualisieren:
1. Zeit, Branches/SHAs und sauberer bzw. WIP-Zustand.
2. Aktive Prozesse/Handles mit tatsächlicher letzter Beobachtung und Logort.
3. Neue Prüfresultate, Fehlerursachen und explizit ungetestete Änderungen.
4. Offene Arbeit mit Eigentümer, Dateigrenzen und nächster ausführbarer Aktion.
5. WIP-/Evidence-Sicherung im Repo; lokale Reständerungen ausdrücklich nennen.
6. CI/PR-/Host-Abnahmestatus ohne historische Werte als aktuell auszugeben.

Vor einem bekannten Nutzungsstopp oder einer Nutzerpause alle Änderungen sichern, Owner-Checkpoints erfassen und laufende Prozesse ausdrücklich koordinieren. Ein Goal nicht allein wegen Nutzungslimit/Arbeitsende als vollständig markieren.

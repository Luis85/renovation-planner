# Verbleibender Implementierungs- und Abnahmeplan

Stand: 2026-09-09. Dieser reine Dokumentations-PR ist die Spitze des Editor-Stacks und baut auf [PR #116](https://github.com/Luis85/renovation-planner/pull/116) auf. Er enthält keine Produktionsänderung. Die Fach-PRs bleiben Drafts; nichts wird automatisch gemergt. Dieser Plan ist für die Fortsetzung maßgeblich, ältere datierte Berichte behalten ausschließlich ihre damalige Aussage.

## Verifizierter Ausgangspunkt

Der unveränderte vollständige Befehl `npm run check` besteht auf `15e4b0d7d6a76f3681f5695dc0af938f5e418c85`: Build, beide Linter, 752 Testdateien mit 8.717 bestandenen Tests und 70 unveränderten Skips, Coverage und Fallow. Die Coverage beträgt 99,17 % Statements, 98,03 % Branches, 99,15 % Functions und 99,55 % Lines. Nur die Parallelität wurde über `VITEST_MAX_WORKERS=1` begrenzt; Grenzwerte, Timeouts, Assertions und Ausschlüsse wurden nicht für einen Pass abgeschwächt.

Der veröffentlichte Acceptance-Stand `dc1bb3515dde752a14bd109e18b7d00a0430f623` enthält identische Produktions-, Styles-, Test-, Script- und geprüfte Konfigurationsdateien. [Maschinenlesbarer Nachweis](evidence/full-check-15e4b0d7/receipt.json) und [vollständiges Log](evidence/full-check-15e4b0d7/check.log) dokumentieren die geprüfte Revision. Das ist keine Behauptung eines separaten vollständigen Passes für jeden Zwischen-PR. Deren neue CI-Ergebnisse sind noch auszuwerten.

Vorherige rote Läufe sind erhalten: `b10c3b24` bestand alle 8.624 Tests, scheiterte aber an Coverage. Ein späterer Lauf erfasste versehentlich generierte HTML-Coverage-Berichte unter `harness-shots`; diese Diagnoseordner wurden unverändert nach `C:/Users/lum/.codex/tmp/editor-boundary-reports-20260909` verschoben. Der hier belegte Pass stammt aus dem anschließenden vollständigen Neustart. Rechnerische Coverage-Vereinigungen sind ausschließlich Diagnose, keine Abnahme.

## Bereits implementiert, visuelle und native Gesamtabnahme noch offen

- Object → Opening → Wall → Room, Handles zuerst, Alt zum Durchschalten; präzise explizite Zahleneingaben und bestehende History-/Recovery-Grenzen.
- Drehung freier räumlicher Elemente sowie Wände mit gehosteten Öffnungen; kleine gebogene Pfeile beim Hover, feste Drehmitte, numerische Winkel und Vierteldrehungen.
- Linke-Maustaste-Rechteckauswahl, gespeicherte Gruppen, Gruppenbewegung/-drehung, explizites Umschließen eines Raums mit Wänden und automatischer Gruppierung, objektbezogenes Kontextmenü.
- Freie Raumkonturen, kreisförmige Kanten, tatsächliche Kantenmaße bei Bearbeitung/Drehung sowie Tür-/Fensterflügel, Anschlag, Öffnungsseite und Winkel; positionsgenaues Verschieben entlang eines Hosts.
- Pan-Werkzeug mit linker Maustaste, Space/Mitteltaste, Treppen und Richtungspfeile, Ctrl+Z/Ctrl+Y, gemeinsame Shift-Winkelregel, Canvas-first-Platzierung und stabiler Review-Reiter.
- Vereinfachtes Foto-Hinzufügen mit begrenzter Bildsuche; große Referenzvorschau mit Pan, Zoom und Fit sowie stabilen Bildkoordinaten der Messpunkte.

Gezielte Prüfungen fanden und korrigierten zusätzlich Tangenten-Rundung, verlorene Kurvenentwürfe nach fehlgeschlagener Aktualisierung, veraltete Singleton-Gruppen-Vorschauen und nicht sofort gesperrte alte Wand-Drehdialoge. Diese Korrekturen sind im verifizierten kumulativen Quellstand enthalten. Es wird daraus keine bereits abgeschlossene Live- oder Bildabnahme abgeleitet.

## Verbleibende Arbeit in Ausführungsreihenfolge

| Priorität / Paket | Konkreter nächster Schritt | Verantwortlich / Abhängigkeit | Fertig, wenn |
|---|---|---|---|
| P0 – veröffentlichter Stack | Alle PR-Basen, Diffs, CI-Läufe und Review-Threads prüfen. Fehlende reine Concern-Korrekturen auf dem jeweiligen Branch ergänzen und abhängige Branches kontrolliert aktualisieren. | Integration; vorhandene PRs #94–#96 respektieren, fremde PRs und Branches nicht übernehmen. | Jede Abhängigkeit eindeutig ist und veröffentlichte CI-/Review-Ergebnisse dem tatsächlichen Head zugeordnet sind. |
| P0 – unveränderte visuelle Matrix | Auf festgeschriebenem Production-/Harness-Stand `node scripts/editor-visual-final-check.mjs` unverändert ausführen. Alle neun Journeys und 18 Referenzvergleiche erzeugen und tatsächlich betrachten. | Integration + Bildschirm-Audit; keine parallelen schweren Prüfungen. | Alle neun Abläufe bestehen, alle 18 passenden Zustände geprüft und Bild-/Quell-Hashes dokumentiert sind. |
| P1 – konkrete Bild-Fidelity | Gegen M00–M17 insbesondere M00/M01/M07 Hierarchie und sichtbare Aktionen, M01 Architektur/Öffnungen/Treppe, M08–M14 Datensatz-/Foto-Kontext sowie M15–M17 Recovery, Enge und Review prüfen. Light, Dark, Akzent und Deutsch berücksichtigen. | Nach aktueller Matrix. | Jede Abweichung entweder behoben und neu verglichen oder als tatsächlich akzeptierte Grenze konkret belegt ist. Keine neuen Deferrals aus alten „Pending“-Notizen ableiten. |
| P1 – neue räumliche Interaktionen | Die sechs Zusatztreiber unten ausführen; sämtliche erzeugten Zustände visuell prüfen. | Verifizierter gemeinsamer Stand. | Hover/Drag/Klick-Drehung, Gruppen/Enclosure, Kanten/Kurven, Treppen/Pfeile, Öffnungsbewegung und Modals in allen Szenarien funktionieren und aktuelle Nachweise vorliegen. |
| P1 – Referenzskalierung und Foto-UX | Die tatsächlich gemalte Bildgröße, erreichbare Pan-/Zoom-/Fit-Bedienung und A/B-Koordinaten unter Zoom/Pan prüfen. In engen Ansichten mit der früher tatsächlich CSS-gerenderten Bildgröße vergleichen. Foto-Suche mit vielen Nicht-Bilddateien prüfen. | Zusatztreiber und aktuelle Bilder. | Bild und Bedienung ausreichend groß und ohne Überlauf erreichbar sind; Kameraaktionen keine Kalibrierung verändern; Bildsuche begrenzt und reaktionsfähig bleibt. |
| P1 – isolierte Obsidian-Abnahme | Nur den unten genannten Testvault verwenden; aktuellen Build sichern/installieren/reloaden, Source-/Bundle-/CSS-/Manifest-Hashes erfassen und H1–H6 soweit ausführbar beobachten. | Nach aktuellem Browserstand; frische Fensteridentität und Fokusprüfung. | Dateien, Cache/Reopen, native Icons, Interaktionen, Fokus, Themes/Zoom und sichere Fehlerpfade tatsächlich beobachtet und genau protokolliert sind. |
| P2 – Leistungs- und Aufräumprüfung | Die bestehenden großen Fixtures, Latenz-/RAF-Budgets und zwölf Schließen/Wiederöffnen-Zyklen gegen ihre unveränderten Budgets auswerten. | Vollständige visuelle Matrix. | Rohwerte, echte Kameraänderungen und Cleanup-Zähler geprüft sind; kein Pass allein aus Exit 0 abgeleitet wird. |
| P2 – Dokumentation / Abschluss | Completion-Matrix, implementation-status, RESUME, Nutzungshinweise und Taskstatus mit aktuellen Belegen abgleichen; alte Claims klar historisch halten. PR-Beschreibungen um tatsächliche finale Checks ergänzen. | Nach Abnahme bzw. dokumentierten externen Grenzen. | Jede M00–M17-Anforderung und jeder gemeinsame Interaktionsvertrag eine aktuelle Klassifikation, Revision, Evidenz und gegebenenfalls konkrete Restaktion besitzt. |

### Zusätzliche Prüfabläufe

`node scripts/editor-object-rotation-check.mjs`  
`node scripts/editor-room-edge-check.mjs`  
`node scripts/editor-group-check.mjs`  
`node scripts/editor-curves-check.mjs`  
`node scripts/editor-stairs-arrows-check.mjs`  
`node scripts/editor-modal-placement-check.mjs`

Diese Ergänzungen ersetzen keinen der ursprünglichen neun Abläufe oder 18 Vergleiche. Die bisherigen Versuche der aktuellen Release-Arbeit sind keine erfolgreiche finale Matrix: ein früherer Lauf stoppte bei M00-Layout, ein späterer Pilot bei Tastatur-Navigation. Deren Korrekturen liegen im Code; die vollständige aktuelle Wiederholung steht aus.

### Native und externe Grenzen

Nur `C:/Users/lum/.codex/tmp/renovation-planner-finalization-vault` ist freigegeben. Das normale Nutzervault bleibt unberührt. Obsidian wurde als Version 1.13.7 erkannt; ein früherer isolierter Icon-Check ist historisch belegt, der aktuelle Gesamtbuild ist noch nicht nativ abgenommen. Vor jeder Aktion Fenster und Fokus neu beobachten. Vor Eingriffen vorhandene synthetische Dateien/Hashes sichern; bestehende Nutzereingaben nicht durch Fixtures überschreiben.

H1: Legacy-Bytes, PNG/PDF, Kalibrierung, Dateien/Cache/Reopen. H2: alle nun 13 Add-Wege, Room/Object/Wall/Group-Interaktionen, Tastatur, Entwürfe, Split-Leaves und verknüpfte Fachabläufe. H3: echte Host-Themes, Deutsch, schmale Ansichten und Host-Zoom. H4: messbare Leistung und injizierte Maus-/Wheel-Eingaben. H6: beobachtbare Peer-Konflikte, fehlende/wiederhergestellte Dateien und Read-only Retry. [Ausführlicher Hostplan](release-native-acceptance.md) und [Hostkriterien](e-host-ci-audit.md) bleiben Referenzen; ihre alten Labels/Zählstände sind vor der Ausführung am aktuellen UI abzugleichen.

Physische Touch-/Pen-/Trackpad-Geräte und ein benannter Screenreader wurden nicht geprüft. Injizierte Eingaben, Axe oder UIA ersetzen das nicht. Ohne sichere native Fault-Seam bleibt außerdem der exakte Save→fehlgeschlagener Readback→mehrere Retries-Nachweis ein automatisierter Runtime-Test. Diese Punkte separat als unperformiert dokumentieren; keine pauschale H1–H6-Freigabe behaupten.

## Regeln für weitere Implementierung

1. Nur reproduzierte in-scope Defekte oder sichtbare Referenzabweichungen ändern; keine neue Editorarchitektur oder Hierarchiemigration beginnen.
2. Fix auf dem zuständigen Concern-Branch mit relevanten Tests und Dokumentation committen. Nach Review-Fixes erst pushen, dann mit SHA/Verifikation antworten und Threads auflösen.
3. Nach relevanten Code-/Harness-Änderungen den kumulativen Stand erneut vollständig prüfen. Vor finalen Bildern Production und Harness committen, alte Evidenz erhalten und Quelle/Hashes fixieren.
4. `npm run check`, alle Grenzwerte, Timeouts und die ursprüngliche visuelle Matrix unverändert lassen. Reine Diagnoseberichte außerhalb des gelinteten Arbeitsbaums halten.
5. Nichts mergen, keinen Release veröffentlichen, keine fremden Worktrees/Branches bereinigen und keine Abnahme allein aus historischem oder rechnerisch kombiniertem Material behaupten.

## PR-Stack und exakte Heads

Die Reihenfolge ist von unten nach oben. Dieser Plan-PR folgt auf #116 und ist die Spitze. Die Basis jedes Fach-PRs ist sein unmittelbarer Vorgänger; die drei bereits veröffentlichten Basis-PRs wurden nicht neu erstellt oder umgeschrieben.

| PR | Concern | Vergleichsbasis | Branch | Commit |
|---|---|---|---|---|
| [#94](https://github.com/Luis85/renovation-planner/pull/94) | Object-first selection and exact input | `main` | `codex/editor-release-selection` | `210b4c82266ade361c717c51dbd9be911b8b83b5` |
| [#95](https://github.com/Luis85/renovation-planner/pull/95) | Free spatial rotation | `codex/editor-release-selection` | `codex/editor-release-rotation` | `ba57db147f49c7a198af937e9b00f37437dc4670` |
| [#96](https://github.com/Luis85/renovation-planner/pull/96) | Reviewed wall rotation | `codex/editor-release-rotation` | `codex/editor-release-wall-rotation` | `037a8496a71b914e55b49e5e06cecb51564db77f` |
| [#100](https://github.com/Luis85/renovation-planner/pull/100) | Resolve editor icons through the native host catalogue | `codex/editor-release-wall-rotation` | `codex/editor-deliver-native-icons` | `fbe8a3935eb442653d5043c23855db25ab5071f5` |
| [#101](https://github.com/Luis85/renovation-planner/pull/101) | Align contextual detail panels with the editor designs | `codex/editor-deliver-native-icons` | `codex/editor-deliver-details` | `41163d31844822fbdbc605c4540b97cc20dd31a1` |
| [#102](https://github.com/Luis85/renovation-planner/pull/102) | Align the editor shell and perspective navigation | `codex/editor-deliver-details` | `codex/editor-deliver-shell` | `6fee2df45a84fecb35ec9535b64ca766cda1c55c` |
| [#103](https://github.com/Luis85/renovation-planner/pull/103) | Expose spatial rotation through hover arrows and Inspectors | `codex/editor-deliver-shell` | `codex/editor-deliver-rotation-ui` | `6d676e0cc9ef7ea4aad98038d646f8d618e99ce5` |
| [#104](https://github.com/Luis85/renovation-planner/pull/104) | Keep Room and wall creation visible and canvas-first | `codex/editor-deliver-rotation-ui` | `codex/editor-deliver-creation` | `2f3f9092e9c39edb273a46156b059ac947960a67` |
| [#105](https://github.com/Luis85/renovation-planner/pull/105) | Show every Room edge and expose free-form drawing | `codex/editor-deliver-creation` | `codex/editor-deliver-room-edges` | `93b9d2b49b7bc718248b4db7a63ab065f65028e9` |
| [#106](https://github.com/Luis85/renovation-planner/pull/106) | Add native opening swing and pointer placement | `codex/editor-deliver-room-edges` | `codex/editor-deliver-openings` | `a6278ea5ca7f30f697fa81a459b9e59d0c4c6eea` |
| [#107](https://github.com/Luis85/renovation-planner/pull/107) | Add marquee, Pan and editor context actions | `codex/editor-deliver-openings` | `codex/editor-deliver-input` | `6284aa4a8f5945c72fd94b4ba1309304e63e536f` |
| [#108](https://github.com/Luis85/renovation-planner/pull/108) | Add image search and import to Photo creation | `codex/editor-deliver-input` | `codex/editor-deliver-photos` | `6c6699ea9a9fda7e9cfe1a35c5f3b010b4607e3f` |
| [#109](https://github.com/Luis85/renovation-planner/pull/109) | Expand the reference calibration viewport | `codex/editor-deliver-photos` | `codex/editor-deliver-reference` | `8948c7a3ea4d014bb0fad8bca31138b7a424d6b7` |
| [#110](https://github.com/Luis85/renovation-planner/pull/110) | Persist groups with guarded geometry history | `codex/editor-deliver-reference` | `codex/editor-deliver-group-storage` | `858f3735dcd3954d6d39157a0fcd59629160db84` |
| [#111](https://github.com/Luis85/renovation-planner/pull/111) | Add editable curved Room and wall boundaries | `codex/editor-deliver-group-storage` | `codex/editor-deliver-curves` | `0a049e270de7b0dbdd4ba88e000866fe34f8634d` |
| [#112](https://github.com/Luis85/renovation-planner/pull/112) | Move hosted openings with a dedicated placement tool | `codex/editor-deliver-curves` | `codex/editor-deliver-opening-move` | `2b81464635aad433b3e08cbebe5cff9c990d6b5a` |
| [#113](https://github.com/Luis85/renovation-planner/pull/113) | Connect saved groups to selection and transforms | `codex/editor-deliver-opening-move` | `codex/editor-deliver-groups` | `f39d001ad41284825732aee34a34b91ebd2221e5` |
| [#114](https://github.com/Luis85/renovation-planner/pull/114) | Add editable Stairs and Direction arrows | `codex/editor-deliver-groups` | `codex/editor-deliver-stairs` | `8abc89569a22d0d61e76d46ac354b2f64e226f9f` |
| [#115](https://github.com/Luis85/renovation-planner/pull/115) | Consolidate editor components and correct preview retirement | `codex/editor-deliver-stairs` | `codex/editor-deliver-quality` | `2259f0a577f4673e2d834148036e03b3ca095792` |
| [#116](https://github.com/Luis85/renovation-planner/pull/116) | Add cumulative editor acceptance journeys and boundary tests | `codex/editor-deliver-quality` | `codex/editor-deliver-acceptance` | `dc1bb3515dde752a14bd109e18b7d00a0430f623` |

Die tatsächlichen Head-SHAs vor jedem weiteren Push erneut prüfen. Die hier genannte Tabelle ist der Veröffentlichungsstand dieses Plan-PRs; spätere Folgeschritte müssen sie oder einen eindeutig verlinkten Nachfolger aktualisieren.

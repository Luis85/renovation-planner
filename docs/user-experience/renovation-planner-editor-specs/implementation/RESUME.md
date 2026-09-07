# Wiederaufnahme der Editor-Finalisierung

Stand: **2026-09-07T15:45:19.483Z (UTC)**. Dieses Dokument ist der zentrale Wiedereinstieg bei App-Neustart, Kontext- oder Nutzungslimit. Git, Prozesse und Tasks beim Fortsetzen erneut prüfen. Der Nutzer hat die frühere Pause mit „fahre fort“/„weiter“ aufgehoben; alte Pause-Dateien sind historisch.

## Auftrag und Abschlussmaßstab

Das aktive, nicht abgeschlossene Goal ohne Tokenbudget lautet:

> Finalize the Renovation Planner editor implementation plan by coordinating the two existing implementation tasks, closing remaining in-scope M00–M17 requirements, integrating committed results, and delivering one verified, reviewable completion candidate. Do not mark complete while required implementation, verification, or live-host acceptance remains outstanding.

Zusammenhängender Ablauf: Project → Floor setup → Room/Area/Wall/Opening → Existing → Planned → Work → Materials → Costs → Evidence → Review → Safe recovery.

Ein bestandener Teiltest, viele grüne Tests, vorhandene Vergleichsbilder oder eine offene PR sind kein Abschluss. Alle anwendbaren M00–M17-Anforderungen, unveränderte Gates, echte visuelle und erforderliche Host-Evidence müssen nachgewiesen sein. Keine alten „not delivered“-Sätze als akzeptierte Scope-Entfernung verwenden.

Der Nutzer verlangt aktuelle Zwischenstände im Repo, sinnvolle Parallelisierung, dieses dauerhafte Dokument und regelmäßige kleine Commits/Pushes aller drei Tasks. Klar gekennzeichneter WIP ist zur Sicherung erlaubt; er ist kein Prüfpass. Vor längeren Prüfungen/Pausen eigene Evidence/Resume aktualisieren. Keine Automation dafür anlegen. Keine PR mergen, keinen Release veröffentlichen, keine Tasks schließen oder fremde Worktrees löschen. Keine Grenzen, Assertions, Timeouts oder Ausschlüsse für einen Pass abschwächen.

## Neue Coverage-Zuständigkeit — Nutzerauftrag

Der Nutzer hat die Coverage-Session gestartet und Root hat deren eigenen Receipt
bestätigt. **Aktiv: Erreiche Editor-Testcoverage**, Task-ID
01a07cca-4d4b-75b0-96fb-9417d3b86f51; Worktree
.worktrees/editor-coverage-finalization, Branch codex/editor-coverage-finalization,
Basis6f72eea1dbb87f0b1b2774c27fc9ce8becf536c4. [Vollständiger Auftrag](coverage-session-brief.md) und
[Steuerung](coverage-coordination.md) sind im Repo gesichert. Globale Coverage-Zuständigkeit ist übergeben; zunächst Lesen/Sourcevorbereitung.
UI hält den aktuellen schweren Slot; Root übergibt den nächsten nach terminalem
UI-Receipt ausdrücklich an Coverage. UI/E sind informiert; Root/Helfer beginnen keine neuen globalen
Coverage-Pakete. UI behält Regressionen eigener Fixes, E konkrete Hardening-Befunde.

Das letzte bereits begonnene Root-Paket ist abgeschlossen: Financial/Project-Library
8/8 Tests in43,84s, Types/whole Ox/scoped ESLint und statischer Fallow grün. Beide
neuen Testdateien sind im gepushten Nachfolger von45c58609 enthalten und dürfen
von der neuen Coverage-Session nicht dupliziert werden. Produktion bleibt seit
f306 unverändert. Root behält Integration, visuelle/Host-Abnahme und Gesamtgoal.

## M17-Vertrag: neue konkrete Korrektur

Marker-Auswahl muss laut M17 in Review bleiben und die Room-/Change-Zusammenfassung
zeigen. Nur Issue-Auswahl öffnet die konkrete Bearbeitung in Renovate; ADR0021
ändert diese Trennung nicht. Root-Code mit Marker→Dialog ist eine echte verbleibende
Lücke. UI übernimmt einen gemeinsamen Leaf-Review-Read-Model für Roomliste und
kompakte Marker, inklusive bestehender Planning-/Renovation-Findings und geteilter
Kontexte. Keine neuen Readiness-Regeln. Coverage besitzt die entsprechende neue
Testdatei und passt die Zielregressionen an; alte Ist-Tests gelten nicht als Abnahme.

Coverage hat npm ci und erste Prüfungen beendet; Slot freigegeben. Root übernimmt
aus227c23b3 nur die zwei grünen öffentlichen Commandfälle und deren gemessenen
Counter-Beleg (+2Arme/+1Statement); Marker-Tests bleiben bis zur UI-Abstimmung außen vor.

## Geprüfte Requirement-Bereinigung

Coverage83ca2f75 wurde selektiv übernommen: der private Requirement.with-Parameter
schließt requiredDate jetzt typseitig aus und übernimmt stets das bestehende Datum.
Alle sieben öffentlichen Aufrufer wurden geprüft; keiner aktualisierte es.
Öffentliche Erstellung, Hydrierung und Datumsvalidierung bleiben erhalten.
Owner16/16 plus Types/Lint/static; Root-Integration16/16 in6,04s. Exakte Messung:
vier Gesamtarme entfernt, davon drei vorher ungetroffene und ein getroffener
Erhaltungsarm; Statements unverändert. Kein neues Health-Ergebnis aus alten
Requirement-Countern ableiten; nächste vollständigeCI muss den neuen Source messen.
[Datums-Evidence](requirement-date-preservation.md).

## Gemeinsamer UI-Join zur Verifikation

Root übernimmt den committeten UI-Checkpoint **f576d13c** auf Root-Basis
1b554540. Git-Merge konfliktfrei; die UI hatte45/45nativeTests sowie aktuelle
Types/Oxlint/scopedESLint bestanden. Das ist ein **gemeinsamer WIP-Kandidat**,
kein abschließender Browser-/Host-Pass. Enthalten sind die gesamte UI-Folge,
Dimension-Caption-Messung, die gemeinsam projizierten Review-Roommarker und
Issue-Schaltflächen. Neue Marker bleiben in Review; Issue-Auswahl öffnet Quellen.

Coverage muss den gepushten Join nach dem Ende seiner laufenden Outline-Prüfung
in den eigenen Branch übernehmen und die gewünschten Markerregressionen daran
prüfen. Keine Sourceänderung während laufender Prüfungen. Root behält die
Integration; UI setzt den unveränderten echten Browserlauf fort und liefert neue
Korrekturen separat. Finale9Journeys/18Referenzen und HostH1–H6 bleiben offen.

## Verbindliche Quellen

Zuerst vorhandene AGENTS.md und bei .codex/ deren instructions.md/Workflow lesen. Beim letzten Audit waren sie im Repo nicht vorhanden; Nutzeranweisungen im Task gelten weiterhin. [CLAUDE.md](../../../../CLAUDE.md) und [SDD](../../../development/sdds/obsidian-renovation-planner-SDD.md) enthalten die Projektregeln. Aktuelle akzeptierte ADR-/SDD-Amendments gehen alten Snapshots vor.

- [Spezifikation und M00–M17-Bilder](../README.md), [Komponenten](../components/component-library.md)
- [Implementierungsplan](implementation-plan.md), [Status](implementation-status.md), [Completion-Matrix](completion-matrix.md), [Integrationsmap](integration-map.md)
- [Metadaten](evidence-metadata-completion.md), [Phasenauswahl](evidence-phase-selection.md), [Element-Plan-Fokus](element-plan-return-evidence.md)
- [Qualitätsfolge](quality-followup.md), [Composition-Grenzen](composition-boundaries-evidence.md), [Planning-Grenzen](planning-boundary-choices-evidence.md), [Project-Einstiege](project-entry-boundaries-evidence.md)
- [Host-Vorbereitung](live-host-preparation.md), [ausführbarer Host-/CI-Audit](e-host-ci-audit.md), [E-Wiederaufnahme](e-hardening-resume.md)

## Repository und Zuständigkeiten

Repo: https://github.com/Luis85/renovation-planner. [PR #91](https://github.com/Luis85/renovation-planner/pull/91) bleibt **OPEN/DRAFT**, Basis codex/materials-costs-evidence (#88, 3c1c737a).

| Bestandteil | Pfad / Branch / Task |
|---|---|
| Hauptcheckout | D:/Projects/renovation-planner, sauber auf main; zuletzt44234f77 |
| Root | .worktrees/editor-plan-finalization / codex/editor-plan-finalization; Task01a0786f-b624-7303-987f-b18b94db48d9 |
| UI, „Implement locked editor UI“ | .worktrees/editor-object-ui / codex/editor-object-ui; Task01a0783d-199d-7772-920b-90493cf0d8b4 |
| E, „Improve M15 recovery workflow“ | Task01a07838-4e54-7ac3-bc24-a8eef9185d6e; aktuelle Teilbranches siehe unten |

Root arbeitet bereits im isolierten Topic-Worktree. Keine Änderungen im main-Checkout. Nur die zwei bestehenden benutzereigenen Implementation-Tasks koordinieren; keine Ersatz-Tasks erzeugen. Der Nutzer hat zusätzliche begrenzte parallele Hilfsagenten erlaubt. Root-Helfer editor_coverage_audit arbeitet nur in ausdrücklich zugewiesenen neuen Test-/Evidence-Dateien.

Root-Produktion baute auf **f3067d82f413de6c67f9d4598608ce1e1a059cb3** auf; danach wurde ausschließlich die unten beschriebene private Requirement-Datumsaktualisierung bereinigt; neuester vollständig gemessener Testcheckpoint ist **45c58609596734f17570a22074d05f3e2f81fafb**. Nachfolger ergänzen Tests/Dokumentation; aktuellen HEAD/Pushstand mit Git prüfen. E9cc0fa6d (vier Project-Einstiegsfälle) ist als **3b12f432** übernommen. Die fünf neuen Planning-Fälle sind nativ/type/lint geprüft. Zwei weitere optionale Spatial-Removal-Fixtures bestehen nativ 2/2 (37,08 s); Types/Oxlint/scoped ESLint und statischer Fallow sind ebenfalls grün: tests/presentation/editor/spatialRemovalLegacy.test.ts und spatial-removal-legacy-evidence.md. Vor Annahmen deren aktuellen Git- und Prüfstatus lesen.

Aktuelle E-Branches:

- codex/downstream-view-states:46dd8661 +3d6ad34d; Root60629492/1201656e. Work-/Quote-Viewzustände geprüft. Auditnachfolger f7b093be separat.
- codex/downstream-late-boundaries:a7bdd443 +7e386d50. Drei native Quote-/Work-Lifecycle-Fälle; UI übernahm a7 als6dfdd827 und prüfte sie im22er-Nachlauf. Noch nicht separat im Root-Testbaum integriert, solange UI nicht übernommen ist.
- codex/project-entry-boundaries:9cc0fa6d; Root3b12f432. Vier native Fälle bestanden, Types/Lint ebenfalls.

UI-WIP-Anker: Galerie b0c68a03; M04 023af985; Record-/Kosten-Dichte5ca8cd65; Overview75a4c0ae; Add421c19b0; M07/M11 226e0be9; Capture-Kontexte cdbd30a3/0a007a62; M05/M15/M17 43cd1ac8 und Review-Fixes6d8a11d5/0e39c1a7. UI hat Root f306 als03057f63 gemergt. Danach M14/M17-Korrekturen efa8cd09,36d93f0b,28878a5d,36691b1c,bd9c7862,98434761 (Galerie mit größeren Bildern),49640b66 (Review-CTA-Kontrast). Neuere Owner-Commits prüfen. Diese UI-Produktion ist noch nicht in Root integriert.

Alte Stashes wurden bereits angewandt und nur als Sicherung behalten: **nicht erneut anwenden/pop**. Exakte alte Ancestry steht in integration-map.md. Abhängigkeiten: #74→#75→#76→#82→#83→#85→#86→#87→#88, dann gewählten #89/#90/#91-Weg genau einmal. Retargeting/Merge-Strategie entscheidet der Mensch.

## Belastbare aktuelle Verifikation

**Neueste vollständige CI45c58609, Run34140688682:** Alle vier Jobs bestehen651Dateien/8079Tests (69übersprungen). Statements99,04%, Functions99,26%, Lines99,51% erfüllen Vorgaben; Branches12400/12692=97,69% bleiben unter98%, bei diesem Nenner39Arme Rest. Neue elfFälle bringen13zusätzlicheBranchhits.

**Vorherige vollständige CI f3067d82, Run34136358483:** alle vier Linux 22/24/26-/Windows 22-Jobs bestehen648 Dateien/8068 Tests,69übersprungen. Audit grün. Statements17872/18049=99,01%, Functions5118/5160=99,18%, Lines13981/14053=99,48% erfüllen Vorgaben. Nur Branches12387/12692=97,59% scheitern an98%; bei diesem Nenner fehlen52 Arme. Nach Änderungen neu messen.

Alle vier Jobs haben vollständige JSON/LCOV-Artefakte hochgeladen. Linux24-Download tatsächlich geprüft. Artifactname enthält den getesteten PR-Merge **ad1d23d0853ce20a7cbb5c6dab06013849c08835**, nicht den Headnamen. Dessen Gitbaum **4a36652288df6c9c07fc868d1e93583211bf3502** ist exakt gleich dem Root f306-Baum.

**Frisches Fallow mit genau diesen unveränderten CI-Countern:** Exit0, null Health-Findings;742/742Dateipfade zugeordnet. Offiziellen --coverage-root-Schalter verwenden. Keine Zähler wurden umgeschrieben. Frühere CRAP-Schätzfehler entstanden durch verschobene/andere Quellpfade und sind damit geklärt. Separater aktueller statischer Scan: null Dead-Code-Issues, null Clone-Gruppen. [CI-/Health-Receipt](evidence/ci-f3067d82-quality.json).

Gezielte Nachfolger:

- Sechs Composition-Fälle plus Nachbarn:34/34PASS. Vergleich identischer95→f306-Countermaps belegt genau **7 neue Brancharme und6 Statements**, siehe [Counter-Gewinne](evidence/composition-counter-gains.json).
- Phase/Date/Work/Shared-Evidence/Planning:42/42PASS; nach Helper-Extraktion4/4 nochmalsPASS. Types/Ox/scoped ESLint PASS.
- Element-Rückkehr zu Plan: echte REDs bei1100/460 px (Fokus auf body), danach beide imUI22er-KorrekturlaufPASS. Auswahl/Kamera/Vault unverändert.
- Vier Project-EinstiegePASS. Fünf neue Planning-FällePASS nach Korrektur einer Testannahme:594.00 und594 sind exakt derselbe Money-Wert; jetzt Domainvergleich plus unveränderte Overrides und Cancel-Bytes. Types/whole Ox/scoped ESLint PASS. Beitrag dieser neun Fälle zur vollen Coverage noch ungemessen.

Verifikation gilt für genannten Source und Scope. Keine überlappenden Testzahlen addieren. Kein vollständiger neuer npm-run-check-Pass behauptet; Branchgrenze und finale gemeinsame UI/Host-Abnahme sind offen.

## Aktueller visueller Arbeitsstand

UI34er-Nachlauf und frühere309+gezielte22er-Prüfungen, Types/wholeLint sind dokumentiert. Originale Vier-Szenarien-Capture konnte funktional bestehen und trotzdem M14 visuell verfehlen: Auswahl löschte During und zeigte siebtes Before-Foto. Root f306 korrigiert das semantisch über den zurückbehaltenen Planning-Baseline; Galerie/Pin/Zeile behalten passende Phase, explizite außerhalb liegende Ziele bleiben erreichbar.

Aktuelle M14-Light-Bilder zeigen sechs größere4:3Thumbnails, aktivesDuring, passendePins/Datum/Work, sichtbareÜberschrift/Add/Metadaten. Doppelte Thumbnail-Metadaten bleiben zugänglich, volle ausgewählte Metadaten sichtbar; Missing-/Thumbnailfehler bleiben sichtbar. Keine Filter- oder Scrollposition nur für Bilder zurücksetzen.

M17-Light/Dark waren innerhalb der Grenzen. Custom legte zusätzlichen Platzbedarf offen. UI hat die kompakte Review-Transformation mit sichtbarem Workfortschritt und lesbaren Linklabels umgesetzt; normales M00 bleibt erhalten. Ein tatsächlicher Kontrastfehler der verschachtelten OpenRoom-CTA wurde mit der bereits vorhandenen semantischen Farbe korrigiert. **Der korrigierte Lauf auf bb77de0f hat inzwischen alle vier Szenarien bestanden**, einschließlich During/6 IDs, Sichtbarkeitsgrenzen und axe. Die Prüfung der acht Bilder fand noch eine Caption-/Maßlabel-Kollision in Custom bei 5% Zoom; UI5154504f liefert inzwischen drei echte predecessor-REDs und25/25GREEN für gemessene Dimension-/Inline-Form-Hindernisse, einschließlich sichtbarer Ausweichposition bei Clamping. Types/Lint/Browser folgen; kein finaler Pixelpass. Kein M14-Endpass trotz bestandenem Driver. Anschließend braucht M17 einen echten Zustand mit zwei nativ angelegten Decisions/Findings; das All-clear-Bild allein reicht nicht. Der ursprüngliche900 px-Notizablauf bleibt, zusätzlich1000 px-Matching-State.

Aktuelle lokale Bildorte: UI-Worktree/harness-shots/materials-costs-evidence/light-photos-gallery.png und light-review-design.png; weitere Szenarien dark, custom-accent, german-constrained. Zeit/Source/Manifest prüfen: Dateien können durch spätere Läufe ersetzt werden. UI archiviert akzeptierte und verworfene Stände mit Hashes in eigenen Evidence-Ordnern. Eigene Dokumente: editor-ui-resume.md, editor-ui-verification.md, editor-gallery-selection.md, editor-review-density.md auf dem UI-Branch.

Nach verifizierter UI-Integration muss der originale scripts/editor-visual-final-check.mjs auf eingefrorenem Source alle **neun** Journeys liefern:

1. materials-costs-evidence
2. renovation-workflow
3. reference-plan
4. editor-visual-resilience
5. editor-visual-overview
6. editor-object
7. planning-recovery
8. modal-busy-focus
9. editor-downstream

Danach18 Referenzen, editor-visual-fidelity-shots.mjs/editor-visual-comparisons.mjs, Hashes und capture-provenance.json prüfen und Bilder tatsächlich ansehen. Keine unterbrochenen Teilläufe zu einem Pass zusammensetzen. M03/M05-Captures existieren im Runner; frühere fehlende Bilder waren Folge eines Abbruchs. Echte Fixturegrößen12/18m² statt15,9/24,3m² und fehlende Building-Hierarchie sind dokumentierte Daten-/ADR-Unterschiede, keine Aufforderung zu gefälschten Werten.

## Produktinvarianten

- Evidence.date ist ein explizites ISO-Kalenderdatum; unbekannt bleibt fehlend. Niemals Heute/Dateizeit einsetzen.
- Nur tatsächlich datierte Plans benötigenSchema8. Reine7→8-Lesemigration schreibt nichts. OhneDatum gilt das höchste Schema der tatsächlich übrigen Fähigkeiten.
- sameRenovation berücksichtigtDatum. Date-only/Clear/Undo/Peer-CAS behalten Fakten.
- Ein useEvidencePins in PlanCanvas liest runtime.planning.baseline. RequiredProps liefern dieselbe datumsgeordnete/phasengefilterteListe an ZoneLayer und RenovationLayer/EvidencePins. ProjectStore-Geometrie liefert nur Weltpositionen. Keine zweite Metadatenquelle/Fallback-Injection.
- Bekannte Daten aufsteigend, gleiche stabil, undatierte danach. Pin-/Galerienummern bleiben zusammen.
- Separates workId erscheint zusätzlich, wenn verschieden von recordId. Identische Links einmal, unterschiedliche Beziehungen erhalten.
- ErfolgreicherWrite bleibt trotz gescheitertemRead-back erfolgreich; Retry/Source dürfen ihn nicht wiederholen. Späte disposedCallbacks dürfen nicht erneut wirken.
- Bestehende NativeCanvas-Brücke konvertiert nur arc-Argument6 von0/1 zuBoolean; echter Rasterizer/Pixeltests bleiben aktiv, keine Fehlerunterdrückung.

## Performance und Host H1–H6

Frühere deutsche Recovery-Messung aufE300a0929 vor dem Metadaten-Join:80 Rooms/240 Materialien/24 Assets/40 Fotos; nutzbar506,9 ms, Auswahl65,4 ms, Inspector75,4 ms; PanMedian16,6/p9517,1 ms, MaterialPan16,7/16,8 ms. Drei Close/Reopen-Zyklen: null getrackteStages/Listener/DOMImages/URLs. Finalen gemeinsamen Lauf wiederholen. Driver-Rohwerte gegen Budgets prüfen; nicht alle Zeit-/FPS-Grenzen sind automatisch assertiert. Kein physischer Geräte-/Heap-/Screenreader-Pass daraus.

Ausschließlich Testvault **C:/Users/lum/.codex/tmp/renovation-planner-finalization-vault** benutzen. Obsidian1.13.7, Testfenster zuletzt7014760; gewöhnliches Nutzervault-Fenster657340 unberührt. Der frühere Trustblocker ist beseitigt; keine Securityeinstellung wurde automatisch verändert. Installierter Build ist weiterhin preliminary, main.jsSHA256:
8258d6b2482c85bc04b1596e9cf0993fd2df8f45571dc84c6235e77106c972d2.

Native Fixtures existieren: Project „Codex Finalization Synthetic 2026-09-07“, project-01M1XSR8AEWA4T9KVEQDGYMED4; Plan „Synthetic Ground Floor“, plan-01M1XSVJ5CECKGQEVW6AFRZYXX. Beide bei ErstellungSchema1/Revision1. Unveränderte PNG/PDF-Fixtures in References/editor-background-png-test.png und editor-background-pdf-test.pdf. Nicht neu erzeugen/gewöhnliche Nutzerdaten verwenden.

Nach finaler UI-Integration einmal Source-/Bundle-/Styles-/Manifest-Hashes erfassen, finalen Build installieren/reloaden und konkrete Host-Evidence sammeln:

| ID | Noch erforderlicher Nachweis |
|---|---|
| H1 | Legacy-Noten read-only bytegleich; PNG/PDF konfigurierenCancel/Save; Evidence öffnen/umbenennen/verschieben, Cache-/Link-/Thumbnailupdate, Reopen. Zwei explizite Daten und eine bewusst undatierte Datei; Dateändern/Clear/Undo/Schema korrekt |
| H2 | Native Tastaturreise, alle11Add-Routen öffnen/abbrechen, Room/Object Save/Undo, Split/Reflow mitDraft, Overview→Materials→Escape, Element→Plan-Fokus, datiertePins/Work-Link; später finaleReview-Summary |
| H3 | Gefüllte Light/Dark/Custom/DE-Zustände, ca460 px und tatsächlicher Hostzoom200%; unter400 px klareAblehnung. Kein neuesTheme installieren |
| H4 | Finale Rohmessungen/Kameradelta/Marker/Cleanup. Physische Touch-/Stift-/Trackpad-Interaktion braucht benanntes Gerät/Beobachter |
| H5 | Benannter Screenreader/Version/Sprache: Auswahl-/Modal-/Validierungs-/M15-Ansagen, Fokusnachfolger, keine störendenWiederholungen tatsächlich beurteilen |
| H6 | EchterPeer-Konflikt und fehlendeDatei imTestvault; Draft/Peerbytes/Retryerhalt. Exakter Save→Readback-Fault/Writecounts bleiben Harness-Nachweis, solange keine sichere Host-Fault-Seam belegt ist |

Erst nach konkretem Host-Belegpaket bleiben zwei menschliche Fragen: welche tatsächlich verfügbaren Touch-/Stift-/Trackpad-Geräte beobachtet werden sollen, und welcher verfügbare Screenreader mit Beobachter genutzt wird. Keine pauschale Freigabefrage. UIA/axe/Bilder ersetzen diese Urteile nicht. Keine Crash-Journal-/Atomicitybehauptung.

Computer-Use-Skill vor Hostbedienung lesen; unterstützte API nutzen. UIA konnte Dokumentroot melden trotz sichtbaremCaret; Fokus auch visuell prüfen. Nach asynchronen Aktionen Ergebnis nachlesen, Submit nicht blind wiederholen. Security-/Privacy-Abfragen nicht automatisch bestätigen oder per Dateien umgehen.

## Nächste Schritte und Ressourcen

1. Aktuellen Git-/Task-/Prozesszustand gegen diesen Snapshot prüfen. Userpause/Weiter hat Vorrang.
2. Die elf neuen Grenzfälle sind gezielt/type/lint geprüft und im aktuellen Checkpoint gesichert. Nächste volle CI-Messung und tatsächliche Branch-Gewinne auswerten; Owner-Testbeiträge nicht doppelt übernehmen.
3. UI hat den nächsten schweren Slot für laufende begrenzte Capture-Korrekturen. Root hat seine letzten Tests/Types/Lint/Fallow beendet. Neue Handles immer tatsächlich nachlesen; alte IDs sind keine laufenden Prozesse.
4. Branch-Coverage über echte erreichbare Fälle schließen und neue vollständigeCI-Artefakte vergleichen. KeinTest gegen unmögliche Baselines/privateHandler. SinnloseInvariantenarme nicht künstlich ausführen.
5. UI-Ergebnis erst nach Source-/Evidence-Review integrieren; gemeinsamesFull9/18, vollständigeGates/CI/PR-Review und Hostpaket abschließen.
6. Erst bei nachgewiesener vollständiger Erfüllung Goal abschließen. PR bleibtDraft bis dahin; Mensch entscheidetIntegration/Merge.

Rechner ca. 8 GB RAM, Node 24.20.0. **Schwere lokale Tests, Builds, Browser-/Performancecaptures serialisieren**. Lesen, Sourcevorbereitung und Dokumentation parallel. Nie fremde Prozesse töten oder aus einem leerenLog/Timeout auf Prozessende schließen. wait/read-Taskresultate waren teilweiseleer trotz laufenderArbeit; konkreteOwnerhandles/Prozesspfad/Startzeit/Log verwenden.

Scratch: **C:/Users/lum/AppData/Local/Temp/rp-finalization-20260907-88b9ee3d**.

- full-checkpoint-73b0c205/: historischer Volltest/Fallow, originalesJSON/LCOV.
- ci-95e7510b-linux24/: frühere volle CI-Daten; ci-f3067d82-linux24/: neue volle Daten.
- ci-f3067d82-health.json: frischesHealth mitOriginal-CI-Daten und offiziellemPfadprefix.
- planning-project-boundaries-native.log, planning-boundaries-green.log, planning-project-boundaries-types.log/static.json.
- evidence-phase-selection-red/green/final.log; phase-composition-*; frühereNodehandles sind terminal.

Browser: RP_CHROMIUM_EXECUTABLE=C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe, BROWSER=none. Edge-Evidence ist kein behaupteter gepinnterChromium- oder Obsidian-Lauf.

Nach Neustart zuerst lesend: git status --short --branch; git worktree list; git log -5 --oneline; gh pr view 91; gh run list --branch codex/editor-plan-finalization. Falls Checkout auf neuemRechner fehlt, vom gepushten Topic-Branch fortsetzen, nicht blind main. Vorhandene Änderungen nicht überschreiben. npm ci nur bei fehlenden Abhängigkeiten und freiemschwerenSlot.

Health mit roherLinux-CI-Datei: fallow health --coverage <coverage-final.json> --coverage-root /home/runner/work/renovation-planner/renovation-planner. Erst Gitbaum-/Sourcegleichheit prüfen. OriginalJSON/LCOV vor scopedRuns erhalten. Artefakte laufen nach14 Tagen ab; fallsLogsfehlen, Evidence/Commits verwenden und erforderlichePrüfung erneut durchführen, niemalsfehlendenBeleg durchPassbehauptung ersetzen.

Dieses Dokument bei jedem wesentlichenCheckpoint ersetzen/aktualisieren: aktuellerSource, echteErgebnisse, Ownergrenzen, ungesicherteWIPs, nächsteAktion. HistorischeDetails bleiben in verlinktenEvidence-Dateien undGit. Ein Goal nicht wegen Nutzungslimit oder Arbeitsende als fertig markieren.

# Wiederaufnahme der Editor-Finalisierung

## Aktueller Auftrag — 2026-09-08

Neuere Nutzerentscheidung: alle freien räumlichen Elemente einzeln drehen; Wände zusammen mit
ihren gehosteten Öffnungen. Ein größerer, klarerer Drehgriff und die numerischen Inspector-Routen
gehören dazu. Nach Prüfung von PR #93 auf `56b4b906` bestätigte der Nutzer ausdrücklich weiterhin
Object → Opening → Wall → Room. #93 bleibt fremdverwaltet und unverändert. Der neue Release-Plan
enthält den aktuellen 172-Test-Checkpoint, weitere Wall-/Handle-Branches und die noch offenen
gemeinsamen Gate-/Bild-/Hostprüfungen; alte Prozess-/Ownerangaben unten sind historisch.

Der neue [Release-Ausführungsplan](release-2026-09-08.md) ist der aktuelle Einstieg. Main/origin/main sind nach Fetch sauber auf `7d4bc381`. Der frühere Stack ist gemergt; PR #93 ist OPEN, docs-only auf `c1362732` und gehört weiterhin dem anderen Rechner. Die neuen Worktrees heißen `editor-release-selection`, `editor-release-rotation`, `editor-release-fidelity` und `editor-release-verification`; alle Branches tragen das Präfix `codex/`. Der Parent besitzt Integration, gemeinsame Dokumentation und serielle Gesamt-/Capture-/Hostprüfung. Die nachfolgenden früheren Owner, Prozesse und offenen PR-Zustände sind historische Snapshots, keine aktuelle Arbeitsanweisung. Die vollständigen M00–M17 plus Object-Rotation bleiben im Scope. Kein Merge ist autorisiert.

Stand: 2026-09-07T21:54:19.460Z (UTC). Dieses Dokument ist der zentrale Wiedereinstieg bei App-Neustart, Kontext- oder Nutzungslimit. Git und laufende Tasks beim Fortsetzen erneut prüfen. Die frühere Nutzerpause ist aufgehoben.

## Auftrag und Abschlussmaßstab

Aktives Goal ohne Tokenbudget: Finalize the Renovation Planner editor implementation plan by coordinating the existing implementation tasks, closing remaining in-scope M00–M17 requirements, integrating committed results, and delivering one verified, reviewable completion candidate. Do not mark complete while required implementation, verification, or live-host acceptance remains outstanding.

Der gesamte Ablauf Project → Floor → Room/Area/Wall/Opening → Existing → Planned → Work → Materials → Costs → Evidence → Review → Safe recovery bleibt im Scope. Teiltests, erzeugte Bilder oder eine offene PR sind kein Abschluss. Unveränderte Qualitätsgrenzen, geprüfte visuelle Ergebnisse und anwendbare Host-Nachweise sind erforderlich.

Nutzerauftrag: regelmäßig Zwischenstände committen/pushen, dieses Dokument aktuell halten und sinnvolle Parallelisierung koordinieren. Klar gekennzeichneter WIP darf gesichert werden. Keine PR mergen, Releases veröffentlichen, Tasks schließen oder fremde Worktrees löschen. Keine Assertions, Grenzen, Timeouts oder Ausschlüsse für einen Pass abschwächen. Alte Stashes wurden bereits angewandt: nicht erneut anwenden oder poppen.

## Aktueller Freeze für den vollständigen Abschlusslauf

Root integriert acac7270ea252f04590dc2bd176c0ce1788f2b72 (Produktion1fee1286): grammatisch neutrale EN/DE-Counttexte, sinnvolle sichtbare Auswahlhilfe nur bei Rooms und idle Select, sowie verifizierter M13Downstream-Pilot. Native21Copy- und6Guide-Prüfungen, Types/Ox/scopedESLint bestanden. M13lief in allen4Szenarien mit unveränderten ursprünglichen Schedule/Quote-Abläufen; Root prüfte66archivierte Dateien und das Dark-Kostenbild. Keine weitere UI-Produktänderung geplant.

Nach diesem Commit/Push erhält UI sofort den Source-SHA für den vollständigen9/18-Lauf mit den abgesicherten Frische-/Archivregeln. Source/HEAD währenddessen einfrieren. Root hat keinen Heavyprozess; Coverage bleibt bei read-only Priorisierung. Aktuelle Linux24-Vollmessung auf dem Vorgängera441:8128TestsPASS,69Skip, B12559/12824=97,93%,9ArmeRest. Neue gemeinsam eingefrorene Produktion benötigt ihre eigene Gesamtmessung und den finalen Host-Build.

## Neuester Integrationscheckpoint

UI9f7e882d is integrated as Root6569a9e7: M01/M04, verified overview images and hardened no-deletion capture provenance. This checkpoint includes Coverage256a9384 with five verified Quote/catalogue/geometry cases. Root checked98UI artifact hashes and6branch/2statement gains against identical original07source/maps. [Joined evidence](joined-overview-snapshot-evidence.md). This production is newer than the measured07baseline below.

UI owns the slot for bounded count-copy/idle-guidance checks and M13pilot. Coverage91653/42286/77614/69697 are terminal;256a9384 is pushed and verified. Root has no heavy process. Then freeze the combined source for final9/18andCI/Health. Final nativeH1–H6remain open.

## Aktueller Gitstand

- Hauptcheckout D:/Projects/renovation-planner bleibt sauber auf main (zuletzt44234f77).
- Root arbeitet ausschließlich in .worktrees/editor-plan-finalization, Branch codex/editor-plan-finalization. Aktuelle Produktion enthält den geprüften Pan-Fix aus **dba43e5fc1d3301b5884e6c386e4722d38f831e4**, integriert mit seinem Evidence-Checkpoint **eefc7c151045d58b6503daeef99fb196cd699fbc**. Das vollständige430-Bildarchivd58 und Root-Diagnosefb928f8e bleiben enthalten. HEAD/origin mit Git prüfen.
- [PR #91](https://github.com/Luis85/renovation-planner/pull/91) bleibt OPEN/DRAFT, Basis codex/materials-costs-evidence (#88,3c1c737a). Der Mensch entscheidet Merge/Integrationsweg.
- Root57144c81 integriert UI f576d13c; Root9cb87b1b integriert dessen verifizierte Folge bis376fe371. Galerie, Caption-Hindernisse, Review-Marker, Warntext- und Fokuskorrekturen sind enthalten. Nicht nochmals integrieren.
- Root465ffe42 enthält die elf geprüften Review/Outline/Command-Fälle aus Coverage44860131. Root4f070aa4 übernimmt selektiv Coverage1debce64: Requirement-Origin-Mapper, schmaler Review-Tap und Kalibrierungsgrenze. Root prüfte die zwei geänderten Testdateien auf dem gemeinsamen UI-Stand:10/10 PASS in33,14s.43041936 schützt ausschließlich die archivierten Logbytes vor Zeilenumbruchkonvertierung.

## Owners und lokaler Prüfslot

| Owner | Task / Branch | Auftrag |
|---|---|---|
| Root | 01a0786f-b624-7303-987f-b18b94db48d9 / codex/editor-plan-finalization | Integration, Gesamtstatus, finale CI-/Bild-/Host-Abnahme |
| Implement locked editor UI | 01a0783d-199d-7772-920b-90493cf0d8b4 / codex/editor-object-ui | Pan-Performance, M01/M04-Darstellung, passende Zusatzaufnahmen und eigene Regressionen |
| Erreiche Editor-Testcoverage | 01a07cca-4d4b-75b0-96fb-9417d3b86f51 / codex/editor-coverage-finalization, PR#92 | Globale Coverage; genau fünf weitere öffentliche Grenzfälle sind source-only freigegeben |
| Improve M15 recovery workflow | 01a07838-4e54-7ac3-bc24-a8eef9185d6e | Idle; native Host-Labels auf430 lesend geprüft, keine Host-Aktion ausgeführt |

**UI besitzt den lokalen Prüfslot.** M01/M04-Produktion150e723e ist nativ/type/lint geprüft und durch UI9f7e882d in Root6569a9e7 integriert. Capture-Helfer wurden nach echten Selektorfehlern korrigiert.89997 und41858 endeten mit Capture-Fehlern; keine Erfolgsaussage daraus. UI47097 ist terminal0; Root63863-Health ebenfalls, Slot ausdrücklich an UI zurückgegeben. Aktuellen nächsten Capture-Handle beim Owner prüfen. Coverage256a9384 ist verifiziert und mit diesem Checkpoint übernommen. Root hat keinen Heavyprozess.

Rechner ca.8GB RAM. Installs, Builds, Tests, Coverage, Analyzer und Browser-/Performancecaptures lokal serialisieren. Lesen, Source und Dokumentation können parallel laufen. Vor einer ruhigen Performance-Messung auch größere Archivierung/Bilddarstellung abstimmen. Keine fremden Prozessausgaben konsumieren oder Prozesse stoppen. Stille und Beobachtungstimeouts sind kein Prozessende; tatsächlichen Handle oder terminalen Owner-Beleg prüfen.

Die dedizierte Coverage-Task besitzt globale Testpakete. Root/E/Helfer beginnen keine weiteren globalen Coverage-Pakete. UI behält Regressionen eigener Fixes. [Coverage-Auftrag](coverage-session-brief.md), [Steuerung](coverage-coordination.md).

## Neueste vollständige CI und Health auf07bc094a

[Run34160382401](https://github.com/Luis85/renovation-planner/actions/runs/34160382401) ist vollständig beendet. Jede Linux22/24/26- und Windows22-Leg besteht **663Dateien/8121Tests,69Skip,0Testfehler**. Build/Lint bestanden; AuditPASS. Einziger CI-Fehler: unveränderte Branchgrenze.

S18076/18237, F5182/5219, L14110/14174, B**12543/12813=97,89%**. Es fehlen **14Brancharme** bei diesem Nenner. Die fünf Repository-Lifecycle-Fälle sind jetzt in der vollen Messung enthalten und liefern exakt die erwarteten fünf zusätzlichen Hits. Neue UI-Produktion später vollständig neu messen.

Mergea7f5ff7ea652773d1f14fb4ee0f2869a19156f6c und Root07 haben denselben Baum009ffd1622554dc0119a595d7b2f8ffdb2a46f6c. Linux24 Job101860791807, Artefakt10032537778. OriginalJSON/LCOV im Root-Scratch ci-07bc094a-linux24/.

**Frischer vollständiger Health auf exakt diesem Source und OriginalJSON: Exit0,0Findings,748/748Dateien gemappt** (Root63863 terminal). Offizieller coverage-root, keine Counterumschreibung. [Gemeinsamer CI-/Health-Receipt](evidence/ci-07bc094a-quality.json). Der frühere9cb-Beleg ist damit nicht mehr der aktuelle Health-Stand.

Coverage0c3a3315 ist als Root07 übernommen: repositoryLifecycleBoundaries.test.ts, Begleitdokument und Counter-Receipt. Native5/5,Types/Ox/scopedESLint/static bestanden; scoped5/5 und fünf exakt zugeordnete Hits zusätzlich von Root gegen545 bestätigt. Nicht duplizieren. [Paket](repository-lifecycle-boundaries.md), [Counter-Receipt](evidence/repository-lifecycle-counter-gains.json).

Coverage256a9384 ist jetzt verifiziert und mit diesem Checkpoint übernommen: catalogueSnapshotBoundaries.test.ts und geometryMaterialGuardBoundaries.test.ts. Native5/5,Types/Ox/scopedESLint/static sowie scoped5/5 bestanden. Exakt6neueBranch-/2Statement-Hits wurden von Root auf identischen07Sourceblobs und Deskriptoren bestätigt. Keine Produktion durch das Coverage-Paket; neue Gesamtmessung nach UI-Integration erforderlich. Diese Fälle nicht duplizieren.

## Vollständiger Browserlauf und konkrete Reste

Der originale scripts/editor-visual-final-check.mjs lief auf eingefrorenem430 vom19:35:04 bis19:44:25UTC vollständig durch: **9Journeys×4Szenarien**,16 zusätzliche Light/Dark-States und alle18M00–M17-Vergleiche. Session29535 terminal0. Archivd58 ist integriert; Root prüfte **340PNG-Hashes** gegen capture-provenance.json. [Lauf und Bildreview](editor-final-visual-run.md).

UI hat alle18Vergleiche angesehen. Root bestätigt M01/M04 anhand der Bilder. Noch offen:

- **M01:** prominente Change/Cost-Hierarchie, Room-Änderungshinweise und die Einladung zur Auswahl prüfen/ergänzen. Bestehende Aggregate und Planning-Reconciliation einschließlich partial/unavailable/stale erhalten. FloatingPrimaryActions bleibt der eine Add-Einstieg.
- **M04:** geschlossener numerischer Wallentwurf ist nach Cursorclear zu schwer von Referenzwänden zu unterscheiden.
- **M00/M07/M13:** zusätzlich korrekt zugeordnete1000px-/Top-Ansichten. Bei M07 untersuchen, ob die nach Navigation erhaltene untere Scrollposition ein Verhaltensfehler ist.
- **M16:** zusätzlich geschlossene460px-Panelansicht. Ursprüngliche900px-/gescrollte Aufnahmen und Assertions erhalten; keine Bilder durch stilles Scrollen/Fit passend machen.

Der vollständige Funktions-/Capture-Pass ersetzt keine visuelle oder Host-Abnahme. Neue Produktkorrekturen brauchen passende erneute gemeinsame Verifikation;430 bleibt als präziser Vorgängerbeleg erhalten. Fixturegrößen12/18m² statt15,9/24,3m² und fehlende Building-Hierarchie sind akzeptierte Daten-/ADR-Unterschiede, keine Aufforderung zu erfundenen Werten.

## Verifizierte Pan-Performancekorrektur

Der vollständige430-Vorgängerlauf hatte ordinary Panmedian33,1–33,3ms und p9550–83,2ms. Ein ruhiger Nachlauf reproduzierte Panmedian33ms in3/4Szenarien bei rund16,7ms Idle; Light-Selection107ms lag über100ms. Originaldaten bleiben in [Root-Diagnose](pan-performance-diagnosis.md) erhalten.

UIdba43e5f stabilisiert ausschließlich ZoneShape: primitive Captionverschiebung, sechs gecachte echte Konva-Configs und Memoisierung des vorhandenen permanenten Groups über diese Configs. Modell, Geometrie, Zoom, Theme, Selection und tatsächliche Text-/Captionänderungen bleiben Abhängigkeiten. Keine Knoten, Fonts, Statuszeilen, Pins, Fixturebestandteile oder Providerverträge entfernt.

Echter Vorgänger-RED32581 gegen430; danach24/24 Caption/Scene/Order/Observer/Fallback-Tests und47/47 Resize/Outline/Inline/Lifecycle-Nachbarn. Types, whole Oxlint und scoped ESLint bestanden. Beide abschließenden Browserprozesse sind terminal0.

**Unprofilierter identischer Nachlauf67702 aufdba:** alle vier Szenarien Pan-/MaterialPanmedian16,6–16,7ms, p95≤17,1ms; usable467,4–508,6ms, selection52,6–59,8ms, Inspector43,7–53,1ms.80Rooms/240Materials/24Assets/40Photos(1600×1200) unverändert; zwölf Close/Reopen-Zyklen trackedResources0. Reale Kameradeltas, drei Materialmarker und PageError-Assertions bleiben Bestandteil desselben Drivers.

Root verglich beide verwendeten Driver exakt mit den Originalen: nur Worktree-/Outputpfade und Profil-Source-Metadaten unterscheiden sich. CPU-Diagnose73590 unterstützt die Ursache: Vue-Konva M/g-Selbstzeit344/476ms→27/43ms, kein Abnahmeurteil aus Profilzeiten. Root prüfte20Dateihashes in den beiden UI-Manifesten. [Fix und Evidence](editor-canvas-pan-stability.md).

Der Root-Integrationsindex stimmt in src/styles/scripts/tests/package samt Lockdatei vollständig mit verifiziertemUIeef überein; deshalb kein identischer zusätzlicher Native-Nachlauf. Neue volle CI/Health und die noch ausstehenden M01/M04-/Host-Schritte bleiben erforderlich. Dieser repräsentative Browsernachweis ersetzt keine physische Geräte- oder native Host-Abnahme.

## Weitere verifizierte Verträge

M17: Ein Marker wählt/framed den Room und bleibt in Review; Nummer und Summary stimmen mit der Liste überein. Nur das explizite Issue öffnet seine Quelle in Renovate. Der shared useReviewPresentation ist einmal leaf-owned und verwendet vorhandene Findings. Existing/Planned/Work behalten ihre bisherigen Markeraktionen. Native Regressionen und reale Maus-/Issue-/Cancel-/Back-Abläufe sind im vollständigen430-Lauf enthalten.

Requirement.with erhält bestehende requiredDate konstruktiv; sieben Aufrufer geprüft, öffentliche Erstellung/Hydrierung/Validierung unverändert. [Datumsbeleg](requirement-date-preservation.md). RequirementMapper nutzt nach erfolgreicher Schema-Prüfung die einzig gültige zone-Origin; V1/V2/V3 behalten literalzone und Domain-Rejection. Owner56/56 plus Types/Lint/static, Root10/10 gemeinsamer Nachlauf. [Origin-Beleg](requirement-origin-mapping.md).

Vorgänger-Reviewaudit: PR74/75/76/82/83/85/86/87 vollständig paginiert,27Threads davon25offen; keine neuen Findings bei unveränderten Heads. PR88 sechs offene Threads, in Continuations/Root behoben, ältere Branches selbst unverändert und deshalb nicht fälschlich aufgelöst. PR91/92 hatten beim Sweep19:18:31UTC jeweils0Reviews/Threads/Kommentare. [Reviewaudit](review-audit.md); vor Abschluss erneut prüfen.

## Aktuelle Capture-Folgen und sichere Provenienz

M00 brauchte den tatsächlichen Renovation-Inspector-Selektor; M01 den eindeutigen primären Titel. M07 zeigte, dass Control+Home auf einem Button den Inspector nicht scrollt; die Zusatzaufnahme verwendet nun dokumentiertes natives Wheel-Scrolling im Inspector und unveränderte Sichtbarkeitsgrenzen. M13 adressiert das fachlich richtige direkte Gesamttotal statt eines mehrdeutigen Selektors. M16 ergänzt880pxL/D als Annäherung an den Referenz-Leaf und weiterhin ein echtes geschlossenes460pxDE-Canvas. Canonical selection im read-only Harness-Probe verhindert Attribution über bloß sichtbare DOM-Zeilen.

Automatische Approval-Prüfung lehnte eine PowerShell-Löschung generierter Overview-Ausgaben ab. Sie wurde nicht ausgeführt und wird nicht über Node oder einen anderen Weg nachgeholt. Der neue Runner erhält vorhandene Dateien und verwendet nur protokollierte erfolgreiche screenshot-Aufrufe, Quelle-Zeit/Hash-Prüfung VOR Kopieren, neun aktuelle Reports/Manifeste,16Static-States und18zugeordnete Eingaben/36Compositions. Keine PNG-Glob-Inventarisierung. Positive Run-Grenze für nachgelagerte Stufen sowie sauberer vorheriger Evidence-Stand und priorEvidenceCommit werden ergänzt; ältere gleichnamige Dateien sind im archivierten Commit erhalten, nicht unverändert am selben Arbeitsbaum-Pfad. Den endgültigen gepushten Helper-Stand vor Integration prüfen.

[Native Host-Prüfanleitung](native-host-walkthrough.md) ist vorbereitet, **noch nicht ausgeführt**. Labels wurden auf430 gelesen; verwendet werden muss der finale gemeinsame Build. Legacy/Reference-Prüfung auf dem noch leeren Plan geht der Room-Erstellung voraus. Die Anleitung ersetzt H1–H6 nicht.

## Verbindliche Quellen

AGENTS.md/.codex waren zuletzt weder in Hauptcheckout noch Rootworktree vorhanden. Nutzeranweisungen gelten. [CLAUDE.md](../../../../CLAUDE.md), [SDD](../../../development/sdds/obsidian-renovation-planner-SDD.md) und aktuelle ADRs enthalten die Projektregeln.

[Specs](../README.md), [Plan](implementation-plan.md), [Status](implementation-status.md), [Completion-Matrix](completion-matrix.md), [Integration](integration-map.md), [Hostvorbereitung](live-host-preparation.md), [Host-/CI-Audit](e-host-ci-audit.md). Historische Einzelbelege bleiben in diesen Docs und Git; für nächste Aktionen gelten dieser Snapshot und neuere tatsächliche Belege.

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

## Nächste Aktionen und technische Wiederaufnahme

1. Gitstatus/HEAD/origin, Taskstatus und tatsächlichen Slotowner prüfen. UI besitzt den Prüfslot für M01/M04 und Zusatzaufnahmen. Pan-Fix und fünf Repository-Grenzfälle sind geprüft und integriert. Keine alten Handles neu starten.
2. Verifizierte UI-Folge prüfen und integrieren. Coverage genau fünf vorbereitete öffentliche Grenzfälle im nächsten expliziten Slot prüfen lassen; danach passende volle CI/Health und verbleibende Arme neu bewerten.
3. Nach den Produktkorrekturen die erforderliche gemeinsame visuelle/Performance-Verifikation abschließen.340Bilder auf430 bleiben Vorgängerbeleg; kein pauschaler neuer Pass daraus.
4. Finalen Build mit Source-/Bundle-/Styles-/Manifest-Hashes ausschließlich im benannten Testvault installieren/reloaden. H1–H6 ausführen. Originale synthetische Dateien und Installed-Hashes sind im Scratch unter host-before-final-build/ gesichert; das native Testvault-Fenster war zugänglich, weiterhin auf vorläufigem Build.
5. E hat tatsächliche englische Labels auf430 gelesen: Open renovation project; New room/Name/Width (m)/Depth (m)/Create room; What's here/What will change/What needs doing; Review before applying/Apply. Evidence hat direkt Apply. Das ist Vorbereitung, keine ausgeführte Hostreise.
6. Erst nach konkretem Hostpaket die erforderlichen Angaben zu physischen Geräten und Screenreader/Beobachter erfragen. Goal erst bei tatsächlicher vollständiger Erfüllung abschließen.

Root-Scratch: C:/Users/lum/AppData/Local/Temp/rp-finalization-20260907-88b9ee3d. Originale CI-Daten95e/f306/45c/571/9cb/430 erhalten. Fallow mit Originaldaten: fallow health --coverage <original coverage-final.json> --coverage-root /home/runner/work/renovation-planner/renovation-planner. Quellstand und Mapping prüfen; Counter nicht umschreiben.

Browser ausdrücklich Edge152.0.4191.62: RP_CHROMIUM_EXECUTABLE=C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe, BROWSER=none. Kein behaupteter gepinnterChromium-/Obsidian-Pass. CI-Artefakte haben14TageRetention; fehlende Nachweise erneut erheben.

Nach Neustart lesend: git status --short --branch; git worktree list; git log -5 --oneline; gh pr view 91; gh run list --branch codex/editor-plan-finalization. Bei neuem Rechner vom gepushten Topicbranch fortsetzen und vorhandene Änderungen erhalten. npm ci nur bei fehlenden Abhängigkeiten und freiem Slot. Dieses Dokument bei wesentlichen Checkpoints aktualisieren; Goal bleibt aktiv.

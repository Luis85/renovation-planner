# Wiederaufnahme der Editor-Finalisierung

Stand: 2026-09-07T19:11:50.314Z (UTC). Zentraler Wiedereinstieg bei App-Neustart, Kontext- oder Nutzungslimit. Git, laufende Prozesse und Owner beim Fortsetzen erneut prüfen. Der Nutzer hat die frühere Pause aufgehoben.

## Auftrag und Abschlussmaßstab

Aktives Goal ohne Tokenbudget: Finalize the Renovation Planner editor implementation plan by coordinating the existing implementation tasks, closing remaining in-scope M00–M17 requirements, integrating committed results, and delivering one verified, reviewable completion candidate. Do not mark complete while required implementation, verification, or live-host acceptance remains outstanding.

Der gesamte Ablauf Project → Floor → Room/Area/Wall/Opening → Existing → Planned → Work → Materials → Costs → Evidence → Review → Safe recovery bleibt im Scope. Einzelne Teiltests oder eine offene PR sind kein Abschluss. Unveränderte Qualitätsgrenzen, finale visuelle Evidence und anwendbare Host-Nachweise sind erforderlich.

Nutzerauftrag: regelmäßig Zwischenstände committen/pushen, dieses Dokument aktuell halten und sinnvolle Parallelisierung koordinieren. Klar gekennzeichneter WIP darf gesichert werden. Keine PR mergen, Releases veröffentlichen, Tasks schließen oder fremde Worktrees löschen. Keine Assertions, Grenzen, Timeouts oder Ausschlüsse für einen Pass abschwächen. Alte Stashes wurden bereits angewandt: nicht erneut anwenden/pop.

## Aktueller Repo- und Integrationsstand

- Hauptcheckout D:/Projects/renovation-planner bleibt sauber auf main (zuletzt44234f77).
- Root arbeitet ausschließlich in .worktrees/editor-plan-finalization, Branch codex/editor-plan-finalization. Verifizierter Start dieses Updates: HEAD/origin **465ffe42b33162f173a15194ffe4f48fa5efc369**, sauber. Spätere Dokumentations-/Integrationscommits mit Git prüfen.
- [PR #91](https://github.com/Luis85/renovation-planner/pull/91) ist OPEN/DRAFT, Basis codex/materials-costs-evidence (#88,3c1c737a). Review-/Mergeentscheidung bleibt beim Menschen.
- Root **57144c81** hat UI **f576d13c** konfliktfrei auf Root1b554540 integriert. Die zuvor als ausstehend beschriebenen Galerie-, Caption-, Density- und Review-Markeränderungen sind damit im gemeinsamen Branch.
- Root **465ffe42** übernimmt elf geprüfte Fälle aus Coverage44860131: Review6, Outline2, öffentliche Commandvalidierung3 samt Counter-Receipt. Keine Tests nochmals übernehmen.
- UI-Folge nachf576 ist noch separat: Warntextseparator, ReviewRoomDetails-Extraktion, sichtbare Source-Labels, Custom-Abstände, lokale Buttonklassen. Letzter committeter UI-Anker **df7100b4**; zusätzlicher Fokusfix ist noch in Verifikation. Erst nach gepushtem SHA/Terminalreceipt integrieren.
- Coverage bereitet separat zwei weitere öffentliche Grenzfälle und den von Root geprüften requirementMapper-Cleanup vor. Noch kein Pass/Integration dieses Pakets.

## Owners und lokaler Prüfslot

| Owner | Task / Branch | Auftrag |
|---|---|---|
| Root | 01a0786f-b624-7303-987f-b18b94db48d9 / codex/editor-plan-finalization | Integration, Gesamtstatus, finale CI-/Bild-/Host-Abnahme |
| Implement locked editor UI | 01a0783d-199d-7772-920b-90493cf0d8b4 / codex/editor-object-ui | UI-Fixes, eigene Regressionen, originale finale9Journeys/18Referenzen |
| Erreiche Editor-Testcoverage | 01a07cca-4d4b-75b0-96fb-9417d3b86f51 / codex/editor-coverage-finalization, PR#92 | Globale Coverage; Nutzer hat Task gestartet und Root hat Übergabe bestätigt |
| Improve M15 recovery workflow | 01a07838-4e54-7ac3-bc24-a8eef9185d6e | Idle, konkrete neue Hardening-Befunde; keine neuen Coverage-Pakete |

**UI hält den schweren lokalen Slot** für die letzten Fokus-/Nachbarprüfungen. Root und Coverage arbeiten lesend bzw. source-only. Der unveränderte Focus-Gate ist inzwischen96/96PASS in3,88s (UI30372 terminal0); native Nachbarn folgen. Root hat keinen laufenden schweren Prozess. Slot erst nach explizitem terminalem Owner-Receipt neu vergeben. Keine fremden Prozessausgaben konsumieren, keine Fremdprozesse stoppen; Stille/Timeout bedeutet nicht Ende.

Rechner ca.8GB RAM. Installs, Builds, Tests, Coverage, Analyzer und Browser-/Performancecaptures lokal serialisieren; Lesen/Source/Docs parallel. Die dedizierte Coverage-Task besitzt globale Testpakete. Root/E/Helfer beginnen keine weiteren globalen Coverage-Pakete. UI behält eigene Fixregressionen. [Auftrag](coverage-session-brief.md), [Steuerung](coverage-coordination.md).

## Neueste vollständige CI und exakte Restgröße

Root465ffe42: [Run34152586317](https://github.com/Luis85/renovation-planner/actions/runs/34152586317), alle vier Verify-Jobs beendet/FAIL, AuditPASS. Linux24 job101837757667, Artefakt10030050526. Getesteter Merge23669557888f836846f8d71048fa17db5a2a9d87 hat denselben Gitbaum8b6a153e52c8bea61c6325dff6da2d2498c8f814 wie Root465.

Linux24: **8104PASS /10FAIL /69SKIP**. S18055/18220, F5175/5212, L14099/14164, B**12540/12821**. Bei diesem Nenner fehlen **25 Brancharme** bis98%; die übrigen drei Floors sind erfüllt. Gegen571 sind Quelle und Maps identisch: exakt6neueBrancharme,5Statements,2Functions, keine Verluste. Nach kommenden UI-/Mapperänderungen neu messen;25 ist keine Zusage zum finalen Nenner.

OriginalJSON/LCOV/Log: C:/Users/lum/AppData/Local/Temp/rp-coverage-finalization-ci-465ffe42-linux24/. Coverage hat Quelle/Baum/Maps geprüft. Vorherige Originale liegen unter Root-Scratch ci-57144c81-linux24/.

Die zehn CI-Fehler sind bekannte UI-Folgen, keine neuen Coverage-Testfehler:

- Neun Warntextfälle: PersistentWarningStrip verschachtelte Severity/Message ohne literales Leerzeichen. UI ecbf7e27 erzeugt genau ein Leerzeichen; unveränderte drei Warnsuites **32/32PASS** in15,79s.
- Ein Focus-Gate: neue anonyme Editor-Buttonresets konkurrieren im konservativen CSS-Scanner auch mit zwei unveränderten Asset-Shelf-Selektoren. Explizite lokale Klassen auf Subject/Work-Sekundäraktionen, Review-Room- und BatchActionList-Buttons begrenzen die Regeln. Unveränderter Gate **96/96PASS**; keine AssetCSS-/Matcher-/Teständerung. Native Nachbarn und gepushter Receipt noch abwarten.
- Full Health auf original571-Countern,747/747Dateien gemappt, fand ReviewSummary Template cognitive17>15. UI extrahiert den unveränderten Selected-Room-Block nach ReviewRoomDetails. Statischer Complexity-/Health-Nachlauf ohne Findings; ältere Coverage beweist keine frischen Counter für verschobene/neue Funktionen. Neuer gemeinsamer Vollrun erforderlich.

## Aktueller Funktions- und visueller Nachweis

M17-Vertrag ist im Root571 umgesetzt: Marker wählt/framed Room und bleibt Review, zeigt dieselbe nummerierte Zusammenfassung wie die Roomliste; Issue öffnet die konkrete Quelle in Renovate. Shared useReviewPresentation ist einmal leaf-owned und nutzt vorhandene Planning-/Renovation-Findings, keine neuen Readiness-Regeln. Existing/Planned/Work behalten ihre bisherigen Markeraktionen. Review6+Outline2 und Command3 wurden nativ/type/lint/static geprüft und sind in465 enthalten.

UI-Browserlauf98235 aufdf7100b4 ist terminal: **alle vier erweiterten Szenarien grün**. Enthält sechs echte During-Fotos mit Datum/Work, echte Caption/Control/Pin-Prüfungen bei Pan/Inline/Clamping, zwei nativ angelegte Decisions, Review-Issuequelle/Cancel/Back und echte Mausauswahl des Roommarkers. Ein solcher Teilrun ersetzt den finalen Gesamtvergleich nicht. Finale Fokusklassen kamen danach.

Caption-Platzierung verwendet tatsächlich gemessene Dimension-/Inline-DOMRects über einen owned ResizeObserver/coalesced RAF und gemeinsame screenToWorld-Umrechnung. Originalschrift,182×56Envelope, alle drei Statuszeilen, Pinpositionen und Geometrie bleiben erhalten. Drei echte Vorgänger-REDs belegen Controlkollision/Inlinekollision/Clipping; native Nachläufe25/25 bzw.28/28 bestanden. Vollständig verdeckter Fallback erhält dokumentiert die Ausgangsposition. Bilder nach finalem Source erneut prüfen.

Nach verifiziertem gemeinsamen Source muss scripts/editor-visual-final-check.mjs unverändert alle neun Journeys in **einem** Lauf liefern: materials-costs-evidence, renovation-workflow, reference-plan, editor-visual-resilience, editor-visual-overview, editor-object, planning-recovery, modal-busy-focus, editor-downstream. Danach18Referenzen über editor-visual-fidelity-shots/editor-visual-comparisons; capture-provenance.json, Originalreports, Hashes und Bilder tatsächlich prüfen. Keine unterbrochenen Teilläufe zusammenzählen. Fixtureflächen12/18m² statt15,9/24,3m² und fehlende Building-Hierarchie sind akzeptierte Daten-/ADR-Unterschiede.

## Bereinigungen und Review

Requirement.with-Datumerhalt ist bereits Root1b554540: privaterParameter nimmt requiredDate typseitig nicht an, bestehendesDatum bleibt erhalten; öffentliche Erstellung/Hydrierung/Validierung unverändert. Owner16/16,Root16/16; vier Gesamtarme entfernt (drei vorher ungetroffen, ein getroffen), Statements unverändert. [Evidence](requirement-date-preservation.md).

Neu freigegeben, noch nicht geprüft: requirementMapper darf nach erfolgreichem Schema-Parsen direkt die einzig gültige zone-Origin abbilden; redundante Reader-kind-Prüfung und Writer-Ternary samt unbenutztem err-Import entfernen. Alle V1/V2/V3-Schemas behalten literalzone und Domain unbekannte-Origin-Rejection. Keine Validierung unterdrücken. Bestehende Mapper/Requirement/public Roundtriptests und Counterreceipt erforderlich.

Frischer Vorgänger-Reviewaudit: PR74/75/76/82/83/85/86/87 vollständig paginiert,27Threads davon25offen; keine neuen Findings bei unveränderten Heads. PR88 sechs offene Threads, alle in Continuations/Root behoben; ältere Branches selbst unverändert, daher nicht als dort erledigt auflösen. PR89/90/91 keine offenen Reviewthreads beim Sweep. [Reviewaudit](review-audit.md). Erneut prüfen, bevor Kandidat als fertig gilt.

## Verbindliche Quellen

AGENTS.md/.codex waren bei frischer Prüfung weder in Hauptcheckout noch Rootworktree vorhanden. Nutzeranweisungen gelten. [CLAUDE.md](../../../../CLAUDE.md), [SDD](../../../development/sdds/obsidian-renovation-planner-SDD.md) und aktuelle ADRs enthalten die Projektregeln.

[Specs](../README.md), [Plan](implementation-plan.md), [Status](implementation-status.md), [Completion-Matrix](completion-matrix.md), [Integration](integration-map.md), [Hostvorbereitung](live-host-preparation.md), [Host-/CI-Audit](e-host-ci-audit.md), [UI-Join](joined-ui-f576-evidence.md). Historische Einzelbelege bleiben in diesen Docs und Git; für die nächste Aktion gilt dieser Snapshot plus neuere echte Receipts.

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

## Nächste Schritte und technische Wiederaufnahme

1. Gitstatus/HEAD/origin, Taskstatus und tatsächlichen Slotowner prüfen. UI-Fokusnachbarn abwarten, gepushte Folge nachf576 reviewen und integrieren.
2. Coverage den nächsten lokalen Prüfslot ausdrücklich übergeben; neue Grenzfälle/Mappercleanup prüfen und nur verifizierte Beiträge integrieren.
3. Neuen gemeinsamen Voll-CI-Lauf stabil bis zu Artefakten lassen; Source-/Baumgleichheit prüfen, Floors und Health aus originalen Countern neu bewerten. Kein docs-onlyPush während eines wertvollen vollständigen Laufs ohne Anlass.
4. UI auf eingefrorenem gemeinsamem Stand originale9Journeys/18Referenzen liefern lassen; Bilder tatsächlich beurteilen. Anschließend finalen Build im benannten Testvault installieren und H1–H6 abschließen.
5. Bei verbleibenden physischen Geräte-/Screenreaderfragen erst konkretes Hostpaket liefern und die zwei notwendigen menschlichen Angaben erfragen. Keine Abschlussbehauptung aus Teiltests.

Root-Scratch: C:/Users/lum/AppData/Local/Temp/rp-finalization-20260907-88b9ee3d. Historische Full-CI-Originale95e/f306/45c/571 bewahren. Offizielle Fallow-Option: fallow health --coverage <original coverage-final.json> --coverage-root /home/runner/work/renovation-planner/renovation-planner. Originalcounter niemals umschreiben; Source- und Mappinggleichheit nachweisen.

Browser ausdrücklich Edge: RP_CHROMIUM_EXECUTABLE=C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe, BROWSER=none. Kein behaupteter gepinnterChromium-/Obsidian-Pass. CI-Artefakte haben14TageRetention; fehlende Belege erneut erheben, nicht als bestanden erfinden.

Nach Neustart lesend: git status --short --branch; git worktree list; git log -5 --oneline; gh pr view91; gh run list --branch codex/editor-plan-finalization. Bei neuem Rechner vom gepushten Topicbranch fortsetzen; vorhandene Änderungen erhalten. npmci nur bei fehlenden Abhängigkeiten und freiemSlot. Dieses Dokument bei wesentlichen Checkpoints aktualisieren; Goal bleibt bis zur tatsächlichen Erfüllung aktiv.

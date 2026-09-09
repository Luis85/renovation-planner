# Referenzskalierung: gezielte Abnahme am 2026-09-09

Status: Browsernachweis und native Teilabnahme vorhanden. Die restliche manuelle Prüfung übernimmt der Nutzer später selbst; keine vollständige Abnahme dieses Punkts. Ausschließlich der Referenzskalierungsanteil des verbleibenden Plans; keine Abnahme anderer Modals, Foto-UX, Editorfunktionen oder der Gesamtmatrix.

## Ausgangspunkt und Abnahmekriterien

Nach `git fetch origin --prune` ist der Concern #109 (`8948c7a3ea4d014bb0fad8bca31138b7a424d6b7`) auf #108 (`6c6699ea9a9fda7e9cfe1a35c5f3b010b4607e3f`) gestapelt. #110 hängt direkt von #109 ab; #117 ist der dokumentierende Stackabschluss. #108 und #109 haben vier fehlgeschlagene Verify-Jobs, Audit und GitGuardian erfolgreich. #117 ist grün. #109 hat keine Review-Kommentare oder Review-Threads. Die konkrete ältere CI von #109 ist [Run 34326600974](https://github.com/Luis85/renovation-planner/actions/runs/34326600974): unter anderem Raum-Inspector-Fehler und 97,86 % Branch-Coverage bei unverändert geforderten 98 %. Das ist keine aktuelle Abnahme dieses Follow-ups.

Der Arbeitsbaum ist `.worktrees/reference-scale-acceptance` auf `codex/reference-scale-acceptance`, aus dem aktuellen Concern-Head erstellt. Ein zusätzlicher eigener, unveränderter Detached-Worktree `.worktrees/reference-scale-legacy` hält #108 für den tatsächlichen Bildvergleich. Main und fremde Worktrees bleiben unverändert. In diesen Quellständen existieren keine AGENTS.md oder .codex-Anweisungen; es gelten die Nutzeranweisungen, der Plan, die einschlägigen Regeln aus CLAUDE.md und der M06-Vertrag.

- Bild: Canvas mindestens 600 px breit auf Desktop/1000-px-Szenario, 300 px bei 460 px; mindestens 340 px hoch; vollständig in den Modal-Scrollbereich bringbar; kein horizontaler Überlauf. Die gemalte Fläche muss sowohl gegenüber dem nominalen alten Fit als auch gegenüber der **tatsächlich CSS-gerenderten** Vorgängerversion mindestens Faktor 1,75 erreichen.
- Navigation: beschriftete Zoom-/Pan-/Fit-Aktionen per Tastatur erreichbar, Pointer-Pan und Wheel, `+`, Pfeiltasten und `F` funktional. Kameraaktionen verändern Bildpixel, aber keine A/B-Feldwerte. Fit stellt exakt dieselben Canvas-Pixel wieder her.
- Kalibrierung: Pointer-Picks liefern Quellpixel innerhalb der bestehenden Zwei-Bildschirmpixel-Toleranz. Die separate exakt berechenbare Speicherfixture A=(400,400), B=(1100,400), Eingabe `3,5` m ergibt 3500 mm, 0,2 Pixel/mm und 5 mm/Pixel. Wiederöffnen muss exakt dieselben Quellkoordinaten und 3,5 m zeigen.
- Schreibgrenzen: Navigation, Apply scale, Zurück und Escape verändern keine gespeicherten Bytes. Nach erfolgreichem Finish bleiben sämtliche bereits gespeicherten Bytes auch nach Navigation, einem 9-m-Entwurf, Review und Abbrechen unverändert.
- Bilder: Light, Dark, eigener Akzent und deutsche 460-px-Ansicht; aktuelle Screenshots tatsächlich betrachten und gegen M06 sowie den aktuellen Vorgänger vergleichen.
- Native: nach eindeutiger Vaultidentität den Build sichern/installieren/reloaden und denselben Ablauf in Obsidian beobachten; Datei- und Buildhashes erfassen. Teilweise erfüllt; die unten benannten verbleibenden Schritte übernimmt der Nutzer manuell.

## Nachgewiesene Korrekturen

Bei 1000×900 px hielt die Referenzvorschau an zwei Spalten fest, obwohl ihre eigene verfügbare Breite unter dem Breakpoint lag. Das Canvas war nur 596 px breit und verfehlte die unveränderte 600-px-Assertion. [Tatsächlicher Vorher-Screenshot](evidence/reference-scale-20260909/reproduction/custom-accent-before.png). Ein benannter Größencontainer auf `.rp-reference-setup` bindet die vorhandene 999-px-Umschaltung an den Referenzbereich. Kein anderer Dialog oder Editorbereich bekommt neue Regeln.

Die ursprüngliche Fit-Pixelassertion scheiterte auch mit dem von Playwright vorgesehenen Chromium. Instrumentierte drawImage-Aufrufe zeigten identische Transformationen und Quellrechtecke. Häufiges Auslesen schaltete Chromiums 2D-Rasterisierung von GPU auf CPU um. Der Zusatztreiber startet deshalb mit `--disable-accelerated-2d-canvas`; die exakte Pixelassertion bleibt erhalten. Das ist eine deterministische Browser-Testkonfiguration, keine Änderung des Produktionsrenderers. Die übrigen Matrixaufrufe behalten ihre bisherigen Startoptionen.

Der vorhandene Theme-/Marker-Test zählte zusätzlich den noch ausstehenden Mount-Fit-Redraw. Ein `await nextTick()` vor Einrichtung des Spys trennt den Mount vom geprüften Redraw. Pixel-, Labelanzahl- und Offscreen-Assertions sind unverändert.

## Treiber und Reproduktion

Der Referenzteil von `scripts/editor-modal-placement-check.mjs` und `editor-reference-viewport-browser.mjs` wird aus #116 auf #109 vorgezogen. Auf diesem Concern führt der Treiber ausschließlich Referenzprüfungen aus; Photo-/Opening-Journeys bleiben auf #116 unverändert. Bei späterer Stackintegration muss dessen kombinierter Einstieg erhalten bleiben und dieser erweiterte Referenzablauf übernommen werden. Es werden hier keine abhängigen Branches umgeschrieben.

```powershell
# Im aktuellen Concern-Worktree, mit installiertem Playwright-Chromium:
node scripts/editor-modal-placement-check.mjs --reference-only

# Im unveränderten #108-Worktree, mit dem absoluten Treiberpfad des Concerns:
node ../reference-scale-acceptance/scripts/editor-modal-placement-check.mjs --reference-baseline
```

Die tatsächlich gemalten Vorgängerflächen sind unter [legacy/report.json](evidence/reference-scale-20260909/legacy/report.json) festgehalten. Die ursprüngliche nominale 400×220-Behauptung allein wird nicht als Vergleich verwendet. Browser-FakeVault nutzt die Produktionskommandos und Repositories; er ersetzt keinen nativen Obsidian-Nachweis. Die Speicherfixture enthält ausschließlich synthetische Daten.

## Festgeschriebene Browser- und Bildabnahme

Quell-/Treiberstand: `7616dd9d8d98e55c740a904f651085967a87ba76`. Beide finalen Aufrufe bestanden mit Chromium 151.0.7922.34: vier aktuelle Referenzabläufe und vier Vorgängeraufnahmen. Alle 16 aktuellen und vier Vorgängerbilder wurden tatsächlich betrachtet; zusätzlich das M06-Referenzbild. [Messbericht](evidence/reference-scale-20260909/current/report.json), [Aufnahmemanifest](evidence/reference-scale-20260909/current/capture-files.json), [Revisionen sowie Bundle-/CSS-/Manifest-/Bild-/Log-Hashes](evidence/reference-scale-20260909/receipt.json).

| Szenario | Gemaltes Bild #108 | Gemaltes Bild aktuell | Flächenfaktor | Aktuelle Screenshots |
|---|---:|---:|---:|---|
| Light, 1440×900 | 304,57×231,55 px | 663×502 px | 4,72 | [Fit/A–B](evidence/reference-scale-20260909/current/light-reference-large-scale.png), [Pan/Zoom](evidence/reference-scale-20260909/current/light-reference-pan-zoom.png), [Länge](evidence/reference-scale-20260909/current/light-reference-known-length.png), [Review](evidence/reference-scale-20260909/current/light-reference-scale-review.png) |
| Dark, 1440×900 | 304,57×231,55 px | 663×502 px | 4,72 | [Fit/A–B](evidence/reference-scale-20260909/current/dark-reference-large-scale.png), [Pan/Zoom](evidence/reference-scale-20260909/current/dark-reference-pan-zoom.png), [Länge](evidence/reference-scale-20260909/current/dark-reference-known-length.png), [Review](evidence/reference-scale-20260909/current/dark-reference-scale-review.png) |
| Eigener Akzent, 1000×900 | 304,57×231,55 px | 664×502 px | 4,73 | [Fit/A–B](evidence/reference-scale-20260909/current/custom-accent-reference-large-scale.png), [Pan/Zoom](evidence/reference-scale-20260909/current/custom-accent-reference-pan-zoom.png), [Länge](evidence/reference-scale-20260909/current/custom-accent-reference-known-length.png), [Review](evidence/reference-scale-20260909/current/custom-accent-reference-scale-review.png) |
| Deutsch, 460×900 | 260,04×197,81 px | 372×282 px | 2,04 | [Fit/A–B](evidence/reference-scale-20260909/current/german-constrained-reference-large-scale.png), [Pan/Zoom](evidence/reference-scale-20260909/current/german-constrained-reference-pan-zoom.png), [Länge](evidence/reference-scale-20260909/current/german-constrained-reference-known-length.png), [Review](evidence/reference-scale-20260909/current/german-constrained-reference-scale-review.png) |

Visueller Befund: Das Planbild ist in allen vier Ansichten vollständig per Fit erreichbar und größer als die echte Vorgängerdarstellung. A/B stehen am Bild, die Kameraaktionen sind beschriftet, Zoomzustand und Hinweise sind lesbar. Auf Desktop stehen die Felder neben dem Bild; bei geringerer Breite sind sie darunter durch Scrollen und Tab erreichbar. Die gesonderten Längen-/Reviewbilder zeigen diese Erreichbarkeit und die konkrete Anzeige `5 mm pro Quellpixel` bei `3,5 m`. Der M06-Vergleich betrifft ausschließlich Arbeitsfläche, Messmarkierungen und den geltenden dreistufigen Kalibrierungs-/Speichervertrag; keine pauschale Pixelgleichheit oder M00–M17-Abnahme.

## Aktueller Qualitätscheck

`npm ci --ignore-scripts` installierte den unveränderten Lockfile-Stand. `VITEST_MAX_WORKERS=1 npm run check` lief vollständig bis zum Coverage-Ergebnis: Build einschließlich Typprüfung und beide Linter bestanden. 698 Testdateien: 693 bestanden, 5 fehlgeschlagen. 8.391 Tests bestanden, 8 fehlgeschlagen, 70 unverändert übersprungen. Suite-Laufzeit 2071,31 s. Statements 99,03 %, Branches 97,87 %, Functions 99 %, Lines 99,51 %. Die unveränderte Branch-Schwelle von 98 % wurde verfehlt. [Vollständiges Log](evidence/reference-scale-20260909/check.log).

Alle vier Referenz-Testdateien (`referenceViewport`, `referenceViewportControls`, `referenceSetup`, `referenceWorkflow.e2e`) sind im tatsächlichen vollständigen Lauf bestanden; [Vitest-Ergebnisse](evidence/reference-scale-20260909/reference-test-results.json). Ein früherer gezielter Lauf hatte 67 bestandene Tests und den oben beschriebenen Mount-/Theme-Testfehler. Dieser Fehler ist behoben, ohne dessen Assertions zu verändern.

Die acht verbleibenden Fehler liegen in `zoneEditing` (3), `newRoomInspector` (2), `renovationRoutes`, `structureLifecycle` und `renovateRoomManipulation` (je 1). Ihre Namen stimmen mit der vorab gelesenen CI des Ausgangs-Heads überein. Sie werden gemäß exklusivem Auftrag nicht mitbearbeitet.

Da die Kette nach Coverage stoppt, wurde `npm run analyze` separat ausgeführt: rot mit vier Dead-code-/Typbefunden und zwölf Komplexitätsbefunden in unveränderten Produktionsdateien außerhalb dieses Concerns. `src/` ist byteidentisch zum Ausgangs-Head; die einzige Produktionskorrektur liegt im Referenz-CSS. [Fallow-Log](evidence/reference-scale-20260909/analyze.log). Keine Grenzwerte, Ausschlüsse oder Timeouts wurden abgesenkt. Der [mechanische Design-Scan](evidence/reference-scale-20260909/design-detect.json) des geänderten CSS meldet keine Befunde. Der Branch ist damit reviewbar, aber besitzt keinen grünen vollständigen Gate-Pass.

Die nachfolgende CI auf `c748be74726a816d9b39d971b45ad656254ddf58` ist inzwischen vollständig ausgewertet: [Run 34337741996](https://github.com/Luis85/renovation-planner/actions/runs/34337741996), alle vier Verify-Jobs fehlgeschlagen, Audit und GitGuardian bestanden. Die Fehlernamen entsprechen genau den acht oben genannten Tests; Branch-Coverage erneut 97,87 %. Dieser Nachweis ersetzt keinen grünen Gesamtcheck.

## Native Teilabnahme und manuelle Fortsetzung

Der Nutzer bestätigte `C:\Users\lum\.codex\tmp\renovation-planner-finalization-vault`. Ausschließlich dieser Vault wurde verwendet. Seine 17 vorhandenen Dateien wurden vor der Installation nach `C:\Users\lum\.codex\tmp\reference-scale-native-backup-20260909` gesichert. Die installierten `main.js`, `styles.css` und `manifest.json` stimmen mit den bereits geprüften Build-Hashes überein; der Plugin-Build wurde über Aus-/Einschalten im zugehörigen Obsidian-Einstellungsfenster neu geladen. Host: Obsidian 1.13.7, beobachtetes Planfenster 1024×800 px.

Ein eigener synthetischer Prüfplan **Reference Scale Acceptance** im Projekt **Reference Scale Acceptance 2026-09-09** verwendet `References/reference-scale-1640x1240.png`. Die bereits vorhandenen Räume und Wände wurden nicht für eine Neukalibrierung benutzt. [Native Nachweisübersicht mit Build-/Datei-/Screenshot-Hashes](evidence/reference-scale-20260909/native/receipt.json).

| Tatsächlich geprüfter Schritt | Befund und Nachweis |
|---|---|
| PNG und Host-Themes | Große geladene Vorschau in [Dark](evidence/reference-scale-20260909/native/04-native-dark-prepare-ready.png) und [Light](evidence/reference-scale-20260909/native/14-native-light-scale.png); Bilder tatsächlich betrachtet. |
| Messpunkte und Navigation | A=(401,08;402,03), B=(1099,28;402,03) per Bildklick gesetzt. [125 % Zoom](evidence/reference-scale-20260909/native/07-native-zoom-125.png), [Pan](evidence/reference-scale-20260909/native/08-native-pan.png), [161 % Mausrad-Zoom](evidence/reference-scale-20260909/native/09-native-wheel-zoom.png) und [Fit auf 100 %](evidence/reference-scale-20260909/native/10-native-fit-restored.png) tatsächlich beobachtet. Die Felder sind [vorher](evidence/reference-scale-20260909/native/06-native-picked-coordinates.png) und [nachher](evidence/reference-scale-20260909/native/11-native-coordinates-after-navigation.png) identisch. |
| Abbruch der ungespeicherten Einrichtung | Escape schließt die Einrichtung. Alle zehn Projekt-/Quell-Dateien sind bytegleich: [Dateinachweis](evidence/reference-scale-20260909/native/empty-cancel-files.json). Erneutes Öffnen beginnt ohne übernommene ungespeicherte Quelle. |
| Zahleneingabe und Review | Die vier Koordinatenfelder und die Länge wurden über Tab bedient: [A=(400,400), B=(1100,400), Eingabe `3,5`](evidence/reference-scale-20260909/native/15-native-known-distance.png). Apply scale und Back änderten keine gespeicherten Dateien. [Review](evidence/reference-scale-20260909/native/16-native-light-review.png) zeigt 5 mm pro Quellpixel. |
| Native Speicherung | Finish speichert exakt 3500 mm und 0,2 Pixel/mm; Weltpunkte A=(2000,2000), B=(5500,2000), Revision 2. [Gespeicherte Ansicht](evidence/reference-scale-20260909/native/17-native-saved-reference.png) und [Dateisnapshot](evidence/reference-scale-20260909/native/committed-files.json). Gegen die Sicherung sind alle sechs zuvor vorhandenen Projekt-/Quelldateien unverändert. Gegen den Snapshot vor Finish änderten sich ausschließlich Plannotiz und Geometriedatei des neuen Prüfplans. |

Die 17 gespeicherten Screenshots wurden während des nativen Laufs betrachtet. Die ersten drei Aufnahmen dokumentieren Initialisierung beziehungsweise Ladeübergänge und zählen nicht als eigenständige bestandene Abnahmeschritte. Die Dateivergleiche dieser Fortschreibung verwenden die aufgezeichneten Snapshots; sie sind keine erneute Live-Prüfung des Vaults.

Computer Use wurde mit der physischen Escape-Taste beendet. Der Nutzer hat danach ausdrücklich erklärt: „die restliche manuelle prüfung erledige ich später selber“. Deshalb erfolgen keine weiteren nativen Aktionen durch den Agenten. Die folgenden Schritte bleiben **ungeprüft und dem Nutzer zugeordnet**:

1. Den gespeicherten Prüfplan beziehungsweise seine Referenzeinrichtung schließen und wieder öffnen. A=(400,400), B=(1100,400), bekannte Länge 3,5 m und 0,2 Pixel/mm prüfen.
2. In der gespeicherten Referenz einen 9-m-Entwurf bis Review führen und abbrechen. Die gespeicherten Daten müssen weiterhin dem [Snapshot nach Finish](evidence/reference-scale-20260909/native/committed-files.json) entsprechen.
3. Die schmale deutsche Host-Ansicht einschließlich Bildgröße, erreichbarer Pan-/Zoom-/Fit-Bedienung und Felder prüfen. Die schmale deutsche **Browser**-Ansicht ist bereits abgenommen; daraus wird kein nativer Pass abgeleitet.

Letzter beobachteter Hostzustand beim Abbruch: **Light**, **Deutsch ausgewählt, Sprachneustart ausstehend**. Ursprünglich: Englisch und „Adapt to system“. Der installierte geprüfte Build und der gespeicherte Prüfplan bleiben für die Fortsetzung erhalten. Sprache/Theme sind nach der manuellen Prüfung gegebenenfalls auf den gewünschten Ausgangszustand zurückzustellen.

Der frühere Browser-[Receipt](evidence/reference-scale-20260909/receipt.json) hält den damaligen Stand vor der Pfadbestätigung fest; der native Receipt dokumentiert diese spätere Teilabnahme und die Übergabe. Physische Touch-/Pen-/Trackpad-Geräte und Screenreader bleiben unperformiert. Keine H1–H6-Gesamtfreigabe, kein Merge, kein Release.

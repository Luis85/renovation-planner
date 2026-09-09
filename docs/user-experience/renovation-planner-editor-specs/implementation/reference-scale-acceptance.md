# Referenzskalierung: gezielte Abnahme am 2026-09-09

Status: Browsernachweis vorhanden, native Abnahme ausstehend. Ausschließlich der Referenzskalierungsanteil des verbleibenden Plans; keine Abnahme anderer Modals, Foto-UX, Editorfunktionen oder der Gesamtmatrix.

## Ausgangspunkt und Abnahmekriterien

Nach `git fetch origin --prune` ist der Concern #109 (`8948c7a3ea4d014bb0fad8bca31138b7a424d6b7`) auf #108 (`6c6699ea9a9fda7e9cfe1a35c5f3b010b4607e3f`) gestapelt. #110 hängt direkt von #109 ab; #117 ist der dokumentierende Stackabschluss. #108 und #109 haben vier fehlgeschlagene Verify-Jobs, Audit und GitGuardian erfolgreich. #117 ist grün. #109 hat keine Review-Kommentare oder Review-Threads. Die konkrete ältere CI von #109 ist [Run 34326600974](https://github.com/Luis85/renovation-planner/actions/runs/34326600974): unter anderem Raum-Inspector-Fehler und 97,86 % Branch-Coverage bei unverändert geforderten 98 %. Das ist keine aktuelle Abnahme dieses Follow-ups.

Der Arbeitsbaum ist `.worktrees/reference-scale-acceptance` auf `codex/reference-scale-acceptance`, aus dem aktuellen Concern-Head erstellt. Ein zusätzlicher eigener, unveränderter Detached-Worktree `.worktrees/reference-scale-legacy` hält #108 für den tatsächlichen Bildvergleich. Main und fremde Worktrees bleiben unverändert. In diesen Quellständen existieren keine AGENTS.md oder .codex-Anweisungen; es gelten die Nutzeranweisungen, der Plan, die einschlägigen Regeln aus CLAUDE.md und der M06-Vertrag.

- Bild: Canvas mindestens 600 px breit auf Desktop/1000-px-Szenario, 300 px bei 460 px; mindestens 340 px hoch; vollständig in den Modal-Scrollbereich bringbar; kein horizontaler Überlauf. Die gemalte Fläche muss sowohl gegenüber dem nominalen alten Fit als auch gegenüber der **tatsächlich CSS-gerenderten** Vorgängerversion mindestens Faktor 1,75 erreichen.
- Navigation: beschriftete Zoom-/Pan-/Fit-Aktionen per Tastatur erreichbar, Pointer-Pan und Wheel, `+`, Pfeiltasten und `F` funktional. Kameraaktionen verändern Bildpixel, aber keine A/B-Feldwerte. Fit stellt exakt dieselben Canvas-Pixel wieder her.
- Kalibrierung: Pointer-Picks liefern Quellpixel innerhalb der bestehenden Zwei-Bildschirmpixel-Toleranz. Die separate exakt berechenbare Speicherfixture A=(400,400), B=(1100,400), Eingabe `3,5` m ergibt 3500 mm, 0,2 Pixel/mm und 5 mm/Pixel. Wiederöffnen muss exakt dieselben Quellkoordinaten und 3,5 m zeigen.
- Schreibgrenzen: Navigation, Apply scale, Zurück und Escape verändern keine gespeicherten Bytes. Nach erfolgreichem Finish bleiben sämtliche bereits gespeicherten Bytes auch nach Navigation, einem 9-m-Entwurf, Review und Abbrechen unverändert.
- Bilder: Light, Dark, eigener Akzent und deutsche 460-px-Ansicht; aktuelle Screenshots tatsächlich betrachten und gegen M06 sowie den aktuellen Vorgänger vergleichen.
- Native: erst nach eindeutiger Vaultidentität den Build sichern/installieren/reloaden und denselben Ablauf in Obsidian beobachten; Datei- und Buildhashes erfassen. Dieses Kriterium ist noch offen.

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

## Native Grenze

Der Auftrag nennt ausschließlich `C:\Users\lum.codex\tmp\renovation-planner-finalization-vault`; dieser Pfad existiert nicht. Der Plan nennt `C:\Users\lum\.codex\tmp\renovation-planner-finalization-vault`; dieser Pfad existiert. Die Pfadklärung wurde angefragt. Bis zur eindeutigen Antwort erfolgen keine nativen Aktionen oder Plugininstallationen in einem der Vaults. Aus einer laufenden Obsidian-Fensterüberschrift lässt sich keine Freigabe des abweichenden Dateisystempfads ableiten.

Die Browserbilder belegen weder native Host-Themes noch Touch/Pen/Trackpad oder Screenreader. Keine H1–H6-Gesamtfreigabe, kein Merge, kein Release.

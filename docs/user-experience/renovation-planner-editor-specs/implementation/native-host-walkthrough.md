# Native Hostreise — vorbereitet, noch nicht ausgeführt

Die folgenden Labels wurden gegen Source43041936 gelesen. Die tatsächliche UI muss beim Ausführen erneut beobachtet werden. Voraussetzung ist der **finale gemeinsam geprüfte Build**, dessen Source-/Bundle-/Styles-/Manifest-Hashes zuerst zu erfassen sind; nicht allein für diesen Ablauf den älteren430-Build installieren. Obsidian und Plugin-UI zunächst Englisch.

Nur den Testvault C:/Users/lum/.codex/tmp/renovation-planner-finalization-vault verwenden. Projekt und Plan bestehen bereits. Vor Änderungen zuerst die Legacy-Bytes vergleichen und PNG/PDF-Cancel/Save/Calibrierung auf dem noch leeren Plan prüfen, wie H1 es verlangt. Originaldateien und Prüfsummen liegen im Root-Scratch unter host-before-final-build/. Keine gewöhnlichen Nutzerdateien verwenden.

1. Palettenkommando **Open renovation project** ausführen.
2. **Codex Finalization Synthetic 2026-09-07** öffnen.
3. **Synthetic Ground Floor** öffnen.
4. **Add rooms**, alternativ **Add → Room**, wählen.
5. Unter **New room**: Name **Acceptance Room**, Width (m) **4**, Depth (m) **3**. Maße jeweils mit Enter bestätigen; es gibt keinen separaten Precision-Schalter.
6. **Create room** wählen.12m² und die Rückkehr zum Select-Werkzeug beobachten.
7. Den Raum auswählen und **Renovate** öffnen.
8. **What's here → Add or edit existing detail** wählen.
9. Surface or element **Floor finish**, Description **Existing timber floor**. **Review before applying → Apply**.
10. Am gespeicherten Datensatz **Mark something for change**: Change **Modify (~)**, Description **Refinish timber floor**, Intended spatial change **Room detail only**. **Review before applying → Apply**.
11. Über den Bereichsschalter zu **What will change** wechseln und die Änderung prüfen.
12. Zu **What needs doing** wechseln und **Add or edit work item** wählen.
13. Title **Prepare floor**, Responsibility **DIY**. **Creates planned outcomes** vollständig unmarkiert lassen. **Review before applying → Apply**. Diese absichtliche fehlende Zuordnung erzeugt einen nachvollziehbaren Review-Fall.
14. Zu **Photos** wechseln und **Link or edit evidence** wählen.
15. Description **Before floor preparation**, Vault file or link **References/editor-background-png-test.png**.
16. Evidence type **Photo**, Date (optional) **2026-08-28**, Phase **Before**, What needs doing **Prepare floor**, Related record (optional) **Unassigned**. Das ausdrücklich gewählte Testdatum unterscheidet sich vom Testtag und von Dateizeitstempeln.
17. **Apply** wählen; diese Planning-Form hat keine vorgeschaltete Reviewstufe.
18. Foto auswählen und den sichtbaren Link **What needs doing: Prepare floor** öffnen. Den tatsächlichen Work-Datensatz und den Fokusnachfolger beobachten.
19. **Review** öffnen. Der absichtlich ungekoppelte Work-Eintrag sollte **Acceptance Room · Work has no planned outcome** mit Ursache **Prepare floor** erzeugen. Zusätzlich ist **Changed outcome has no work** für die ungekoppelte Änderung korrekt.
20. Dieses Work-Issue öffnen und die Rückkehr zum betroffenen Work prüfen. Zusätzlich den Room-Marker getrennt prüfen: Auswahl bleibt in Review, Issue-Auswahl öffnet die Quelle.

Das ist nur der Kernweg für die reale Hostbedienung. Er ersetzt nicht H1–H6. Zusätzlich erforderlich sind u.a. zwei explizit datierte und eine undatierte Evidence-Datei, Datum ändern/entfernen/Undo samt passendem Schema, Dateiumbenennen/-verschieben/Cache/Reopen, alle11Add-Cancels, repräsentatives Room/Object-Save/Undo, Draft-Reflow/Split-Leaf, Themes/German/echterHostzoom, fehlende Datei/Peer-Konflikt und die benannten physischen Geräte-/Screenreaderbeobachtungen. [Vollständiger Host-Audit](e-host-ci-audit.md), [operativer Wiedereinstieg](RESUME.md).

Vorher/Nachher-Bytes, Hashes, Revisionen, sichtbarer Fokus und tatsächliche Ansagen getrennt notieren. Nicht aus einem UIA-Attribut oder einer erfolgreichen Aktion auf ungetestete Host-/Geräteeigenschaften schließen. Keine Ausführung oder bestandene Host-Abnahme wird durch dieses Vorbereitungsdokument behauptet.

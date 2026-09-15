# Wall thickness / Wanddicke

## English

In **Plan**, choose **Add → Wall**. Set **Thickness (m)** before placing points, or choose 0.1, 0.15 or 0.2 m. New walls start with equal depths on each side. This value applies to the whole draft chain. Place connected points or enter lengths and angles, then choose **Finish walls**. Live measurements and snapping help you connect walls.

For a saved wall, right-click it and choose **Enter wall thickness…**. Enter **Side A (m)** and **Side B (m)**, inspect the preview and choose **Apply**. Looking from the wall's start toward its end, **A is left and B is right**. The arrow on the reference line shows that direction when a face is highlighted. Each value measures the perpendicular depth from that fixed line to its face. Changing A leaves B and the reference line fixed; total thickness is A+B.

**Adjust wall thickness** puts separate minus/plus controls beside each face. Each button changes its own face by 10 mm. Hover or focus highlights the corresponding face. Tethers retain that association when the controls need to move away from a canvas edge. In a very small pane the same controls share a compact, scrollable panel. The camera stays where you left it.

**Details → Edit measurements** exposes both face depths and the total, together with length and height. **Details → Adjust wall thickness** opens the focused controls. With the wall selected, Shift+F10 or the Context Menu key opens its menu. Tab reaches every input and button; Enter applies. Cancel or Escape discards the preview. Clicking elsewhere, opening another dialog, changing the selection/tool or leaving Plan also discards it. While saving, wait for completion before editing again.

Use metres with a decimal point or comma: 0.075 m means 75 mm. Each depth may be zero or positive; zero puts that face on the reference line. The **total** must be 0.001–1000 m. Invalid input cannot be applied. The last button step near a bound stops at the bound. Numeric input preserves fractional millimetres. One Apply is one undo step, including a change that keeps the same total. Undo, Redo and reopening retain both depths. Ordinary save failures keep the draft; refresh a stale or conflicting floor before retrying.

Openings keep their along-wall position, width and swing; their frame and cut follow the actual faces. Wall endpoints, room associations and captions remain unchanged. Changing **total thickness in a multiple-wall measurement edit** moves both faces equally and preserves their depth difference; a shrink that would make a depth negative is refused.

Straight corners and T junctions use the actual face geometry. Curved walls support independent depths while the inside face remains outside the curve centre. Curved T junctions that require clipping or meet the host tangentially are explicitly refused for an independent-depth network. Reduce the offending depth, cancel, or retain equal depths on that connected wall network.

Existing walls reopen with A=B=old thickness/2, without moving or rewriting them on read. Saved independent depths require sidecar schema 13; an older plugin refuses the newer file rather than dropping the depths. Keep the newer plugin when sharing such plans.

## Deutsch

In **Plan** unter **Hinzufügen → Wand** die **Dicke (m)** vor dem Zeichnen eingeben oder 0,1, 0,15 bzw. 0,2 m wählen. Neue Wände erhalten auf beiden Seiten gleiche Tiefen. Der Wert gilt für die gesamte Wandkette. Verbundene Punkte setzen oder Längen und Winkel eingeben; anschließend die Wände fertigstellen. Maßanzeigen und Fanghilfen unterstützen das Verbinden.

Eine gespeicherte Wand mit der rechten Maustaste anklicken und **Wanddicke eingeben…** wählen. **Seite A (m)** und **Seite B (m)** eingeben, Vorschau prüfen und **Anwenden** wählen. Vom Anfang zum Ende der Wand gesehen liegt **A links und B rechts**. Bei hervorgehobener Fläche zeigt der Pfeil auf der Bezugslinie diese Richtung. Jeder Wert misst die senkrechte Tiefe ab dieser festen Linie. Eine Änderung von A lässt B und die Bezugslinie unverändert; die Gesamtdicke ist A+B.

**Wanddicke anpassen** zeigt an jeder Fläche eigene Minus-/Plus-Schaltflächen. Ein Schritt ändert nur die zugehörige Seite um 10 mm. Darüberfahren oder Tastaturfokus hebt die Fläche hervor. Verbindungslinien zeigen die Zuordnung, wenn die Steuerung am Zeichenflächenrand versetzt werden muss. In sehr kleinen Ansichten stehen dieselben Steuerelemente in einem kompakten, scrollbareren Bereich. Der Bildausschnitt bleibt unverändert.

Die vollständige Maßbearbeitung in **Details** zeigt beide Tiefen und die Summe sowie Länge und Höhe. **Wanddicke anpassen** öffnet dort die fokussierten Steuerelemente. Umschalt+F10 oder die Kontextmenütaste öffnet das Menü der ausgewählten Wand. Tab erreicht Felder und Schaltflächen; Eingabe wendet an. Abbrechen oder Escape verwirft die Vorschau. Ein Klick außerhalb, ein anderer Dialog, ein Auswahl-/Werkzeugwechsel oder das Verlassen von Plan verwirft sie ebenfalls. Während des Speicherns dessen Abschluss abwarten.

Meter mit Dezimalpunkt oder Komma eingeben: 0,075 m sind 75 mm. Jede Tiefe darf null oder positiv sein; null setzt diese Fläche auf die Bezugslinie. Die **Summe** muss zwischen 0,001 und 1000 m liegen. Ungültige Werte werden nicht angewendet. Der letzte Schritt an einer Grenze endet genau dort. Numerische Eingaben erhalten auch Bruchteile eines Millimeters. Ein Anwenden entspricht einem Rückgängig-Schritt, auch bei gleichbleibender Summe. Wiederholen und erneutes Öffnen erhalten beide Tiefen. Nach gewöhnlichen Speicherfehlern bleibt der Entwurf verfügbar; bei einem veralteten oder widersprüchlichen Plan zuerst aktualisieren.

Position entlang der Wand, Breite und Anschlag der Öffnungen bleiben erhalten; Rahmen und Ausschnitt folgen den tatsächlichen Flächen. Wandendpunkte, Raumzuordnungen und Beschriftungen bleiben unverändert. Eine Änderung der **Gesamtdicke bei mehreren ausgewählten Wänden** bewegt beide Flächen gleichmäßig und erhält ihren Tiefenunterschied. Eine Verringerung, die eine Tiefe negativ machen würde, wird abgelehnt.

Gerade Ecken und T-Anschlüsse verwenden die tatsächlichen Flächen. Gebogene Wände erlauben unabhängige Tiefen, solange die innere Fläche den Kurvenmittelpunkt nicht erreicht. Gebogene T-Anschlüsse, die beschnitten werden müssten oder tangential auf die Hauptwand treffen, werden bei unabhängigen Tiefen ausdrücklich abgelehnt. Die betreffende Tiefe verringern, abbrechen oder im verbundenen Wandnetz gleiche Tiefen beibehalten.

Bestehende Wände erhalten beim Öffnen A=B=alte Dicke/2, ohne Geometrieänderung oder Schreibzugriff beim Lesen. Gespeicherte unabhängige Tiefen benötigen Sidecar-Schema 13. Eine ältere Plugin-Version lehnt die neuere Datei ab, statt die Tiefen zu verlieren. Für solche gemeinsam genutzten Pläne die neuere Plugin-Version verwenden.

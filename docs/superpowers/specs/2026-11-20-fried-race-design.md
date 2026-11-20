# Fried Race – Spieldesign

## Absicht

Fried Race wird zunächst ein kleines, webbasiertes 3D-Auto-Arcadespiel für einen einzelnen Spieler. Der Spieler fährt durch eine stilisierte Region, absolviert schnelle Wegpunktfahrten und Rallye-Rennen, verdient dabei Geld und erweitert seine Fahrzeugsammlung.

Die erste Version soll unkompliziert im Browser starten und vor allem für den Besitzer des Projekts spielbar sein. Eine spätere Server-Komponente für gemeinsame Fahrten mit Freunden bleibt möglich, gehört aber nicht zur ersten Version.

## Ziele

- Direkt im Desktop-Browser spielbares 3D-Rennspiel.
- Arcade-Fahrgefühl mit Verfolgerkamera hinter dem Fahrzeug.
- Startkapital von 30.000 Euro und ein Mitsubishi Eclipse (1995) als Startfahrzeug.
- Garage als Startpunkt und zentrale Fahrzeugauswahl.
- Frei befahrbare, stilisierte Spielwelt, inspiriert von Unterwart, Oberwart, Pinkafeld und Großpetersdorf.
- Wegpunkt-Zeitfahrten als wiederholbare Einnahmequelle.
- Separate Rallye-Veranstaltung mit Fahrzeugklassen-Beschränkung.
- Geldpreise und Mystery-Boxen als Belohnungen.
- Fahrzeugkauf und Fahrzeugsammlung im Spielermenü.
- Lokales Speichern des Spielstands im Browser.
- Technische Trennung der Spiellogik, damit später ein Server ergänzt werden kann.

## Nicht-Ziele der ersten Version

- Exakte geografische oder fotorealistische Nachbildung der vier Orte.
- Realistische Fahrsimulation oder detailgetreue Fahrzeugmechanik.
- Online-Mehrspieler, Benutzerkonten oder zentral gespeicherte Spielstände.
- Fahrzeug-Tuning, Schäden, Polizei, Verkehr oder Fußgänger.
- Mobile beziehungsweise Touch-Steuerung.
- Umfangreiche Auswahl lizenzierter Fahrzeuge.
- Kauf von Inhalten mit echtem Geld.

## Anti-Ziele

Die erste Version gilt als verfehlt, wenn sie zwar viele Menüs oder Fahrzeuge enthält, das eigentliche Fahren aber keinen Spaß macht. Ebenso soll sie nicht durch eine zu große oder leere Welt, schwer kontrollierbare Simulation oder lange Ladezeiten unnötig kompliziert werden.

## Rahmenbedingungen

- Neue, derzeit leere Codebasis.
- Webanwendung für aktuelle Desktop-Browser.
- Tastatursteuerung mit W, A, S und D.
- Kleine erste Version, die später erweitert werden kann.
- Externe 3D-Modelle und Markenzeichen dürfen nur verwendet werden, wenn ihre Lizenz dies erlaubt. Während der Entwicklung kann ein selbst erstelltes, stilisiertes Modell den Mitsubishi darstellen.

## Betrachtete Ansätze

### Three.js, Rapier und TypeScript – ausgewählt

Three.js rendert die 3D-Welt, Rapier übernimmt Kollisionen und grundlegende Physik, und Vite stellt Entwicklungsserver und Produktions-Build bereit. Dieser Ansatz ist flexibel, leicht als normale Webseite auslieferbar und erlaubt eine klare Trennung zwischen Darstellung und Spiellogik. Dafür müssen die Spielsysteme selbst entwickelt werden.

### Babylon.js

Babylon.js bietet mehr integrierte Spielfunktionen und könnte einen schnellen Prototyp ermöglichen. Die Anwendung wäre jedoch stärker an die Struktur einer einzelnen Engine gebunden. Für das kleine, gezielt aufgebaute Spiel bietet der zusätzliche Umfang wenig Vorteil.

### Godot mit Web-Export

Godot besitzt einen komfortablen visuellen Editor und gute Szenenwerkzeuge. Sein Web-Export ist jedoch schwergewichtiger und weniger direkt in eine klassische Webanwendung integrierbar. Da die Browser-Auslieferung und eine spätere Web-Server-Anbindung wichtig sind, wurde dieser Ansatz nicht gewählt.

## Technischer Aufbau

Die Anwendung verwendet TypeScript, Vite, Three.js und Rapier. Die Hauptbereiche werden getrennt organisiert:

- **Simulation:** Fahrzeugzustand, Fahrbewegung, Kollisionen, Zeitmessung und Rennregeln.
- **Darstellung:** 3D-Szene, Kamera, Beleuchtung, Landschaft und Fahrzeuge.
- **Spielsysteme:** Geld, Garage, Händler, Besitz, Belohnungen und Mystery-Boxen.
- **Benutzeroberfläche:** Tachometer, Minikarte beziehungsweise Karte, Menüs und Rennanzeigen.
- **Speicherung:** Versionierter lokaler Spielstand im Browser.
- **Inhalte:** Fahrzeugwerte, Preise, Klassen und Rennkonfigurationen als Daten statt fest im Programmcode.

Diese Grenzen ermöglichen später, entscheidende Simulationen und Besitzdaten auf einen Server zu verschieben, ohne die gesamte Darstellung neu zu schreiben.

## Erste Spielwelt

Die erste Welt ist eine kompakte, stilisierte Testregion. Vier Bereiche tragen die Namen Unterwart, Oberwart, Pinkafeld und Großpetersdorf und werden durch Straßen verbunden. Sie sind keine maßstabsgetreuen Abbilder. Markante Schilder, unterschiedliche Landschaftsfarben und eine einfache Straßenführung machen die Bereiche erkennbar.

Die Garage liegt am Startpunkt. Eine eigene Rallye-Strecke befindet sich abseits der normalen Straßen. Unsichtbare Begrenzungen und Landschaftselemente verhindern, dass der Spieler die kleine Spielzone dauerhaft verlässt.

## Kern-Spielablauf

1. Der Spieler startet an der Garage mit 30.000 Euro und dem Eclipse von 1995.
2. Er wählt sein aktuelles Fahrzeug in der Garage.
3. In der freien Fahrt öffnet er die Karte und setzt einen erreichbaren Wegpunkt.
4. Sobald die Fahrt bestätigt wird, beginnt die Zeitmessung.
5. Der Spieler fährt so schnell wie möglich zum Ziel.
6. Bei Zielankunft erhält er abhängig von Strecke und Zeit Geld.
7. Das verdiente Geld kann im Fahrzeugmenü für weitere Autos ausgegeben werden.
8. Geeignete Fahrzeuge können an Rallye-Veranstaltungen teilnehmen.
9. Rallye-Siege vergeben Geld und gelegentlich eine Mystery-Box mit einem zufälligen Fahrzeug.

## Fahrzeug und Steuerung

Die Fahrzeuge verwenden bewusst vereinfachte Arcade-Physik:

- **W:** Beschleunigen und vorwärts fahren.
- **S:** Bremsen; bei Stillstand anschließend rückwärts fahren.
- **A/D:** Nach links beziehungsweise rechts lenken.
- Die Lenkung wird bei hoher Geschwindigkeit reduziert, um das Fahrzeug kontrollierbar zu halten.
- Das Fahrzeug erhält Bodenhaftung, begrenzte Höchstgeschwindigkeit und eine automatische Stabilisierung gegen unnötiges Umkippen.
- Eine Verfolgerkamera folgt weich hinter dem Auto und schaut in Fahrtrichtung.
- Falls das Fahrzeug feststeckt oder umkippt, kann es über eine zusätzliche Zurücksetzen-Funktion wieder auf die Straße gestellt werden. Die endgültige Taste legt die Umsetzung fest.

Das HUD zeigt mindestens Geschwindigkeit in km/h, aktuelles Geld und gegebenenfalls die laufende Zeitfahrt an.

## Wegpunkt-Zeitfahrten

Die Karte kann während der freien Fahrt geöffnet werden. Ein Klick auf einen gültigen Straßen- oder Geländepunkt setzt das Ziel. Nach Bestätigung startet die Zeitmessung. Ein sichtbarer Marker und eine einfache Richtungsanzeige führen zum Ziel.

Die Belohnung basiert auf der Entfernung und einer Zielzeit. Langsames Ankommen gibt eine kleine Grundbelohnung; schnelle Fahrten erhöhen sie. Abbrechen oder Zurücksetzen verhindert eine volle Belohnung. Die konkreten Werte werden beim Balancing festgelegt und als Konfigurationsdaten gespeichert.

## Rallye

Die Rallye ist ein vordefiniertes Rennen mit Kontrollpunkten und Ziel. Jedes Rallye-Event nennt erlaubte Fahrzeugklassen, beispielsweise Rallye oder Gelände. Ein ungeeignetes Fahrzeug kann das Event nicht starten.

Die erste Rallye besteht aus einem Rundkurs oder einer Punkt-zu-Punkt-Strecke, einer Zielzeit und einer festen Geldbelohnung. Ein Sieg kann zusätzlich eine Mystery-Box vergeben. Spätere Events können andere Klassen, Strecken und Belohnungen verwenden.

## Fahrzeuge, Händler und Garage

Fahrzeuge werden durch Daten beschrieben:

- Kennung und Anzeigename
- Kaufpreis
- Fahrzeugklasse
- Höchstgeschwindigkeit
- Beschleunigung
- Bremsleistung
- Lenkverhalten
- Geländeeignung
- Seltenheit
- 3D-Modell und Darstellung

Der Spieler besitzt zum Start den Mitsubishi Eclipse (1995). Das Startbudget bleibt zusätzlich bei 30.000 Euro. Im Fahrzeugmenü werden verfügbare und bereits besessene Autos angezeigt. Ein Kauf zieht den Preis ab und fügt das Auto dauerhaft zur Garage hinzu. Doppelte Mystery-Box-Gewinne werden entweder in Geld umgewandelt oder neu gezogen; für die erste Version wird die einfachere Geldumwandlung verwendet.

## Mystery-Boxen

Eine Mystery-Box wählt zufällig ein Fahrzeug aus einer konfigurierten Liste. Seltenheiten beeinflussen die Wahrscheinlichkeit. Das Ergebnis wird in einer kurzen Bildschirmsequenz angezeigt. Da es keine Echtgeldkäufe gibt, dient die Box ausschließlich als Spielbelohnung.

Zieht der Spieler ein bereits besessenes Fahrzeug, erhält er automatisch einen konfigurierten Anteil seines Kaufpreises als Geld.

## Speichern

Der lokale Spielstand enthält mindestens:

- Versionsnummer des Speicherformats
- Geldbestand
- besessene Fahrzeuge
- aktives Fahrzeug
- geöffnete beziehungsweise abgeschlossene Rennen
- optionale Bestzeiten

Ungültige oder alte Daten werden geprüft und, soweit möglich, migriert. Ein neuer Spielstand stellt das Anfangsbudget und den Eclipse wieder her.

## Fehler- und Randfälle

- Wegpunkte außerhalb der erlaubten Welt werden abgelehnt oder auf den nächsten gültigen Bereich gesetzt.
- Das aktive Fahrzeug kann nicht verkauft oder aus der Garage entfernt werden.
- Käufe ohne ausreichendes Geld werden blockiert.
- Rennen können nach Verlassen der Strecke oder Überspringen von Kontrollpunkten nicht erfolgreich beendet werden.
- Ein umgekipptes oder festgefahrenes Fahrzeug kann zurückgesetzt werden.
- Fehlende Modelle verwenden ein einfaches Ersatzfahrzeug, damit der Spielstand weiterhin geladen werden kann.

## Umfang der ersten spielbaren Version

Die erste spielbare Version umfasst:

- Eine kompakte 3D-Testwelt mit Garage, Straßen und Rallye-Strecke.
- Einen fahrbaren stilisierten Eclipse.
- Arcade-Steuerung und Verfolgerkamera.
- Tachometer und Geldanzeige.
- Eine Kartenansicht mit Wegpunkt-Zeitfahrt.
- Ein Rallye-Event mit Fahrzeugklassenprüfung.
- Garage und Händler mit wenigen Beispielsfahrzeugen.
- Geldbelohnungen und eine einfache Mystery-Box.
- Lokalen Spielstand.

## Spätere Server-Erweiterung

Eine spätere Version kann einen kleinen Server für Benutzerkonten, gemeinsame Sitzungen, synchronisierte Fahrzeuge und serverseitig geprüfte Belohnungen ergänzen. Für echtes Multiplayer-Fahren müssten Positionen regelmäßig synchronisiert und geglättet werden. Diese Funktionen werden in der ersten Version nicht vorgetäuscht oder teilweise eingebaut; es werden lediglich klare Schnittstellen zwischen Simulation, Besitzdaten und Darstellung eingehalten.

## Entscheidungen für die Umsetzung

Folgende Detailentscheidungen darf die Umsetzung treffen, ohne das Spieldesign zu ändern:

- Genaue Farben, Schriften und Menüanordnung.
- Konkrete Streckenführung der stilisierten Testwelt.
- Taste zum Zurücksetzen des Fahrzeugs und Öffnen der Karte.
- Anfangswerte für Geschwindigkeit, Preise, Belohnungen und Wahrscheinlichkeiten.
- Auswahl frei nutzbarer Platzhaltermodelle und Geräusche.
- Ob die erste Rallye ein Rundkurs oder eine Punkt-zu-Punkt-Strecke ist.

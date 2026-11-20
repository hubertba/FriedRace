# Fried Race

Ein kleines webbasiertes 3D-Arcade-Rennspiel mit lokal gespeicherten OpenStreetMap-Straßen für Unterwart, Oberwart, Pinkafeld, Oberschützen und Großpetersdorf.

## Starten

Voraussetzung: Node.js 22.19 oder neuer.

```bash
npm install
npm run dev
```

Den angezeigten lokalen Link in einem aktuellen Desktop-Browser öffnen.

## Steuerung

- **W:** beschleunigen
- **S:** bremsen und anschließend rückwärts fahren
- **A / D:** lenken
- **R:** Fahrzeug zurücksetzen
- **M:** Karte und Wegpunktwahl
- **G:** Garage öffnen, wenn das Auto an der Garage steht

## Spielablauf

Der Spielstand beginnt mit 30.000 Euro und einem stilisierten Mitsubishi Eclipse von 1995. Wegpunkt-Zeitfahrten bringen Geld. In der Garage können weitere Fahrzeuge gekauft und ausgewählt werden. Die Rallye akzeptiert nur Rallye- und Geländefahrzeuge und vergibt Geld sowie eine Mystery-Box. Doppelte Mystery-Fahrzeuge werden in Geld umgewandelt. Der Spielstand liegt versioniert im lokalen Browser-Speicher.

## OpenStreetMap-Daten

```bash
npm run map:import
```

Der Import lädt die Straßen nur während der Entwicklung über Overpass, validiert das verbundene Hauptstraßennetz und ersetzt `src/content/map/region.json` atomar. Das laufende Spiel verwendet ausschließlich diese lokale Datei. Kartendaten: © OpenStreetMap-Mitwirkende, bereitgestellt unter ODbL. Siehe <https://www.openstreetmap.org/copyright>.

## Tests und Build

```bash
npm test
npm run test:e2e
npm run build
```

## Assets und Marken

Die aktuelle Fahrzeugdarstellung besteht aus selbst erzeugten Platzhaltergeometrien. Externe Modelle, Texturen, Geräusche und Markenassets dürfen nur mit einer passenden Lizenz ergänzt werden. Der Fahrzeugname beschreibt die Spielidee; es werden keine Herstellerlogos oder fremden Modelle mitgeliefert.

## Spätere Erweiterung

Domänenlogik, Darstellung und Speicherung sind getrennt. Eine spätere Server-Komponente kann Profile, Belohnungen und Mehrspieler-Synchronisierung übernehmen, ohne die gesamte 3D-Darstellung neu aufzubauen.

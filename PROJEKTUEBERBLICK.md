# Projektueberblick: i7100 Label Print Prototype

Stand der Sichtung: 8. Maerz 2026

## Kurzfassung

Das Projekt ist ein schlanker lokaler Druck-Prototyp fuer zwei Anwendungsfaelle:

- Cross-Connect-Labels fuer einen Brady i7100
- Patch-Panel-Labels fuer einen Brother PT-P950

Die Loesung besteht aus zwei Teilen:

1. einem Tampermonkey-Userscript, das Daten aus Jarvis-Seiten liest und Druckbuttons in die UI einhaengt
2. einer kleinen Node.js/Express-API, die Requests validiert, Druckdaten erzeugt und optional direkt per Raw TCP an Netzwerkdrucker sendet

Der aktive Produktionspfad fuer den i7100 ist aktuell **JScript**, nicht ZPL. Fuer Patch-Panel-Labels wird **ESC/P** verwendet.

## Gesamtarchitektur

```text
Jarvis Webseite
  -> Tampermonkey Userscript
  -> POST /api/prototype/print
  -> Express API
  -> Payload-Erzeugung je Labeltyp
  -> Raw TCP auf Port 9100
  -> Primaerdrucker, bei Fehler optional Fallback-Drucker
```

## Was das Projekt konkret macht

### 1. Connect-/Cross-Connect-Workflow

Das Userscript erkennt Jarvis-Seiten mit "connect", liest dort unter anderem:

- Serial Number
- Final A-side System Name
- Final Z-side System Name
- Patch-Panel-Code auf A- und Z-Seite
- Port-A/Port-B-Werte

Aus diesen Daten baut es drei Textzeilen:

- `line1`: Seriennummer
- `line2`: A-Seite, Format ungefaehr `SYSTEM:CABINET:PANEL:PORTS`
- `line3`: Z-Seite, Format ungefaehr `SYSTEM:CABINET:PANEL:PORTS`

Danach zeigt das Script eine Vorschau mit Label-Anzahl an und sendet pro gewuenschtem Label einen API-Request.

### 2. Patch-Panel-Workflow

Auf Jarvis-Seiten mit "patch panel" wird ein zweiter Button eingeblendet. Dieser nutzt nur die Seriennummer bzw. Patch-Panel-Nummer und erstellt ein sehr kleines Label mit einer Zeile Text.

Im Simulationsmodus zeigt das Userscript hier nur eine lokale Vorschau. Im echten Druckmodus ruft es ebenfalls die API auf.

## Backend-Aufbau

### Einstiegspunkt

Die API lebt komplett in [`src/server.js`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/src/server.js).

Wesentliche Aufgaben:

- Express-App starten
- CORS und JSON-Parsing konfigurieren
- Request validieren
- Labeltyp und Protokoll pruefen
- Druckpayload erzeugen
- optional an Drucker senden
- strukturierte Fehlerantworten liefern

### API-Endpunkte

- `GET /health`
  - einfacher Healthcheck
- `GET /api/prototype/default-data`
  - liefert unterstuetzte Labeltypen, Protokolle und Default-Druckerwerte
- `POST /api/prototype/print`
  - Hauptendpunkt fuer Simulation und echten Druck

### Request-Verhalten

Der Print-Endpunkt unterstuetzt zwei Labeltypen:

- `i7100`
  - erwartet `data.line1`, `data.line2`, `data.line3`
  - erzwingt intern `jscript`
- `patch-panel`
  - erwartet `data.line1` oder alternativ `data.serial` / `data.value`
  - erzwingt intern `escp`

`simulate` ist standardmaessig aktiv, solange der Request nicht explizit `simulate: false` setzt.

## Druckprotokolle und Payload-Erzeugung

### i7100 / JScript

Die Erzeugung liegt in [`src/jscript.js`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/src/jscript.js).

Das Modul:

- rechnet mm in Druckerpunkte um
- escaped Texte fuer den JScript-Interpreter
- erzeugt ein Label mit:
  - 38.1 mm Breite
  - 101.6 mm Gesamthoehe
  - 50.8 mm aktivem Druckbereich
  - drei Textzeilen oben
  - Trennlinie in der Mitte
  - QR-Code unten

Der QR-Inhalt faellt standardmaessig auf `line2` zurueck, falls kein `qrPayload` mitgegeben wird.

### Patch-Panel / ESC/P

Die Erzeugung liegt in [`src/ptouch.js`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/src/ptouch.js).

Das Modul:

- nimmt genau einen Textwert
- entfernt problematische Steuerzeichen
- baut einen sehr einfachen ESC/P-Bytestrom
- sendet `ESC @`, dann ASCII-Text, danach `CR LF FF`

### Vorhandene, aber derzeit nicht aktive ZPL-Unterstuetzung

In [`src/zpl.js`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/src/zpl.js) existieren Generatoren fuer ZPL-Labels. Diese werden aktuell vom Server **nicht** benutzt.

Wichtig:

- Legacy-Protokollwerte wie `zpl` oder `zpl-emulation` werden im Server auf `jscript` umgebogen
- dadurch bleibt alte Request-Kompatibilitaet erhalten, obwohl der aktive Pfad heute JScript ist

## Druckversand

Die Netzwerkkommunikation steckt in [`src/printerClient.js`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/src/printerClient.js).

Verhalten:

- direkter TCP-Socket auf Port 9100
- 5 Sekunden Timeout pro Versuch
- zuerst Primaerdrucker
- bei Fehler optional Fallback-Drucker
- Rueckgabe mit Ziel-IP, Dauer und Fallback-Info

Wenn beide Drucker fehlschlagen, antwortet die API mit `502`.

## Tampermonkey-Userscript

Das groesste Einzelartefakt ist [`scripts/i7100-tampermonkey-prototype.user.js`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/scripts/i7100-tampermonkey-prototype.user.js) mit gut 1000 Zeilen.

Seine Aufgaben:

- nur auf `jarvis-emea.equinix.com` aktiv werden
- DOM-Struktur der Jarvis-Seiten beobachten
- Buttons dynamisch einfuegen oder entfernen
- Daten ueber CSS-Selektoren auslesen
- Vorschau-Dialoge anzeigen
- per `GM_xmlhttpRequest` gegen die lokale API posten

Auffaelligkeiten:

- Konfiguration sitzt zentral in `USER_CONFIG` und `CONFIG`
- `SIMULATE_MODE` steht aktuell auf `true`
- fuer Connect-Labels gibt es eine Mengensteuerung fuer mehrere Ausdrucke
- fuer Patch-Panel gibt es im Simulationsmodus nur eine lokale Vorschau ohne API-Call

## Wichtige Dateien im Projekt

- [`README.md`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/README.md)
  - fachliche Einordnung, Startanleitung, Beispielaufrufe
- [`package.json`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/package.json)
  - minimales Node-20-Projekt mit `express` und `cors`
- [`examples/request.simulate.json`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/examples/request.simulate.json)
  - Beispiel fuer i7100-Simulation
- [`examples/request.print.json`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/examples/request.print.json)
  - Beispiel fuer echten i7100-Druck
- [`examples/request.patch-panel.simulate.json`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/examples/request.patch-panel.simulate.json)
  - Beispiel fuer Patch-Panel-Simulation
- [`examples/request.patch-panel.print.json`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/examples/request.patch-panel.print.json)
  - Beispiel fuer echten Patch-Panel-Druck
- [`docker/Dockerfile`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/docker/Dockerfile)
  - Container-Build mit `node:20-alpine`
- [`podman-compose.yml`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/podman-compose.yml)
  - Build-basierter Compose-Start
- [`portainer-stack.yml`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/portainer-stack.yml)
  - Image-basierter Stack fuer Portainer

## Betrieb und Deployment

### Lokal

- Start ueber `npm start`
- Dev-Modus ueber `npm run dev`
- Default-Port: `5100`

### Container

Das Image enthaelt nur die Laufzeitbestandteile:

- `package.json`
- `package-lock.json`
- `src/`

Die Datei [`.dockerignore`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/.dockerignore) schliesst unter anderem `node_modules`, `scripts`, `examples` und `*.md` aus dem Build-Kontext aus.

## Konfiguration

Wichtige Umgebungsvariablen des Backends:

- `HOST`
- `PORT`
- `CORS_ORIGIN`
- `PRIMARY_PRINTER_IP`
- `FALLBACK_PRINTER_IP`
- `PRINTER_PORT`

Im Userscript sind zusaetzlich hinterlegt:

- `apiUrl`
- `primaryPrinterIp`
- `fallbackPrinterIp`
- `patchPanelPrinterIp`
- `printerPort`
- `SIMULATE_MODE`

## Mitgelieferte Referenzdokumente

Im Repository liegen zwei PDF-Handbuecher:

- [`cab_programming_manual_jscript.pdf`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/cab_programming_manual_jscript.pdf)
  - neueres cab-JScript-Handbuch
  - Ausgabe 11/2024
  - 376 Seiten
  - laut Titelseiten fuer Firmware 5.45.2
- [`programming_manual_x4.pdf`](/home/pc/Schreibtisch/i7100/i7100-label-print-prototype/programming_manual_x4.pdf)
  - aelteres JScript-Handbuch fuer SQUIX und MACH 4S
  - 2018
  - 587 Seiten
  - beschreibt Funktionen ab Firmware 5.19

Diese PDFs sind im aktuellen Code nicht automatisch eingebunden, dienen aber klar als Nachschlagewerk fuer cab-JScript-Befehle und Druckerfunktionen.

## Beobachtungen zum aktuellen Stand

- Das Projekt ist eher ein pragmatischer Prototyp als ein allgemeines Produkt.
- Es gibt keine automatisierten Tests.
- Es gibt keine Authentifizierung; die API ist fuer ein lokales/vertrautes Netz gedacht.
- `CORS_ORIGIN` steht standardmaessig offen auf `*`.
- Die Browserintegration haengt stark an konkreten Jarvis-CSS-Selektoren; DOM-Aenderungen koennen den Workflow leicht brechen.
- `src/zpl.js` und `buildPatchPanelJScript` sind vorbereitet, aber derzeit ungenutzt.
- Das Backend ist bewusst klein und dadurch gut nachvollziehbar.

## Fazit

Fachlich ist das Projekt ein Bruecken-Prototyp zwischen Jarvis, einer lokalen Druck-API und zwei Netzwerkdruckern. Die Kernidee ist sauber und einfach:

- Daten im Browser abgreifen
- streng validieren
- druckerspezifische Payload erzeugen
- direkt per TCP an den Drucker schicken

Fuer einen Prototyp ist der Aufbau gut lesbar und zweckmaessig. Die groesste Komplexitaet liegt nicht im Backend, sondern im Tampermonkey-Script und dessen Abhaengigkeit von der Jarvis-DOM-Struktur.

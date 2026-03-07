# i7100 Label Print Prototype (Standalone)

Dieses Projekt ist ein vollständig eigenständiger lokaler Prototyp.

## Ziel
- Tampermonkey-Button in beliebiger Webseite injizieren
- Tampermonkey sammelt Daten aus Jarvis und sendet an die API
- API validiert die Daten streng (keine Testdaten/Fallback-Werte)
- i7100: ZPL via Raw TCP (Port 9100)
- PT-P950: ESC/P via Raw TCP

## Label-Layout (aus deiner Vorgabe)
- Breite: 38.1mm
- Höhe: 101.6mm
- aktiver Druckbereich: 50.8mm
- umklappbar, hälftig: 25.4mm + 25.4mm
- oben: 3 Textzeilen (mittig)
- Trennstrich in der Mitte
- unten: QR-Code (mittig)

## Endpunkte
- `GET /health`
- `GET /api/prototype/default-data`
- `POST /api/prototype/print`

### `POST /api/prototype/print`
- `simulate: true` (Default): erzeugt nur Render-Daten + Metadaten
- `simulate: false`: sendet an den Drucker mit passendem Protokoll je `labelType`
- `labelType: i7100`
  - erforderliche Felder: `data.line1`, `data.line2`, `data.line3`
  - Protokoll: `zpl`
  - Default-Drucker: `10.145.162.22` (Fallback `10.145.162.32`)
- `labelType: patch-panel`
  - erforderliches Feld: `data.line1` (alternativ `data.serial` oder `data.value`)
  - Protokoll: `escp`
  - typischer Drucker: PT-P950 (`10.145.162.23`)

### Lesbare Fehlerantworten
- Bei unvollstaendigen Daten gibt die API `422` zurueck mit:
  - `error.message` (direkt fuer UI lesbar)
  - `error.fields` (betroffene Request-Felder)

## Lokal starten
1. `cd "c:\Users\Simaxe\GitHub Repos\i7100-label-print-prototype"`
2. `npm install`
3. `npm start`

## Test mit curl (Simulation)
PowerShell:
`Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/api/prototype/print" -ContentType "application/json" -InFile ".\examples\request.simulate.json"`

Patch-Panel Simulation:
`Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/api/prototype/print" -ContentType "application/json" -InFile ".\examples\request.patch-panel.simulate.json"`

## Test mit echtem Druck
- in `examples/request.print.json` bleibt `simulate: false`
- dann senden:
`Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/api/prototype/print" -ContentType "application/json" -InFile ".\examples\request.print.json"`

Patch-Panel Druck:
`Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/api/prototype/print" -ContentType "application/json" -InFile ".\examples\request.patch-panel.print.json"`

## Podman/Portainer
- Compose-Datei: `podman-compose.yml`
- Dockerfile: `docker/Dockerfile`

### Warum der Fehler `lstat /data/compose/.../docker: no such file or directory` auftritt
Wenn du im Portainer **Stack Web-Editor** nur YAML einfügst, liegt im Build-Kontext nur diese eine Datei.
Die Ordner `docker/` und `src/` fehlen dort, daher kann `build` nicht funktionieren.

### Deployment-Variante A (empfohlen für lokale Entwicklung)
1. Auf dem Raspberry Pi im Projektordner einmalig Image bauen:
  `docker build -t i7100-print-prototype:local -f docker/Dockerfile .`
2. In Portainer Stack dann **ohne build** deployen mit `portainer-stack.yml`.

### Deployment-Variante B (automatischer Build in Portainer)
- In Portainer `Deploy from Git repository` verwenden,
- damit Portainer den vollständigen Projektinhalt (`docker/`, `src/`, `package.json`) auscheckt.

Beispiel lokal:
1. `podman compose -f podman-compose.yml up -d --build`
2. `podman compose -f podman-compose.yml logs -f`

Für Portainer Stack kannst du den Inhalt von `podman-compose.yml` direkt verwenden.
Für den Portainer Web-Editor ohne Git verwende stattdessen `portainer-stack.yml`.

## Tampermonkey-Prototyp
- Datei: `scripts/i7100-tampermonkey-prototype.user.js`
- in Tampermonkey als neues Script importieren
- sammelt Daten im Browser und sendet sie an `POST /api/prototype/print`
- Tampermonkey ist nur fuer Datenerhebung/Absenden zustaendig, die Drucklogik liegt im Backend

Wenn API auf VM läuft:
- im Userscript `CONFIG.apiUrl` auf VM-URL anpassen
- zusätzlich passende `@connect` Hosteinträge ergänzen

## Hinweis zu macOS ohne Treiber
Da direkt per TCP (`9100`) gedruckt wird, ist kein nativer macOS-Druckertreiber noetig.
- Voraussetzung i7100: ZPL-Emulator aktiv
- Voraussetzung PT-P950: ESC/P ueber Netzwerk muss unterstuetzt/aktiviert sein

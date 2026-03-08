# Projektueberblick: i7100 Label Print

Stand: 8. Maerz 2026

## Architektur
1. Tampermonkey-Script liest Daten aus Jarvis.
2. Script sendet an `POST /api/label/print`.
3. Node/Express validiert Daten und erzeugt Druckpayload.
4. Versand per Raw TCP (Port 9100) an Primaerdrucker, optional Fallback.

## Labeltypen
- `i7100`:
  - Pflicht: `line1`, `line2`, `line3`
  - Ausgabe: cab JScript
- `patch-panel`:
  - Pflicht: `line1` (oder `serial`/`value`)
  - Ausgabe: ESC/P

## Wichtige Dateien
- `src/server.js` API und Routing
- `src/jscript.js` i7100 JScript-Generator
- `src/ptouch.js` Patch-Panel ESC/P-Generator
- `src/printerClient.js` TCP-Versand mit Fallback
- `scripts/i7100-tampermonkey.user.js` Browser-Integration
- `examples/*.json` Beispiel-Requests

## API-Endpunkte
- `GET /health`
- `GET /api/label/default-data`
- `POST /api/label/print`

## Betrieb
- Lokal: `npm start`
- Container: `podman-compose.yml` / `portainer-stack.yml`

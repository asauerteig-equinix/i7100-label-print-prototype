# i7100 Label Print

Lokaler Label-Druckdienst fuer:
- Brady i7100 (JScript via Raw TCP 9100)
- Brother PT-P950 (ESC/P via Raw TCP 9100)

## API
- `GET /health`
- `GET /api/label/default-data`
- `POST /api/label/print`

### `POST /api/label/print`
- `simulate: true` (Default): nur Render-/Metadaten
- `simulate: false`: echter Druck
- `labelType: i7100`
  - Pflichtfelder: `data.line1`, `data.line2`, `data.line3`
  - Protokoll: `jscript`
- `labelType: patch-panel`
  - Pflichtfeld: `data.line1` (alternativ `data.serial`/`data.value`)
  - Protokoll: `escp`

## Lokal starten
1. `npm install`
2. `npm start`

Optional fuer Brady i7100 X-Feintuning:
- `HARDWARE_X_ORIGIN_MM=2.5` ist der Default fuer die globale Links/Rechts-Korrektur.
- Bei Feintuning in `0.5`-mm-Schritten anpassen.

## Test (PowerShell)
Simulation:
`Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5100/api/label/print" -ContentType "application/json" -InFile ".\examples\request.simulate.json"`

Echter Druck:
`Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5100/api/label/print" -ContentType "application/json" -InFile ".\examples\request.print.json"`

Patch-Panel Simulation:
`Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5100/api/label/print" -ContentType "application/json" -InFile ".\examples\request.patch-panel.simulate.json"`

Patch-Panel Druck:
`Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5100/api/label/print" -ContentType "application/json" -InFile ".\examples\request.patch-panel.print.json"`

## Tampermonkey
- Script: `scripts/i7100-tampermonkey.user.js`
- Sendet Requests an `POST /api/label/print`
- In der Script-Konfiguration `CONFIG.apiUrl` auf Zielhost anpassen

## Container
- Build/Run lokal: `podman compose -f podman-compose.yml up -d --build`
- Portainer ohne Build: `portainer-stack.yml` mit lokal gebautem Image `i7100-label-print:local`

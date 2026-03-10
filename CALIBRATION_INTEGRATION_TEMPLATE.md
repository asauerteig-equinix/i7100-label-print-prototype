# i7100 Calibration Integration Template

Diese Vorlage beschreibt die konkrete Integration, wie sie in `mini-i7100-adjust` umgesetzt wurde, damit sie 1:1 in ein anderes Projekt uebernommen werden kann.

## Zielbild

- Labelformat: `38.1mm x 101.6mm`
- Globaler Hardware-X-Shift: `+2.5mm` (damit links/rechts sauber auf dem Medium liegen)

## 1) Backend: JScript-Generator anpassen

### Pflichtpunkte

1. Label-Nennmasse verwenden:
   - `nominalWidthMm = 38.1`
   - `heightMm = 101.6`
2. Globalen X-Offset ueber `S`-Befehl setzen:
   - `hardwareXOriginMm = 2.5` als Default
   - optional per Env ueberschreibbar: `HARDWARE_X_ORIGIN_MM`
   - `S l1;<xo>,0,<h>,<h>,<w>`
3. Keine per-element "Breiten-Tricks" (`+2mm/+3mm` auf Labelbreite) verwenden.

### Referenz-Snippet (entscheidender Teil)

```text
S l1;2.50,0,101.6,101.6,38.1
```

Der `xo`-Wert verschiebt den gesamten Job nach rechts und ist die zentrale Hardware-Korrektur.

### Service-Umgebung

- Optional konfigurierbar:
  - `HARDWARE_X_ORIGIN_MM=2.5`

Wenn nicht gesetzt, ist `2.5` als Backend-Default aktiv.

## 6) Abnahme-Check (muss nach Deploy sichtbar sein)

1. Linke und rechte vertikale Rahmenlinie sind sichtbar.
2. `CALIBRATION` ist links nicht abgeschnitten.
3. `SIZE 38.1X101.6MM` ist vollstaendig (inkl. letztem `M`).
4. Rechts bleibt kein signifikanter ungenutzter Rand (>1mm), sofern `HARDWARE_X_ORIGIN_MM` passt.
5. In Userscript-Vorschau wird der erwartete Backend-Host angezeigt.

## 7) Feintuning-Regel

- Wenn links abgeschnitten und rechts viel Platz: `HARDWARE_X_ORIGIN_MM` erhoehen (`+0.5` Schritte).
- Wenn rechts abgeschnitten und links viel Platz: `HARDWARE_X_ORIGIN_MM` verringern (`-0.5` Schritte).
- Immer nur **einen** Parameter je Iteration aendern.

## 8) Warum diese Strategie stabil ist

- Job-Shift auf `S`-Ebene korrigiert die Hardwarelage global.
- Elementweise Offsets fuehren oft zu inkonsistenten Effekten.
- Nominalrahmen macht sofort sichtbar, ob die Geometrie oder nur Text betroffen ist.


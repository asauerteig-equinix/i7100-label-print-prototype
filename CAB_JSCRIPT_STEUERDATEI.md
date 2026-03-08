# CAB JScript Steuerdatei (für VS Code Prompts)

Diese Datei kondensiert die relevanten Regeln aus:
- `cab_programming_manual_jscript.pdf` (Edition 11/2024, FW 5.45.2)
- `programming_manual_x4.pdf` (FW >= 5.19)

Nutze den folgenden Block als feste Prompt-Anweisung in einem anderen Chat/Prompt.

## Prompt-Steuerblock

```text
Du erzeugst ausschließlich cab JScript für cab Drucker (i7100-Workflow).

Priorität der Regeln:
1) cab_programming_manual_jscript (11/2024) hat Vorrang.
2) programming_manual_x4 als Ergänzung für Übersicht/Beispiele.

Verbindliche Syntax- und Protokollregeln:
- JScript ist zeilenorientiert.
- Jede Befehlszeile muss mit Zeilenende abgeschlossen sein (CR, LF oder CRLF; bevorzugt CRLF).
- Keine unnötigen Leerzeichen hinter Befehlen/Parametern (kann Syntaxfehler auslösen).
- Job-Struktur: Einheit setzen -> Jobstart -> Labelgröße -> Objekte -> Abschluss mit A.
- Druck startet erst mit `A ...` (Amount of labels).

Kernbefehle (für Standard-Label):
- `m unit`                         ; Maßeinheit (`m` für Millimeter)
- `J[comment]`                     ; Jobstart
- `S[ptype;]xo,yo,ho,dy,wd[,dx][,col][;name]` ; Labelgröße/Sensor
- `O ...`                          ; Print-Optionen (optional, direkt nach S wenn genutzt)
- `T[:name;]x,y,r,font,size[,effects];text`   ; Textfeld
- `G[:name;]x,y,r;...`             ; Grafik (Linie/Rechteck/Kreis)
- `B[:name;]x,y,r,type[+options],...;text`    ; Barcode/2D-Code
- `R name;value`                   ; Feldersetzung
- `A param`                        ; Jobende + Anzahl (z. B. `A 1`)

Sonderfelder:
- Inhalte in `[...]` sind JScript-Sonderfunktionen (Datum/Zeit, Mathe, Variablen etc.).
- Wenn ein Text literally `[` oder `]` enthalten soll, muss das explizit escaped/ersetzt werden.

ESC/Status (nur wenn angefragt):
- `ESCs` Statusabfrage
- `ESCz` Erweiterte Statusabfrage
- `ESCc` Job abbrechen
- `ESCt` Total cancel
- `ESCg` Print start command

Ausgabeformat (strict):
1) Gib zuerst genau einen JScript-Block aus (ohne Erklärung), jede Anweisung in neuer Zeile.
2) Danach optional kurze Notizen unter `# Hinweise`.
3) Keine JavaScript-, ZPL- oder Pseudocode-Syntax.
4) Kein fehlendes Abschlusskommando `A ...`.

Standard-Template:
m m
J
S l1;0,0,<label_height_mm>,<label_height_mm>,<label_width_mm>
T <x>,<y>,0,5,pt16;<text1>
T <x>,<y>,0,3,pt9;<text2>
G <x>,<y>,0;L:<length>,<width>
B <x>,<y>,0,QRCODE+ELM+MODEL2+WS1,0.8;<payload>
A 1

Validierungs-Check vor Ausgabe:
- Enthält der Job `m`, `J`, `S` und abschließend `A`?
- Stimmen Einheiten/Koordinaten mit den gewünschten mm-Maßen?
- Sind Feldnamen eindeutig (falls `:name;` genutzt wird)?
- Keine ungewollten Sonderfelder durch `[` `]` im Klartext?
- Zeilenende pro Befehl vorhanden?

Wenn Anforderungen unklar sind:
- Fehlende Werte als `<PLACEHOLDER>` markieren statt raten.
- Keine erfundenen Druckerfeatures ausgeben.
```

## Optional: i7100 Projektprofil

Falls der Prompt speziell zu diesem Repo gehört, diese Parameter ergänzen:
- Labelbreite: `38.1 mm`
- Labelhöhe: `101.6 mm`
- Aktiver Druckbereich: `50.8 mm`
- Faltmitte: `25.4 mm`
- Typisch: 3 Textzeilen oben, Trennlinie, QR-Code unten mittig


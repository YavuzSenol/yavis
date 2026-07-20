@echo off
chcp 65001 >nul
setlocal
rem ============================================================
rem  YAVIS - Ein-Klick-Ordner einrichten
rem  Kein Administrator noetig. Gilt fuer diesen Windows-Benutzer.
rem  Einfach diese Datei doppelklicken. Auf jedem PC EINMAL ausfuehren.
rem ============================================================

set "QUELLE=%~dp0YavisOrdner.cs"
set "ZIEL=%LOCALAPPDATA%\YAVIS"
set "EXE=%ZIEL%\YavisOrdner.exe"
set "CSC=%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

echo.
echo   YAVIS - Ordner-Oeffner wird eingerichtet...
echo.

if not exist "%QUELLE%" (
  echo   [FEHLER] Die Datei YavisOrdner.cs wurde nicht gefunden.
  echo   Sie muss im selben Ordner liegen wie diese .bat-Datei.
  echo.
  pause
  exit /b 1
)
if not exist "%CSC%" (
  echo   [FEHLER] Der Windows-eigene C#-Compiler wurde nicht gefunden:
  echo   %CSC%
  echo.
  pause
  exit /b 1
)

if not exist "%ZIEL%" mkdir "%ZIEL%"

rem --- Handler-Programm bauen (der Compiler gehoert zu Windows, nichts wird geladen) ---
rem  WICHTIG: Der Handler MUSS eine echte .exe sein. Mit einem Skript-Aufruf
rem  (powershell -File ...) bricht Chrome den Protokoll-Start KOMMENTARLOS ab -
rem  es kommt nicht einmal die uebliche Rueckfrage. Aus genau diesem Grund liefern
rem  Zoom, Teams & Co. ein eigenes kleines Programm mit.
rem  Gefunden am 20.07.2026 auf dem Buero-PC mit Chrome 150.
echo   Baue das Handler-Programm ...
"%CSC%" /nologo /target:winexe /optimize+ /out:"%EXE%" "%QUELLE%"
if not exist "%EXE%" (
  echo   [FEHLER] Das Handler-Programm konnte nicht gebaut werden.
  echo.
  pause
  exit /b 1
)

rem --- Protokoll yavis-ordner: fuer diesen Benutzer registrieren (HKCU, kein Admin) ---
reg add "HKCU\Software\Classes\yavis-ordner" /ve /t REG_SZ /d "URL:YAVIS Ordner" /f >nul
reg add "HKCU\Software\Classes\yavis-ordner" /v "URL Protocol" /t REG_SZ /d "" /f >nul
reg add "HKCU\Software\Classes\yavis-ordner" /v "FriendlyTypeName" /t REG_SZ /d "YAVIS Ordner-Oeffner" /f >nul
reg add "HKCU\Software\Classes\yavis-ordner\DefaultIcon" /ve /t REG_SZ /d "%EXE%,0" /f >nul
reg add "HKCU\Software\Classes\yavis-ordner\shell\open\command" /ve /t REG_SZ /d "\"%EXE%\" \"%%1\"" /f >nul

if errorlevel 1 (
  echo   [FEHLER] Der Registry-Eintrag konnte nicht gesetzt werden.
  echo.
  pause
  exit /b 1
)

echo   ============================================
echo    FERTIG! Der Ein-Klick-Ordner ist auf
echo    diesem PC eingerichtet.
echo   ============================================
echo.
echo   In YAVIS bei einer Person/Firma auf
echo   "Bearbeiten" gehen, unter "Ordner (OneDrive)"
echo   den Pfad hinterlegen und speichern.
echo   Danach erscheint oben der Knopf
echo   "Ordner oeffnen".
echo.
echo   (Beim allerersten Klick fragt Chrome einmal
echo    "YAVIS oeffnen?" - dort "Immer erlauben" waehlen.)
echo.
echo   FALLS CHROME GAR NICHTS TUT und auch NICHT nachfragt:
echo   Dann fehlt in Chrome die Freigabe fuer die Seite. Chrome schliessen
echo   (auch im Task-Manager pruefen) und in der Datei
echo     %%LOCALAPPDATA%%\Google\Chrome\User Data\Default\Preferences
echo   unter  protocol_handler / allowed_origin_protocol_pairs
echo   bei  "https://yavuzsenol.github.io"  den Eintrag
echo     "yavis-ordner": true
echo   ergaenzen. Danach Chrome starten - der Knopf funktioniert.
echo   (Genau so am 20.07.2026 auf dem Buero-PC geloest.)
echo.
pause

@echo off
chcp 65001 >nul
setlocal
rem ============================================================
rem  YAVIS - Ein-Klick-Ordner einrichten
rem  Kein Administrator noetig. Gilt fuer diesen Windows-Benutzer.
rem  Einfach diese Datei doppelklicken. Auf jedem PC EINMAL ausfuehren.
rem ============================================================

set "SRC=%~dp0yavis_ordner_oeffnen.ps1"
set "ZIEL=%LOCALAPPDATA%\YAVIS"

echo.
echo   YAVIS - Ordner-Oeffner wird eingerichtet...
echo.

if not exist "%SRC%" (
  echo   [FEHLER] Die Datei yavis_ordner_oeffnen.ps1 wurde nicht gefunden.
  echo   Sie muss im selben Ordner liegen wie diese .bat-Datei.
  echo.
  pause
  exit /b 1
)

if not exist "%ZIEL%" mkdir "%ZIEL%"
copy /y "%SRC%" "%ZIEL%\yavis_ordner_oeffnen.ps1" >nul
if errorlevel 1 (
  echo   [FEHLER] Konnte den Helfer nicht nach "%ZIEL%" kopieren.
  echo.
  pause
  exit /b 1
)

rem --- Protokoll yavis-ordner: fuer diesen Benutzer registrieren (HKCU, kein Admin) ---
reg add "HKCU\Software\Classes\yavis-ordner" /ve /t REG_SZ /d "URL:YAVIS Ordner" /f >nul
reg add "HKCU\Software\Classes\yavis-ordner" /v "URL Protocol" /t REG_SZ /d "" /f >nul
reg add "HKCU\Software\Classes\yavis-ordner\shell\open\command" /ve /t REG_EXPAND_SZ /d "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%%LOCALAPPDATA%%\YAVIS\yavis_ordner_oeffnen.ps1\" \"%%1\"" /f >nul

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
pause

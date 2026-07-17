@echo off
rem Startet das Umbenenn-Skript. Zeigt zuerst nur eine Vorschau -
rem umbenannt wird erst, wenn du im Fenster "JA" tippst.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kandidaten_umbenennen.ps1"

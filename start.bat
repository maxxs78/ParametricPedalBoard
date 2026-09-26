@echo off
rem Startet einen lokalen Webserver und oeffnet den Konfigurator im Browser.
cd /d "%~dp0"
start "" http://localhost:8123/
python -m http.server 8123

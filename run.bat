@echo off
title Satria Celular - Warehouse & Servis HP
echo ========================================================
echo   SATRIA CELULAR - WAREHOUSE & SERVICE MANAGEMENT SYSTEM
echo ========================================================
echo.

cd /d "%~dp0"

IF NOT EXIST ".venv\Scripts\python.exe" (
    echo [INFO] Menyiapkan environment Python...
    python -m venv .venv
    echo [INFO] Menginstall modul Flask...
    .\.venv\Scripts\pip install -r requirements.txt
)

echo [INFO] Memulai server Satria Celular di http://localhost:5000 ...
echo [INFO] Tekan Ctrl+C untuk menghentikan server.
echo.

start "" "http://localhost:5000"
.\.venv\Scripts\python.exe app.py

pause

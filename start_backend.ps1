$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    Write-Host "Virtual environment Python not found at $pythonExe" -ForegroundColor Red
    Write-Host "Create the venv and install requirements first." -ForegroundColor Yellow
    exit 1
}

if (-not $env:ENABLE_SERIAL) {
    $env:ENABLE_SERIAL = "1"
}

if (-not $env:SERIAL_PORT) {
    $env:SERIAL_PORT = "COM3"
}

if (-not $env:BAUD_RATE) {
    $env:BAUD_RATE = "115200"
}

Write-Host "Starting Smart Saline backend..." -ForegroundColor Cyan
Write-Host "Project: $projectRoot"
Write-Host "Serial enabled: $env:ENABLE_SERIAL"
Write-Host "Serial port: $env:SERIAL_PORT"
Write-Host "Baud rate: $env:BAUD_RATE"
Write-Host "Camera enabled: $($env:ENABLE_CAMERA -eq '1')"
Write-Host ""
Write-Host "Open http://127.0.0.1:5000/logs after startup." -ForegroundColor Green
Write-Host ""

& $pythonExe app.py

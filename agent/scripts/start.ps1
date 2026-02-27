# Start SoloClaw agent + ngrok
# Kør: .\scripts\start.ps1  eller  pwsh .\scripts\start.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== SoloClaw Agent ===" -ForegroundColor Cyan
Write-Host "Starter server..." -ForegroundColor Yellow
Start-Process -FilePath "node" -ArgumentList "dist/server.js" -WorkingDirectory (Get-Location) -NoNewWindow -PassThru | Out-Null
Start-Sleep -Seconds 3

$health = $null
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3456/health" -TimeoutSec 5 -ErrorAction Stop
} catch {}

if ($health -and $health.ok) {
    Write-Host "Agent kører pa http://localhost:3456" -ForegroundColor Green
} else {
    Write-Host "Agent startet (health-check fejlede)" -ForegroundColor Yellow
}

Write-Host "`nStarter ngrok..." -ForegroundColor Yellow
Write-Host "Kopier URL'en nedenfor og sæt den i Vercel: AGENT_BACKEND_URL" -ForegroundColor Cyan
Write-Host ""

Start-Process -FilePath "npx" -ArgumentList "ngrok", "http", "3456" -NoNewWindow
Start-Sleep -Seconds 4

try {
    $ngrok = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 3
    $url = $ngrok.tunnels[0].public_url
    Write-Host "NGROK URL: $url" -ForegroundColor Green
    Write-Host "Sæt i Vercel: AGENT_BACKEND_URL = $url" -ForegroundColor Cyan
} catch {
    Write-Host "Åbn http://127.0.0.1:4040 for at se ngrok URL" -ForegroundColor Yellow
}

Write-Host "`nTryk Ctrl+C for at stoppe" -ForegroundColor Gray

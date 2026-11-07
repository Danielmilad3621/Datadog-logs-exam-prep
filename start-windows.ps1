$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Please install Node.js LTS: https://nodejs.org/en/download" -ForegroundColor Yellow
  exit 1
}
Write-Host "Node version: $(node --version)" -ForegroundColor Cyan
Write-Host "Installing project dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Open http://localhost:3000" -ForegroundColor Green
npm run dev

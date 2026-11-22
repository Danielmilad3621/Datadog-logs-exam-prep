$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Please install Node.js LTS from https://nodejs.org/en/download' -ForegroundColor Yellow
  exit 1
}
if (-not (Test-Path -LiteralPath 'node_modules')) {
  npm.cmd ci
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Write-Host 'Open the local URL printed by Vite. Sign in with your Google account.' -ForegroundColor Green
npm.cmd run dev -- --host 127.0.0.1 --port 5184 --strictPort
exit $LASTEXITCODE

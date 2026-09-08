# Builds the distributable "local agent" folder + zip for employees who don't have Node.js.
# Bundles a portable Node.js runtime (no install needed) + the compiled agent code + a pruned
# playwright-only node_modules, and wraps it with a double-clickable .bat launcher.
#
# Usage: npm run agent:build  (or: powershell -ExecutionPolicy Bypass -File agent/build-dist.ps1)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$nodeVersion = "v20.18.1"
$distDir = "agent-exe\dist"
$nodeCacheZip = "agent-exe\node-portable-cache.zip"

Write-Host "1/6 Compiling agent TypeScript..."
if (Test-Path "agent-dist") { Remove-Item "agent-dist" -Recurse -Force }
npx tsc -p tsconfig.agent.json
if ($LASTEXITCODE -ne 0) { throw "tsc failed" }

Write-Host "2/6 Resetting dist folder..."
$cacheTmp = $null
if (Test-Path $nodeCacheZip) {
    $cacheTmp = Join-Path $env:TEMP "node-portable-cache-$(Get-Random).zip"
    Move-Item $nodeCacheZip $cacheTmp
}
if (Test-Path "agent-exe") { Remove-Item "agent-exe" -Recurse -Force }
New-Item -ItemType Directory -Path $distDir -Force | Out-Null
if ($cacheTmp) { Move-Item $cacheTmp $nodeCacheZip }

Write-Host "3/6 Fetching portable Node.js runtime..."
if (-not (Test-Path $nodeCacheZip)) {
    Invoke-WebRequest -Uri "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-win-x64.zip" -OutFile $nodeCacheZip
}
Expand-Archive -Path $nodeCacheZip -DestinationPath $distDir
Rename-Item "$distDir\node-$nodeVersion-win-x64" "node"

Write-Host "4/6 Copying compiled app code..."
New-Item -ItemType Directory -Path "$distDir\app" -Force | Out-Null
Copy-Item "agent-dist\*" "$distDir\app" -Recurse -Force

Write-Host "5/6 Installing pruned playwright dependency..."
'{"name":"vietjet-lookup-agent-runtime","private":true,"dependencies":{"playwright":"1.63.0"}}' |
    Out-File -FilePath "$distDir\package.json" -Encoding utf8 -NoNewline
Push-Location $distDir
npm install --omit=dev --no-audit --no-fund | Out-Null
Pop-Location

Write-Host "6/6 Writing launcher + zipping..."
@'
@echo off
chcp 65001 >nul
title Tro ly tra cuu ve Vietjet
echo Dang khoi dong Tro ly tra cuu ve...
echo Giu cua so nay mo khi dung trang tra cuu ve. Dong cua so nay de tat.
echo.
"%~dp0node\node.exe" "%~dp0app\agent\server.js"
pause
'@ | Out-File -FilePath "$distDir\Chay Tro ly tra cuu ve.bat" -Encoding ascii

$zipPath = "agent-exe\TroLyTraCuuVeVietjet.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }
Compress-Archive -Path "$distDir\*" -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "Done: $zipPath"

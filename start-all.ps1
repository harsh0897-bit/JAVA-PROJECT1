Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  CYBERFUSION X // DUAL-PORTAL FORENSIC PLATFORM LAUNCHER" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

if (-not (Test-Path "backend\bin")) {
    New-Item -ItemType Directory -Force -Path "backend\bin" | Out-Null
}

Write-Host "[1/3] Compiling Java 21 Forensic Backend..." -ForegroundColor Yellow
javac -cp "backend/lib/h2.jar" -d backend/bin backend/src/com/cyberfusionx/util/*.java backend/src/com/cyberfusionx/db/*.java backend/src/com/cyberfusionx/server/*.java
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Java compilation failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "[2/3] Starting Java 21 Backend on port 8080..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "java -cp 'backend/bin;backend/lib/h2.jar' com.cyberfusionx.server.CyberFusionServer"

Write-Host "[3/3] Starting Vite Frontend on port 3000..." -ForegroundColor Green
npm run dev

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  CYBERFUSION X // STARTING JAVA 21 FORENSIC BACKEND ENGINE" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

if (-not (Test-Path "backend\bin")) {
    New-Item -ItemType Directory -Force -Path "backend\bin" | Out-Null
}

Write-Host "[1/2] Compiling Java 21 Virtual-Threaded Engine..." -ForegroundColor Yellow
javac -cp "backend/lib/h2.jar" -d backend/bin backend/src/com/cyberfusionx/util/*.java backend/src/com/cyberfusionx/db/*.java backend/src/com/cyberfusionx/server/*.java
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Compilation failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "[2/2] Launching CyberFusion Server on port 8080 (Virtual Threads + H2 DB)..." -ForegroundColor Green
java -cp "backend/bin;backend/lib/h2.jar" com.cyberfusionx.server.CyberFusionServer

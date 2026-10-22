@echo off
setlocal
echo ==================================================================
echo   CYBERFUSION X // DUAL-PORTAL FORENSIC PLATFORM LAUNCHER
echo ==================================================================

echo [1/3] Compiling Java 21 Forensic Backend...
if not exist "backend\bin" mkdir backend\bin
javac -cp "backend/lib/h2.jar" -d backend/bin backend/src/com/cyberfusionx/util/*.java backend/src/com/cyberfusionx/db/*.java backend/src/com/cyberfusionx/server/*.java
if %errorlevel% neq 0 (
    echo [ERROR] Java compilation failed!
    pause
    exit /b %errorlevel%
)

echo [2/3] Starting Java 21 Backend (Port 8080 - Virtual Threads + H2 DB)...
start "CyberFusion X - Java 21 Backend" cmd /k "java -cp backend/bin;backend/lib/h2.jar com.cyberfusionx.server.CyberFusionServer"

echo [3/3] Starting Vite Frontend (Port 3000)...
npm run dev

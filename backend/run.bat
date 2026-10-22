@echo off
setlocal
echo ==================================================================
echo   CYBERFUSION X // STARTING JAVA 21 FORENSIC BACKEND ENGINE
echo ==================================================================

if not exist "backend\bin" mkdir backend\bin

echo [1/2] Compiling Java 21 Virtual-Threaded Engine...
javac -cp "backend/lib/h2.jar" -d backend/bin backend/src/com/cyberfusionx/util/*.java backend/src/com/cyberfusionx/db/*.java backend/src/com/cyberfusionx/server/*.java
if %errorlevel% neq 0 (
    echo [ERROR] Java compilation failed!
    exit /b %errorlevel%
)

echo [2/2] Launching CyberFusion Server on port 8080 (Virtual Threads + H2 DB)...
java -cp "backend/bin;backend/lib/h2.jar" com.cyberfusionx.server.CyberFusionServer

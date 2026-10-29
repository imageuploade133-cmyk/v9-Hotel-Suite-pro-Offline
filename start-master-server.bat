@echo off
TITLE Hotel and Restaurant Local Master Server Mode

echo ==============================================================================
echo             HOTEL AND RESTAURANT LOCAL MASTER SERVER INITIALIZER
echo ==============================================================================

if "%HOST%"=="" set HOST=0.0.0.0
if "%PORT%"=="" set PORT=3000

echo [INFO] Starting Local Master Server on host %HOST% (Port %PORT%)...
echo ==============================================================================

:: Find Local IP Address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    echo [LAN NETWORK IP] http://%%a:%PORT%
)

echo ==============================================================================
echo [LAUNCHING] Next.js Application in Local Master Mode...
echo ==============================================================================

set NODE_ENV=production

:: Use CALL to prevent batch script auto-closing on Windows
if exist "node_modules\.bin\pnpm.cmd" (
    call pnpm run start:master
) else if exist "node_modules\.bin\next.cmd" (
    call npx next start -H %HOST% -p %PORT%
) else (
    call npm run start:master
)

if %ERRORLEVEL% NEQ 0 (
    echo ==============================================================================
    echo [ERROR] Server stopped with error code %ERRORLEVEL%.
    echo ==============================================================================
)

echo.
echo Press any key to exit...
pause

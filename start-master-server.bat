@echo off
TITLE Hotel & Restaurant Local Master Server Mode

echo ==============================================================================
echo             HOTEL & RESTAURANT LOCAL MASTER SERVER INITIALIZER
echo ==============================================================================

set HOST=%HOST%
if "%HOST%"=="" set HOST=127.0.0.1
set PORT=%PORT%
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

if exist "node_modules\.bin\next.cmd" (
    pnpm start -H %HOST% -p %PORT%
) else (
    npm run start -- -H %HOST% -p %PORT%
)

pause

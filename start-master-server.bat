@echo off
TITLE Hotel & Restaurant Local Master Server Mode

echo ==============================================================================
echo             HOTEL & RESTAURANT LOCAL MASTER SERVER INITIALIZER
echo ==============================================================================
echo [INFO] Starting Local Master Server bound to 0.0.0.0 (Port 3000)...
echo [INFO] All staff phones, reception PCs, and POS terminals on LAN Wi-Fi
echo        can connect using your Master PC Local IP address.
echo ==============================================================================

:: Find Local IP Address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    echo [LAN NETWORK IP] http://%%a:3000
)

echo ==============================================================================
echo [LAUNCHING] Next.js Application in Local Network Master Mode...
echo ==============================================================================

set HOST=0.0.0.0
set PORT=3000
set NODE_ENV=production

:: Start the Next.js app bound to 0.0.0.0
if exist "node_modules\.bin\next.cmd" (
    pnpm start -H 0.0.0.0 -p 3000
) else (
    npm run start -- -H 0.0.0.0 -p 3000
)

pause

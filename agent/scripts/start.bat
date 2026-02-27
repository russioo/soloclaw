@echo off
cd /d "%~dp0.."
echo.
echo === SoloClaw Agent ===
echo.
echo Starter agent server...
start "Agent" cmd /k "node dist/server.js"
timeout /t 4 /nobreak > nul
echo.
echo Starter ngrok...
echo Kopier URL'en og saet AGENT_BACKEND_URL i Vercel
echo.
start "Ngrok" cmd /k "npx ngrok http 3456"
timeout /t 5 /nobreak > nul
echo.
echo Agent: http://localhost:3456
echo Ngrok UI: http://127.0.0.1:4040
echo.
pause

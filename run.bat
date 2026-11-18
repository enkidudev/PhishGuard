@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 goto failed
where node >nul 2>&1
if errorlevel 1 goto node_required
where npm.cmd >nul 2>&1
if errorlevel 1 goto node_required
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>20 || (a===20 && b>=19) ? 0 : 1)"
if errorlevel 1 goto node_required
if not exist node_modules\.bin\next.cmd (
  call npm.cmd ci
  if errorlevel 1 goto failed
)
call npm.cmd run setup
if errorlevel 1 goto failed
call npm.cmd run setup -- --repair-local
if errorlevel 1 goto failed
set "APP_ORIGIN=http://127.0.0.1:3000"
set "COOKIE_SECURE=false"
call npm.cmd run db:push
if errorlevel 1 goto failed
call npm.cmd run demo:install
if errorlevel 1 goto failed
echo Open http://127.0.0.1:3000 when the server is ready.
call npm.cmd run dev
if errorlevel 1 goto failed
popd
exit /b 0
:node_required
echo Install Node.js 20.19 or later with npm, then run this file again.
goto pause_exit
:failed
echo PhishGuard stopped. Check the error above before restarting.
:pause_exit
pause
exit /b 1
